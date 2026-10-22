//! Thread-owned Nautilus replay runtime and single-SBar Step execution.
//!
//! All BacktestEngine / Cache / Struxis / Strategy objects are constructed and
//! used inside the worker thread. Only owned input, instrument metadata,
//! checkpoint projections, and RunState cross the thread boundary.
//!
//! Interactive production Runs install no CheckpointSink and retain immutable
//! owned checkpoints in memory. SnapshotWriter is invoked only by an explicit
//! save operation after completion; it never participates in Start or Step.

use std::{
    sync::mpsc::{self, Receiver, SyncSender},
    thread::{self, JoinHandle},
};

#[cfg(test)]
use std::sync::{Arc, Mutex};

use capitus_strategy::StruxisDemo;
use capitus_struxis::{NautilusRuntime, Struxis, StruxisConfig};
use nautilus_backtest::{
    config::{BacktestEngineConfig, SimulatedVenueConfig},
    engine::BacktestEngine,
};
use nautilus_execution::models::fee::{FeeModelAny, MakerTakerFeeModel};
use nautilus_model::{
    data::{BarType, Data},
    enums::{AccountType, BookType, OmsType},
    identifiers::{StrategyId, Venue},
    instruments::{Instrument, InstrumentAny},
    types::Money,
};

use crate::{
    checkpoint::{OwnedCheckpoint, ReplayCheckpointProjection, ReplayInspectorProjection},
    effective_config::EffectiveStruxisConfig,
    replay::{LoadedInput, ReplayCommandGate, ReplayCommandKind},
    run::{RunState, RunStatus},
};

/// Legacy recording contract retained for isolated writer tests and internal
/// compatibility paths. Production interactive Replay uses `spawn_interactive`
/// with a volatile sink; SnapshotWriter is invoked only by explicit save.
pub(crate) trait CheckpointSink: Send + 'static {
    fn initialize(
        &mut self,
        initial_state: &RunState,
        effective_config: &EffectiveStruxisConfig,
    ) -> Result<(), String>;

    fn commit_checkpoint(
        &mut self,
        checkpoint_index: usize,
        sbar_id: &str,
        projection: &ReplayCheckpointProjection,
    ) -> Result<(), String>;

    /// Finalizes durable storage after the last checkpoint has been confirmed.
    fn finalize(&mut self, _completed_state: &RunState) -> Result<(), String> {
        Ok(())
    }

    /// Records a durable failure status when persistence has already started.
    fn fail(&mut self, _diagnostic: &str) -> Result<(), String> {
        Ok(())
    }
}

/// Owned configuration passed into the worker thread.
///
/// Instrument is immutable Nautilus market metadata, not a live runtime
/// resource. The engine, Cache, Strategy and Struxis are created only after
/// the worker thread starts.
pub(crate) struct ReplayWorkerConfig {
    pub(crate) run_id: String,
    pub(crate) input: LoadedInput,
    pub(crate) instrument: InstrumentAny,
}

enum WorkerCommand {
    GetState(SyncSender<RunState>),
    GetInspector(SyncSender<Option<ReplayInspectorProjection>>),
    SnapshotData(SyncSender<Result<ReplaySnapshotData, String>>),
    Step(SyncSender<Result<RunState, String>>),
    Stop(SyncSender<Result<RunState, String>>),
    Dispose(SyncSender<Result<RunState, String>>),
}

/// Stable, owned data exported only after a Run has completed.
pub(crate) struct ReplaySnapshotData {
    pub(crate) state: RunState,
    pub(crate) input: LoadedInput,
    pub(crate) instrument_id: String,
    pub(crate) effective_config: EffectiveStruxisConfig,
    pub(crate) checkpoints: Vec<OwnedCheckpoint>,
}

/// Handle to the worker. It never exposes Nautilus runtime objects.
pub(crate) struct ReplayWorker {
    commands: SyncSender<WorkerCommand>,
    command_gate: ReplayCommandGate,
    join: Option<JoinHandle<()>>,
    terminal_state: Option<RunState>,
}

impl ReplayWorker {
    /// Starts an interactive Run without creating or initializing a SnapshotWriter.
    /// No persistence sink is installed on the production Start / Step path.
    pub(crate) fn spawn_interactive(
        config: ReplayWorkerConfig,
    ) -> Result<(Self, RunState), String> {
        Self::spawn_inner(config, None)
    }

    /// Compatibility entry point for isolated recording-contract tests.
    pub(crate) fn spawn(
        config: ReplayWorkerConfig,
        sink: Box<dyn CheckpointSink>,
    ) -> Result<(Self, RunState), String> {
        Self::spawn_inner(config, Some(sink))
    }

