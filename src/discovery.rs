//! Catalog-backed discovery of exact BarType streams for Origin Load.
//!
//! Discovery enumerates Catalog file metadata only; it does not decode full bar
//! streams. A candidate is selectable only after Nautilus parses its exact
//! BarType and Catalog instrument metadata resolves the corresponding instrument.

use std::{
    collections::BTreeSet,
    path::{Path, PathBuf},
    str::FromStr,
};

use anyhow::{Context, Result, bail};
use nautilus_model::{
    data::{BarType, NautilusDataType},
    identifiers::InstrumentId,
};
use nautilus_persistence::{
    backend::parquet::catalog::ParquetDataCatalog,
    catalog::types::CatalogDataType,
};
use serde::Serialize;

/// The Catalog root used by the standalone Debugger during development.
pub fn configured_catalog_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../test_data/catalog")
}

/// Frontend-safe metadata for one discovered Catalog bar stream.
///
/// `id` is a stable selection key for the discovered entry. `bar_type` is
/// populated only when the directory identifier parses as an exact Nautilus
/// BarType. Unavailable entries remain visible with a diagnostic.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogDatasetEntry {
    pub id: String,
    pub bar_type: Option<String>,
    pub instrument_id: Option<String>,
    pub timeframe: Option<String>,
    pub available: bool,
    pub diagnostic: Option<String>,
}

/// Lists Catalog BarType streams without loading their complete data sequences.
///
/// File paths are used only to discover candidate stream identifiers. The
/// candidate must then be parsed by Nautilus and resolved against Catalog
/// Instrument metadata before it is marked available.
pub fn discover_catalog_datasets(catalog_path: &Path) -> Result<Vec<CatalogDatasetEntry>> {
    if !catalog_path.is_dir() {
        bail!(
            "Configured Catalog directory does not exist: {}",
            catalog_path.display()
        );
    }

    let catalog = ParquetDataCatalog::new(catalog_path, None, None, None, None);
    let bar_files = catalog
        .query_files(&CatalogDataType::from(NautilusDataType::Bar), None, None, None)
        .with_context(|| {
            format!(
                "Failed to discover Bar streams in Catalog {}",
                catalog_path.display()
            )
        })?;

    let mut candidates = BTreeSet::new();
    for file in bar_files {
        let Some(parent) = Path::new(&file).parent() else {
            continue;
        };
        let Some(segment) = parent.file_name().and_then(|name| name.to_str()) else {
            continue;
        };
        let decoded = decode_percent_encoded_segment(segment).unwrap_or_else(|_| segment.to_owned());
        if !decoded.is_empty() {
            candidates.insert(decoded);
        }
    }

    let mut entries = Vec::with_capacity(candidates.len());
    for candidate in candidates {
        entries.push(resolve_candidate(&catalog, candidate));
    }
    Ok(entries)
}

fn resolve_candidate(catalog: &ParquetDataCatalog, candidate: String) -> CatalogDatasetEntry {
    let parsed = match BarType::from_str(&candidate) {
        Ok(bar_type) => bar_type,
        Err(error) => {
            return unavailable(candidate, None, None, format!("Catalog BarType metadata is invalid: {error}"));
        }
    };

    let instrument_id: InstrumentId = parsed.instrument_id();
    let instrument_filter = instrument_id.to_string();
    let instruments = match catalog.query_instruments(Some(std::slice::from_ref(&instrument_filter))) {
        Ok(instruments) => instruments,
        Err(error) => {
            return unavailable(
                candidate,
                Some(parsed.to_string()),
                Some(instrument_filter),
                format!("Failed to resolve Catalog Instrument metadata: {error}"),
            );
        }
    };

    if !instruments.iter().any(|instrument| instrument.id() == instrument_id) {
        return unavailable(
            candidate,
            Some(parsed.to_string()),
            Some(instrument_filter),
            "No matching Instrument metadata exists in this Catalog".to_owned(),
        );
    }

    CatalogDatasetEntry {
        id: candidate,
        bar_type: Some(parsed.to_string()),
        instrument_id: Some(instrument_id.to_string()),
        timeframe: Some(parsed.spec().to_string()),
        available: true,
        diagnostic: None,
    }
}

fn unavailable(
    id: String,
    bar_type: Option<String>,
    instrument_id: Option<String>,
    diagnostic: String,
) -> CatalogDatasetEntry {
    CatalogDatasetEntry {
        id,
        bar_type,
        instrument_id,
        timeframe: None,
        available: false,
        diagnostic: Some(diagnostic),
    }
}

/// Decodes percent escapes in one Catalog path segment without treating 
/// as a space. Catalog identifiers are UTF-8 domain strings, not form data.
fn decode_percent_encoded_segment(segment: &str) -> Result<String> {
    let bytes = segment.as_bytes();
    let mut decoded = Vec::with_capacity(bytes.len());
    let mut index = 0;

    while index < bytes.len() {
        if bytes[index] == b'%' {
            if index + 2 >= bytes.len() {
                bail!("incomplete percent escape");
            }
            let high = hex_nibble(bytes[index + 1]).context("invalid percent escape")?;
            let low = hex_nibble(bytes[index + 2]).context("invalid percent escape")?;
            decoded.push((high << 4) | low);
            index += 3;
        } else {
            decoded.push(bytes[index]);
            index += 1;
        }
    }

    String::from_utf8(decoded).context("Catalog identifier is not valid UTF-8")
}

fn hex_nibble(value: u8) -> Option<u8> {
    match value {
        b'0'..=b'9' => Some(value - b'0'),
        b'a'..=b'f' => Some(value - b'a' + 10),
        b'A'..=b'F' => Some(value - b'A' + 10),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::{decode_percent_encoded_segment, hex_nibble};

    #[test]
    fn decodes_encoded_path_separator_without_form_semantics() {
        assert_eq!(
            decode_percent_encoded_segment("EUR%2FUSD.SIM-5-MINUTE-LAST-EXTERNAL")
                .expect("valid encoded identifier"),
            "EUR/USD.SIM-5-MINUTE-LAST-EXTERNAL"
        );
        assert_eq!(
            decode_percent_encoded_segment("A+B").expect("plus is a literal"),
            "A+B"
        );
    }

    #[test]
    fn rejects_invalid_percent_escapes_and_utf8() {
        assert!(decode_percent_encoded_segment("bad%").is_err());
        assert!(decode_percent_encoded_segment("%GG").is_err());
        assert!(decode_percent_encoded_segment("%FF").is_err());
    }

    #[test]
    fn hex_nibble_accepts_both_cases() {
        assert_eq!(hex_nibble(b'F'), Some(15));
        assert_eq!(hex_nibble(b'f'), Some(15));
        assert_eq!(hex_nibble(b'G'), None);
    }
}
