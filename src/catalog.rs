//! Read-only access to the complete Origin Dataset stored in a Nautilus Parquet catalog.

use std::path::Path;

use anyhow::{bail, Result};
use nautilus_model::data::Bar;

use crate::checkpoint::{StructureCheckpoint, structure_from_state_view};
use nautilus_persistence::backend::parquet::catalog::ParquetDataCatalog;

/// Loads every bar for one exact Nautilus BarType from a catalog.
///
/// No timestamp range or SQL predicate is applied. The returned records are
/// checked in event-time order; this function fails rather than silently
/// sorting a dataset whose ordering is inconsistent.
pub(crate) fn load_bars(catalog_path: &Path, bar_type: &str) -> Result<Vec<Bar>> {
    let mut catalog = ParquetDataCatalog::new(catalog_path, None, None, None, None);
    let bars = catalog.query::<Bar>(
        Some(vec![bar_type.to_owned()]),
        None,
        None,
        None,
        None,
        true,
    )?;

    validate_catalog_bars(&bars, bar_type)?;

    Ok(bars)
}

/// Validates Catalog stream ordering and timestamp uniqueness without sorting
/// or modifying the source sequence.
fn validate_catalog_bars(bars: &[Bar], bar_type: &str) -> Result<()> {
    use std::collections::HashMap;

    let mut first_ts_init_index = HashMap::with_capacity(bars.len());

    for (index, bar) in bars.iter().enumerate() {
        if let Some(first_index) = first_ts_init_index.insert(bar.ts_init, index) {
            bail!(
                "Catalog contains duplicate ts_init {} for {bar_type} at loaded_index={} and loaded_index={index}",
                bar.ts_init,
                first_index,
            );
        }

        if let Some(previous) = index.checked_sub(1).and_then(|i| bars.get(i)) {
            if previous.ts_event > bar.ts_event {
                bail!(
                    "Catalog bars are not ordered by ts_event for {bar_type}: previous ts_event={} at loaded_index={} is followed by ts_event={} at loaded_index={index}",
                    previous.ts_event,
                    index - 1,
                    bar.ts_event,
                );
            }
            if previous.ts_event == bar.ts_event {
                bail!(
                    "Catalog contains duplicate ts_event {} for {bar_type} at loaded_index={} and loaded_index={index}",
                    bar.ts_event,
                    index - 1,
                );
            }
        }
    }

    Ok(())
}


/// The validated, owned market-data projection returned by Origin Load.
///
/// Bars are copied from Struxis' read-only SBarSeries only after the complete
/// Catalog input has been processed and validated. The BacktestEngine and its
/// Cache are disposed before this value is returned.
#[derive(Debug, Clone)]
pub(crate) struct OriginLoad {
    pub(crate) origin_dataset_id: uuid::Uuid,
    pub(crate) state_key: capitus_struxis::StruxisStateKey,
    pub(crate) sbar_sequence_fingerprint: String,
    pub(crate) bar_type: String,
    pub(crate) bars: Vec<Bar>,
    pub(crate) structure: Option<StructureCheckpoint>,
}

