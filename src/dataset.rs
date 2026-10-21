//! Immutable Origin / Test Dataset models and input-sequence identity.

use std::collections::HashSet;

use anyhow::{Result, ensure};
use nautilus_model::data::Bar;
use sha2::{Digest, Sha256};
use uuid::Uuid;

use crate::catalog::OriginLoad;
use capitus_struxis::StruxisStateKey;

/// An immutable, session-scoped Test Dataset derived from a validated Origin.
#[derive(Debug, Clone)]
pub(crate) struct TestDataset {
    test_dataset_id: Uuid,
    origin_dataset_id: Uuid,
    state_key: StruxisStateKey,
    bar_type: String,
    start_sbar_id: String,
    end_sbar_id: String,
    bars: Vec<Bar>,
    sbar_sequence_fingerprint: String,
}

impl TestDataset {
    /// Creates a new Test Dataset from a continuous, inclusive Origin range.
    ///
    /// Selection boundaries are real SBar IDs represented as lossless decimal
    /// strings at the UI/IPC boundary. A new object ID is assigned on every
    /// successful call; object identity is excluded from the sequence fingerprint.
    pub(crate) fn create(origin: &OriginLoad, start_sbar_id: &str, end_sbar_id: &str) -> Result<Self> {
        validate_origin(origin)?;

        let start_index = origin
            .bars
            .iter()
            .position(|bar| bar.ts_event.to_string() == start_sbar_id)
            .ok_or_else(|| {
                anyhow::anyhow!("Test selection start SBar ID {start_sbar_id} is not in Origin")
            })?;
        let end_index = origin
            .bars
            .iter()
            .position(|bar| bar.ts_event.to_string() == end_sbar_id)
            .ok_or_else(|| {
                anyhow::anyhow!("Test selection end SBar ID {end_sbar_id} is not in Origin")
            })?;

        ensure!(
            start_index <= end_index,
            "Test selection is reversed: start loaded_index={start_index}, end loaded_index={end_index}"
        );

        let bars = origin.bars[start_index..=end_index].to_vec();
        let fingerprint = sequence_fingerprint(origin.state_key, &bars)?;

        Ok(Self {
            test_dataset_id: Uuid::new_v4(),
            origin_dataset_id: origin.origin_dataset_id,
            state_key: origin.state_key,
            bar_type: origin.bar_type.clone(),
            start_sbar_id: start_sbar_id.to_owned(),
            end_sbar_id: end_sbar_id.to_owned(),
            bars,
            sbar_sequence_fingerprint: fingerprint,
        })
    }

    #[must_use]
    pub(crate) const fn test_dataset_id(&self) -> Uuid {
        self.test_dataset_id
    }

    #[must_use]
    pub(crate) const fn origin_dataset_id(&self) -> Uuid {
        self.origin_dataset_id
    }

    #[must_use]
    pub(crate) const fn state_key(&self) -> StruxisStateKey {
        self.state_key
    }

    #[must_use]
    pub(crate) fn bar_type(&self) -> &str {
        &self.bar_type
    }

    #[must_use]
    pub(crate) fn start_sbar_id(&self) -> &str {
        &self.start_sbar_id
    }

    #[must_use]
    pub(crate) fn end_sbar_id(&self) -> &str {
        &self.end_sbar_id
    }

    #[must_use]
    pub(crate) fn bars(&self) -> &[Bar] {
        &self.bars
    }

    #[must_use]
    pub(crate) fn sbar_sequence_fingerprint(&self) -> &str {
        &self.sbar_sequence_fingerprint
    }
}

fn validate_origin(origin: &OriginLoad) -> Result<()> {
    ensure!(
        !origin.bars.is_empty(),
        "Cannot create Test Dataset from an empty Origin"
    );

    let expected_bar_type = origin
        .bars
        .first()
        .map(|bar| bar.bar_type)
        .ok_or_else(|| anyhow::anyhow!("Origin has no bars"))?;

    ensure!(
        origin.bar_type == expected_bar_type.to_string(),
        "Origin BarType metadata does not match its SBar sequence"
    );
    ensure!(
        StruxisStateKey::from_bar_type(&expected_bar_type) == origin.state_key,
        "Origin StruxisStateKey does not match its BarType"
    );

    let mut ts_init_values = HashSet::with_capacity(origin.bars.len());
    for (index, bar) in origin.bars.iter().enumerate() {
        ensure!(
            bar.bar_type == expected_bar_type,
            "Origin contains a different BarType at loaded_index={index}"
        );
        ensure!(
            ts_init_values.insert(bar.ts_init),
            "Origin contains duplicate ts_init {} at loaded_index={index}",
            bar.ts_init
        );

        if let Some(previous) = index.checked_sub(1).and_then(|i| origin.bars.get(i)) {
            ensure!(
                previous.ts_event < bar.ts_event,
                "Origin ts_event must be strictly increasing: previous={} at loaded_index={}, current={} at loaded_index={index}",
                previous.ts_event,
                index - 1,
                bar.ts_event
            );
        }
    }

    let recomputed = sequence_fingerprint(origin.state_key, &origin.bars)?;
    ensure!(
        recomputed == origin.sbar_sequence_fingerprint,
        "Origin SBar sequence fingerprint does not match its validated bars"
    );

    Ok(())
}

