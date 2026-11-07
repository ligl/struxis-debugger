//! Application-level ownership of the active Replay Worker.
//!
//! This manager owns at most one worker. Production interactive Start / Restart
//! install no persistence sink; a completed Run can export an owned trajectory
//! for explicit Snapshot save. Restart never creates a replacement unless the
//! previous worker's terminal response and thread join both confirm release.

use std::sync::Arc;

use crate::{
    checkpoint::{ReplayInspectorProjection, ReplayStepResult},
    replay::{ReplayCommandGate, ReplayCommandKind},
    run::RunState,
    worker::{ReplaySnapshotData, ReplayWorker, ReplayWorkerConfig},
};

#[cfg(test)]
use crate::worker::CheckpointSink;

/// Owns the single active Run worker for one Debugger application session.
#[derive(Default)]
pub(crate) struct ReplayManager {
    active: Option<ReplayWorker>,
    /// Immutable completed trajectory retained independently of worker/runtime ownership.
    completed_result: Option<Arc<ReplaySnapshotData>>,
    /// Last user-visible processing state; may outlive the worker that produced it.
    last_state: Option<RunState>,
    last_inspector: Option<ReplayInspectorProjection>,
    gate: ReplayCommandGate,
}

impl ReplayManager {
    pub(crate) fn observation(
        &mut self,
        command: crate::observation::ObservationCommand,
    ) -> Result<crate::observation::ObservationCommandResult, crate::ipc::IpcError> {
        use crate::ipc::{IpcError, IpcErrorCode};
        let _permit = self
            .gate
            .try_enter(ReplayCommandKind::Observation)
            .map_err(|error| IpcError::new(IpcErrorCode::Conflict, error))?;
        let result = self
            .active
            .as_mut()
            .ok_or_else(|| {
                IpcError::new(
                    IpcErrorCode::InvalidState,
                    "No paused Replay runtime is available",
                )
            })?
            .observation(command)?;
        self.last_inspector = Some(result.inspector.clone());
        Ok(result)
    }

    #[must_use]
    pub(crate) fn new() -> Self {
        Self::default()
    }

    /// Starts an interactive Run without creating a SnapshotWriter.
    pub(crate) fn start_interactive(
        &mut self,
        config: ReplayWorkerConfig,
    ) -> Result<RunState, String> {
        let _permit = self.gate.try_enter(ReplayCommandKind::Start)?;
        if self.active.is_some() {
            return Err(
                "Start rejected: an active or unreleased Run is still owned by ReplayManager"
                    .to_owned(),
            );
        }
        let (worker, initial_state) = ReplayWorker::spawn_interactive(config)?;
        // A new Run context replaces the old unsaved result only after Start succeeds.
        self.completed_result = None;
        self.last_state = Some(initial_state.clone());
        self.last_inspector = None;
        self.active = Some(worker);
        Ok(initial_state)
    }

    /// Starts a new worker only when no previous worker remains owned.
    ///
    /// Compatibility orchestration API used by recording-contract tests.
    /// Production application workflows use `start_interactive` and explicit save.
    #[cfg(test)]
    pub(crate) fn start(
        &mut self,
        config: ReplayWorkerConfig,
        sink: Box<dyn CheckpointSink>,
    ) -> Result<RunState, String> {
        let _permit = self.gate.try_enter(ReplayCommandKind::Start)?;
        if self.active.is_some() {
            return Err(
                "Start rejected: an active or unreleased Run is still owned by ReplayManager"
                    .to_owned(),
            );
        }

        let (worker, initial_state) = ReplayWorker::spawn(config, sink)?;
        self.completed_result = None;
        self.last_state = Some(initial_state.clone());
        self.last_inspector = None;
        self.active = Some(worker);
        Ok(initial_state)
    }

    pub(crate) fn snapshot_data(&mut self) -> Result<Arc<ReplaySnapshotData>, String> {
        let _permit = self.gate.try_enter(ReplayCommandKind::GetState)?;
        if let Some(result) = self.completed_result.as_ref() {
            return Ok(Arc::clone(result));
        }
        self.active
            .as_mut()
            .ok_or_else(|| "Snapshot save rejected: no completed Run trajectory is available".to_owned())?
            .snapshot_data()
    }

