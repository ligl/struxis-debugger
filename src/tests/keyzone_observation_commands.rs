//! Real Replay worker tests: domain facts are produced by streamed Bars.

use std::str::FromStr;

use capitus_struxis::StruxisStateKey;
use nautilus_model::{
    data::{Bar, BarType},
    instruments::{InstrumentAny, stubs::audusd_sim},
    types::{Price, Quantity},
};

use crate::{
    catalog::OriginLoad,
    dataset::{TestDataset, sequence_fingerprint},
    ipc::IpcErrorCode,
    manager::ReplayManager,
    observation::{
        CancelObservation, Completion, CreateObservation, ObservationCommand, ObservationContext,
        Operation,
    },
    replay::LoadedInput,
    worker::ReplayWorkerConfig,
};

const BASE: u64 = 1_735_689_600_000_000_000;
fn time(index: u64) -> String {
    (BASE + index * 60_000_000_000).to_string()
}

fn config() -> ReplayWorkerConfig {
    let bar_type = BarType::from_str("AUD/USD.SIM-1-MINUTE-LAST-EXTERNAL").unwrap();
    // The bottom at index 1 forms Swing's fixed [0.00005, 0.00010] zone.
    let ranges = [
        (17, 22),
        (5, 10),
        (15, 20),
        (23, 27),
        (30, 35),
        (24, 29),
        (15, 20),
        (22, 27),
        (10, 15),
        (14, 20),
        (20, 25),
        (24, 29),
        (28, 33),
        (34, 39),
        (26, 31),
        (8, 12),
        (7, 11),
        (6, 10),
        (5, 9),
    ];
    let bars = ranges
        .into_iter()
        .enumerate()
        .map(|(index, (low, high))| {
            let low = Price::from(format!("0.{low:05}"));
            let high = Price::from(format!("0.{high:05}"));
            let t = BASE + index as u64 * 60_000_000_000;
            Bar::new(
                bar_type,
                low,
                high,
                low,
                low,
                Quantity::from("1000"),
                t.into(),
                t.into(),
            )
        })
        .collect::<Vec<_>>();
    let state_key = StruxisStateKey::from_bar_type(&bar_type);
    let origin = OriginLoad {
        keyzones: None,
        origin_dataset_id: uuid::Uuid::new_v4(),
        state_key,
        sbar_sequence_fingerprint: sequence_fingerprint(state_key, &bars).unwrap(),
        bar_type: bar_type.to_string(),
        bars,
        structure: None,
    };
    let test = TestDataset::create(&origin, &time(0), &time(18)).unwrap();
    ReplayWorkerConfig {
        run_id: uuid::Uuid::new_v4().to_string(),
        input: LoadedInput::from_test(&test).unwrap(),
        instrument: InstrumentAny::CurrencyPair(audusd_sim()),
    }
}

fn paused() -> (ReplayManager, CreateObservation) {
    let mut manager = ReplayManager::new();
    let state = manager.start_interactive(config()).unwrap();
    for _ in 0..15 {
        manager.step_checkpoint().unwrap();
    }
    let inspector = manager.inspector().unwrap().unwrap();
    let registry = inspector.keyzones.unwrap();
    let zone = registry
        .zones
        .iter()
        .find(|zone| {
            zone.origin_kind == "Swing" && zone.formed_at == time(1) && zone.state != "Invalidated"
        })
        .unwrap();
    let request = CreateObservation {
        context: ObservationContext {
            run_id: state.run_id,
            expected_sbar_id: time(14),
        },
        keyzone_id: zone.keyzone_id.clone(),
        request_id: "debugger-observe".into(),
        start_at: None,
        n: "2".into(),
        x: 0.5,
        completion: Completion::UntilDeadline,
        deadline: time(18),
    };
    (manager, request)
}

