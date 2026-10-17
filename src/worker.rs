//! Thread-owned Nautilus replay runtime and single-SBar Step execution.
//!
//! All BacktestEngine / Cache / Struxis / Strategy objects are constructed and
//! used inside the worker thread. Only owned input, instrument metadata,
//! checkpoint projections, and RunState cross the thread boundary.
//!
//! Production Start must remain unexposed until a persistent SnapshotWriter
//! implements the CheckpointSink contract.

use std::{
    path::PathBuf,
    sync::{
        Arc, Mutex,
        mpsc::{self, Receiver, SyncSender},
        atomic::Ordering,
    },
    thread::{self, JoinHandle},
};

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
    checkpoint::ReplayCheckpointProjection,
    replay::{LoadedInput, ReplayCommandGate, ReplayCommandKind},
    run::{RunState, RunStatus},
};

/// The persistence boundary required before a checkpoint can advance progress.
///
/// Implementations must make `commit_checkpoint` atomic: an error means the
/// checkpoint is not confirmed and Run progress must not advance.
pub trait CheckpointSink: Send + 'static {
    fn initialize(&mut self, initial_state: &RunState) -> Result<(), String>;

    fn commit_checkpoint(
        &mut self,
        checkpoint_index: usize,
        sbar_id: &str,
        projection: &ReplayCheckpointProjection,
    ) -> Result<(), String>;
}

/// Owned configuration passed into the worker thread.
///
/// Instrument is immutable Nautilus market metadata, not a live runtime
/// resource. The engine, Cache, Strategy and Struxis are created only after
/// the worker thread starts.
pub struct ReplayWorkerConfig {
    pub run_id: String,
    pub input: LoadedInput,
    pub instrument: InstrumentAny,
}

enum WorkerCommand {
    Step(SyncSender<Result<RunState, String>>),
    Dispose(SyncSender<Result<RunState, String>>),
}

/// Handle to the worker. It never exposes Nautilus runtime objects.
pub struct ReplayWorker {
    commands: SyncSender<WorkerCommand>,
    command_gate: ReplayCommandGate,
    join: Option<JoinHandle<()>>,
}