    fn spawn_inner(
        config: ReplayWorkerConfig,
        mut sink: Option<Box<dyn CheckpointSink>>,
    ) -> Result<(Self, RunState), String> {
        let (command_tx, command_rx) = mpsc::sync_channel(0);
        let (ready_tx, ready_rx) = mpsc::sync_channel(0);

        let join = thread::Builder::new()
            .name(format!("struxis-replay-{}", config.run_id))
            .spawn(move || {
                let session = WorkerSession::initialize(config, sink.as_deref_mut());
                match session {
                    Ok(mut session) => {
                        if ready_tx.send(Ok(session.state.clone())).is_err() {
                            session.engine_dispose();
                            return;
                        }
                        worker_loop(session, sink, command_rx);
                    }
                    Err(error) => {
                        let _ = ready_tx.send(Err(error));
                    }
                }
            })
            .map_err(|error| format!("Failed to spawn Replay worker: {error}"))?;

        let initial_state = match ready_rx.recv() {
            Ok(Ok(state)) => state,
            Ok(Err(error)) => {
                let _ = join.join();
                return Err(error);
            }
            Err(error) => {
                let _ = join.join();
                return Err(format!("Replay worker exited during initialization: {error}"));
            }
        };

        Ok((
            Self {
                commands: command_tx,
                command_gate: ReplayCommandGate::new(),
                join: Some(join),
                terminal_state: None,
            },
            initial_state,
        ))
    }

    /// Returns the latest Struxis-owned checkpoint projection, if any.
    /// The query is handled at a worker boundary and never exposes live runtime objects.
    pub(crate) fn inspector(&mut self) -> Result<Option<ReplayInspectorProjection>, String> {
        if self.terminal_state.is_some() {
            return Ok(None);
        }
        let _permit = self.command_gate.try_enter(ReplayCommandKind::GetInspector)?;
        let (reply_tx, reply_rx) = mpsc::sync_channel(0);
        if let Err(error) = self.commands.send(WorkerCommand::GetInspector(reply_tx)) {
            let detail = format!("Replay worker is unavailable during GetInspector: {error}");
            return Err(self.join_after_transport_failure(detail));
        }
        reply_rx.recv().map_err(|error| {
            let detail = format!("Replay worker dropped GetInspector response: {error}");
            self.join_after_transport_failure(detail)
        })
    }

    /// Exports a stable copy of a Completed Run's trajectory for explicit saving.
    /// No active Nautilus / Struxis runtime objects cross this boundary.
    pub(crate) fn snapshot_data(&mut self) -> Result<ReplaySnapshotData, String> {
        if self.terminal_state.is_some() {
            return Err("Snapshot save rejected: Run runtime has already been released".into());
        }
        let _permit = self.command_gate.try_enter(ReplayCommandKind::GetState)?;
        let (reply_tx, reply_rx) = mpsc::sync_channel(0);
        if let Err(error) = self.commands.send(WorkerCommand::SnapshotData(reply_tx)) {
            let detail = format!("Replay worker is unavailable during SnapshotData: {error}");
            return Err(self.join_after_transport_failure(detail));
        }
        match reply_rx.recv() {
            Ok(result) => result,
            Err(error) => {
                let detail = format!("Replay worker dropped SnapshotData response: {error}");
                Err(self.join_after_transport_failure(detail))
            }
        }
    }

    /// Returns the latest authoritative RunState observed at a worker boundary.
    ///
    /// During Play, the query is handled between SBar checkpoints. This also
    /// makes asynchronous processing failures observable without issuing a
    /// state-changing command such as Stop or Dispose.
    pub(crate) fn state(&mut self) -> Result<RunState, String> {
        if let Some(state) = &self.terminal_state {
            return Ok(state.clone());
        }
        let _permit = self.command_gate.try_enter(ReplayCommandKind::GetState)?;
        let (reply_tx, reply_rx) = mpsc::sync_channel(0);
        if let Err(error) = self.commands.send(WorkerCommand::GetState(reply_tx)) {
            let detail = format!("Replay worker is unavailable during GetState: {error}");
            return Err(self.join_after_transport_failure(detail));
        }
        reply_rx.recv().map_err(|error| {
            let detail = format!("Replay worker dropped GetState response: {error}");
            self.join_after_transport_failure(detail)
        })
    }

    /// Processes exactly one next Test SBar and returns after its checkpoint
    /// sink commit and Run progress confirmation.
    pub(crate) fn step(&mut self) -> Result<RunState, String> {
        let _permit = self.command_gate
            .try_enter(ReplayCommandKind::Step)?;
        let (reply_tx, reply_rx) = mpsc::sync_channel(0);
        if let Err(error) = self.commands.send(WorkerCommand::Step(reply_tx)) {
            let detail = format!("Replay worker is unavailable during Step: {error}");
            return Err(self.join_after_transport_failure(detail));
        }
        match reply_rx.recv() {
            Ok(result) => result,
            Err(error) => {
                let detail = format!("Replay worker dropped Step response: {error}");
                Err(self.join_after_transport_failure(detail))
            }
        }
    }