#[test]
fn current_observation_refreshes_without_advancing_and_cancel_stops_its_interaction() {
    let (mut manager, request) = paused();
    let result = manager
        .observation(ObservationCommand::Create(request.clone()))
        .unwrap();
    assert_eq!(result.operation, Operation::Created);
    assert_eq!(result.inspector.sbar_id, time(14));
    let registry = result.inspector.keyzones.unwrap();
    assert_eq!(registry.observations.len(), 1);
    assert!(registry.interactions.is_empty());
    assert_eq!(manager.state().unwrap().unwrap().processed_count, 15);
    let retry = manager
        .observation(ObservationCommand::Create(request.clone()))
        .unwrap();
    assert_eq!(retry.operation, Operation::Existing);
    assert_eq!(retry.observation_id, result.observation_id);
    let step = manager.step_checkpoint().unwrap();
    let registry = step.inspector.unwrap().keyzones.unwrap();
    assert_eq!(registry.interactions.len(), 1);
    assert_eq!(registry.interactions[0].state, "Active");
    assert_eq!(registry.interactions[0].started_at, time(15));
    let cancel = CancelObservation {
        context: ObservationContext {
            expected_sbar_id: time(15),
            ..request.context
        },
        observation_id: result.observation_id,
    };
    let result = manager
        .observation(ObservationCommand::Cancel(cancel.clone()))
        .unwrap();
    assert_eq!(result.operation, Operation::Cancelled);
    let registry = result.inspector.keyzones.unwrap();
    assert_eq!(registry.observations[0].state, "Cancelled");
    assert_eq!(registry.interactions[0].state, "Interrupted");
    assert_eq!(
        registry.interactions[0].last_processed_at.as_deref(),
        Some(time(15).as_str())
    );
    assert_eq!(
        manager
            .observation(ObservationCommand::Cancel(cancel))
            .unwrap()
            .operation,
        Operation::AlreadyTerminated
    );
    let later = manager
        .step_checkpoint()
        .unwrap()
        .inspector
        .unwrap()
        .keyzones
        .unwrap();
    assert_eq!(later.interactions, registry.interactions);
    assert_eq!(later.observations, registry.observations);
    manager.dispose().unwrap();
}

#[test]
fn historical_observation_completes_from_fixed_market_facts_and_old_checkpoints_stay_immutable() {
    let (mut manager, mut request) = paused();
    request.start_at = Some(time(1));
    request.completion = Completion::AfterOneInteraction;
    let result = manager
        .observation(ObservationCommand::Create(request))
        .unwrap();
    let registry = result.inspector.keyzones.unwrap();
    assert_eq!(registry.observations[0].state, "Completed");
    assert_eq!(
        registry.observations[0].reason.as_deref(),
        Some("InteractionCompleted")
    );
    assert_eq!(registry.interactions.len(), 1);
    assert_eq!(registry.interactions[0].started_at, time(1));
    assert_eq!(
        registry.interactions[0].ended_at.as_deref(),
        Some(time(3).as_str())
    );
    for _ in 15..19 {
        manager.step_checkpoint().unwrap();
    }
    let data = manager.snapshot_data().unwrap();
    assert!(
        data.checkpoints[14]
            .keyzones
            .as_ref()
            .unwrap()
            .observations
            .is_empty()
    );
    assert_eq!(
        data.checkpoints[15].keyzones.as_ref().unwrap().observations[0].state,
        "Completed"
    );
}

#[test]
fn invalid_and_stale_commands_leave_run_and_registry_unchanged() {
    let (mut manager, request) = paused();
    let before = manager.inspector().unwrap();
    for (mut invalid, code) in [
        (
            {
                let mut r = request.clone();
                r.context.run_id = "old-run".into();
                r
            },
            IpcErrorCode::Conflict,
        ),
        (
            {
                let mut r = request.clone();
                r.context.expected_sbar_id = time(13);
                r
            },
            IpcErrorCode::Conflict,
        ),
        (
            {
                let mut r = request.clone();
                r.n = "0".into();
                r
            },
            IpcErrorCode::InvalidArgument,
        ),
        (
            {
                let mut r = request.clone();
                r.deadline = time(14);
                r
            },
            IpcErrorCode::InvalidArgument,
        ),
        (
            {
                let mut r = request.clone();
                r.start_at = Some(time(0));
                r.deadline = time(0);
                r
            },
            IpcErrorCode::InvalidArgument,
        ),
        (
            {
                let mut r = request.clone();
                r.keyzone_id = "18446744073709551615".into();
                r
            },
            IpcErrorCode::NotFound,
        ),
    ] {
        invalid.request_id = "invalid-request".into();
        assert_eq!(
            manager
                .observation(ObservationCommand::Create(invalid))
                .unwrap_err()
                .code,
            code
        );
        assert_eq!(manager.inspector().unwrap(), before);
        assert_eq!(manager.state().unwrap().unwrap().processed_count, 15);
    }
    let created = manager
        .observation(ObservationCommand::Create(request.clone()))
        .unwrap();
    let mut conflicting = request;
    conflicting.n = "3".into();
    assert_eq!(
        manager
            .observation(ObservationCommand::Create(conflicting))
            .unwrap_err()
            .code,
        IpcErrorCode::Conflict
    );
    assert_eq!(manager.inspector().unwrap().unwrap(), created.inspector);
    let state = manager.state().unwrap().unwrap();
    manager
        .observation(ObservationCommand::Cancel(CancelObservation {
            context: ObservationContext {
                run_id: state.run_id,
                expected_sbar_id: time(14),
            },
            observation_id: created.observation_id,
        }))
        .unwrap();
    manager.dispose().unwrap();
}

