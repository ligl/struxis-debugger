//! Application-level ownership of the active Replay Worker.
//!
//! This manager owns at most one worker. It deliberately accepts a CheckpointSink
//! from its caller: production Start must not be wired until a persistent
//! SnapshotWriter is available. Restart never creates a replacement unless the
//! previous worker's terminal response and thread join both confirm release.

use crate::{
    replay::{ReplayCommandGate, ReplayCommandKind},
    run::RunState,
    worker::{CheckpointSink, ReplayWorker, ReplayWorkerConfig},
};

/// Owns the single active Run worker for one Debugger application session.
#[derive(Default)]
pub struct ReplayManager {
    active: Option<ReplayWorker>,
    gate: ReplayCommandGate,
}

impl ReplayManager {
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    /// Starts a new worker only when no previous worker remains owned.
    ///
    /// This is an internal orchestration API, not a production Tauri command.
    /// Its caller must provide the real persistent SnapshotWriter before it can
    /// be connected to the production application workflow.
    pub fn start(
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

    pub fn state(&mut self) -> Result<RunState, String> {
        let _permit = self.gate.try_enter(ReplayCommandKind::GetState)?;
        self.active
            .as_mut()
            .ok_or_else(|| "GetState rejected: ReplayManager has no active Run".to_owned())?
            .state()
    }

    pub fn step(&mut self) -> Result<RunState, String> {
        let _permit = self.gate.try_enter(ReplayCommandKind::Step)?;
        self.active
            .as_mut()
            .ok_or_else(|| "Step rejected: ReplayManager has no active Run".to_owned())?
            .step()
    }

    pub fn play(&mut self) -> Result<RunState, String> {
        let _permit = self.gate.try_enter(ReplayCommandKind::Play)?;
        self.active
            .as_mut()
            .ok_or_else(|| "Play rejected: ReplayManager has no active Run".to_owned())?
            .play()
    }

    pub fn pause(&mut self) -> Result<RunState, String> {
        let _permit = self.gate.try_enter(ReplayCommandKind::Pause)?;
        self.active
            .as_mut()
            .ok_or_else(|| "Pause rejected: ReplayManager has no active Run".to_owned())?
            .pause()
    }

    /// Requests safe-boundary stop. The worker remains owned so its confirmed
    /// terminal state can still be queried and so Restart can enforce cleanup.
    pub fn stop(&mut self) -> Result<RunState, String> {
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
    pub fn dispose(&mut self) -> Result<RunState, String> {
        let _permit = self.gate.try_enter(ReplayCommandKind::Dispose)?;
        let worker = self
            .active
            .as_mut()
            .ok_or_else(|| "Dispose rejected: ReplayManager has no active Run".to_owned())?;
        let state = worker.dispose()?;
        self.active = None;
        Ok(state)
    }

    /// Disposes the previous Run before creating a replacement from the caller's
    /// fixed Test input. A release failure leaves the old worker owned and blocks
    /// the replacement; it is never silently overwritten.
    pub fn restart(
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
    pub fn has_owned_run(&self) -> bool {
        self.active.is_some()
    }
}