    /// Legacy IPC compatibility only. Playback is scheduled by the frontend
    /// through serialized Step commands; the worker cannot enter a play loop.
    pub(crate) fn play(&mut self) -> Result<RunState, String> {
        Err("Play is frontend-owned; use serialized Step commands".to_owned())
    }

    /// Legacy IPC compatibility only. Pause stops frontend scheduling and does
    /// not represent a backend RunState transition.
    pub(crate) fn pause(&mut self) -> Result<RunState, String> {
        Err("Pause is frontend-owned; stop scheduling further Step commands".to_owned())
    }

    /// Stops the Run at a safe checkpoint boundary and releases its runtime.
    pub(crate) fn stop(&mut self) -> Result<RunState, String> {
        self.send_terminal_command(ReplayCommandKind::Stop, WorkerCommand::Stop)
    }

    fn send_terminal_command(
        &mut self,
        kind: ReplayCommandKind,
        command: fn(SyncSender<Result<RunState, String>>) -> WorkerCommand,
    ) -> Result<RunState, String> {
        if let Some(state) = &self.terminal_state {
            return Ok(state.clone());
        }
        let _permit = self.command_gate.try_enter(kind)?;
        let (reply_tx, reply_rx) = mpsc::sync_channel(0);
        if let Err(error) = self.commands.send(command(reply_tx)) {
            let detail = format!("Replay worker is unavailable during {kind:?}: {error}");
            return Err(self.join_after_transport_failure(detail));
        }
        let result = match reply_rx.recv() {
            Ok(result) => result,
            Err(error) => {
                let detail = format!("Replay worker dropped {kind:?} response: {error}");
                return Err(self.join_after_transport_failure(detail));
            }
        };
        if let Some(join) = self.join.take() {
            join.join().map_err(|_| {
                format!(
                    "Replay worker panicked while handling {kind:?}; resource release is unconfirmed"
                )
            })?;
        }
        if let Ok(state) = &result {
            self.terminal_state = Some(state.clone());
        }
        result
    }

    /// Releases Run-owned resources on the worker thread and joins it.
    pub(crate) fn dispose(&mut self) -> Result<RunState, String> {
        if let Some(state) = &self.terminal_state {
            return Ok(state.clone());
        }
        let _permit = self.command_gate
            .try_enter(ReplayCommandKind::Dispose)?;
        let (reply_tx, reply_rx) = mpsc::sync_channel(0);
        if let Err(error) = self.commands.send(WorkerCommand::Dispose(reply_tx)) {
            let detail = format!("Replay worker is unavailable during Dispose: {error}");
            return Err(self.join_after_transport_failure(detail));
        }
        let result = match reply_rx.recv() {
            Ok(result) => result,
            Err(error) => {
                let detail = format!("Replay worker dropped Dispose response: {error}");
                return Err(self.join_after_transport_failure(detail));
            }
        };
        if let Some(join) = self.join.take() {
            join.join().map_err(|_| {
                "Replay worker panicked while disposing resources; resource release is unconfirmed"
                    .to_owned()
            })?;
        }
        if let Ok(state) = &result {
            self.terminal_state = Some(state.clone());
        }
        result
    }

    /// Reap a worker that can no longer answer commands. A successful join
    /// does not prove runtime cleanup succeeded: without the Dispose response,
    /// the caller must treat resource release as unconfirmed.
    fn join_after_transport_failure(&mut self, detail: String) -> String {
        match self.join.take() {
            Some(join) => match join.join() {
                Ok(()) => format!(
                    "{detail}; worker thread exited but resource release is unconfirmed"
                ),
                Err(_) => format!(
                    "{detail}; worker panicked and resource release is unconfirmed"
                ),
            },
            None => format!("{detail}; worker thread was already joined"),
        }
    }
}

impl Drop for ReplayWorker {
    fn drop(&mut self) {
        if let Some(join) = self.join.take() {
            // Best-effort fail-safe cleanup. Explicit Dispose remains the only
            // path that can report a confirmed RunState::Disposed to callers.
            // A buffered reply prevents the worker from blocking forever
            // while sending Dispose's response when Drop does not read it.
            let (reply_tx, _reply_rx) = mpsc::sync_channel(1);
            let _ = self.commands.send(WorkerCommand::Dispose(reply_tx));
            let _ = join.join();
        }
    }
}

struct WorkerSession {
    engine: BacktestEngine,
    struxis: Struxis,
    input: LoadedInput,
    state: RunState,
    next_index: usize,
    latest_inspector: Option<ReplayInspectorProjection>,
    owned_checkpoints: Vec<OwnedCheckpoint>,
    instrument_id: String,
    effective_config: EffectiveStruxisConfig,
}