    pub(crate) fn inspector(&mut self) -> Result<Option<ReplayInspectorProjection>, String> {
        let _permit = self.gate.try_enter(ReplayCommandKind::GetInspector)?;
        let Some(worker) = self.active.as_mut() else {
            return Ok(self.last_inspector.clone());
        };
        let projection = worker.inspector()?;
        if projection.is_some() {
            self.last_inspector = projection.clone();
        }
        Ok(projection)
    }

    /// Returns the active Run state, or the last user-visible processing result
    /// after its worker has been released. Reset clears that retained result.
    pub(crate) fn state(&mut self) -> Result<Option<RunState>, String> {
        let _permit = self.gate.try_enter(ReplayCommandKind::GetState)?;
        if let Some(worker) = self.active.as_mut() {
            let state = worker.state()?;
            self.last_state = Some(state.clone());
            return Ok(Some(state));
        }
        Ok(self.last_state.clone())
    }

    #[cfg(test)]
    pub(crate) fn step(&mut self) -> Result<RunState, String> {
        self.step_checkpoint().map(|result| result.run_state)
    }

    pub(crate) fn step_checkpoint(&mut self) -> Result<ReplayStepResult, String> {
        let _permit = self.gate.try_enter(ReplayCommandKind::Step)?;
        let step_result = self.active
            .as_mut()
            .ok_or_else(|| "Step rejected: ReplayManager has no active Run".to_owned())?
            .step_checkpoint();
        let result = match step_result {
            Ok(result) => result,
            Err(error) => {
                // Domain processing failures are terminal. Preserve their confirmed
                // state, release runtime resources internally, and free the owner slot.
                let failed_state = self.active.as_mut().and_then(|worker| worker.state().ok());
                if let Some(mut state) = failed_state.filter(|state| state.status == crate::run::RunStatus::Failed) {
                    if let Some(worker) = self.active.as_mut() {
                        match worker.dispose() {
                            Ok(released_state) => {
                                self.last_state = Some(released_state);
                                self.active = None;
                            }
                            Err(release_error) => {
                                state.failure_diagnostic = Some(format!(
                                    "{}; runtime release is unconfirmed: {release_error}",
                                    state.failure_diagnostic.clone().unwrap_or_else(|| error.clone())
                                ));
                                self.last_state = Some(state);
                                return Err(format!("{error}; Run failed and runtime release is unconfirmed: {release_error}"));
                            }
                        }
                    }
                }
                return Err(error);
            }
        };
        self.last_state = Some(result.run_state.clone());
        if result.inspector.is_some() {
            self.last_inspector = result.inspector.clone();
        }
        if matches!(result.run_state.status, crate::run::RunStatus::Completed | crate::run::RunStatus::Failed) {
            let worker = self.active.as_mut().expect("active worker remains owned during Step");
            let trajectory = if result.run_state.status == crate::run::RunStatus::Completed {
                Some(worker.snapshot_data())
            } else {
                None
            };
            // Terminal processing outcomes release runtime ownership internally.
            let release = worker.dispose();
            match (trajectory, release) {
                (Some(Ok(data)), Ok(released_state)) => {
                    self.completed_result = Some(data);
                    self.last_state = Some(result.run_state.clone());
                    debug_assert_eq!(released_state.status, crate::run::RunStatus::Disposed);
                }
                (Some(Err(error)), Ok(mut released_state)) => {
                    released_state.failure_diagnostic = Some(format!(
                        "Run processing completed, but its Checkpoint trajectory could not be retained for Snapshot save: {error}"
                    ));
                    self.last_state = Some(released_state);
                    self.active = None;
                    return Err(format!("Run completed and runtime released, but its Checkpoint trajectory could not be retained for Snapshot save: {error}"));
                }
                (None, Ok(released_state)) => {
                    self.last_state = Some(released_state);
                }
                (Some(Ok(data)), Err(error)) => {
                    self.completed_result = Some(data);
                    let mut state = result.run_state.clone();
                    state.status = crate::run::RunStatus::Failed;
                    state.failure_diagnostic = Some(format!("Run processing completed, but runtime release is unconfirmed: {error}"));
                    self.last_state = Some(state);
                    return Err(format!("Run completed, but runtime release is unconfirmed: {error}"));
                }
                (_, Err(error)) => {
                    let mut state = result.run_state.clone();
                    state.status = crate::run::RunStatus::Failed;
                    state.failure_diagnostic = Some(format!("Terminal Run runtime release is unconfirmed: {error}"));
                    self.last_state = Some(state);
                    return Err(format!("Run reached a terminal processing state, but runtime release is unconfirmed: {error}"));
                }
            }
            self.active = None;
        }
        Ok(result)
    }

