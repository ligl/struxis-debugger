//! Replay command admission primitives.
//!
//! This module does not create Nautilus resources yet. The later Replay worker
//! must create, use, and dispose BacktestEngine / Cache / Strategy / Struxis on
//! its own thread. These primitives enforce the no-command-queue contract at
//! the application boundary.

use std::sync::{
    Arc,
    atomic::{AtomicBool, Ordering},
};

/// Commands that mutate or advance one active Run.
///
/// Querying a stable state snapshot is intentionally not included here.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ReplayCommandKind {
    Start,
    Step,
    Play,
    Pause,
    Stop,
    Resume,
    Dispose,
    Restart,
}

/// Shared non-queuing admission gate for state-changing Replay commands.
///
/// A caller must acquire a permit before issuing a command to the worker. If a
/// previous command still owns the permit, the new command is rejected
/// immediately instead of being queued for later execution.
#[derive(Debug, Clone, Default)]
pub struct ReplayCommandGate {
    active: Arc<AtomicBool>,
}

impl ReplayCommandGate {
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    pub fn try_enter(&self, command: ReplayCommandKind) -> Result<ReplayCommandPermit, String> {
        self.active
            .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
            .map_err(|_| format!("{command:?} rejected: another Replay command is still active"))?;

        Ok(ReplayCommandPermit {
            active: Arc::clone(&self.active),
            command,
        })
    }
}

/// RAII permit; releasing it allows the next command to be admitted.
#[derive(Debug)]
pub struct ReplayCommandPermit {
    active: Arc<AtomicBool>,
    command: ReplayCommandKind,
}

impl ReplayCommandPermit {
    #[must_use]
    pub const fn command(&self) -> ReplayCommandKind {
        self.command
    }
}

impl Drop for ReplayCommandPermit {
    fn drop(&mut self) {
        self.active.store(false, Ordering::Release);
    }
}


/// Non-queuing control intent shared with a running Replay worker.
///
/// Play is a short state transition and must not hold the command-admission
/// permit while the worker advances bars. Pause and Stop therefore publish
/// intent here; the worker consumes it only at a safe checkpoint boundary.
#[derive(Debug, Clone, Default)]
pub struct ReplayControl {
    intent: Arc<std::sync::atomic::AtomicU8>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum ReplayControlIntent {
    None = 0,
    Pause = 1,
    Stop = 2,
}

impl ReplayControl {
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    /// Requests Pause if no other control intent is pending.
    pub fn request_pause(&self) -> Result<(), String> {
        self.intent
            .compare_exchange(
                ReplayControlIntent::None as u8,
                ReplayControlIntent::Pause as u8,
                Ordering::AcqRel,
                Ordering::Acquire,
            )
            .map(|_| ())
            .map_err(|current| {
                format!(
                    "Pause rejected: pending control intent is {:?}",
                    ReplayControlIntent::from_raw(current)
                )
            })
    }

    /// Requests Stop. Stop may supersede a pending Pause, but never a Stop.
    pub fn request_stop(&self) -> Result<(), String> {
        loop {
            let current = self.intent.load(Ordering::Acquire);
            match ReplayControlIntent::from_raw(current) {
                ReplayControlIntent::None => {
                    if self.intent.compare_exchange(
                        ReplayControlIntent::None as u8,
                        ReplayControlIntent::Stop as u8,
                        Ordering::AcqRel,
                        Ordering::Acquire,
                    ).is_ok() {
                        return Ok(());
                    }
                }
                ReplayControlIntent::Pause => {
                    if self.intent.compare_exchange(
                        ReplayControlIntent::Pause as u8,
                        ReplayControlIntent::Stop as u8,
                        Ordering::AcqRel,
                        Ordering::Acquire,
                    ).is_ok() {
                        return Ok(());
                    }
                }
                ReplayControlIntent::Stop => {
                    return Err("Stop rejected: Stop is already pending".into());
                }
            }
        }
    }