/// Loads a complete Catalog BarType through Nautilus → Strategy → Struxis,
/// validates the resulting SBarSeries against the original input, and returns
/// an owned projection sourced from Struxis.
///
/// This is an Origin Load operation, not a replay step: the complete dataset is
/// processed in one temporary engine. Each later Run must create its own
/// independent engine, Cache, Strategy, and Struxis state.
pub(crate) fn load_origin(
    catalog_path: &Path,
    bar_type: &str,
    enable_structure: bool,
) -> Result<OriginLoad> {
    use std::str::FromStr;

    use capitus_strategy::StruxisDemo;
    use capitus_struxis::{NautilusRuntime, Struxis, StruxisConfig, StruxisStateKey};
    use nautilus_backtest::{
        config::{BacktestEngineConfig, SimulatedVenueConfig},
        engine::BacktestEngine,
    };
    use nautilus_execution::models::fee::{FeeModelAny, MakerTakerFeeModel};
    use nautilus_model::{
        enums::{AccountType, BookType, OmsType},
        identifiers::{StrategyId, Venue},
        instruments::Instrument,
        types::Money,
    };

    let origin_bars = load_bars(catalog_path, bar_type)?;
    let first_bar = origin_bars
        .first()
        .ok_or_else(|| anyhow::anyhow!("Origin Catalog contains no bars for {bar_type}"))?;
    let parsed_bar_type = nautilus_model::data::BarType::from_str(bar_type)?;
    anyhow::ensure!(
        first_bar.bar_type == parsed_bar_type,
        "Catalog returned BarType {} when {} was requested",
        first_bar.bar_type,
        parsed_bar_type
    );

    let instrument_id = parsed_bar_type.instrument_id();
    let instrument_id_filter = instrument_id.to_string();
    let catalog = ParquetDataCatalog::new(catalog_path, None, None, None, None);
    let instruments = catalog.query_instruments(Some(std::slice::from_ref(&instrument_id_filter)))?;
    let instrument = instruments
        .iter()
        .find(|instrument| instrument.id() == instrument_id)
        .ok_or_else(|| {
            anyhow::anyhow!(
                "Origin Catalog has bars for {bar_type} but no matching instrument {instrument_id}"
            )
        })?;

    let state_key = StruxisStateKey::from_bar_type(&parsed_bar_type);
    let venue = Venue::new(instrument_id.venue.as_str());
    let engine_config = BacktestEngineConfig {
        logging: nautilus_common::logging::logger::LoggerConfig::from_spec("stdout=Error")?,
        ..BacktestEngineConfig::default()
    };
    let mut engine = BacktestEngine::new(engine_config)?;
    let setup_result = (|| -> Result<(Vec<Bar>, Option<StructureCheckpoint>)> {
        engine.add_venue(
            SimulatedVenueConfig::builder()
                .venue(venue)
                .oms_type(OmsType::Hedging)
                .account_type(AccountType::Margin)
                .book_type(BookType::L1_MBP)
                .starting_balances(vec![Money::from("1_000_000 USD")])
                .fee_model(FeeModelAny::MakerTaker(MakerTakerFeeModel::zero()).into())
                .build()?,
        )?;
        engine.add_instrument(instrument)?;

        let runtime = NautilusRuntime::new(engine.kernel().cache.clone());
        let struxis = Struxis::new(
            StruxisConfig::builder()
                .enable_structure(enable_structure)
                .build(),
            runtime,
        );
        let strategy = StruxisDemo::new(
            struxis.clone(),
            StrategyId::from("STRUXIS-DEBUGGER-ORIGIN-LOAD"),
            vec![parsed_bar_type],
        )?;
        engine.add_strategy(strategy)?;
        engine.add_data(
            origin_bars.iter().cloned().map(nautilus_model::data::Data::Bar).collect(),
            None,
            true,
            true,
        )?;
        engine.run(None, None, None, false)?;

        let owned_projection = {
            let state = struxis.state(state_key).ok_or_else(|| {
                anyhow::anyhow!("Struxis state {state_key:?} was not created by Origin Load")
            })?;
            anyhow::ensure!(
                enable_structure || state.structure().is_none(),
                "Origin Load configured enable_structure=false but Struxis created Structure"
            );
            anyhow::ensure!(
                !enable_structure || state.structure().is_some(),
                "Origin Load configured enable_structure=true but Struxis did not create Structure"
            );
            validate_sbar_series(&origin_bars, state.sbars())?;
            let extracted = state.sbars().last_n(state.sbars().len());
            let structure = structure_from_state_view(&state);
            anyhow::ensure!(
                state.last_ts_event() == origin_bars.last().map(|bar| bar.ts_event),
                "Origin Load ended at {:?}, expected {:?}",
                state.last_ts_event(),
                origin_bars.last().map(|bar| bar.ts_event)
            );
            (extracted, structure)
        };

        Ok(owned_projection)
    })();

    // Dispose the temporary engine even when strategy processing or validation fails.
    engine.dispose();
    let (bars, structure) = setup_result?;
    let sbar_sequence_fingerprint = crate::dataset::sequence_fingerprint(state_key, &bars)?;

    Ok(OriginLoad {
        origin_dataset_id: uuid::Uuid::new_v4(),
        state_key,
        sbar_sequence_fingerprint,
        bar_type: parsed_bar_type.to_string(),
        bars,
        structure,
    })
}


