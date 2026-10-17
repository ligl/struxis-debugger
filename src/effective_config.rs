//! Canonical, Struxis-only configuration identity for Snapshot metadata.

use capitus_struxis::StruxisConfig;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

const CONFIG_HASH_PREFIX: &[u8] = b"capitus.debug-chart.config\0";

/// The resolved Struxis configuration recorded by a Debugger Snapshot.
///
/// Capacity values are decimal strings in the serialized representation to
/// match the Snapshot canonical JSON contract.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct EffectiveStruxisConfig {
    pub enable_structure: bool,
    pub structure_cbars_capacity: String,
    pub structure_swings_capacity: String,
    pub structure_trends_capacity: String,
}

impl EffectiveStruxisConfig {
    /// Resolves optional overrides through Struxis' own implementation defaults.
    pub fn from_struxis_config(config: &StruxisConfig) -> Self {
        let (cbars, swings, trends) = config.resolved_structure_capacities();
        Self {
            enable_structure: config.enable_structure,
            structure_cbars_capacity: cbars.to_string(),
            structure_swings_capacity: swings.to_string(),
            structure_trends_capacity: trends.to_string(),
        }
    }

    /// Returns canonical JSON with deterministic struct-field order.
    pub fn canonical_json(&self) -> Result<String, String> {
        serde_json::to_string(self)
            .map_err(|error| format!("Effective Struxis config serialization failed: {error}"))
    }

    /// Fingerprints exactly the canonical JSON persisted in the Snapshot Manifest.
    pub fn fingerprint(&self) -> Result<String, String> {
        fingerprint_canonical_config(&self.canonical_json()?)
    }
}

/// Computes the domain-separated fingerprint of canonical effective-config JSON.
pub fn fingerprint_canonical_config(canonical_json: &str) -> Result<String, String> {
    let config: EffectiveStruxisConfig = serde_json::from_str(canonical_json)
        .map_err(|error| format!("Invalid effective Struxis config schema: {error}"))?;
    let normalized_json = serde_json::to_string(&config)
        .map_err(|error| format!("Effective config canonicalization failed: {error}"))?;
    if normalized_json != canonical_json {
        return Err("Effective config JSON is not canonical".to_owned());
    }

    let mut input = Vec::with_capacity(CONFIG_HASH_PREFIX.len() + canonical_json.len());
    input.extend_from_slice(CONFIG_HASH_PREFIX);
    input.extend_from_slice(canonical_json.as_bytes());
    Ok(sha256_hex(&input))
}

fn sha256_hex(input: &[u8]) -> String {
    let digest = Sha256::digest(input);
    let mut output = String::with_capacity(64);
    for byte in digest {
        use std::fmt::Write;
        write!(&mut output, "{byte:02x}").expect("writing to String cannot fail");
    }
    output
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_are_resolved_from_struxis_implementation() {
        let config = StruxisConfig::builder().build();
        let effective = EffectiveStruxisConfig::from_struxis_config(&config);
        let (cbars, swings, trends) = config.resolved_structure_capacities();

        assert!(effective.enable_structure);
        assert_eq!(effective.structure_cbars_capacity, cbars.to_string());
        assert_eq!(effective.structure_swings_capacity, swings.to_string());
        assert_eq!(effective.structure_trends_capacity, trends.to_string());
    }

    #[test]
    fn explicit_capacity_override_and_structure_flag_are_recorded() {
        let config = StruxisConfig::builder()
            .enable_structure(false)
            .structure_cbars_capacity(321)
            .structure_swings_capacity(123)
            .structure_trends_capacity(45)
            .build();
        let effective = EffectiveStruxisConfig::from_struxis_config(&config);

        assert!(!effective.enable_structure);
        assert_eq!(effective.structure_cbars_capacity, "321");
        assert_eq!(effective.structure_swings_capacity, "123");
        assert_eq!(effective.structure_trends_capacity, "45");
    }

    #[test]
    fn fingerprint_is_derived_from_complete_effective_config() {
        let defaults = EffectiveStruxisConfig::from_struxis_config(&StruxisConfig::builder().build());
        let altered = EffectiveStruxisConfig::from_struxis_config(
            &StruxisConfig::builder().structure_cbars_capacity(321).build(),
        );

        assert_ne!(defaults.canonical_json().unwrap(), altered.canonical_json().unwrap());
        assert_ne!(defaults.fingerprint().unwrap(), altered.fingerprint().unwrap());
        assert_eq!(defaults.fingerprint().unwrap(), fingerprint_canonical_config(&defaults.canonical_json().unwrap()).unwrap());
    }
}