    pub(crate) fn play(&mut self) -> Result<RunState, String> {
        let _permit = self.gate.try_enter(ReplayCommandKind::Play)?;
        self.active
            .as_mut()
            .ok_or_else(|| "Play rejected: ReplayManager has no active Run".to_owned())?
            .play()
    }

    pub(crate) fn pause(&mut self) -> Result<RunState, String> {
        let _permit = self.gate.try_enter(ReplayCommandKind::Pause)?;
        self.active
            .as_mut()
            .ok_or_else(|| "Pause rejected: ReplayManager has no active Run".to_owned())?
            .pause()
    }

    /// Ends the user-visible Run and releases its worker/runtime ownership.
    /// Confirmed progress remains available as a result state after cleanup.
    pub(crate) fn stop(&mut self) -> Result<RunState, String> {
        let _permit = self.gate.try_enter(ReplayCommandKind::Stop)?;
        let worker = self.active.as_mut()
            .ok_or_else(|| "Stop rejected: ReplayManager has no active Run".to_owned())?;
        if let Ok(inspector) = worker.inspector() {
            if inspector.is_some() { self.last_inspector = inspector; }
        }
        let state = worker.stop()?;
        self.last_state = Some(state.clone());
        self.active = None;
        Ok(state)
    }

    /// Internal resource cleanup for an active Run. Processing results remain
    /// independently queryable and completed trajectories remain saveable.
    pub(crate) fn dispose(&mut self) -> Result<RunState, String> {
        let _permit = self.gate.try_enter(ReplayCommandKind::Dispose)?;
        let worker = self.active
            .as_mut()
            .ok_or_else(|| "Dispose rejected: ReplayManager has no active Run".to_owned())?;
        let state = worker.dispose()?;
        self.active = None;
        self.last_state = Some(state.clone());
        Ok(state)
    }

    /// User-facing Reset: release any active runtime, then clear the current Run
    /// context and unsaved trajectory. No synthetic RunState is manufactured.
    pub(crate) fn reset(&mut self) -> Result<(), String> {
        let _permit = self.gate.try_enter(ReplayCommandKind::Dispose)?;
        if let Some(worker) = self.active.as_mut() {
            worker.dispose()?;
            self.active = None;
        }
        self.completed_result = None;
        self.last_state = None;
        self.last_inspector = None;
        Ok(())
    }

    /// Restarts an interactive Run without coupling its lifetime to SnapshotWriter.
    pub(crate) fn restart_interactive(
        &mut self,
        config: ReplayWorkerConfig,
    ) -> Result<RunState, String> {
        let _permit = self.gate.try_enter(ReplayCommandKind::Restart)?;
        if let Some(worker) = self.active.as_mut() {
            worker.dispose().map_err(|error| {
                format!("Restart aborted: previous Run release is unconfirmed: {error}")
            })?;
        }
        self.active = None;
        self.completed_result = None;
        self.last_state = None;
        self.last_inspector = None;
        let (worker, initial_state) = ReplayWorker::spawn_interactive(config)?;
        self.last_state = Some(initial_state.clone());
        self.active = Some(worker);
        Ok(initial_state)
    }

