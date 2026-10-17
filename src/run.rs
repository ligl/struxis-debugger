//! Pure Run lifecycle model. Nautilus runtime ownership belongs to the Replay worker.

use serde::Serialize;
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum RunStatus {
    Ready,
    Running,
    Paused,
    Completed,
    Failed,
    Disposed,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RunState {
    pub run_id: Uuid,
    pub test_dataset_id: Uuid,
    pub input_fingerprint: String,
    pub input_count: usize,
    pub status: RunStatus,
    pub processed_count: usize,
    pub cursor_sbar_id: Option<String>,
    pub failure_diagnostic: Option<String>,
}

impl RunState {
    pub fn ready(
        run_id: Uuid,
        test_dataset_id: Uuid,
        input_fingerprint: String,
        input_count: usize,
    ) -> Result<Self, String> {
        if input_fingerprint.trim().is_empty() || input_count == 0 {
            return Err("Run requires a nonempty input fingerprint and at least one SBar".into());
        }
        Ok(Self {
            run_id,
            test_dataset_id,
            input_fingerprint,
            input_count,
            status: RunStatus::Ready,
            processed_count: 0,
            cursor_sbar_id: None,
            failure_diagnostic: None,
        })
    }

    pub fn play(&mut self) -> Result<(), String> {
        match self.status {
            RunStatus::Ready | RunStatus::Paused => {
                self.status = RunStatus::Running;
                Ok(())
            }
            status => Err(self.invalid_transition("Play", status)),
        }
    }

    pub fn pause(&mut self) -> Result<(), String> {
        match self.status {
            RunStatus::Running => {
                self.status = RunStatus::Paused;
                Ok(())
            }
            status => Err(self.invalid_transition("Pause", status)),
        }
    }

    /// Call only after Strategy/Struxis processing and checkpoint commit succeed.
    pub fn confirm_checkpoint(&mut self, sbar_id: String) -> Result<(), String> {
        if !matches!(
            self.status,
            RunStatus::Ready | RunStatus::Running | RunStatus::Paused
        ) {
            return Err(self.invalid_transition("ConfirmCheckpoint", self.status));
        }
        if sbar_id.trim().is_empty() || self.processed_count >= self.input_count {
            return Err("Invalid checkpoint SBar ID or no unprocessed input remains".into());
        }

        self.processed_count += 1;
        self.cursor_sbar_id = Some(sbar_id);
        if self.processed_count == self.input_count {
            self.status = RunStatus::Completed;
        } else if self.status != RunStatus::Running {
            self.status = RunStatus::Paused;
        }
        Ok(())
    }

    pub fn fail(&mut self, diagnostic: String) -> Result<(), String> {
        if self.status == RunStatus::Disposed || diagnostic.trim().is_empty() {
            return Err("Run cannot fail from Disposed or with an empty diagnostic".into());
        }
        self.status = RunStatus::Failed;
        self.failure_diagnostic = Some(diagnostic);
        Ok(())
    }

    /// The caller must first stop and join the worker; Running is rejected.
    pub fn dispose(&mut self) -> Result<(), String> {
        match self.status {
            RunStatus::Ready | RunStatus::Paused | RunStatus::Completed | RunStatus::Failed => {
                self.status = RunStatus::Disposed;
                Ok(())
            }
            status => Err(self.invalid_transition("Dispose", status)),
        }
    }

    fn invalid_transition(&self, command: &str, status: RunStatus) -> String {
        format!("{command} is invalid while Run {} is {status:?}", self.run_id)
    }
}

#[cfg(test)]
mod tests {
    use super::{RunState, RunStatus};
    use uuid::Uuid;

    fn ready(count: usize) -> RunState {
        RunState::ready(
            Uuid::new_v4(),
            Uuid::new_v4(),
            "fingerprint".into(),
            count,
        ).expect("fixture should be valid")
    }

    #[test]
    fn step_confirms_one_checkpoint_and_pauses() {
        let mut run = ready(2);
        run.confirm_checkpoint("100".into()).unwrap();
        assert_eq!(run.status, RunStatus::Paused);
        assert_eq!(run.processed_count, 1);
        assert_eq!(run.cursor_sbar_id.as_deref(), Some("100"));
    }

    #[test]
    fn play_remains_running_until_last_checkpoint() {
        let mut run = ready(2);
        run.play().unwrap();
        run.confirm_checkpoint("100".into()).unwrap();
        assert_eq!(run.status, RunStatus::Running);
        run.confirm_checkpoint("200".into()).unwrap();
        assert_eq!(run.status, RunStatus::Completed);
        assert_eq!(run.processed_count, 2);
    }

    #[test]
    fn rejected_checkpoint_does_not_advance_progress() {
        let mut run = ready(1);
        assert!(run.confirm_checkpoint(String::new()).is_err());
        assert_eq!(run.processed_count, 0);
        assert!(run.confirm_checkpoint("100".into()).is_ok());
        assert!(run.confirm_checkpoint("200".into()).is_err());
        assert_eq!(run.processed_count, 1);
    }

    #[test]
    fn running_run_cannot_be_disposed() {
        let mut run = ready(2);
        run.play().unwrap();
        assert!(run.dispose().is_err());
        run.pause().unwrap();
        run.dispose().unwrap();
        assert_eq!(run.status, RunStatus::Disposed);
    }

    #[test]
    fn failure_preserves_confirmed_progress() {
        let mut run = ready(2);
        run.confirm_checkpoint("100".into()).unwrap();
        run.fail("checkpoint sink failed".into()).unwrap();
        assert_eq!(run.status, RunStatus::Failed);
        assert_eq!(run.processed_count, 1);
        assert_eq!(run.cursor_sbar_id.as_deref(), Some("100"));
        assert!(run.play().is_err());
    }
}
