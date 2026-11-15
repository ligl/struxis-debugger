//! Canonical, Struxis-only configuration identity for Snapshot metadata.

use capitus_struxis::{StruxisConfig, keyzone::KeyZoneEngine};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::num::NonZeroUsize;

const CONFIG_HASH_PREFIX: &[u8] = b"capitus.debug-chart.config\0";

/// The resolved Struxis configuration recorded by a Debugger Snapshot.
///
/// Capacity values are serialized as JSON integers; the config fingerprint hashes
/// this exact canonical representation.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct EffectiveStruxisConfig {
    pub(crate) enable_structure: bool,
    pub(crate) structure_cbars_capacity: NonZeroUsize,
    pub(crate) structure_swings_capacity: NonZeroUsize,
    pub(crate) structure_trends_capacity: NonZeroUsize,
    pub(crate) keyzone_capacity: NonZeroUsize,
}

impl EffectiveStruxisConfig {
    /// Resolves optional overrides through Struxis' own implementation defaults.
    pub(crate) fn from_struxis_config(config: &StruxisConfig) -> Self {
        let (cbars, swings, trends) =
            capitus_struxis::structure::structure::Structure::resolve_capacities(
                config.structure_cbars_capacity,
                config.structure_swings_capacity,
                config.structure_trends_capacity,
            );
        Self {
            enable_structure: config.enable_structure,
            structure_cbars_capacity: cbars,
            structure_swings_capacity: swings,
            structure_trends_capacity: trends,
            keyzone_capacity: KeyZoneEngine::resolve_capacity(config.keyzone_capacity),
        }
    }

    /// Returns canonical JSON with deterministic struct-field order.
    pub(crate) fn canonical_json(&self) -> Result<String, String> {
        serde_json::to_string(self)
            .map_err(|error| format!("Effective Struxis config serialization failed: {error}"))
    }

    /// Fingerprints exactly the canonical JSON persisted in the Snapshot Manifest.
    pub(crate) fn fingerprint(&self) -> Result<String, String> {
        fingerprint_canonical_config(&self.canonical_json()?)
    }
}

/// Computes the domain-separated fingerprint of canonical effective-config JSON.
pub(crate) fn fingerprint_canonical_config(canonical_json: &str) -> Result<String, String> {
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
        let (cbars, swings, trends) =
            capitus_struxis::structure::structure::Structure::resolve_capacities(
                config.structure_cbars_capacity,
                config.structure_swings_capacity,
                config.structure_trends_capacity,
            );

        assert!(effective.enable_structure);
        assert_eq!(effective.structure_cbars_capacity, cbars);
        assert_eq!(effective.structure_swings_capacity, swings);
        assert_eq!(effective.structure_trends_capacity, trends);
    }

    #[test]
    fn explicit_capacity_override_and_structure_flag_are_recorded() {
        let config = StruxisConfig::builder()
            .enable_structure(false)
            .structure_cbars_capacity(NonZeroUsize::new(321).unwrap())
            .structure_swings_capacity(NonZeroUsize::new(123).unwrap())
            .structure_trends_capacity(NonZeroUsize::new(45).unwrap())
            .build();
        let effective = EffectiveStruxisConfig::from_struxis_config(&config);

        assert!(!effective.enable_structure);
        assert_eq!(effective.structure_cbars_capacity.get(), 321);
        assert_eq!(effective.structure_swings_capacity.get(), 123);
        assert_eq!(effective.structure_trends_capacity.get(), 45);
    }

    #[test]
    fn fingerprint_rejects_missing_and_unknown_schema_fields() {
        let missing = r#"{"enableStructure":true,"structureCbarsCapacity":10000,"structureSwingsCapacity":2000,"keyzoneCapacity":100}"#;
        assert!(
            fingerprint_canonical_config(missing)
                .unwrap_err()
                .contains("schema")
        );

        let unknown = r#"{"enableStructure":true,"structureCbarsCapacity":10000,"structureSwingsCapacity":2000,"structureTrendsCapacity":666,"keyzoneCapacity":100,"tradingFeeModel":"ignored"}"#;
        assert!(
            fingerprint_canonical_config(unknown)
                .unwrap_err()
                .contains("schema")
        );
    }

    #[test]
    fn fingerprint_rejects_string_encoded_capacities() {
        let encoded = r#"{"enableStructure":true,"structureCbarsCapacity":"10000","structureSwingsCapacity":2000,"structureTrendsCapacity":666,"keyzoneCapacity":100}"#;
        assert!(
            fingerprint_canonical_config(encoded)
                .unwrap_err()
                .contains("schema")
        );
    }

    #[test]
    fn fingerprint_is_derived_from_complete_effective_config() {
        let defaults =
            EffectiveStruxisConfig::from_struxis_config(&StruxisConfig::builder().build());
        let altered = EffectiveStruxisConfig::from_struxis_config(
            &StruxisConfig::builder()
                .structure_cbars_capacity(NonZeroUsize::new(321).unwrap())
                .build(),
        );

        assert_ne!(
            defaults.canonical_json().unwrap(),
            altered.canonical_json().unwrap()
        );
        assert_ne!(
            defaults.fingerprint().unwrap(),
            altered.fingerprint().unwrap()
        );
        assert_eq!(
            defaults.fingerprint().unwrap(),
            fingerprint_canonical_config(&defaults.canonical_json().unwrap()).unwrap()
        );
    }
    #[test]
    fn keyzone_capacity_is_numeric_nonzero_and_part_of_the_fingerprint() {
        let defaults =
            EffectiveStruxisConfig::from_struxis_config(&StruxisConfig::builder().build());
        assert_eq!(defaults.keyzone_capacity.get(), 100);
        let altered = EffectiveStruxisConfig::from_struxis_config(
            &StruxisConfig::builder()
                .keyzone_capacity(NonZeroUsize::new(2).unwrap())
                .build(),
        );
        assert_eq!(altered.keyzone_capacity.get(), 2);
        assert_ne!(
            defaults.fingerprint().unwrap(),
            altered.fingerprint().unwrap()
        );
        let value = serde_json::to_value(&defaults).unwrap();
        assert_eq!(value["keyzoneCapacity"], serde_json::json!(100));
        for field in [
            "structureCbarsCapacity",
            "structureSwingsCapacity",
            "structureTrendsCapacity",
            "keyzoneCapacity",
        ] {
            for invalid in [serde_json::json!(0), serde_json::json!("100")] {
                let mut value = value.clone();
                value[field] = invalid;
                assert!(
                    fingerprint_canonical_config(&serde_json::to_string(&value).unwrap())
                        .unwrap_err()
                        .contains("schema")
                );
            }
        }
        let mut missing = value;
        missing.as_object_mut().unwrap().remove("keyzoneCapacity");
        assert!(
            fingerprint_canonical_config(&serde_json::to_string(&missing).unwrap())
                .unwrap_err()
                .contains("schema")
        );
    }
}