    /// Restarts from the Test Dataset beginning and processes through target_sbar_id
    /// inside the Worker, publishing only the final confirmed checkpoint.
    pub(crate) fn restart_to_sbar(
        &mut self,
        config: ReplayWorkerConfig,
        target_sbar_id: String,
    ) -> Result<ReplayStepResult, String> {
        let _permit = self.gate.try_enter(ReplayCommandKind::RestartToSBar)?;

        // Reject an invalid target before releasing or replacing the current Run.
        // This identity check uses the same immutable input lookup as Worker.
        if config.input.index_of_sbar_id(&target_sbar_id).is_none() {
            return Err(format!(
                "Restart to SBar rejected: target {target_sbar_id} is not in Test Dataset {}",
                config.input.test_dataset_id
            ));
        }

        if let Some(worker) = self.active.as_mut() {
            worker.dispose().map_err(|error| {
                format!("Restart to SBar aborted: previous Run release is unconfirmed: {error}")
            })?;
        }

        // Do not clear the prior context until the old runtime has been released.
        self.active = None;
        self.completed_result = None;
        self.last_state = None;
        self.last_inspector = None;

        let (worker, initial_state) = ReplayWorker::spawn_interactive(config)?;
        self.last_state = Some(initial_state);
        self.active = Some(worker);

        let result = self
            .active
            .as_mut()
            .expect("new Worker is installed before fast-forward")
            .fast_forward_to_sbar(target_sbar_id);

        let result = match result {
            Ok(result) => result,
            Err(error) => {
                if let Some(worker) = self.active.as_mut() {
                    if let Ok(Some(inspector)) = worker.inspector() {
                        self.last_inspector = Some(inspector);
                    }
                    match worker.state() {
                        Ok(state) if state.status == crate::run::RunStatus::Failed => {
                            match worker.dispose() {
                                Ok(_released_state) => {
                                    // Release confirms resource cleanup; it must not
                                    // overwrite the processing failure or its last
                                    // confirmed cursor with a Disposed RunState.
                                    self.last_state = Some(state);
                                    self.active = None;
                                }
                                Err(release_error) => {
                                    let mut state = state;
                                    state.failure_diagnostic = Some(format!(
                                        "{}; runtime release is unconfirmed: {release_error}",
                                        state
                                            .failure_diagnostic
                                            .clone()
                                            .unwrap_or_else(|| error.clone())
                                    ));
                                    self.last_state = Some(state);
                                    return Err(format!(
                                        "{error}; Run failed and runtime release is unconfirmed: {release_error}"
                                    ));
                                }
                            }
                        }
                        Ok(_) => {}
                        Err(state_error) => {
                            // If transport failed, Worker can no longer report its
                            // authoritative cursor. Never keep the initial Ready
                            // state visible as though fast-forward were healthy.
                            if let Some(mut state) = self.last_state.clone() {
                                state.status = crate::run::RunStatus::Failed;
                                state.failure_diagnostic = Some(format!(
                                    "{error}; latest Worker state unavailable: {state_error}; runtime release is unconfirmed"
                                ));
                                self.last_state = Some(state);
                            }
                        }
                    }
                }
                return Err(error);
            }
        };

        self.last_state = Some(result.run_state.clone());
        if result.inspector.is_some() {
            self.last_inspector = result.inspector.clone();
        }

        if result.run_state.status == crate::run::RunStatus::Completed {
            let worker = self
                .active
                .as_mut()
                .expect("active Worker remains owned until terminal cleanup");
            let trajectory = worker.snapshot_data();
            let release = worker.dispose();
            match (trajectory, release) {
                (Ok(data), Ok(_released_state)) => {
                    self.completed_result = Some(data);
                    self.last_state = Some(result.run_state.clone());
                    self.active = None;
                }
                (Err(error), Ok(released_state)) => {
                    let mut state = released_state;
                    state.failure_diagnostic = Some(format!(
                        "Run completed, but its Checkpoint trajectory could not be retained for Snapshot save: {error}"
                    ));
                    self.last_state = Some(state);
                    self.active = None;
                    return Err(format!("Run completed and runtime released, but its Checkpoint trajectory could not be retained for Snapshot save: {error}"));
                }
                (Ok(data), Err(error)) => {
                    // Trajectory completeness and runtime release are independent.
                    // Keep the confirmed full trajectory available for Snapshot save,
                    // while retaining the Worker because release is unconfirmed.
                    self.completed_result = Some(data);
                    let mut state = result.run_state.clone();
                    state.status = crate::run::RunStatus::Failed;
                    state.failure_diagnostic = Some(format!(
                        "Run processing completed, but runtime release is unconfirmed: {error}"
                    ));
                    self.last_state = Some(state);
                    return Err(format!("Run completed, but runtime release is unconfirmed: {error}"));
                }
                (Err(trajectory_error), Err(release_error)) => {
                    let mut state = result.run_state.clone();
                    state.status = crate::run::RunStatus::Failed;
                    state.failure_diagnostic = Some(format!(
                        "Run completed, but its Checkpoint trajectory could not be retained for Snapshot save: {trajectory_error}; runtime release is unconfirmed: {release_error}"
                    ));
                    self.last_state = Some(state);
                    return Err(format!(
                        "Run completed, but its Checkpoint trajectory could not be retained for Snapshot save: {trajectory_error}; runtime release is unconfirmed: {release_error}"
                    ));
                }
            }
        }
        Ok(result)
    }