impl WorkerSession {
    fn initialize(
        config: ReplayWorkerConfig,
        mut sink: Option<&mut dyn CheckpointSink>,
    ) -> Result<Self, String> {
        use std::str::FromStr;

        if config.input.bars.is_empty() {
            return Err("Replay worker cannot start with an empty Test input".into());
        }
        let actual_fingerprint = crate::dataset::sequence_fingerprint(
            config.input.state_key,
            &config.input.bars,
        )
        .map_err(|error| format!("Replay worker input fingerprint failed: {error}"))?;
        if actual_fingerprint != config.input.sbar_sequence_fingerprint {
            return Err(format!(
                "Replay worker input fingerprint mismatch: expected={}, actual={actual_fingerprint}",
                config.input.sbar_sequence_fingerprint
            ));
        }

        let bar_type = BarType::from_str(&config.input.bar_type)
            .map_err(|error| format!("Invalid Replay BarType: {error}"))?;
        if config.input.bars.iter().any(|bar| bar.bar_type != bar_type) {
            return Err("Replay worker input contains a Bar with a different BarType".into());
        }
        if config.instrument.id() != bar_type.instrument_id() {
            return Err(format!(
                "Replay instrument mismatch: instrument={}, BarType={}",
                config.instrument.id(),
                bar_type
            ));
        }

        let engine_config = BacktestEngineConfig {
            logging: nautilus_common::logging::logger::LoggerConfig::from_spec("stdout=Error")
                .map_err(|error| format!("Replay logger configuration failed: {error}"))?,
            ..BacktestEngineConfig::default()
        };
        let mut engine = BacktestEngine::new(engine_config)
            .map_err(|error| format!("Replay BacktestEngine creation failed: {error}"))?;

        let struxis_config = StruxisConfig::builder().enable_structure(true).build();
        let effective_config = EffectiveStruxisConfig::from_struxis_config(&struxis_config);
        let setup = (|| -> anyhow::Result<Struxis> {
            let instrument_id = config.instrument.id();
            engine.add_venue(
                SimulatedVenueConfig::builder()
                    .venue(Venue::new(instrument_id.venue.as_str()))
                    .oms_type(OmsType::Hedging)
                    .account_type(AccountType::Margin)
                    .book_type(BookType::L1_MBP)
                    .starting_balances(vec![Money::from("1_000_000 USD")])
                    .fee_model(FeeModelAny::MakerTaker(MakerTakerFeeModel::zero()).into())
                    .build()?,
            )?;
            engine.add_instrument(&config.instrument)?;

            let runtime = NautilusRuntime::new(engine.kernel().cache.clone());
            let struxis = Struxis::new(struxis_config, runtime);
            let strategy = StruxisDemo::new(
                struxis.clone(),
                StrategyId::from(format!("STRUXIS-DEBUGGER-{}", config.run_id)),
                vec![bar_type],
            )?;
            engine.add_strategy(strategy)?;
            Ok(struxis)
        })();

        let struxis = match setup {
            Ok(struxis) => struxis,
            Err(error) => {
                engine.dispose();
                return Err(format!("Replay runtime setup failed: {error}"));
            }
        };

        let instrument_id = config.instrument.id().to_string();
        let state = RunState::ready(
            config.run_id,
            config.input.test_dataset_id.clone(),
            config.input.sbar_sequence_fingerprint.clone(),
            config.input.bars.len(),
        )?;
        if let Some(sink) = sink.as_deref_mut() {
            if let Err(error) = sink.initialize(&state, &effective_config) {
                engine.dispose();
                return Err(format!("Snapshot Recording initialization failed: {error}"));
            }
        }

        let checkpoint_capacity = config.input.bars.len();
        Ok(Self {
            engine,
            struxis,
            input: config.input,
            state,
            next_index: 0,
            latest_inspector: None,
            owned_checkpoints: Vec::with_capacity(checkpoint_capacity),
            instrument_id,
            effective_config,
        })
    }

    /// Stops at the current safe boundary and releases the runtime.
    ///
    /// If the final checkpoint has already committed, Completed takes
    /// precedence over Stop: release runtime resources but preserve the
    /// completed processing result in the returned state.
    fn stop(&mut self) -> Result<RunState, String> {
        self.release_runtime_and_finalize_status()
    }

    fn dispose(&mut self) -> Result<RunState, String> {
        self.release_runtime_and_finalize_status()
    }

    /// Resource release finalizes the lifecycle status as Disposed. Processing
    /// facts remain available independently through processed_count,
    /// input_count, cursor_sbar_id, and failure_diagnostic.
    fn release_runtime_and_finalize_status(&mut self) -> Result<RunState, String> {
        self.engine_dispose();
        self.state.dispose()?;
        Ok(self.state.clone())
    }

