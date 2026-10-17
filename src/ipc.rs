//! Stable, frontend-safe error types for the Struxis Debugger IPC boundary.
//!
//! This module defines the wire representation only. Command handlers should map
//! internal errors to an `IpcError` deliberately instead of serializing arbitrary
//! Rust error chains.

/// Stable machine-readable categories returned across the IPC boundary.
#[derive(Clone, Copy, Debug, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum IpcErrorCode {
    InvalidArgument,
    NotFound,
    Conflict,
    InvalidState,
    Internal,
}

/// An error response safe to expose through the frontend IPC boundary.
///
/// `message` must be a caller-safe diagnostic, not an arbitrary internal error
/// chain or a debug representation of runtime objects.
#[derive(Clone, Debug, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IpcError {
    pub code: IpcErrorCode,
    pub message: String,
}

impl IpcError {
    /// Creates an IPC error with an explicitly selected stable code.
    #[must_use]
    pub fn new(code: IpcErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{IpcError, IpcErrorCode};

    #[test]
    fn error_serialization_uses_stable_field_and_code_names() {
        let error = IpcError::new(IpcErrorCode::InvalidState, "Run is not active");

        let json = serde_json::to_string(&error).expect("IPC error should serialize");

        assert_eq!(
            json,
            r#"{"code":"invalid_state","message":"Run is not active"}"#
        );
    }

    #[test]
    fn error_round_trip_preserves_code_and_message() {
        let error = IpcError::new(IpcErrorCode::InvalidArgument, "Invalid dataset selection");

        let json = serde_json::to_string(&error).expect("IPC error should serialize");
        let decoded: IpcError =
            serde_json::from_str(&json).expect("IPC error should deserialize");

        assert_eq!(decoded, error);
    }
}
