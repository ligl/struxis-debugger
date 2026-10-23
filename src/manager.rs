//! Application-level ownership of the active Replay Worker.
//!
//! This manager owns at most one worker. Production interactive Start / Restart
//! install no persistence sink; a completed Run can export an owned trajectory
//! for explicit Snapshot save. Restart never creates a replacement unless the
//! previous worker's terminal response and thread join both confirm release.

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
    gate: ReplayCommandGate,
}

impl ReplayManager {
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
        self.active = Some(worker);
        Ok(initial_state)
    }

    pub(crate) fn snapshot_data(&mut self) -> Result<ReplaySnapshotData, String> {
        let _permit = self.gate.try_enter(ReplayCommandKind::GetState)?;
        self.active
            .as_mut()
            .ok_or_else(|| "Snapshot save rejected: ReplayManager has no active Run".to_owned())?
            .snapshot_data()
    }

    pub(crate) fn inspector(&mut self) -> Result<Option<ReplayInspectorProjection>, String> {
        let _permit = self.gate.try_enter(ReplayCommandKind::GetInspector)?;
        let Some(worker) = self.active.as_mut() else {
            return Ok(None);
        };
        worker.inspector()
    }

    /// Returns the authoritative Run state when a Run is owned, or `None`
    /// when Replay has not started a Run in this application session.
    pub(crate) fn state(&mut self) -> Result<Option<RunState>, String> {
        let _permit = self.gate.try_enter(ReplayCommandKind::GetState)?;
        self.active.as_mut().map(ReplayWorker::state).transpose()
    }

    pub(crate) fn step(&mut self) -> Result<RunState, String> {
        self.step_checkpoint().map(|result| result.run_state)
    }

    pub(crate) fn step_checkpoint(&mut self) -> Result<ReplayStepResult, String> {
        let _permit = self.gate.try_enter(ReplayCommandKind::Step)?;
        self.active
            .as_mut()
            .ok_or_else(|| "Step rejected: ReplayManager has no active Run".to_owned())?
            .step_checkpoint()
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

    /// Requests safe-boundary stop. The worker remains owned so its confirmed
    /// terminal state can still be queried and so Restart can enforce cleanup.
    pub(crate) fn stop(&mut self) -> Result<RunState, String> {
        let _permit = self.gate.try_enter(ReplayCommandKind::Stop)?;
        self.active
            .as_mut()
            .ok_or_else(|| "Stop rejected: ReplayManager has no active Run".to_owned())?
            .stop()
    }

    /// Explicitly disposes and then releases the manager's ownership slot.
    ///
    /// The slot is cleared only after worker Dispose returns a state and join
    /// succeeds. Any error leaves the worker owned and blocks a subsequent Start.
    pub(crate) fn dispose(&mut self) -> Result<RunState, String> {
        let _permit = self.gate.try_enter(ReplayCommandKind::Dispose)?;
        let worker = self
            .active
            .as_mut()
            .ok_or_else(|| "Dispose rejected: ReplayManager has no active Run".to_owned())?;
        let state = worker.dispose()?;
        self.active = None;
        Ok(state)
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
        let (worker, initial_state) = ReplayWorker::spawn_interactive(config)?;
        self.active = Some(worker);
        Ok(initial_state)
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
}