    fn step(
        &mut self,
        sink: Option<&mut dyn CheckpointSink>,
    ) -> Result<RunState, String> {
        let mut sink = sink;
        if !matches!(self.state.status, RunStatus::Ready | RunStatus::Paused) {
            return Err(format!(
                "Step is invalid while Run {} is {:?}",
                self.state.run_id, self.state.status
            ));
        }
        let bar = self.input.bars.get(self.next_index)
            .cloned()
            .ok_or_else(|| "Replay has no unprocessed Test SBar remaining".to_owned())?;

        self.engine.clear_data();
        if let Err(error) = self.engine
            .add_data(vec![Data::Bar(bar.clone())], None, true, true)
            .and_then(|()| self.engine.run(None, None, None, true))
        {
            let diagnostic = format!(
                "Nautilus Step failed at input_index={} sbar_id={}: {error}",
                self.next_index,
                bar.ts_event
            );
            let _ = self.state.fail(diagnostic.clone());
            notify_sink_failure(&mut sink, &diagnostic);
            return Err(diagnostic);
        }

        let projection = {
            let Some(state_view) = self.struxis.state(self.input.state_key) else {
                let diagnostic = format!(
                    "Struxis state {:?} missing after processing sbar_id={}",
                    self.input.state_key, bar.ts_event
                );
                let _ = self.state.fail(diagnostic.clone());
                notify_sink_failure(&mut sink, &diagnostic);
                return Err(diagnostic);
            };
            if state_view.last_ts_event() != Some(bar.ts_event) {
                let diagnostic = format!(
                    "Struxis checkpoint mismatch at input_index={}: expected ts_event={}, actual={:?}",
                    self.next_index,
                    bar.ts_event,
                    state_view.last_ts_event()
                );
                let _ = self.state.fail(diagnostic.clone());
                notify_sink_failure(&mut sink, &diagnostic);
                return Err(diagnostic);
            }
            ReplayCheckpointProjection::from_state_view(&state_view)
        };

        let expected_count = self.next_index + 1;
        if projection.sbar_count != expected_count {
            let diagnostic = format!(
                "Struxis SBar prefix mismatch at input_index={}: expected_count={}, actual_count={}",
                self.next_index, expected_count, projection.sbar_count
            );
            let _ = self.state.fail(diagnostic.clone());
            notify_sink_failure(&mut sink, &diagnostic);
            return Err(diagnostic);
        }

        let commit_result = match sink.as_deref_mut() {
            Some(sink) => sink.commit_checkpoint(self.next_index, &bar.ts_event.to_string(), &projection),
            None => Ok(()),
        };
        if let Err(error) = commit_result {
            let diagnostic = format!(
                "Checkpoint sink commit failed at input_index={} sbar_id={}: {error}",
                self.next_index, bar.ts_event
            );
            let _ = self.state.fail(diagnostic.clone());
            notify_sink_failure(&mut sink, &diagnostic);
            return Err(diagnostic);
        }

        let sbar_id = bar.ts_event.to_string();
        let owned_checkpoint = OwnedCheckpoint::from_projection(
            self.next_index,
            &sbar_id,
            &projection,
        )?;
        let inspector = projection.inspector_projection(self.next_index, &sbar_id)?;

        self.state.confirm_checkpoint(sbar_id)?;
        self.owned_checkpoints.push(owned_checkpoint);
        self.latest_inspector = Some(inspector);
        self.next_index += 1;
        if self.owned_checkpoints.len() != self.state.processed_count {
            let diagnostic = format!(
                "Owned Checkpoint trajectory mismatch: retained={}, processed={}",
                self.owned_checkpoints.len(),
                self.state.processed_count
            );
            let _ = self.state.fail(diagnostic.clone());
            return Err(diagnostic);
        }

        if self.state.status == RunStatus::Completed {
            if let Err(error) = self.engine.end() {
                let diagnostic = format!("BacktestEngine finalization failed after final checkpoint: {error}");
                let _ = self.state.fail(diagnostic.clone());
                notify_sink_failure(&mut sink, &diagnostic);
                return Err(diagnostic);
            }
            let finalize_result = match sink.as_deref_mut() {
                Some(sink) => sink.finalize(&self.state),
                None => Ok(()),
            };
            if let Err(error) = finalize_result {
                let diagnostic = format!("Snapshot finalization failed: {error}");
                let _ = self.state.fail(diagnostic.clone());
                notify_sink_failure(&mut sink, &diagnostic);
                return Err(diagnostic);
            }
        }

        Ok(self.state.clone())
    }

    /// Nautilus exposes BacktestEngine::dispose as an infallible, void API.
    /// It performs synchronous teardown, but logs callback-cleanup failures
    /// internally instead of returning them. Therefore this confirms that the
    /// disposal routine returned, not that every internal callback was cleared.
    fn engine_dispose(&mut self) {
        self.engine.dispose();
    }
}

