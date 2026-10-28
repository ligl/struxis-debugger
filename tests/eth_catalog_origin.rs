#![cfg(feature = "catalog-integration-tests")]
// This integration target imports the binary's private modules to exercise the
// production Catalog loader; unrelated entry points in those modules are unused here.
#![allow(dead_code)]

//! Real-Catalog regression test for the ETH perpetual daily stream.
//!
//! The debugger is currently a binary crate, so this integration target includes
//! its source modules to exercise the same private Origin Load implementation
//! without moving production internals into a public library API.

#[path = "../src/app.rs"]
mod app;
#[path = "../src/catalog.rs"]
mod catalog;
#[path = "../src/compare.rs"]
mod compare;
#[path = "../src/commands.rs"]
mod commands;
#[path = "../src/dataset.rs"]
mod dataset;
#[path = "../src/discovery.rs"]
mod discovery;
#[path = "../src/ipc.rs"]
mod ipc;
#[path = "../src/run.rs"]
mod run;
#[path = "../src/replay.rs"]
mod replay;
#[path = "../src/checkpoint.rs"]
mod checkpoint;
#[path = "../src/diagnostics.rs"]
mod diagnostics;
#[path = "../src/worker.rs"]
mod worker;
#[path = "../src/manager.rs"]
mod manager;
#[path = "../src/snapshot.rs"]
mod snapshot;
#[path = "../src/snapshot_writer.rs"]
mod snapshot_writer;
#[path = "../src/snapshot_store.rs"]
mod snapshot_store;
#[path = "../src/effective_config.rs"]
mod effective_config;

#[test]
fn loads_ethusdt_perpetual_daily_origin_with_structure_enabled() {
    use std::path::PathBuf;

    // Exact stream reported to fail in the debugger. Do not replace this with
    // another instrument/timeframe, or the regression may stop reproducing it.
    const ETH_BAR_TYPE: &str = "ETHUSDT-PERP.BINANCE-1-DAY-LAST-EXTERNAL";
    let catalog_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../test_data/catalog");

    let origin = catalog::load_origin(&catalog_path, ETH_BAR_TYPE, true)
        .unwrap_or_else(|error| {
            panic!("Origin Load failed for regression stream {ETH_BAR_TYPE}: {error:#}")
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