    /// Reads the pending intent without consuming it.
    #[must_use]
    pub fn pending(&self) -> ReplayControlIntent {
        ReplayControlIntent::from_raw(self.intent.load(Ordering::Acquire))
    }

    /// Consumes a pending intent at a worker checkpoint boundary.
    pub fn take_at_checkpoint(&self) -> ReplayControlIntent {
        ReplayControlIntent::from_raw(
            self.intent.swap(ReplayControlIntent::None as u8, Ordering::AcqRel),
        )
    }
}

impl ReplayControlIntent {
    fn from_raw(value: u8) -> Self {
        match value {
            1 => Self::Pause,
            2 => Self::Stop,
            _ => Self::None,
        }
    }
}

/// Owned, immutable Run input constructed only from the selected Test Dataset.
///
/// This validates the complete ordered Bar sequence before a worker creates any
/// Nautilus resources. It deliberately does not read the Origin or Catalog.
#[derive(Debug, Clone)]
pub struct LoadedInput {
    pub test_dataset_id: String,
    pub state_key: capitus_struxis::StruxisStateKey,
    pub bar_type: String,
    pub bars: Vec<nautilus_model::data::Bar>,
    pub sbar_sequence_fingerprint: String,
}

impl LoadedInput {
    pub fn from_test(test: &crate::dataset::TestDataset) -> Result<Self, String> {
        use crate::dataset::sequence_fingerprint;

        let bars = test.bars();
        if bars.is_empty() {
            return Err("LoadedInput cannot be constructed from an empty Test Dataset".into());
        }

        let actual_fingerprint = sequence_fingerprint(test.state_key(), bars)
            .map_err(|error| format!("LoadedInput fingerprint calculation failed: {error}"))?;
        if actual_fingerprint != test.sbar_sequence_fingerprint() {
            return Err(format!(
                "LoadedInput fingerprint mismatch: Test={}, actual={actual_fingerprint}",
                test.sbar_sequence_fingerprint()
            ));
        }

        let expected_bar_type = bars[0].bar_type.to_string();
        if bars.iter().any(|bar| bar.bar_type.to_string() != expected_bar_type) {
            return Err("LoadedInput contains more than one BarType".into());
        }
        if expected_bar_type != test.bar_type() {
            return Err(format!(
                "LoadedInput BarType mismatch: Test={}, actual={expected_bar_type}",
                test.bar_type()
            ));
        }

        Ok(Self {
            test_dataset_id: test.test_dataset_id().to_string(),
            state_key: test.state_key(),
            bar_type: expected_bar_type,
            bars: bars.to_vec(),
            sbar_sequence_fingerprint: actual_fingerprint,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::{LoadedInput, ReplayCommandGate, ReplayCommandKind, ReplayControl, ReplayControlIntent};


    use crate::{
        catalog::OriginLoad,
        dataset::{TestDataset, sequence_fingerprint},
    };
    use capitus_struxis::StruxisStateKey;
    use nautilus_model::{
        data::{Bar, BarType},
        types::{Price, Quantity},
    };
    use std::str::FromStr;
    use uuid::Uuid;

    fn test_dataset() -> TestDataset {
        let bar_type = BarType::from_str("AUD/USD.SIM-5-MINUTE-LAST-EXTERNAL")
            .expect("fixture BarType should parse");
        let bars = vec![
            Bar::new(
                bar_type,
                Price::from("10.00"),
                Price::from("12.00"),
                Price::from("9.00"),
                Price::from("11.00"),
                Quantity::from("100"),
                100_u64.into(),
                100_u64.into(),
            ),
            Bar::new(
                bar_type,
                Price::from("11.00"),
                Price::from("13.00"),
                Price::from("10.00"),
                Price::from("12.00"),
                Quantity::from("100"),
                200_u64.into(),
                200_u64.into(),
            ),
        ];
        let state_key = StruxisStateKey::from_bar_type(&bar_type);
        let fingerprint = sequence_fingerprint(state_key, &bars).expect("fingerprint");
        let origin = OriginLoad {
            origin_dataset_id: Uuid::new_v4(),
            state_key,
            sbar_sequence_fingerprint: fingerprint,
            bar_type: bar_type.to_string(),
            bars,
        };
        TestDataset::create(&origin, "100", "200").expect("Test Dataset should be valid")
    }

    #[test]
    fn loaded_input_copies_test_bars_and_revalidates_sequence_identity() {
        let test = test_dataset();
        let loaded = LoadedInput::from_test(&test).expect("LoadedInput should validate");
        assert_eq!(loaded.test_dataset_id, test.test_dataset_id().to_string());
        assert_eq!(loaded.bars.len(), test.bars().len());
        assert_eq!(loaded.sbar_sequence_fingerprint, test.sbar_sequence_fingerprint());
        assert_eq!(
            loaded.bars.iter().map(|bar| bar.ts_event.to_string()).collect::<Vec<_>>(),
            vec!["100", "200"]
        );
    }

    #[test]
    fn loaded_input_does_not_depend_on_catalog_or_origin_selection() {
        let test = test_dataset();
        let loaded = LoadedInput::from_test(&test).expect("LoadedInput should validate");
        assert_eq!(loaded.bar_type, test.bar_type());
        assert_eq!(loaded.state_key, test.state_key());
        // The owned input contains only the selected Test sequence; no Origin
        // reference or Catalog query is part of this construction path.
        assert_eq!(loaded.bars.len(), 2);
    }

    #[test]
    fn pause_intent_is_visible_until_checkpoint_consumes_it() {
        let control = ReplayControl::new();
        control.request_pause().unwrap();
        assert_eq!(control.pending(), ReplayControlIntent::Pause);
        assert_eq!(control.take_at_checkpoint(), ReplayControlIntent::Pause);
        assert_eq!(control.pending(), ReplayControlIntent::None);
    }

    #[test]
    fn stop_supersedes_pause_and_cannot_be_overwritten() {
        let control = ReplayControl::new();
        control.request_pause().unwrap();
        control.request_stop().unwrap();
        assert_eq!(control.pending(), ReplayControlIntent::Stop);
        assert!(control.request_pause().is_err());
        assert!(control.request_stop().is_err());
        assert_eq!(control.take_at_checkpoint(), ReplayControlIntent::Stop);
    }

    #[test]
    fn duplicate_pause_is_rejected_without_queueing() {
        let control = ReplayControl::new();
        control.request_pause().unwrap();
        assert!(control.request_pause().is_err());
        assert_eq!(control.pending(), ReplayControlIntent::Pause);
    }

    #[test]
    fn rejects_a_second_command_while_first_is_active() {
        let gate = ReplayCommandGate::new();
        let first = gate.try_enter(ReplayCommandKind::Step).unwrap();

        let error = gate
            .try_enter(ReplayCommandKind::Pause)
            .expect_err("commands must not queue behind an active command");

        assert!(error.contains("Pause rejected"));
        drop(first);

        assert!(gate.try_enter(ReplayCommandKind::Pause).is_ok());
    }

    #[test]
    fn independent_gates_do_not_block_each_other() {
        let first_gate = ReplayCommandGate::new();
        let second_gate = ReplayCommandGate::new();
        let _first = first_gate.try_enter(ReplayCommandKind::Play).unwrap();

        assert!(second_gate.try_enter(ReplayCommandKind::Start).is_ok());
    }

    #[test]
    fn permit_drop_releases_gate_after_early_return() {
        let gate = ReplayCommandGate::new();
        {
            let permit = gate.try_enter(ReplayCommandKind::Restart).unwrap();
            assert_eq!(permit.command(), ReplayCommandKind::Restart);
        }

        assert!(gate.try_enter(ReplayCommandKind::Start).is_ok());
    }
}