/// The worker is command-driven only. It never advances SBar state unless a
/// single Step command has been received; continuous Play is frontend-owned.
fn worker_loop(
    mut session: WorkerSession,
    mut sink: Option<Box<dyn CheckpointSink>>,
    commands: Receiver<WorkerCommand>,
) {
    loop {
        let command = match commands.recv() {
            Ok(command) => command,
            Err(_) => {
                let _ = session.dispose();
                return;
            }
        };
        match command {
            WorkerCommand::GetState(reply) => {
                let _ = reply.send(session.state.clone());
            }
            WorkerCommand::GetInspector(reply) => {
                let _ = reply.send(session.latest_inspector.clone());
            }
            WorkerCommand::SnapshotData(reply) => {
                let result = if session.state.status != RunStatus::Completed {
                    Err(format!(
                        "Snapshot save requires Completed Run, got {:?}",
                        session.state.status
                    ))
                } else if session.owned_checkpoints.len() != session.input.bars.len() {
                    Err(format!(
                        "Completed Run trajectory is incomplete: input={}, checkpoints={}",
                        session.input.bars.len(),
                        session.owned_checkpoints.len()
                    ))
                } else {
                    Ok(ReplaySnapshotData {
                        state: session.state.clone(),
                        input: session.input.clone(),
                        instrument_id: session.instrument_id.clone(),
                        effective_config: session.effective_config.clone(),
                        checkpoints: session.owned_checkpoints.clone(),
                    })
                };
                let _ = reply.send(result);
            }
            WorkerCommand::Step(reply) => {
                let _ = reply.send(session.step(sink.as_deref_mut()));
            }
            WorkerCommand::Stop(reply) => {
                let result = session.stop();
                let _ = reply.send(result);
                return;
            }
            WorkerCommand::Dispose(reply) => {
                let result = session.dispose();
                let _ = reply.send(result);
                return;
            }
        }
    }
}

fn notify_sink_failure(
    sink: &mut Option<&mut dyn CheckpointSink>,
    diagnostic: &str,
) {
    if let Some(sink) = sink.as_deref_mut() {
        let _ = sink.fail(diagnostic);
    }
}

/// Test-only in-memory sink. It intentionally is not a production persistence
/// implementation and cannot be wired to a production Start command.
#[cfg(test)]
#[derive(Clone, Default)]
struct MemoryCheckpointSink {
    checkpoints: Arc<Mutex<Vec<(usize, String, ReplayCheckpointProjection)>>>,
    initialized: Arc<Mutex<Option<RunState>>>,
    effective_config: Arc<Mutex<Option<EffectiveStruxisConfig>>>,
}

#[cfg(test)]
impl CheckpointSink for MemoryCheckpointSink {
    fn initialize(
        &mut self,
        initial_state: &RunState,
        effective_config: &EffectiveStruxisConfig,
    ) -> Result<(), String> {
        *self.initialized.lock().map_err(|_| "sink lock poisoned".to_owned())? =
            Some(initial_state.clone());
        *self.effective_config.lock().map_err(|_| "sink lock poisoned".to_owned())? =
            Some(effective_config.clone());
        Ok(())
    }

    fn commit_checkpoint(
        &mut self,
        checkpoint_index: usize,
        sbar_id: &str,
        projection: &ReplayCheckpointProjection,
    ) -> Result<(), String> {
        self.checkpoints.lock().map_err(|_| "sink lock poisoned".to_owned())?
            .push((checkpoint_index, sbar_id.to_owned(), projection.clone()));
        Ok(())
    }
}

#[cfg(test)]
struct FailingCheckpointSink;

#[cfg(test)]
impl CheckpointSink for FailingCheckpointSink {
    fn initialize(
        &mut self,
        _initial_state: &RunState,
        _effective_config: &EffectiveStruxisConfig,
    ) -> Result<(), String> {
        Ok(())
    }

    fn commit_checkpoint(
        &mut self,
        _checkpoint_index: usize,
        _sbar_id: &str,
        _projection: &ReplayCheckpointProjection,
    ) -> Result<(), String> {
        Err("injected checkpoint failure".into())
    }
}

#[cfg(test)]
mod tests {
    use super::{
        FailingCheckpointSink, MemoryCheckpointSink, ReplayCommandGate, ReplayWorker,
        ReplayWorkerConfig, mpsc,
    };
    use crate::{
        catalog::OriginLoad,
        dataset::{TestDataset, sequence_fingerprint},
        replay::LoadedInput,
        run::RunStatus,
    };
    use capitus_struxis::StruxisStateKey;
    use nautilus_model::{
        data::{Bar, BarType},
        instruments::{InstrumentAny, stubs::audusd_sim},
        types::{Price, Quantity},
    };
    use std::str::FromStr;

    fn fixture_test() -> TestDataset {
        let bar_type = BarType::from_str("AUD/USD.SIM-1-MINUTE-LAST-EXTERNAL")
            .expect("fixture BarType should parse");
        let bars = (0..3).map(|index| {
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
        }).collect::<Vec<_>>();
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
        TestDataset::create(&origin, "1735689600000000000", "1735689720000000000")
            .expect("fixture Test Dataset")
    }