    /// Compatibility restart path for recording-contract tests. Production uses
    /// `restart_interactive`; both paths require confirmed release of the old Run.
    #[cfg(test)]
    pub(crate) fn restart(
        &mut self,
        config: ReplayWorkerConfig,
        sink: Box<dyn CheckpointSink>,
    ) -> Result<RunState, String> {
        let _permit = self.gate.try_enter(ReplayCommandKind::Restart)?;
        if let Some(worker) = self.active.as_mut() {
            worker.dispose().map_err(|error| {
                format!("Restart aborted: previous Run release is unconfirmed: {error}")
            })?;
        }

        // Clear the old owner only after Dispose and join both succeeded.
        self.active = None;
        let (worker, initial_state) = ReplayWorker::spawn(config, sink)?;
        self.completed_result = None;
        self.last_state = Some(initial_state.clone());
        self.last_inspector = None;
        self.active = Some(worker);
        Ok(initial_state)
    }

    #[must_use]
    pub(crate) fn has_owned_run(&self) -> bool {
        self.active.is_some()
    }

}


#[cfg(test)]
mod tests {
    use super::ReplayManager;
    use crate::{
        catalog::OriginLoad,
        checkpoint::ReplayCheckpointProjection,
        dataset::{TestDataset, sequence_fingerprint},
        replay::LoadedInput,
        worker::{CheckpointSink, ReplayWorkerConfig},
    };
    use capitus_struxis::StruxisStateKey;
    use nautilus_model::{
        data::{Bar, BarType},
        instruments::{InstrumentAny, stubs::audusd_sim},
        types::{Price, Quantity},
    };
    use std::str::FromStr;

    struct NoopCheckpointSink;

    impl CheckpointSink for NoopCheckpointSink {
        fn initialize(
            &mut self,
            _initial_state: &crate::run::RunState,
            _effective_config: &crate::effective_config::EffectiveStruxisConfig,
        ) -> Result<(), String> {
            Ok(())
        }

        fn commit_checkpoint(
            &mut self,
            _checkpoint_index: usize,
            _sbar_id: &str,
            _projection: &ReplayCheckpointProjection,
        ) -> Result<(), String> {
            Ok(())
        }
    }

