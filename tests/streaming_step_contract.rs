//! Contract tests for single-Bar streaming replay in the Debugger crate.
//!
//! Each fixture Bar has a distinct ts_init. A successful streaming batch must
//! finish the Nautilus Strategy callback and advance Struxis before run returns.
//! The Cache-backed SBar view must not expose bars from future batches.

use std::str::FromStr;

use capitus_strategy::StruxisDemo;
use capitus_struxis::{sbar::SBar, NautilusRuntime, Struxis, StruxisConfig, StruxisStateKey};
use nautilus_backtest::{
    config::{BacktestEngineConfig, SimulatedVenueConfig},
    engine::BacktestEngine,
};
use nautilus_execution::models::fee::{FeeModelAny, MakerTakerFeeModel};
use nautilus_model::{
    data::{Bar, BarType, Data},
    enums::{AccountType, BookType, OmsType},
    identifiers::{StrategyId, Venue},
    instruments::{Instrument, InstrumentAny, stubs::audusd_sim},
    types::{Money, Price, Quantity},
};

const VENUE: &str = "SIM";
const STARTING_BALANCE: &str = "1_000_000 USD";
const BAR_COUNT: usize = 6;

#[test]
fn each_streaming_batch_advances_strategy_and_struxis_by_exactly_one_bar() -> anyhow::Result<()> {
    let engine_config = BacktestEngineConfig {
        logging: nautilus_common::logging::logger::LoggerConfig::from_spec("stdout=Error")?,
        ..BacktestEngineConfig::default()
    };
    let mut engine = BacktestEngine::new(engine_config)?;

    engine.add_venue(
        SimulatedVenueConfig::builder()
            .venue(Venue::from(VENUE))
            .oms_type(OmsType::Hedging)
            .account_type(AccountType::Margin)
            .book_type(BookType::L1_MBP)
            .starting_balances(vec![Money::from(STARTING_BALANCE)])
            .fee_model(FeeModelAny::MakerTaker(MakerTakerFeeModel::zero()).into())
            .build()?,
    )?;

    let instrument = InstrumentAny::CurrencyPair(audusd_sim());
    let instrument_id = instrument.id();
    engine.add_instrument(&instrument)?;

    let bar_type = BarType::from_str(&format!("{instrument_id}-1-MINUTE-LAST-EXTERNAL"))?;
    let bars = generate_bars(bar_type);
    let expected_bars = bars.clone();
    let expected_timestamps: Vec<_> = bars.iter().map(|bar| bar.ts_event).collect();

    let runtime = NautilusRuntime::new(engine.kernel().cache.clone());
    let struxis = Struxis::new(
        StruxisConfig::builder().enable_structure(true).build(),
        runtime,
    );
    let key = StruxisStateKey::from_bar_type(&bar_type);
    let strategy = StruxisDemo::new(
        struxis.clone(),
        StrategyId::from("STRUXIS-DEBUGGER-STEP-TEST"),
        vec![bar_type],
    )?;
    engine.add_strategy(strategy)?;

    for (index, bar) in bars.into_iter().enumerate() {
        // Only the current logical Step is made available to the engine.
        // Clearing the pending stream must not clear historical Cache data.
        engine.clear_data();
        engine.add_data(vec![Data::Bar(bar)], None, true, true)?;
        engine.run(None, None, None, true)?;

        let processed_count = index + 1;
        let state = struxis
            .state(key)
            .expect("strategy registration must create the Struxis state");

        assert_eq!(
            state.last_ts_event(),
            Some(expected_timestamps[index]),
            "Step {processed_count} must return only after Struxis advances to its Bar"
        );
        assert_eq!(
            state.sbars().len(),
            processed_count,
            "Step {processed_count} must not expose future Bars through the Cache-backed SBarSeries"
        );

        let visible_bars = state.sbars().last_n(processed_count);
        assert_eq!(
            visible_bars.len(),
            processed_count,
            "Step {processed_count} must expose the complete processed prefix"
        );
        for (bar_index, (expected, actual)) in expected_bars[..processed_count]
            .iter()
            .zip(visible_bars.iter())
            .enumerate()
        {
            assert_eq!(
                actual.id(),
                expected.id(),
                "Step {processed_count}, bar {bar_index}: SBarId"
            );
            assert_eq!(
                actual.bar_type,
                expected.bar_type,
                "Step {processed_count}, bar {bar_index}: BarType"
            );
            assert_eq!(
                actual.ts_event,
                expected.ts_event,
                "Step {processed_count}, bar {bar_index}: ts_event"
            );
            assert_eq!(
                actual.ts_init,
                expected.ts_init,
                "Step {processed_count}, bar {bar_index}: ts_init"
            );
            assert_eq!(
                actual.open,
                expected.open,
                "Step {processed_count}, bar {bar_index}: open"
            );
            assert_eq!(
                actual.high,
                expected.high,
                "Step {processed_count}, bar {bar_index}: high"
            );
            assert_eq!(
                actual.low,
                expected.low,
                "Step {processed_count}, bar {bar_index}: low"
            );
            assert_eq!(
                actual.close,
                expected.close,
                "Step {processed_count}, bar {bar_index}: close"
            );
            assert_eq!(
                actual.volume,
                expected.volume,
                "Step {processed_count}, bar {bar_index}: volume"
            );
        }

        let checkpoint = capitus_struxis_debugger::checkpoint::ReplayCheckpointProjection::from_state_view(&state);
        assert_eq!(checkpoint.last_ts_event.as_deref(), Some(expected_timestamps[index].to_string().as_str()));
        assert_eq!(checkpoint.sbar_count, processed_count);
        assert_eq!(checkpoint.sbars.len(), processed_count);
        assert_eq!(checkpoint.sbars.first().map(|bar| bar.sbar_id.as_str()), Some(expected_bars[0].ts_event.to_string().as_str()));
        assert_eq!(checkpoint.sbars.last().map(|bar| bar.sbar_id.as_str()), Some(expected_bars[index].ts_event.to_string().as_str()));
        assert_eq!(
            checkpoint.structure.as_ref().map(|structure| structure.cbar_count),
            Some(state.structure().expect("structure enabled").cbars().len())
        );
        assert_eq!(
            checkpoint.structure.as_ref().map(|structure| structure.swing_count),
            Some(state.structure().expect("structure enabled").swings().iter().count())
        );

        assert!(
            state.structure().is_some(),
            "structure processing must remain enabled throughout replay"
        );
    }

    // Finalization must not mutate or invalidate the last completed checkpoint.
    let before_end = {
        let state = struxis
            .state(key)
            .expect("state should exist after the final streaming Step");
        (state.last_ts_event(), state.sbars().len())
    };
    assert_eq!(before_end.0, expected_timestamps.last().copied());
    assert_eq!(before_end.1, BAR_COUNT);

    engine.end()?;

    let after_end = {
        let state = struxis
            .state(key)
            .expect("state should remain readable after engine.end()");
        (state.last_ts_event(), state.sbars().len())
    };
    assert_eq!(after_end, before_end);

    engine.dispose();
    Ok(())
}

fn generate_bars(bar_type: BarType) -> Vec<Bar> {
    let base_ts = 1_735_689_600_000_000_000_u64;
    let interval = 60_u64 * 1_000_000_000;
    let mut bars = Vec::with_capacity(BAR_COUNT);

    for i in 0..BAR_COUNT {
        let center = 0.65000 + ((i % 4) as f64 * 0.00010);
        let open = center;
        let close = if i.is_multiple_of(2) {
            center + 0.00005
        } else {
            center - 0.00005
        };
        let high = open.max(close) + 0.00010;
        let low = open.min(close) - 0.00010;
        let ts = base_ts + i as u64 * interval;

        bars.push(Bar::new(
            bar_type,
            Price::from(format!("{open:.5}").as_str()),
            Price::from(format!("{high:.5}").as_str()),
            Price::from(format!("{low:.5}").as_str()),
            Price::from(format!("{close:.5}").as_str()),
            Quantity::from("100000"),
            ts.into(),
            ts.into(),
        ));
    }

    bars
}
