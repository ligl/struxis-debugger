//! Owned commands for user-driven observation of the current Replay stream.

use capitus_struxis::keyzone::{KeyZoneError, ObservationTaskCompletion};
use serde::{Deserialize, Serialize};

use crate::{
    checkpoint::ReplayInspectorProjection,
    ipc::{IpcError, IpcErrorCode},
};

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct ObservationContext {
    pub(crate) run_id: String,
    pub(crate) expected_sbar_id: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct CreateFixedPriceRange {
    pub(crate) context: ObservationContext,
    pub(crate) lower: String,
    pub(crate) upper: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct FixedPriceRangeResult {
    pub(crate) keyzone_id: String,
    pub(crate) inspector: ReplayInspectorProjection,
}

#[derive(Debug, Clone, Copy, Deserialize)]
pub(crate) enum Completion {
    AfterOneInteraction,
    UntilDeadline,
}

impl From<Completion> for ObservationTaskCompletion {
    fn from(value: Completion) -> Self {
        match value {
            Completion::AfterOneInteraction => Self::AfterOneInteraction,
            Completion::UntilDeadline => Self::UntilDeadline,
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct CreateObservation {
    pub(crate) context: ObservationContext,
    pub(crate) keyzone_id: String,
    pub(crate) request_id: String,
    /// None means strictly after the current accepted cursor.
    pub(crate) start_at: Option<String>,
    pub(crate) n: String,
    pub(crate) x: f64,
    pub(crate) completion: Completion,
    pub(crate) deadline: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct CancelObservation {
    pub(crate) context: ObservationContext,
    pub(crate) observation_id: String,
}

#[derive(Debug, Clone)]
pub(crate) enum ObservationCommand {
    Create(CreateObservation),
    Cancel(CancelObservation),
}

impl ObservationCommand {
    pub(crate) fn context(&self) -> &ObservationContext {
        match self {
            Self::Create(request) => &request.context,
            Self::Cancel(request) => &request.context,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ObservationCommandResult {
    pub(crate) observation_id: String,
    pub(crate) operation: Operation,
    pub(crate) inspector: ReplayInspectorProjection,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum Operation {
    Created,
    Existing,
    Cancelled,
    AlreadyTerminated,
}

pub(crate) fn integer(value: &str, field: &str) -> Result<u64, IpcError> {
    if value.is_empty() || !value.bytes().all(|byte| byte.is_ascii_digit()) {
        return Err(IpcError::new(
            IpcErrorCode::InvalidArgument,
            format!("{field} must be an unsigned decimal integer"),
        ));
    }
    value.parse().map_err(|_| {
        IpcError::new(
            IpcErrorCode::InvalidArgument,
            format!("{field} exceeds the supported integer range"),
        )
    })
}

pub(crate) fn domain_error(error: KeyZoneError) -> IpcError {
    let code = match error {
        KeyZoneError::UnknownKeyZone(_)
        | KeyZoneError::UnknownObservation
        | KeyZoneError::UnknownInteraction => IpcErrorCode::NotFound,
        KeyZoneError::RequestConflict | KeyZoneError::OutOfOrder => IpcErrorCode::Conflict,
        KeyZoneError::InvalidConfig
        | KeyZoneError::InvalidObservation
        | KeyZoneError::InvalidTemporal
        | KeyZoneError::StreamMismatch => IpcErrorCode::InvalidArgument,
        _ => IpcErrorCode::InvalidState,
    };
    IpcError::new(code, error.to_string())
}