    fn worker_config(run_id: &str) -> ReplayWorkerConfig {
        let bar_type = BarType::from_str("AUD/USD.SIM-1-MINUTE-LAST-EXTERNAL")
            .expect("fixture BarType");
        let bars = (0..3)
            .map(|index| {
                let ts = 1_735_689_600_000_000_000_u64 + index * 60_000_000_000;
                Bar::new(
                    bar_type,
                    Price::from("0.65000"),
                    Price::from("0.65100"),
                    Price::from("0.64900"),
                    Price::from("0.65050"),
                    Quantity::from("100000"),
                    ts.into(),
                    ts.into(),
                )
            })
            .collect::<Vec<_>>();
        let state_key = StruxisStateKey::from_bar_type(&bar_type);
        let fingerprint = sequence_fingerprint(state_key, &bars).expect("fingerprint");
        let origin = OriginLoad {
            keyzones: None,
            origin_dataset_id: uuid::Uuid::new_v4(),
            state_key,
            sbar_sequence_fingerprint: fingerprint,
            bar_type: bar_type.to_string(),
            bars,
            structure: None,
        };
        let test = TestDataset::create(
            &origin,
            "1735689600000000000",
            "1735689720000000000",
        )
        .expect("Test Dataset");
        ReplayWorkerConfig {
            run_id: run_id.to_owned(),
            input: LoadedInput::from_test(&test).expect("LoadedInput"),
            instrument: InstrumentAny::CurrencyPair(audusd_sim()),
        }
    }

    fn sink() -> Box<dyn CheckpointSink> {
        Box::new(NoopCheckpointSink)
    }

    #[test]
    fn inspector_returns_only_the_latest_confirmed_struxis_checkpoint() {
        let mut manager = ReplayManager::new();
        manager
            .start(worker_config("manager-inspector"), sink())
            .expect("Run starts");

        assert!(manager.inspector().expect("initial Inspector query").is_none());

        let stepped = manager.step().expect("one checkpoint is processed");
        assert_eq!(stepped.processed_count, 1);
        let projection = manager.inspector()
            .expect("Inspector query")
            .expect("confirmed checkpoint is available");
        assert_eq!(projection.checkpoint_index, 0);
        assert_eq!(projection.sbar_id, stepped.cursor_sbar_id.expect("cursor exists"));
        assert_eq!(projection.sbar.sbar_id, projection.sbar_id);
        assert_eq!(projection.structure.as_ref().map(|state| state.cbar_count), Some(1));

        manager.dispose().expect("Run cleanup");
    }

    #[test]
    fn manager_owns_only_one_worker_until_dispose_is_confirmed() {
        let mut manager = ReplayManager::new();
        let initial = manager
            .start(worker_config("manager-owner-first"), sink())
            .expect("first Run starts");
        assert_eq!(initial.processed_count, 0);
        assert!(manager.has_owned_run());

        let error = manager
            .start(worker_config("manager-owner-second"), sink())
            .expect_err("second Start must not replace an owned Run");
        assert!(error.contains("active or unreleased Run"));

        let disposed = manager.dispose().expect("Dispose confirms release");
        assert_eq!(disposed.status, crate::run::RunStatus::Disposed);
        assert!(!manager.has_owned_run());
    }

    #[test]
    fn restart_releases_old_worker_before_publishing_replacement() {
        let mut manager = ReplayManager::new();
        manager
            .start(worker_config("manager-restart-old"), sink())
            .expect("old Run starts");

        let replacement = manager
            .restart(worker_config("manager-restart-new"), sink())
            .expect("Restart should release old worker before creating new one");

        assert_eq!(replacement.run_id, "manager-restart-new");
        assert_eq!(replacement.processed_count, 0);
        assert_eq!(replacement.status, crate::run::RunStatus::Ready);
        assert!(manager.has_owned_run());
        let disposed = manager.dispose().expect("replacement cleanup");
        assert_eq!(disposed.status, crate::run::RunStatus::Disposed);
    }

    #[test]
    fn completed_run_releases_worker_but_retains_snapshot_trajectory() {
        let mut manager = ReplayManager::new();
        manager.start_interactive(worker_config("manager-auto-cleanup"),).expect("Run starts");
        for expected in 1..=3 {
            let result = manager.step_checkpoint().expect("Step succeeds");
            assert_eq!(result.run_state.processed_count, expected);
        }

        assert!(!manager.has_owned_run(), "Completed Run must not retain a Worker");
        let state = manager.state().expect("state query").expect("last result remains visible");
        assert_eq!(state.status, crate::run::RunStatus::Completed);
        assert_eq!(state.processed_count, 3);

        let snapshot = manager.snapshot_data().expect("completed trajectory remains saveable");
        assert_eq!(snapshot.state.status, crate::run::RunStatus::Completed);
        assert_eq!(snapshot.checkpoints.len(), 3);
    }