/// Computes the canonical SHA-256 semantic identity of a complete SBar sequence.
///
/// Canonical state-key text is <InstrumentId>|<duration-seconds>s (for example,
/// AUD/USD.SIM|300s). Duration-based encoding preserves StruxisStateKey equality
/// when equivalent Timeframe values use different units. JSON field order and
/// prefix are fixed by contract; integers and exact decimals are canonical strings.
pub(crate) fn sequence_fingerprint(state_key: StruxisStateKey, bars: &[Bar]) -> Result<String> {
    let canonical_state_key = format!(
        "{}|{}s",
        state_key.instrument_id,
        state_key.timeframe.duration().as_secs()
    );
    let state_key_json = serde_json::to_string(&canonical_state_key)?;
    let count_json = serde_json::to_string(&bars.len().to_string())?;

    let mut records = Vec::with_capacity(bars.len());
    for bar in bars {
        let bar_type = serde_json::to_string(&bar.bar_type.to_string())?;
        let sbar_id = serde_json::to_string(&bar.ts_event.to_string())?;
        let ts_event = serde_json::to_string(&bar.ts_event.to_string())?;
        let ts_init = serde_json::to_string(&bar.ts_init.to_string())?;
        let open = serde_json::to_string(&canonical_decimal(&bar.open.to_string()))?;
        let high = serde_json::to_string(&canonical_decimal(&bar.high.to_string()))?;
        let low = serde_json::to_string(&canonical_decimal(&bar.low.to_string()))?;
        let close = serde_json::to_string(&canonical_decimal(&bar.close.to_string()))?;
        let volume = serde_json::to_string(&canonical_decimal(&bar.volume.to_string()))?;

        records.push(format!(
            "{{\"bar_type\":{bar_type},\"sbar_id\":{sbar_id},\"ts_event\":{ts_event},\"ts_init\":{ts_init},\"open\":{open},\"high\":{high},\"low\":{low},\"close\":{close},\"volume\":{volume}}}"
        ));
    }

    let payload = format!(
        "{{\"state_key\":{state_key_json},\"sbar_count\":{count_json},\"sbar_records\":[{}]}}",
        records.join(",")
    );

    let mut hasher = Sha256::new();
    hasher.update(b"capitus.debug-chart.sbar-sequence\0");
    hasher.update(payload.as_bytes());
    Ok(format!("{:x}", hasher.finalize()))
}

fn canonical_decimal(value: &str) -> String {
    let mut value = value.trim().to_owned();
    if value.contains('.') {
        while value.ends_with('0') {
            value.pop();
        }
        if value.ends_with('.') {
            value.pop();
        }
    }
    if value == "-0" || value.is_empty() {
        "0".to_owned()
    } else if value.starts_with("-.") {
        value.insert(1, '0');
        value
    } else if value.starts_with('.') {
        value.insert(0, '0');
        value
    } else {
        value
    }
}

#[cfg(test)]
mod tests {
    use super::{TestDataset, canonical_decimal, sequence_fingerprint};
    use crate::catalog::OriginLoad;
    use capitus_struxis::StruxisStateKey;
    use nautilus_model::{
        data::{Bar, BarType},
        types::{Price, Quantity},
    };
    use std::str::FromStr;
    use uuid::Uuid;

    fn bar(ts_event: u64, ts_init: u64, open: &str) -> Bar {
        Bar::new(
            BarType::from_str("AUD/USD.SIM-5-MINUTE-LAST-EXTERNAL")
                .expect("valid fixture BarType"),
            Price::from(open),
            Price::from("12.00"),
            Price::from("9.00"),
            Price::from("11.00"),
            Quantity::from("100"),
            ts_event.into(),
            ts_init.into(),
        )
    }

    fn origin(bars: Vec<Bar>) -> OriginLoad {
        let bar_type = bars[0].bar_type;
        let state_key = StruxisStateKey::from_bar_type(&bar_type);
        let fingerprint =
            sequence_fingerprint(state_key, &bars).expect("fingerprint should compute");
        OriginLoad {
            origin_dataset_id: Uuid::new_v4(),
            state_key,
            sbar_sequence_fingerprint: fingerprint,
            bar_type: bar_type.to_string(),
            bars,
            structure: None,
        }
    }

    #[test]
    fn creates_continuous_inclusive_test_input() {
        let origin = origin(vec![
            bar(100, 100, "10.00"),
            bar(200, 200, "10.50"),
            bar(300, 300, "10.75"),
            bar(400, 400, "10.25"),
        ]);

        let test = TestDataset::create(&origin, "200", "300").expect("valid inclusive range");
        assert_eq!(test.bars().len(), 2);
        assert_eq!(test.start_sbar_id(), "200");
        assert_eq!(test.end_sbar_id(), "300");
        assert_eq!(test.bars()[0].ts_event.to_string(), "200");
        assert_eq!(test.bars()[1].ts_event.to_string(), "300");
        assert_eq!(test.origin_dataset_id(), origin.origin_dataset_id);
    }

