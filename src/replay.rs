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

#[cfg(test)]
mod tests {
    use super::{ReplayCommandGate, ReplayCommandKind};

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