/// Validates the complete Origin input against the SBar sequence exposed by Struxis.
///
/// The caller must pass the read-only series from the matching
/// `StruxisStateView`. Both sequences are compared oldest-first, without
/// sorting, filling gaps, normalizing values, or converting fixed-precision
/// prices/quantities to floating point.
pub(crate) fn validate_sbar_series(
    origin_bars: &[Bar],
    sbar_series: &capitus_struxis::sbar::SBarSeries,
) -> Result<()> {
    use capitus_struxis::sbar::SBar;

    let actual_count = sbar_series.len();
    let expected_count = origin_bars.len();
    if actual_count != expected_count {
        bail!(
            "Origin SBar validation count mismatch: expected={expected_count}, actual={actual_count}"
        );
    }

    let actual_bars = sbar_series.last_n(actual_count);
    if actual_bars.len() != expected_count {
        bail!(
            "Origin SBar validation could not extract the complete series: expected={expected_count}, actual={}",
            actual_bars.len()
        );
    }

    for (loaded_index, (expected, actual)) in
        origin_bars.iter().zip(actual_bars.iter()).enumerate()
    {
        let mut differences = Vec::new();

        if expected.id() != actual.id() {
            differences.push(format!(
                "sbar_id expected={:?} actual={:?}",
                expected.id(),
                actual.id()
            ));
        }
        if expected.bar_type != actual.bar_type {
            differences.push(format!(
                "bar_type expected={} actual={}",
                expected.bar_type,
                actual.bar_type
            ));
        }
        if expected.ts_event != actual.ts_event {
            differences.push(format!(
                "ts_event expected={} actual={}",
                expected.ts_event,
                actual.ts_event
            ));
        }
        if expected.ts_init != actual.ts_init {
            differences.push(format!(
                "ts_init expected={} actual={}",
                expected.ts_init,
                actual.ts_init
            ));
        }
        if expected.open != actual.open {
            differences.push(format!("open expected={} actual={}", expected.open, actual.open));
        }
        if expected.high != actual.high {
            differences.push(format!("high expected={} actual={}", expected.high, actual.high));
        }
        if expected.low != actual.low {
            differences.push(format!("low expected={} actual={}", expected.low, actual.low));
        }
        if expected.close != actual.close {
            differences.push(format!("close expected={} actual={}", expected.close, actual.close));
        }
        if expected.volume != actual.volume {
            differences.push(format!(
                "volume expected={} actual={}",
                expected.volume,
                actual.volume
            ));
        }

        if !differences.is_empty() {
            bail!(
                "Origin SBar validation mismatch at loaded_index={loaded_index}: expected_sbar_id={:?}, actual_sbar_id={:?}; {}",
                expected.id(),
                actual.id(),
                differences.join("; ")
            );
        }
    }

    Ok(())
}


#[cfg(test)]
mod tests {
    use super::validate_sbar_series;
    use std::{cell::RefCell, rc::Rc, str::FromStr};

    #[cfg(feature = "catalog-integration-tests")]
    use super::load_bars;
    #[cfg(feature = "catalog-integration-tests")]
    use std::path::PathBuf;

    use capitus_struxis::{
        NautilusRuntime, Struxis, StruxisConfig, StruxisRegistrant, StruxisStateKey,
    };
    use nautilus_common::cache::Cache;
    use nautilus_model::{
        data::{Bar, BarType},
        identifiers::StrategyId,
        types::{Price, Quantity},
    };