#[test]
fn old_run_requests_are_rejected_after_restart() {
    let (mut manager, request) = paused();
    manager.restart_interactive(config()).unwrap();
    assert_eq!(
        manager
            .observation(ObservationCommand::Create(request))
            .unwrap_err()
            .code,
        IpcErrorCode::Conflict
    );
    manager.dispose().unwrap();
}

#[test]
fn completion_with_active_observation_preserves_inspector_and_snapshot_facts() {
    let (mut manager, mut request) = paused();
    request.deadline = time(19);
    manager
        .observation(ObservationCommand::Create(request))
        .unwrap();
    for _ in 15..19 {
        manager.step_checkpoint().unwrap();
    }
    assert_eq!(
        manager.state().unwrap().unwrap().status,
        crate::run::RunStatus::Completed
    );
    let inspector = manager.inspector().unwrap().unwrap();
    let registry = inspector.keyzones.as_ref().unwrap();
    assert_eq!(registry.observations[0].state, "Observing");
    assert_eq!(registry.observations[0].reason, None);
    assert_eq!(registry.observations[0].terminal_at, None);
    assert_eq!(registry.interactions[0].state, "Active");
    assert_eq!(
        registry.interactions[0].last_processed_at.as_deref(),
        Some(time(18).as_str())
    );
    assert_eq!(registry.interactions[0].interrupted_at, None);
    let snapshot = manager.snapshot_data().unwrap();
    assert_eq!(
        snapshot.checkpoints.last().unwrap().keyzones,
        inspector.keyzones
    );
}

#[test]
fn stop_with_active_interaction_preserves_the_last_facts_without_cancelling() {
    let (mut manager, request) = paused();
    manager
        .observation(ObservationCommand::Create(request))
        .unwrap();
    manager.step_checkpoint().unwrap();
    let before = manager.inspector().unwrap().unwrap();
    let registry = before.keyzones.as_ref().unwrap();
    assert_eq!(registry.observations[0].state, "Observing");
    assert_eq!(registry.interactions[0].state, "Active");
    assert_eq!(
        manager.stop().unwrap().status,
        crate::run::RunStatus::Disposed
    );
    assert_eq!(manager.inspector().unwrap().unwrap(), before);
}

#[test]
fn restart_with_active_interaction_releases_old_worker_and_keeps_owned_results_unchanged() {
    let (mut manager, request) = paused();
    manager
        .observation(ObservationCommand::Create(request))
        .unwrap();
    manager.step_checkpoint().unwrap();
    let old = manager.inspector().unwrap().unwrap();
    let old_run_id = manager.state().unwrap().unwrap().run_id;
    let restarted = manager.restart_interactive(config()).unwrap();
    assert_ne!(restarted.run_id, old_run_id);
    assert_eq!(restarted.status, crate::run::RunStatus::Ready);
    assert!(manager.inspector().unwrap().is_none());
    assert_eq!(
        old.keyzones.as_ref().unwrap().observations[0].state,
        "Observing"
    );
    assert_eq!(
        old.keyzones.as_ref().unwrap().interactions[0].state,
        "Active"
    );
    let new = manager.step_checkpoint().unwrap().inspector.unwrap();
    assert!(new.keyzones.as_ref().unwrap().observations.is_empty());
    assert!(new.keyzones.as_ref().unwrap().interactions.is_empty());
    manager.dispose().unwrap();
}

