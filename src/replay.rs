//! Replay input identity and command-admission primitives.
//!
//! `LoadedInput` fixes and validates the immutable Test Dataset sequence before
//! worker initialization. `ReplayCommandGate` and `ReplayControl` provide
//! non-queuing command admission/control primitives. The actual Nautilus runtime
//! lifecycle and per-SBar execution live in `worker.rs`; application-level
//! ReplayManager ownership and Tauri Run commands are not implemented here.

use std::sync::{
    Arc,
    atomic::{AtomicBool, Ordering},
};

/// Commands accepted by the active Run's non-queuing command gate.
///
/// GetState is read-only, but uses the same gate so its response cannot race
/// another command's state transition.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum ReplayCommandKind {
    Start,
    GetState,
    GetInspector,
    Step,
    Play,
    Pause,
    Stop,
    Dispose,
    Restart,
}

/// Shared non-queuing admission gate for state-changing Replay commands.
///
/// A caller must acquire a permit before issuing a command to the worker. If a
/// previous command still owns the permit, the new command is rejected
/// immediately instead of being queued for later execution.
#[derive(Debug, Clone, Default)]
pub(crate) struct ReplayCommandGate {
    active: Arc<AtomicBool>,
}

impl ReplayCommandGate {
    #[must_use]
    pub(crate) fn new() -> Self {
        Self::default()
    }

    pub(crate) fn try_enter(&self, command: ReplayCommandKind) -> Result<ReplayCommandPermit, String> {
        self.active
            .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
            .map_err(|_| format!("{command:?} rejected: another Replay command is still active"))?;

        Ok(ReplayCommandPermit {
            active: Arc::clone(&self.active),
        })
    }
}

/// RAII permit; releasing it allows the next command to be admitted.
#[derive(Debug)]
pub(crate) struct ReplayCommandPermit {
    active: Arc<AtomicBool>,
}

impl Drop for ReplayCommandPermit {
    fn drop(&mut self) {
        self.active.store(false, Ordering::Release);
    }
}


/// Owned, immutable Run input constructed only from the selected Test Dataset.
///
/// This validates the complete ordered Bar sequence before a worker creates any
/// Nautilus resources. It deliberately does not read the Origin or Catalog.
#[derive(Debug, Clone)]
pub(crate) struct LoadedInput {
    pub(crate) test_dataset_id: String,
    pub(crate) state_key: capitus_struxis::StruxisStateKey,
    pub(crate) bar_type: String,
    pub(crate) bars: Vec<nautilus_model::data::Bar>,
    pub(crate) sbar_sequence_fingerprint: String,
}

impl LoadedInput {
    pub(crate) fn from_test(test: &crate::dataset::TestDataset) -> Result<Self, String> {
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
    use super::{LoadedInput, ReplayCommandGate, ReplayCommandKind};


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
            structure: None,
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
            let _permit = gate.try_enter(ReplayCommandKind::Restart).unwrap();
        }

        assert!(gate.try_enter(ReplayCommandKind::Start).is_ok());
    }
}