    #[test]
    fn restart_to_last_sbar_retains_completed_trajectory_for_snapshot_save() {
        let mut manager = ReplayManager::new();
        let result = manager
            .restart_to_sbar(
                worker_config("manager-restart-to-last"),
                "1735689720000000000".to_owned(),
            )
            .expect("Restart to final SBar succeeds");

        assert_eq!(result.run_state.status, crate::run::RunStatus::Completed);
        assert_eq!(result.run_state.processed_count, 3);
        assert_eq!(
            result.run_state.cursor_sbar_id.as_deref(),
            Some("1735689720000000000")
        );
        assert!(!manager.has_owned_run(), "Completed fast-forward releases Worker");

        let snapshot = manager
            .snapshot_data()
            .expect("completed fast-forward trajectory remains saveable");
        assert_eq!(snapshot.state.status, crate::run::RunStatus::Completed);
        assert_eq!(snapshot.checkpoints.len(), 3);
    }

    #[test]
    fn invalid_restart_to_sbar_target_preserves_the_current_run() {
        let mut manager = ReplayManager::new();
        let initial = manager
            .start_interactive(worker_config("manager-invalid-target-old"))
            .expect("existing Run starts");
        assert_eq!(initial.status, crate::run::RunStatus::Ready);

        let error = manager
            .restart_to_sbar(
                worker_config("manager-invalid-target-replacement"),
                "not-a-real-sbar".to_owned(),
            )
            .expect_err("invalid target must be rejected before replacing the current Run");

        assert!(error.contains("not in Test Dataset"));
        assert!(manager.has_owned_run(), "the old Worker must remain owned");
        let current = manager
            .state()
            .expect("old Run remains queryable")
            .expect("old Run state remains present");
        assert_eq!(current.run_id, "manager-invalid-target-old");
        assert_eq!(current.status, crate::run::RunStatus::Ready);
        assert_eq!(current.processed_count, 0);

        manager.dispose().expect("old Run can still be disposed");
    }

    #[test]
    fn reset_clears_completed_result_and_run_state() {
        let mut manager = ReplayManager::new();
        manager.start_interactive(worker_config("manager-reset"),).expect("Run starts");
        for _ in 0..3 {
            manager.step_checkpoint().expect("Step succeeds");
        }
        assert!(manager.snapshot_data().is_ok());

        manager.reset().expect("Reset clears the completed context");
        assert!(!manager.has_owned_run());
        assert!(manager.state().expect("state query").is_none());
        assert!(manager.snapshot_data().is_err());
    }


    #[test]
    fn stop_releases_runtime_and_allows_starting_a_new_run() {
        let mut manager = ReplayManager::new();
        manager.start_interactive(worker_config("manager-stop-old")).expect("first Run starts");
        manager.step_checkpoint().expect("one checkpoint succeeds");

        let stopped = manager.stop().expect("Stop ends and releases the Run");
        assert_eq!(stopped.status, crate::run::RunStatus::Disposed);
        assert!(!manager.has_owned_run());

        let next = manager.start_interactive(worker_config("manager-stop-new"))
            .expect("Start creates a new Run after Stop");
        assert_eq!(next.status, crate::run::RunStatus::Ready);
        assert_eq!(next.processed_count, 0);
        manager.reset().expect("Reset cleans up the second Run");
    }

    #[test]
    fn reset_releases_an_active_run_and_clears_its_state() {
        let mut manager = ReplayManager::new();
        manager.start_interactive(worker_config("manager-reset-active")).expect("Run starts");
        manager.step_checkpoint().expect("one checkpoint succeeds");
        assert!(manager.has_owned_run());

        manager.reset().expect("Reset stops and releases the active Run");
        assert!(!manager.has_owned_run());
        assert!(manager.state().expect("state query").is_none());
        assert!(manager.snapshot_data().is_err());
    }

}