    const BAR_TYPE: &str = "BTCUSDT-PERP.BINANCE-5-MINUTE-LAST-EXTERNAL";

    fn fixture_bar(ts_event: u64, open: &str) -> Bar {
        fixture_bar_with_timestamps(ts_event, ts_event, open)
    }

    fn fixture_bar_with_timestamps(ts_event: u64, ts_init: u64, open: &str) -> Bar {
        let bar_type = BarType::from_str("AUD/USD.SIM-5-MINUTE-LAST-EXTERNAL")
            .expect("valid fixture BarType");
        Bar::new(
            bar_type,
            Price::from(open),
            Price::from("12.00"),
            Price::from("9.00"),
            Price::from("11.00"),
            Quantity::from("100"),
            ts_event.into(),
            ts_init.into(),
        )
    }

    fn processed_sbar_series(bars: &[Bar]) -> (Struxis, StruxisStateKey) {
        let cache = Rc::new(RefCell::new(Cache::default()));
        let struxis = Struxis::new(
            StruxisConfig::builder().build(),
            NautilusRuntime::new(Rc::clone(&cache)),
        );
        let key = StruxisStateKey::from_bar_type(&bars[0].bar_type);
        let registrant = StruxisRegistrant::Strategy(StrategyId::from("ORIGIN-VALIDATION-TEST"));
        struxis.register(key, registrant);

        for bar in bars {
            cache
                .borrow_mut()
                .add_bar(bar.clone())
                .expect("fixture Bar should be accepted by Cache");
            assert!(matches!(
                struxis.process(bar),
                capitus_struxis::ProcessOutcome::Processed { .. }
            ));
        }

        (struxis, key)
    }

    #[test]
    fn rejects_duplicate_ts_init_even_when_non_adjacent() {
        let bars = vec![
            fixture_bar(100, "10.00"),
            fixture_bar(200, "10.50"),
            Bar::new(
                BarType::from_str("AUD/USD.SIM-5-MINUTE-LAST-EXTERNAL")
                    .expect("valid fixture BarType"),
                Price::from("10.75"),
                Price::from("12.00"),
                Price::from("9.00"),
                Price::from("11.00"),
                Quantity::from("100"),
                300_u64.into(),
                100_u64.into(),
            ),
        ];

        let error = super::validate_catalog_bars(&bars, BAR_TYPE)
            .expect_err("duplicate ts_init must fail Catalog admission")
            .to_string();

        assert!(error.contains("duplicate ts_init 100"), "{error}");
        assert!(error.contains("loaded_index=0"), "{error}");
        assert!(error.contains("loaded_index=2"), "{error}");
    }

    #[test]
    fn accepts_unique_ts_init_in_event_time_order() {
        let bars = vec![
            fixture_bar(100, "10.00"),
            fixture_bar(200, "10.50"),
            fixture_bar(300, "10.75"),
        ];

        super::validate_catalog_bars(&bars, BAR_TYPE)
            .expect("unique ts_init values in event-time order should validate");
    }

    #[test]
    fn rejects_duplicate_ts_event_with_positions() {
        let bars = vec![
            fixture_bar_with_timestamps(100, 100, "10.00"),
            fixture_bar_with_timestamps(100, 101, "10.50"),
        ];

        let error = super::validate_catalog_bars(&bars, BAR_TYPE)
            .expect_err("duplicate ts_event must fail Catalog admission")
            .to_string();

        assert!(error.contains("duplicate ts_event 100"), "{error}");
        assert!(error.contains("loaded_index=0"), "{error}");
        assert!(error.contains("loaded_index=1"), "{error}");
    }

    #[test]
    fn validates_exact_oldest_first_sbar_series() {
        let origin = vec![
            fixture_bar(100, "10.00"),
            fixture_bar(200, "10.50"),
            fixture_bar(300, "10.75"),
        ];
        let (struxis, key) = processed_sbar_series(&origin);
        let state = struxis.state(key).expect("state should be registered");

        validate_sbar_series(&origin, state.sbars())
            .expect("identical Origin and Struxis SBar sequences should validate");
    }