    #[test]
    fn accepts_single_bar_and_full_origin_ranges() {
        let origin = origin(vec![
            bar(100, 100, "10.00"),
            bar(200, 200, "10.50"),
            bar(300, 300, "10.75"),
        ]);

        let single = TestDataset::create(&origin, "200", "200").expect("single-bar range");
        assert_eq!(single.bars().len(), 1);
        assert_eq!(single.start_sbar_id(), "200");
        assert_eq!(single.end_sbar_id(), "200");

        let full = TestDataset::create(&origin, "100", "300").expect("full Origin range");
        assert_eq!(full.bars().len(), origin.bars.len());
        assert_eq!(full.start_sbar_id(), "100");
        assert_eq!(full.end_sbar_id(), "300");
    }

    #[test]
    fn rejects_origin_with_a_mismatched_sequence_fingerprint() {
        let mut origin = origin(vec![bar(100, 100, "10.00"), bar(200, 200, "10.50")]);
        origin.sbar_sequence_fingerprint = "00".to_owned();

        assert!(TestDataset::create(&origin, "100", "200").is_err());
    }

    #[test]
    fn identical_ranges_have_distinct_ids_and_identical_fingerprints() {
        let origin = origin(vec![bar(100, 100, "10.00"), bar(200, 200, "10.50")]);
        let first = TestDataset::create(&origin, "100", "200").expect("first Test");
        let second = TestDataset::create(&origin, "100", "200").expect("second Test");

        assert_ne!(first.test_dataset_id(), second.test_dataset_id());
        assert_eq!(
            first.sbar_sequence_fingerprint(),
            second.sbar_sequence_fingerprint()
        );
    }

    #[test]
    fn rejects_missing_and_reversed_selection_boundaries() {
        let origin = origin(vec![bar(100, 100, "10.00"), bar(200, 200, "10.50")]);

        assert!(TestDataset::create(&origin, "99", "200").is_err());
        assert!(TestDataset::create(&origin, "100", "201").is_err());
        assert!(TestDataset::create(&origin, "200", "100").is_err());
    }

    #[test]
    fn fingerprint_matches_fixed_canonical_vector() {
        let one = bar(100, 100, "10.00");
        let state_key = StruxisStateKey::from_bar_type(&one.bar_type);
        let fingerprint = sequence_fingerprint(state_key, &[one]).expect("fingerprint");
        assert_eq!(
            fingerprint,
            "1a7a6f3ff9494caef302c8f51ebe6bdc32e1eafc0cde003c87aac17486319af6"
        );
    }

    #[test]
    fn fingerprint_changes_when_formal_bar_attributes_change() {
        let baseline = bar(100, 100, "10.00");
        let changed = bar(100, 100, "10.01");
        let state_key = StruxisStateKey::from_bar_type(&baseline.bar_type);

        assert_ne!(
            sequence_fingerprint(state_key, &[baseline]).expect("baseline fingerprint"),
            sequence_fingerprint(state_key, &[changed]).expect("changed fingerprint")
        );
    }

    #[test]
    fn fingerprint_changes_when_ordered_input_sequence_changes() {
        let bars = vec![bar(100, 100, "10.00"), bar(200, 200, "10.50")];
        let state_key = StruxisStateKey::from_bar_type(&bars[0].bar_type);
        let reversed = vec![bars[1].clone(), bars[0].clone()];

        assert_ne!(
            sequence_fingerprint(state_key, &bars).expect("ordered fingerprint"),
            sequence_fingerprint(state_key, &reversed).expect("reversed fingerprint")
        );
    }

    #[test]
    fn equivalent_timeframe_units_have_identical_state_key_encoding() {
        use capitus_struxis::Timeframe;
        use std::num::NonZeroU32;

        let one = bar(100, 100, "10.00");
        let key = StruxisStateKey::from_bar_type(&one.bar_type);
        let equivalent_key = StruxisStateKey {
            instrument_id: key.instrument_id,
            timeframe: Timeframe::seconds(NonZeroU32::new(300).expect("nonzero duration")),
        };

        assert_eq!(key, equivalent_key);
        assert_eq!(
            sequence_fingerprint(key, &[one.clone()]).expect("original key fingerprint"),
            sequence_fingerprint(equivalent_key, &[one]).expect("equivalent key fingerprint")
        );
    }

    #[test]
    fn canonical_decimal_removes_insignificant_zeroes_and_negative_zero() {
        assert_eq!(canonical_decimal("10.000"), "10");
        assert_eq!(canonical_decimal("0.0100"), "0.01");
        assert_eq!(canonical_decimal("-0.000"), "0");
        assert_eq!(canonical_decimal("-.2500"), "-0.25");
        assert_eq!(canonical_decimal("100"), "100");
    }
}