impl ReplayWorker {
    /// Spawns the worker and returns only after engine setup and sink
    /// initialization succeed. No SBar is processed during initialization.
    pub fn spawn(
        config: ReplayWorkerConfig,
        mut sink: Box<dyn CheckpointSink>,
    ) -> Result<(Self, RunState), String> {
        let (command_tx, command_rx) = mpsc::sync_channel(0);
        let (ready_tx, ready_rx) = mpsc::sync_channel(0);

        let join = thread::Builder::new()
            .name(format!("struxis-replay-{}", config.run_id))
            .spawn(move || {
                let session = WorkerSession::initialize(config, sink.as_mut());
                match session {
                    Ok(session) => {
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
            },
            initial_state,
        ))
    }

    /// Processes exactly one next Test SBar and returns after its checkpoint
    /// sink commit and Run progress confirmation.
    pub fn step(&self) -> Result<RunState, String> {
        let _permit = self.command_gate
            .try_enter(ReplayCommandKind::Step)?;
        let (reply_tx, reply_rx) = mpsc::sync_channel(0);
        self.commands
            .send(WorkerCommand::Step(reply_tx))
            .map_err(|error| format!("Replay worker is unavailable: {error}"))?;
        reply_rx
            .recv()
            .map_err(|error| format!("Replay worker dropped Step response: {error}"))?
    }

    /// Releases Run-owned resources on the worker thread and joins it.
    pub fn dispose(&mut self) -> Result<RunState, String> {
        let _permit = self.command_gate
            .try_enter(ReplayCommandKind::Dispose)?;
        let (reply_tx, reply_rx) = mpsc::sync_channel(0);
        self.commands
            .send(WorkerCommand::Dispose(reply_tx))
            .map_err(|error| format!("Replay worker is unavailable during Dispose: {error}"))?;
        let result = reply_rx
            .recv()
            .map_err(|error| format!("Replay worker dropped Dispose response: {error}"))?;
        if let Some(join) = self.join.take() {
            join.join()
                .map_err(|_| "Replay worker panicked while disposing resources".to_owned())?;
        }
        result
    }
}

impl Drop for ReplayWorker {
    fn drop(&mut self) {
        if let Some(join) = self.join.take() {
            // Best-effort fail-safe cleanup. Explicit Dispose remains the only
            // path that can report a confirmed RunState::Disposed to callers.
            let (reply_tx, _reply_rx) = mpsc::sync_channel(0);
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
}

impl WorkerSession {
    fn initialize(
        config: ReplayWorkerConfig,
        sink: &mut dyn CheckpointSink,
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
            let struxis = Struxis::new(
                StruxisConfig::builder().enable_structure(true).build(),
                runtime,
            );
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

        let state = RunState::ready(
            config.run_id,
            config.input.test_dataset_id.clone(),
            config.input.sbar_sequence_fingerprint.clone(),
            config.input.bars.len(),
        )?;
        if let Err(error) = sink.initialize(&state) {
            engine.dispose();
            return Err(format!("Snapshot Recording initialization failed: {error}"));
        }

        Ok(Self {
            engine,
            struxis,
            input: config.input,
            state,
            next_index: 0,
        })
    }

    fn step(&mut self, sink: &mut dyn CheckpointSink) -> Result<RunState, String> {
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
            return Err(diagnostic);
        }

        let projection = {
            let state_view = self.struxis.state(self.input.state_key)
                .ok_or_else(|| format!(
                    "Struxis state {:?} missing after processing sbar_id={}",
                    self.input.state_key, bar.ts_event
                ))?;
            if state_view.last_ts_event() != Some(bar.ts_event) {
                let diagnostic = format!(
                    "Struxis checkpoint mismatch at input_index={}: expected ts_event={}, actual={:?}",
                    self.next_index,
                    bar.ts_event,
                    state_view.last_ts_event()
                );
                let _ = self.state.fail(diagnostic.clone());
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
            return Err(diagnostic);
        }

        if let Err(error) = sink.commit_checkpoint(expected_count, &bar.ts_event.to_string(), &projection) {
            let diagnostic = format!(
                "Checkpoint sink commit failed at input_index={} sbar_id={}: {error}",
                self.next_index, bar.ts_event
            );
            let _ = self.state.fail(diagnostic.clone());
            return Err(diagnostic);
        }

        self.state.confirm_checkpoint(bar.ts_event.to_string())?;
        self.next_index += 1;

        if self.state.status == RunStatus::Completed {
            if let Err(error) = self.engine.end() {
                let diagnostic = format!("BacktestEngine finalization failed after final checkpoint: {error}");
                let _ = self.state.fail(diagnostic.clone());
                return Err(diagnostic);
            }
        }

        Ok(self.state.clone())
    }

    fn engine_dispose(&mut self) {
        self.engine.dispose();
    }
}

fn worker_loop(
    mut session: WorkerSession,
    mut sink: Box<dyn CheckpointSink>,
    commands: Receiver<WorkerCommand>,
) {
    while let Ok(command) = commands.recv() {
        match command {
            WorkerCommand::Step(reply) => {
                let _ = reply.send(session.step(sink.as_mut()));
            }
            WorkerCommand::Dispose(reply) => {
                session.engine_dispose();
                let result = session.state.dispose();
                let _ = reply.send(result.map(|()| session.state.clone()));
                return;
            }
        }
    }
    session.engine_dispose();
}

/// Test-only in-memory sink. It intentionally is not a production persistence
/// implementation and cannot be wired to a production Start command.
#[cfg(test)]
#[derive(Clone, Default)]
struct MemoryCheckpointSink {
    checkpoints: Arc<Mutex<Vec<(usize, String, ReplayCheckpointProjection)>>>,
    initialized: Arc<Mutex<Option<RunState>>>,
}

#[cfg(test)]
impl CheckpointSink for MemoryCheckpointSink {
    fn initialize(&mut self, initial_state: &RunState) -> Result<(), String> {
        *self.initialized.lock().map_err(|_| "sink lock poisoned".to_owned())? =
            Some(initial_state.clone());
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
mod tests {
    use super::{CheckpointSink, MemoryCheckpointSink, ReplayWorker, ReplayWorkerConfig};
    use crate::{
        catalog::OriginLoad,
        dataset::{TestDataset, sequence_fingerprint},
        replay::LoadedInput,
    };
    use capitus_struxis::StruxisStateKey;
    use nautilus_model::{
        data::{Bar, BarType},
        instruments::{InstrumentAny, stubs::audusd_sim},
        types::{Price, Quantity},
    };
    use std::{str::FromStr, sync::Arc};

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
        };
        TestDataset::create(&origin, "1735689600000000000", "1735689720000000000")
            .expect("fixture Test Dataset")
    }

    #[derive(Clone, Default)]
    struct SharedSink(MemoryCheckpointSink);

    impl CheckpointSink for SharedSink {
        fn initialize(&mut self, initial_state: &crate::run::RunState) -> Result<(), String> {
            self.0.initialize(initial_state)
        }

        fn commit_checkpoint(
            &mut self,
            checkpoint_index: usize,
            sbar_id: &str,
            projection: &crate::checkpoint::ReplayCheckpointProjection,
        ) -> Result<(), String> {
            self.0.commit_checkpoint(checkpoint_index, sbar_id, projection)
        }
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

        assert_eq!(initial.status, RunStatusForTest::Ready);
        assert_eq!(initial.processed_count, 0);
        let first = worker.step().expect("first Step");
        assert_eq!(first.processed_count, 1);
        assert_eq!(first.cursor_sbar_id.as_deref(), Some("1735689600000000000"));
        let second = worker.step().expect("second Step");
        assert_eq!(second.processed_count, 2);
        let third = worker.step().expect("third Step");
        assert_eq!(third.processed_count, 3);
        assert_eq!(third.status, RunStatusForTest::Completed);

        let checkpoints = observed.checkpoints.lock().expect("sink checkpoints");
        assert_eq!(checkpoints.len(), 3);
        assert_eq!(checkpoints[0].0, 1);
        assert_eq!(checkpoints[1].0, 2);
        assert_eq!(checkpoints[2].0, 3);
        assert_eq!(checkpoints[0].2.sbar_count, 1);
        assert_eq!(checkpoints[1].2.sbar_count, 2);
        assert_eq!(checkpoints[2].2.sbar_count, 3);

        worker.dispose().expect("worker Dispose");
    }

    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    enum RunStatusForTest { Ready, Completed }
}