#[test]
fn fixed_price_range_creation_is_separate_from_observation_and_survives_step() {
    use crate::observation::CreateFixedPriceRange;
    let (mut manager, mut observation) = paused();
    let before = manager.inspector().unwrap().unwrap();
    let created = manager
        .create_fixed_price_range(CreateFixedPriceRange {
            context: observation.context.clone(),
            lower: "0.00005".into(),
            upper: "0.00010".into(),
        })
        .unwrap();
    assert_eq!(created.inspector.sbar_id, time(14));
    assert_eq!(created.inspector.structure, before.structure);
    let registry = created.inspector.keyzones.as_ref().unwrap();
    assert_eq!(
        registry.zones.len(),
        before.keyzones.as_ref().unwrap().zones.len() + 1
    );
    assert!(registry.observations.is_empty());
    assert!(registry.interactions.is_empty());
    let fixed = registry
        .zones
        .iter()
        .find(|zone| zone.keyzone_id == created.keyzone_id)
        .unwrap();
    assert_eq!(fixed.origin_kind, "FixedPriceRange");
    assert_eq!(fixed.origin_id, None);
    assert_eq!(fixed.state, "Finalized");
    assert_eq!(fixed.lower, "0.00005");
    assert_eq!(fixed.upper, "0.00010");
    assert_eq!(fixed.formed_at, fixed.created_at);
    assert_eq!(fixed.finalized_at.as_ref(), Some(&fixed.created_at));
    // Fixed ranges may observe history preceding their system creation time.
    observation.keyzone_id = created.keyzone_id.clone();
    let observed = manager
        .observation(ObservationCommand::Create(observation))
        .unwrap();
    assert_eq!(
        observed
            .inspector
            .keyzones
            .as_ref()
            .unwrap()
            .observations
            .len(),
        1
    );
    let next = manager.step_checkpoint().unwrap();
    let next_inspector = next.inspector.unwrap();
    assert_eq!(next_inspector.sbar_id, time(15));
    assert!(
        next_inspector
            .keyzones
            .as_ref()
            .unwrap()
            .zones
            .iter()
            .any(|zone| zone.keyzone_id == created.keyzone_id)
    );
}

#[test]
fn fixed_price_range_rejects_invalid_prices_and_stale_context_without_creating_zones() {
    use crate::observation::CreateFixedPriceRange;
    let (mut manager, observation) = paused();
    let before = manager.inspector().unwrap().unwrap();
    for (lower, upper) in [
        ("", "1"),
        ("NaN", "1"),
        ("1", "1"),
        ("2", "1"),
        ("1", "infinity"),
    ] {
        let error = manager
            .create_fixed_price_range(CreateFixedPriceRange {
                context: observation.context.clone(),
                lower: lower.into(),
                upper: upper.into(),
            })
            .unwrap_err();
        assert_eq!(error.code, IpcErrorCode::InvalidArgument);
        assert_eq!(
            manager.inspector().unwrap().unwrap().keyzones,
            before.keyzones
        );
    }
    for context in [
        ObservationContext {
            run_id: "stale-run".into(),
            ..observation.context.clone()
        },
        ObservationContext {
            expected_sbar_id: time(13),
            ..observation.context.clone()
        },
    ] {
        let error = manager
            .create_fixed_price_range(CreateFixedPriceRange {
                context,
                lower: "1".into(),
                upper: "2".into(),
            })
            .unwrap_err();
        assert_eq!(error.code, IpcErrorCode::Conflict);
        assert_eq!(
            manager.inspector().unwrap().unwrap().keyzones,
            before.keyzones
        );
    }
    manager.stop().unwrap();
    assert!(
        manager
            .create_fixed_price_range(CreateFixedPriceRange {
                context: observation.context,
                lower: "1".into(),
                upper: "2".into(),
            })
            .is_err()
    );
}