    #[test]
    fn rejects_out_of_order_sbar_series_without_sorting_input() {
        let origin = vec![
            fixture_bar(100, "10.00"),
            fixture_bar(200, "10.50"),
            fixture_bar(300, "10.75"),
        ];
        let (struxis, key) = processed_sbar_series(&origin);
        let state = struxis.state(key).expect("state should be registered");
        let out_of_order_origin = vec![origin[1].clone(), origin[0].clone(), origin[2].clone()];

        let error = validate_sbar_series(&out_of_order_origin, state.sbars())
            .expect_err("SBar validation must reject sequence order mismatch")
            .to_string();

        assert!(error.contains("loaded_index=0"), "{error}");
        assert!(error.contains("sbar_id expected="), "{error}");
    }

    #[test]
    fn rejects_each_sbar_domain_attribute_mismatch_without_float_conversion() {
        let actual_input = vec![
            fixture_bar(100, "10.00"),
            fixture_bar(200, "10.50"),
            fixture_bar(300, "10.75"),
        ];
        let (struxis, key) = processed_sbar_series(&actual_input);
        let state = struxis.state(key).expect("state should be registered");

        let cases: Vec<(&str, Vec<Bar>, &str)> = vec![
            (
                "bar_type",
                {
                    let mut bars = actual_input.clone();
                    bars[1].bar_type = BarType::from_str("AUD/JPY.SIM-5-MINUTE-LAST-EXTERNAL")
                        .expect("valid alternate fixture BarType");
                    bars
                },
                "bar_type expected=",
            ),
            (
                "ts_event and SBarId",
                {
                    let mut bars = actual_input.clone();
                    bars[1].ts_event = 201_u64.into();
                    bars
                },
                "sbar_id expected=",
            ),
            (
                "ts_init",
                {
                    let mut bars = actual_input.clone();
                    bars[1].ts_init = 201_u64.into();
                    bars
                },
                "ts_init expected=201 actual=200",
            ),
            (
                "open",
                {
                    let mut bars = actual_input.clone();
                    bars[1].open = Price::from("10.25");
                    bars
                },
                "open expected=10.25 actual=10.50",
            ),
            (
                "high",
                {
                    let mut bars = actual_input.clone();
                    bars[1].high = Price::from("12.25");
                    bars
                },
                "high expected=12.25 actual=12.00",
            ),
            (
                "low",
                {
                    let mut bars = actual_input.clone();
                    bars[1].low = Price::from("8.75");
                    bars
                },
                "low expected=8.75 actual=9.00",
            ),
            (
                "close",
                {
                    let mut bars = actual_input.clone();
                    bars[1].close = Price::from("10.75");
                    bars
                },
                "close expected=10.75 actual=11.00",
            ),
            (
                "volume",
                {
                    let mut bars = actual_input.clone();
                    bars[1].volume = Quantity::from("101");
                    bars
                },
                "volume expected=101 actual=100",
            ),
        ];

        for (attribute, origin, expected_diagnostic) in cases {
            let error = validate_sbar_series(&origin, state.sbars())
                .expect_err(&format!("{attribute} mismatch must fail validation"))
                .to_string();
            assert!(
                error.contains("loaded_index=1"),
                "{attribute}: {error}"
            );
            assert!(
                error.contains(expected_diagnostic),
                "{attribute}: expected diagnostic {expected_diagnostic:?}, got {error}"
            );
        }
    }