    #[test]
    fn terminal_transport_failure_joins_worker_but_does_not_claim_release() {
        let (commands, _receiver) = mpsc::sync_channel(0);
        let join = std::thread::spawn(|| {});
        let mut worker = ReplayWorker {
            commands,
            command_gate: ReplayCommandGate::new(),
            join: Some(join),
            terminal_state: None,
        };

        let error = worker.join_after_transport_failure(
            "injected Dispose transport failure".to_owned(),
        );

        assert!(error.contains("worker thread exited"));
        assert!(error.contains("resource release is unconfirmed"));
        assert!(worker.join.is_none());
    }

    #[test]
    fn state_transport_failure_joins_worker_without_claiming_release() {
        let (commands, receiver) = mpsc::sync_channel(0);
        drop(receiver);
        let join = std::thread::spawn(|| {});
        let mut worker = ReplayWorker {
            commands,
            command_gate: ReplayCommandGate::new(),
            join: Some(join),
            terminal_state: None,
        };

        let error = worker.state().expect_err("state query should fail after worker exit");

        assert!(error.contains("Replay worker is unavailable during GetState"));
        assert!(error.contains("resource release is unconfirmed"));
        assert!(worker.join.is_none());
    }

    #[test]
    fn step_transport_failure_reaps_the_worker() {
        let (commands, receiver) = mpsc::sync_channel(0);
        drop(receiver);
        let join = std::thread::spawn(|| {});
        let mut worker = ReplayWorker {
            commands,
            command_gate: ReplayCommandGate::new(),
            join: Some(join),
            terminal_state: None,
        };

        let error = worker.step().expect_err("Step transport must fail");

        assert!(error.contains("resource release is unconfirmed"), "{error}");
        assert!(worker.join.is_none(), "failed Step should reap the worker");
        assert!(worker.terminal_state.is_none(), "failed Step must not cache a terminal state");
    }

    #[test]
    fn play_and_pause_are_rejected_without_touching_worker_transport() {
        let (commands, receiver) = mpsc::sync_channel(0);
        let join = std::thread::spawn(|| {});
        let mut worker = ReplayWorker {
            commands,
            command_gate: ReplayCommandGate::new(),
            join: Some(join),
            terminal_state: None,
        };

        let play_error = worker.play().expect_err("Play is frontend-owned");
        assert!(play_error.contains("Play is frontend-owned"));
        assert!(worker.join.is_some(), "rejected Play must not reap the worker");

        let pause_error = worker.pause().expect_err("Pause is frontend-owned");
        assert!(pause_error.contains("Pause is frontend-owned"));
        assert!(worker.join.is_some(), "rejected Pause must not reap the worker");

        // Ensure Drop's best-effort Dispose send cannot block on this test's
        // deliberately non-consuming rendezvous receiver.
        drop(receiver);
    }

    #[test]
    fn terminal_response_followed_by_join_panic_is_not_cached_as_disposed() {
        let (commands, receiver) = mpsc::sync_channel(0);
        let state = crate::run::RunState::ready(
            "worker-join-panic".into(),
            "test-dataset".into(),
            "fingerprint".into(),
            1,
        ).expect("fixture state");
        let join = std::thread::spawn(move || {
            match receiver.recv().expect("Stop command") {
                super::WorkerCommand::Stop(reply) => {
                    reply.send(Ok(state)).expect("Stop response receiver");
                    panic!("injected worker panic after terminal response");
                }
                _ => panic!("expected Stop command"),
            }
        });
        let mut worker = ReplayWorker {
            commands,
            command_gate: ReplayCommandGate::new(),
            join: Some(join),
            terminal_state: None,
        };

        let error = worker.stop().expect_err("join panic must invalidate release confirmation");

        assert!(error.contains("resource release is unconfirmed"));
        assert!(worker.terminal_state.is_none());
        assert!(worker.join.is_none());
    }

    #[test]
    fn repeated_terminal_commands_return_the_confirmed_terminal_state() {
        let test = fixture_test();
        let input = LoadedInput::from_test(&test).expect("LoadedInput");
        let instrument = InstrumentAny::CurrencyPair(audusd_sim());
        let (mut worker, _) = ReplayWorker::spawn(
            ReplayWorkerConfig {
                run_id: "worker-repeated-terminal-command".into(),
                input,
                instrument,
            },
            Box::new(MemoryCheckpointSink::default()),
        ).expect("worker should initialize");

        let stopped = worker.stop().expect("first Stop should release the worker");
        assert_eq!(stopped.status, RunStatus::Disposed);

        let disposed = worker.dispose().expect("Dispose after Stop should be idempotent");
        assert_eq!(disposed, stopped);
        assert_eq!(worker.state().expect("terminal state remains queryable"), stopped);
        assert_eq!(worker.stop().expect("repeated Stop should be idempotent"), stopped);
    }

