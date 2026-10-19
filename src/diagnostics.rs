//! Stable, owned diagnostics associated with Struxis Debugger checkpoints.
//!
//! Diagnostics are data, not log strings. A checkpoint carries the diagnostics
//! observed at that processing boundary; an empty collection is represented as []
//! when persisted in a Snapshot.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct Diagnostic {
    pub(crate) source: String,
    pub(crate) severity: String,
    pub(crate) category: String,
    pub(crate) object_type: Option<String>,
    pub(crate) object_id: Option<String>,
    pub(crate) sbar_ids: Vec<String>,
    pub(crate) checkpoint_index: Option<usize>,
    pub(crate) message: String,
}

impl Diagnostic {
    /// Validate fields that define machine-readable diagnostic identity.
    /// Unknown values are allowed so an unclassifiable upstream diagnostic can
    /// be represented explicitly without inventing a category or severity.
    pub(crate) fn validate(&self) -> Result<(), String> {
        for (field, value) in [
            ("source", self.source.as_str()),
            ("severity", self.severity.as_str()),
            ("category", self.category.as_str()),
            ("message", self.message.as_str()),
        ] {
            if value.trim().is_empty() {
                return Err(format!("Diagnostic {field} must not be empty"));
            }
        }
        if self.object_type.is_some() != self.object_id.is_some() {
            return Err("Diagnostic object_type and object_id must both be present or both be null".into());
        }
        if self.sbar_ids.iter().any(|id| id.trim().is_empty()) {
            return Err("Diagnostic sbar_ids must not contain empty IDs".into());
        }
        Ok(())
    }
}

/// Serialize diagnostics in the canonical Snapshot order.
///
/// message is only a final deterministic tie-breaker; consumers must use the
/// structured identity fields rather than message text to classify differences.
pub(crate) fn canonical_diagnostics_json(diagnostics: &[Diagnostic]) -> Result<String, String> {
    let mut ordered = diagnostics.to_vec();
    for diagnostic in &ordered {
        diagnostic.validate()?;
    }
    ordered.sort_by(|left, right| {
        left.source.cmp(&right.source)
            .then_with(|| left.category.cmp(&right.category))
            .then_with(|| left.object_type.cmp(&right.object_type))
            .then_with(|| left.object_id.cmp(&right.object_id))
            .then_with(|| left.sbar_ids.first().cmp(&right.sbar_ids.first()))
            .then_with(|| left.severity.cmp(&right.severity))
            .then_with(|| left.message.cmp(&right.message))
            .then_with(|| left.checkpoint_index.cmp(&right.checkpoint_index))
            .then_with(|| left.sbar_ids.cmp(&right.sbar_ids))
    });
    serde_json::to_string(&ordered)
        .map_err(|error| format!("Cannot encode canonical diagnostics: {error}"))
}

/// Validates the persisted diagnostics JSON against the actual diagnostic DTO.
///
/// Canonicalization orders records and JSON object fields; it does not rewrite
/// semantic values such as checkpoint indexes from numbers into strings.
pub(crate) fn validate_canonical_diagnostics_json(encoded: &str) -> Result<(), String> {
    let diagnostics: Vec<Diagnostic> = serde_json::from_str(encoded)
        .map_err(|error| format!("Invalid diagnostics DTO: {error}"))?;
    let canonical = canonical_diagnostics_json(&diagnostics)?;
    if canonical != encoded {
        return Err("Diagnostics are not canonical JSON".to_owned());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{canonical_diagnostics_json, Diagnostic};

    fn diagnostic(source: &str, category: &str, message: &str) -> Diagnostic {
        Diagnostic {
            source: source.into(),
            severity: "warning".into(),
            category: category.into(),
            object_type: None,
            object_id: None,
            sbar_ids: Vec::new(),
            checkpoint_index: Some(0),
            message: message.into(),
        }
    }

    #[test]
    fn empty_diagnostics_are_an_explicit_empty_array() {
        assert_eq!(canonical_diagnostics_json(&[]).unwrap(), "[]");
    }

    #[test]
    fn diagnostics_have_deterministic_canonical_order() {
        let a = diagnostic("replay", "ZCategory", "z");
        let b = diagnostic("input", "ACategory", "a");
        let forward = canonical_diagnostics_json(&[a.clone(), b.clone()]).unwrap();
        let reverse = canonical_diagnostics_json(&[b, a]).unwrap();
        assert_eq!(forward, reverse);
        let parsed: Vec<Diagnostic> = serde_json::from_str(&forward).unwrap();
        assert_eq!(parsed[0].source, "input");
        assert_eq!(parsed[1].source, "replay");
    }

    #[test]
    fn checkpoint_index_keeps_its_json_integer_type() {
        let value = diagnostic("replay", "Category", "message");
        let encoded = canonical_diagnostics_json(&[value]).unwrap();
        assert!(encoded.contains(r#""checkpointIndex":0"#));
        assert!(!encoded.contains(r#""checkpointIndex":"0""#));
        assert!(super::validate_canonical_diagnostics_json(&encoded).is_ok());

        let string_index = encoded.replace(r#""checkpointIndex":0"#, r#""checkpointIndex":"0""#);
        assert!(super::validate_canonical_diagnostics_json(&string_index).is_err());
    }

    #[test]
    fn rejects_incomplete_machine_identity() {
        let mut value = diagnostic("replay", "Category", "message");
        value.category.clear();
        assert!(canonical_diagnostics_json(&[value]).is_err());
    }
}