    #[test]
    fn rejects_sbar_count_mismatch() {
        let actual_input = vec![fixture_bar(100, "10.00"), fixture_bar(200, "10.50")];
        let (struxis, key) = processed_sbar_series(&actual_input);
        let state = struxis.state(key).expect("state should be registered");
        let origin = vec![
            fixture_bar(100, "10.00"),
            fixture_bar(200, "10.50"),
            fixture_bar(300, "10.75"),
        ];

        let error = validate_sbar_series(&origin, state.sbars())
            .expect_err("missing SBar must fail validation")
            .to_string();

        assert!(error.contains("expected=3, actual=2"), "{error}");
    }

    #[cfg(feature = "catalog-integration-tests")]
    #[test]
    fn loads_origin_through_backtest_strategy_and_struxis() {
        let catalog_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../../test_data/catalog");

        let with_structure = super::load_origin(&catalog_path, BAR_TYPE, true)
            .unwrap_or_else(|error| panic!("Origin Load with structure enabled failed: {error:#}"));
        assert!(!with_structure.bars.is_empty());
        assert_eq!(with_structure.bar_type, BAR_TYPE);

        let without_structure = super::load_origin(&catalog_path, BAR_TYPE, false)
            .unwrap_or_else(|error| panic!("Origin Load with structure disabled failed: {error:#}"));
        assert_eq!(without_structure.bars, with_structure.bars);
        assert_eq!(
            without_structure.sbar_sequence_fingerprint,
            with_structure.sbar_sequence_fingerprint,
            "Load structure-calculation mode must not affect input-sequence identity"
        );
        assert_ne!(
            without_structure.origin_dataset_id,
            with_structure.origin_dataset_id,
            "each successful Load creates a distinct Origin Dataset instance"
        );
    }

    #[cfg(feature = "catalog-integration-tests")]
    #[test]
    fn loads_ethusdt_perpetual_daily_origin_with_structure_enabled() {
        // Regression coverage for the real ETH daily Catalog stream that has
        // triggered MissingSBar while the debugger processes historical bars.
        // Keep this tied to an exact BarType so a different instrument or
        // timeframe cannot silently replace the reproducer.
        const ETH_BAR_TYPE: &str = "ETHUSDT-PERP.BINANCE-1-DAY-LAST-EXTERNAL";
        let catalog_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../../test_data/catalog");

        let origin = super::load_origin(&catalog_path, ETH_BAR_TYPE, true)
            .unwrap_or_else(|error| {
                panic!(
                    "Origin Load failed for regression stream {ETH_BAR_TYPE}: {error:#}"
                )
            });

        assert_eq!(origin.bar_type, ETH_BAR_TYPE);
        assert!(
            !origin.bars.is_empty(),
            "ETH regression stream should produce a non-empty validated SBar sequence"
        );
        assert!(
            origin.structure.is_some(),
            "structure-enabled ETH Origin Load should expose its Struxis structure projection"
        );

        let first = origin.bars.first().expect("non-empty sequence asserted");
        let last = origin.bars.last().expect("non-empty sequence asserted");
        assert!(
            first.ts_event < last.ts_event,
            "ETH SBar sequence should cover multiple ordered bars: first={}, last={}",
            first.ts_event,
            last.ts_event
        );
    }

    #[cfg(feature = "catalog-integration-tests")]
    #[test]
    fn reads_complete_catalog_dataset_in_event_time_order() {
        let catalog_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../../test_data/catalog");

        let bars = load_bars(&catalog_path, BAR_TYPE)
            .unwrap_or_else(|error| panic!("failed to load {BAR_TYPE}: {error:#}"));

        assert!(
            !bars.is_empty(),
            "Catalog returned no bars for {BAR_TYPE} at {}",
            catalog_path.display()
        );

        let first = &bars[0];
        let last = bars.last().expect("non-empty bars checked above");

        println!(
            "Catalog smoke test: bar_type={BAR_TYPE}, count={}, first_ts_event={}, last_ts_event={}",
            bars.len(),
            first.ts_event,
            last.ts_event,
        );
        assert!(
            first.ts_event < last.ts_event,
            "expected multiple bars with increasing event timestamps, got first={} last={}",
            first.ts_event,
            last.ts_event
        );
    }
}