    #[test]
    fn worker_processes_one_test_sbar_per_step_and_commits_before_advancing() {
        let test = fixture_test();
        let input = LoadedInput::from_test(&test).expect("LoadedInput");
        let sink = MemoryCheckpointSink::default();
        let observed = sink.clone();
        let instrument = InstrumentAny::CurrencyPair(audusd_sim());
        let (mut worker, initial) = ReplayWorker::spawn(
            ReplayWorkerConfig {
                run_id: "worker-step-contract".into(),
                input,
                instrument,
            },
            Box::new(sink),
        ).expect("worker should initialize");

        assert_eq!(initial.status, RunStatus::Ready);
        assert_eq!(initial.processed_count, 0);
        let initialized = observed.initialized.lock().expect("sink initialization");
        assert_eq!(initialized.as_ref().map(|state| state.status), Some(RunStatus::Ready));
        assert_eq!(initialized.as_ref().map(|state| state.processed_count), Some(0));
        drop(initialized);
        {
            let effective = observed.effective_config.lock().expect("effective config");
            let effective = effective.as_ref().expect("sink receives effective Struxis config");
            assert!(effective.enable_structure);
            assert_eq!(effective.structure_cbars_capacity, 10000);
            assert_eq!(effective.structure_swings_capacity, 2000);
            assert_eq!(effective.structure_trends_capacity, 666);
            assert_eq!(
                effective.fingerprint().expect("effective config fingerprint"),
                crate::effective_config::fingerprint_canonical_config(
                    &effective.canonical_json().expect("canonical effective config")
                ).expect("canonical config fingerprint")
            );
        }
        let first = worker.step().expect("first Step");
        assert_eq!(first.processed_count, 1);
        assert_eq!(first.cursor_sbar_id.as_deref(), Some("1735689600000000000"));
        let second = worker.step().expect("second Step");
        assert_eq!(second.processed_count, 2);
        let third = worker.step().expect("third Step");
        assert_eq!(third.processed_count, 3);
        assert_eq!(third.status, RunStatus::Completed);

        let checkpoints = observed.checkpoints.lock().expect("sink checkpoints");
        assert_eq!(checkpoints.len(), 3);
        assert_eq!(checkpoints[0].0, 0);
        assert_eq!(checkpoints[1].0, 1);
        assert_eq!(checkpoints[2].0, 2);
        assert_eq!(checkpoints[0].2.sbar_count, 1);
        assert_eq!(checkpoints[1].2.sbar_count, 2);
        assert_eq!(checkpoints[2].2.sbar_count, 3);

        let disposed = worker.dispose().expect("worker Dispose");
        assert_eq!(disposed.status, RunStatus::Disposed);
        assert_eq!(disposed.processed_count, 3);
        assert_eq!(disposed.cursor_sbar_id.as_deref(), Some("1735689720000000000"));
    }

    #[test]
    fn failed_checkpoint_dispose_preserves_diagnostic() {
        let test = fixture_test();
        let input = LoadedInput::from_test(&test).expect("LoadedInput");
        let instrument = InstrumentAny::CurrencyPair(audusd_sim());
        let (mut worker, _) = ReplayWorker::spawn(
            ReplayWorkerConfig {
                run_id: "worker-failed-dispose-contract".into(),
                input,
                instrument,
            },
            Box::new(FailingCheckpointSink),
        ).expect("worker should initialize");

        let error = worker.step().expect_err("checkpoint commit should fail");
        assert!(error.contains("injected checkpoint failure"));
        let failed = worker.dispose().expect("Dispose should release failed Run");
        assert_eq!(failed.status, RunStatus::Disposed);
        assert_eq!(failed.processed_count, 0);
        assert!(failed.failure_diagnostic.as_deref().unwrap().contains("injected checkpoint failure"));
    }


    #[test]
    fn backend_play_and_pause_are_rejected_without_advancing_replay() {
        let test = fixture_test();
        let input = LoadedInput::from_test(&test).expect("LoadedInput");
        let instrument = InstrumentAny::CurrencyPair(audusd_sim());
        let (mut worker, initial) = ReplayWorker::spawn(
            ReplayWorkerConfig {
                run_id: "worker-frontend-playback-only".into(),
                input,
                instrument,
            },
            Box::new(MemoryCheckpointSink::default()),
        ).expect("worker should initialize");

        assert_eq!(initial.status, RunStatus::Ready);
        assert!(worker.play().expect_err("backend Play must be rejected").contains("frontend-owned"));
        assert!(worker.pause().expect_err("backend Pause must be rejected").contains("frontend-owned"));

        let unchanged = worker.state().expect("RunState remains queryable");
        assert_eq!(unchanged.status, RunStatus::Ready);
        assert_eq!(unchanged.processed_count, 0);
        assert_eq!(unchanged.cursor_sbar_id, None);
        worker.dispose().expect("worker Dispose");
    }

}
