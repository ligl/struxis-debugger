//! Owned, immutable projection of one confirmed Struxis checkpoint.
//!
//! This is the boundary between thread-local Nautilus / Struxis objects and
//! later checkpoint persistence or UI transport. No borrowed domain view or
//! Cache-backed series escapes this module.

use serde::{Deserialize, Serialize};

use crate::{diagnostics::Diagnostic, run::RunState};

use capitus_struxis::{
    StruxisStateView,
    sbar::{SBar, SBarSeries},
    structure::trend::{Trend, TrendSeries},
};

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ReplayCheckpointProjection {
    pub(crate) state_key: String,
    pub(crate) last_ts_event: Option<String>,
    pub(crate) sbar_count: usize,
    pub(crate) sbars: Vec<SBarCheckpoint>,
    pub(crate) structure: Option<StructureCheckpoint>,
    /// Structured diagnostics observed at this exact confirmed Bar boundary.
    pub(crate) diagnostics: Vec<Diagnostic>,
    pub(crate) keyzones: Option<KeyZoneCheckpoint>,
}

/// Small live Inspector payload derived from one backend-confirmed checkpoint.
/// It excludes the complete SBar history to avoid resending the entire sequence
/// whenever the UI polls during Replay.
/// Minimal immutable trajectory record retained for an explicit Snapshot save.
/// It intentionally excludes the full SBar history carried by the live chart projection.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct OwnedCheckpoint {
    pub(crate) checkpoint_index: usize,
    pub(crate) sbar_id: String,
    pub(crate) ts_event: String,
    pub(crate) state_key: String,
    pub(crate) structure: Option<StructureCheckpoint>,
    pub(crate) diagnostics: Vec<Diagnostic>,
    pub(crate) keyzones: Option<KeyZoneCheckpoint>,
}

impl OwnedCheckpoint {
    pub(crate) fn from_projection(
        checkpoint_index: usize,
        sbar_id: &str,
        projection: &ReplayCheckpointProjection,
    ) -> Result<Self, String> {
        if projection.last_ts_event.as_deref() != Some(sbar_id) {
            return Err(format!(
                "Owned Checkpoint SBar mismatch at index {checkpoint_index}"
            ));
        }
        let current_sbar = projection
            .sbars
            .iter()
            .find(|bar| bar.sbar_id == sbar_id)
            .ok_or_else(|| format!("Owned Checkpoint SBar {sbar_id} is absent from projection"))?;
        Ok(Self {
            checkpoint_index,
            sbar_id: sbar_id.to_owned(),
            ts_event: current_sbar.ts_event.clone(),
            state_key: projection.state_key.clone(),
            structure: projection.structure.clone(),
            keyzones: projection.keyzones.clone(),
            diagnostics: projection.diagnostics.clone(),
        })
    }
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ReplayStepResult {
    pub(crate) run_state: RunState,
    pub(crate) inspector: Option<ReplayInspectorProjection>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ReplayInspectorProjection {
    pub(crate) state_key: String,
    pub(crate) checkpoint_index: usize,
    pub(crate) sbar_id: String,
    pub(crate) sbar: SBarCheckpoint,
    pub(crate) structure: Option<StructureCheckpoint>,
    pub(crate) keyzones: Option<KeyZoneCheckpoint>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SBarCheckpoint {
    pub(crate) sbar_id: String,
    pub(crate) bar_type: String,
    pub(crate) ts_event: String,
    pub(crate) ts_init: String,
    pub(crate) open: String,
    pub(crate) high: String,
    pub(crate) low: String,
    pub(crate) close: String,
    pub(crate) volume: String,
    pub(crate) body: String,
    pub(crate) upper_shadow: String,
    pub(crate) lower_shadow: String,
    pub(crate) total_range: String,
    pub(crate) body_ratio: f64,
    pub(crate) shadow_ratio: f64,
    pub(crate) direction: String,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct StructureCheckpoint {
    pub(crate) cbar_count: usize,
    pub(crate) cbars: Vec<CBarCheckpoint>,
    pub(crate) swing_count: usize,
    pub(crate) swings: Vec<SwingCheckpoint>,
    pub(crate) trend_count: usize,
    pub(crate) trends: Vec<TrendCheckpoint>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) feature_sequence: Option<Vec<FeatureElementCheckpoint>>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct FeatureElementCheckpoint {
    pub(crate) feature_id: String,
    pub(crate) high: String,
    pub(crate) low: String,
    pub(crate) source_start_swing_id: String,
    pub(crate) source_end_swing_id: String,
    pub(crate) sbar_start_id: String,
    pub(crate) sbar_end_id: String,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CBarCheckpoint {
    pub(crate) cbar_id: String,
    pub(crate) high: String,
    pub(crate) low: String,
    pub(crate) sbar_start_id: String,
    pub(crate) sbar_end_id: String,
    pub(crate) span_sbars: u32,
    pub(crate) fractal_type: Option<String>,
    pub(crate) created_at: String,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SwingCheckpoint {
    pub(crate) swing_id: String,
    pub(crate) direction: String,
    pub(crate) high: String,
    pub(crate) low: String,
    pub(crate) cbar_start_id: String,
    pub(crate) cbar_end_id: String,
    pub(crate) sbar_start_id: String,
    pub(crate) sbar_end_id: String,
    pub(crate) start_oi: Option<String>,
    pub(crate) end_oi: Option<String>,
    pub(crate) volume: String,
    pub(crate) span_sbars: u32,
    pub(crate) state: String,
    pub(crate) created_at: String,
    pub(crate) updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TrendCheckpoint {
    pub(crate) trend_id: String,
    pub(crate) direction: String,
    pub(crate) high: String,
    pub(crate) low: String,
    pub(crate) swing_start_id: String,
    pub(crate) swing_end_id: String,
    pub(crate) sbar_start_id: String,
    pub(crate) sbar_end_id: String,
    pub(crate) start_oi: Option<String>,
    pub(crate) end_oi: Option<String>,
    pub(crate) volume: String,
    pub(crate) span_sbars: u32,
    pub(crate) state: String,
    pub(crate) created_at: String,
    pub(crate) updated_at: String,
}

impl From<&Trend> for TrendCheckpoint {
    fn from(trend: &Trend) -> Self {
        Self {
            trend_id: trend.id.to_string(),
            direction: format!("{:?}", trend.direction),
            high: trend.high.to_string(),
            low: trend.low.to_string(),
            swing_start_id: trend.swing_start_id.to_string(),
            swing_end_id: trend.swing_end_id.to_string(),
            sbar_start_id: trend.sbar_start_id.to_string(),
            sbar_end_id: trend.sbar_end_id.to_string(),
            start_oi: trend.start_oi.map(|value| value.to_string()),
            end_oi: trend.end_oi.map(|value| value.to_string()),
            volume: trend.volume.to_string(),
            span_sbars: trend.span_sbars,
            state: format!("{:?}", trend.state),
            created_at: trend.created_at.to_string(),
            updated_at: trend.updated_at.to_string(),
        }
    }
}

fn project_trends(series: &TrendSeries) -> Vec<TrendCheckpoint> {
    series.iter().map(TrendCheckpoint::from).collect()
}

fn project_feature_sequence(
    structure: &capitus_struxis::structure::structure::Structure,
) -> Option<Vec<FeatureElementCheckpoint>> {
    structure.feature_sequence().and_then(|elements| {
        elements
            .iter()
            .map(|element| {
                let start_id = element.source_start_id();
                let end_id = element.source_end_id();
                let start_swing = structure.swings().get_swing(start_id)?;
                let end_swing = structure.swings().get_swing(end_id)?;
                Some(FeatureElementCheckpoint {
                    feature_id: format!("{start_id}:{end_id}"),
                    high: element.high().to_string(),
                    low: element.low().to_string(),
                    source_start_swing_id: start_id.to_string(),
                    source_end_swing_id: end_id.to_string(),
                    sbar_start_id: start_swing.sbar_start_id.to_string(),
                    sbar_end_id: end_swing.sbar_end_id.to_string(),
                })
            })
            .collect()
    })
}

impl ReplayCheckpointProjection {
    /// Creates a compact Inspector projection from this already confirmed checkpoint.
    /// All domain values are copied verbatim from the Struxis state projection.
    pub(crate) fn inspector_projection(
        &self,
        checkpoint_index: usize,
        sbar_id: &str,
    ) -> Result<ReplayInspectorProjection, String> {
        let sbar = self
            .sbars
            .iter()
            .find(|sbar| sbar.sbar_id == sbar_id)
            .cloned()
            .ok_or_else(|| {
                format!("Confirmed checkpoint SBar {sbar_id} is absent from projection")
            })?;
        Ok(ReplayInspectorProjection {
            state_key: self.state_key.clone(),
            checkpoint_index,
            sbar_id: sbar_id.to_owned(),
            sbar,
            structure: self.structure.clone(),
            keyzones: self.keyzones.clone(),
        })
    }

    /// Extracts all currently retained state from a short-lived read-only view.
    ///
    /// Callers must drop the supplied view before the next Strategy callback,
    /// Struxis mutation, worker message wait, or thread boundary.
    pub(crate) fn from_state_view(state: &StruxisStateView<'_>) -> Self {
        let sbars = project_sbars(state.sbars());
        let structure = structure_from_state_view(state);

        Self {
            state_key: format!("{:?}", state.key()),
            last_ts_event: state.last_ts_event().map(|value| value.to_string()),
            sbar_count: sbars.len(),
            sbars,
            structure,
            keyzones: None,
            diagnostics: Vec::new(),
        }
    }
}

fn project_sbars(series: &SBarSeries) -> Vec<SBarCheckpoint> {
    series
        .last_n(series.len())
        .into_iter()
        .map(|bar| SBarCheckpoint {
            sbar_id: bar.id().to_string(),
            bar_type: bar.bar_type.to_string(),
            ts_event: bar.ts_event.to_string(),
            ts_init: bar.ts_init.to_string(),
            open: bar.open.to_string(),
            high: bar.high.to_string(),
            low: bar.low.to_string(),
            close: bar.close.to_string(),
            volume: bar.volume.to_string(),
            body: bar.body().to_string(),
            upper_shadow: bar.upper_shadow().to_string(),
            lower_shadow: bar.lower_shadow().to_string(),
            total_range: bar.total_range().to_string(),
            body_ratio: bar.body_ratio(),
            shadow_ratio: bar.shadow_ratio(),
            direction: format!("{:?}", bar.direction()),
        })
        .collect()
}

pub(crate) fn structure_from_state_view(
    state: &StruxisStateView<'_>,
) -> Option<StructureCheckpoint> {
    state.structure().map(|structure| {
        let cbars = structure
            .cbars()
            .last_n(structure.cbars().len())
            .into_iter()
            .map(|cbar| CBarCheckpoint {
                cbar_id: cbar.id.to_string(),
                high: cbar.high.to_string(),
                low: cbar.low.to_string(),
                sbar_start_id: cbar.sbar_start_id.to_string(),
                sbar_end_id: cbar.sbar_end_id.to_string(),
                span_sbars: cbar.span_sbars,
                fractal_type: cbar.fractal_type.map(|kind| format!("{kind:?}")),
                created_at: cbar.created_at.to_string(),
            })
            .collect::<Vec<_>>();
        let swings = structure
            .swings()
            .iter()
            .map(|swing| SwingCheckpoint {
                swing_id: swing.id.to_string(),
                direction: format!("{:?}", swing.direction),
                high: swing.high.to_string(),
                low: swing.low.to_string(),
                cbar_start_id: swing.cbar_start_id.to_string(),
                cbar_end_id: swing.cbar_end_id.to_string(),
                sbar_start_id: swing.sbar_start_id.to_string(),
                sbar_end_id: swing.sbar_end_id.to_string(),
                start_oi: swing.start_oi.map(|value| value.to_string()),
                end_oi: swing.end_oi.map(|value| value.to_string()),
                volume: swing.volume.to_string(),
                span_sbars: swing.span_sbars,
                state: format!("{:?}", swing.state),
                created_at: swing.created_at.to_string(),
                updated_at: swing.updated_at.to_string(),
            })
            .collect::<Vec<_>>();
        let trends = project_trends(structure.trends());
        let feature_sequence = project_feature_sequence(structure);
        StructureCheckpoint {
            cbar_count: cbars.len(),
            cbars,
            swing_count: swings.len(),
            swings,
            trend_count: trends.len(),
            trends,
            feature_sequence,
        }
    })
}

/// Owned Instrument Registry projection. Absence means this recording predates
/// KeyZone support; Some with empty collections is an observed empty Registry.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct KeyZoneCheckpoint {
    pub(crate) instrument_id: String,
    pub(crate) observations: Vec<KeyZoneObservation>,
    pub(crate) zones: Vec<KeyZoneObject>,
    pub(crate) interactions: Vec<KeyZoneInteraction>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct KeyZoneObject {
    pub(crate) keyzone_id: String,
    pub(crate) origin_kind: String,
    pub(crate) origin_id: Option<String>,
    pub(crate) timeframe: String,
    pub(crate) lower: String,
    pub(crate) upper: String,
    pub(crate) state: String,
    pub(crate) formed_at: String,
    pub(crate) created_at: String,
    pub(crate) finalized_at: Option<String>,
    pub(crate) finalized_detected_at: Option<String>,
    pub(crate) invalidated_at: Option<String>,
    pub(crate) invalidated_detected_at: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct KeyZoneInteraction {
    pub(crate) interaction_id: String,
    pub(crate) keyzone_id: String,
    pub(crate) observer_timeframe: String,
    pub(crate) observation_id: String,
    pub(crate) observer: ObservationStateKey,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) interrupted_at: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) interrupted_detected_at: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) interruption_reason: Option<String>,
    pub(crate) state: String,
    pub(crate) config_n: String,
    pub(crate) config_x: f64,
    pub(crate) outside_count: String,
    pub(crate) last_processed_at: Option<String>,
    pub(crate) started_at: String,
    pub(crate) started_detected_at: String,
    pub(crate) ended_at: Option<String>,
    pub(crate) ended_detected_at: Option<String>,
    pub(crate) invalidated_at: Option<String>,
    pub(crate) invalidated_detected_at: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct ObservationStateKey {
    pub(crate) instrument_id: String,
    pub(crate) timeframe: String,
}
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct KeyZoneObservation {
    pub(crate) observation_id: String,
    pub(crate) consumer_id: String,
    pub(crate) request_id: String,
    pub(crate) keyzone_id: String,
    pub(crate) observer: ObservationStateKey,
    pub(crate) start_mode: String,
    pub(crate) start_at: String,
    pub(crate) start_exclusive: bool,
    pub(crate) deadline: String,
    pub(crate) completion: String,
    pub(crate) config_n: String,
    pub(crate) config_x: f64,
    pub(crate) created_at: String,
    pub(crate) state: String,
    pub(crate) reason: Option<String>,
    pub(crate) last_processed_at: Option<String>,
    pub(crate) terminal_at: Option<String>,
    pub(crate) terminal_detected_at: Option<String>,
}

impl KeyZoneCheckpoint {
    pub(crate) fn from_registry(
        registry: &capitus_struxis::keyzone::KeyZoneRegistry,
    ) -> Result<Self, String> {
        use capitus_struxis::keyzone::KeyZoneOrigin;
        let mut zones = Vec::new();
        let mut interactions = Vec::new();
        for zone in registry.keyzones() {
            let temporal = zone.temporal();
            let (origin_kind, origin_id) = match zone.origin() {
                KeyZoneOrigin::Swing(id) => ("Swing", Some(id.to_string())),
                KeyZoneOrigin::Trend(id) => ("Trend", Some(id.to_string())),
                KeyZoneOrigin::FixedPriceRange => ("FixedPriceRange", None),
            };
            zones.push(KeyZoneObject {
                keyzone_id: zone.id().value().to_string(),
                origin_kind: origin_kind.into(),
                origin_id,
                timeframe: zone.timeframe().to_string(),
                lower: zone.price_range().lower().to_string(),
                upper: zone.price_range().upper().to_string(),
                state: format!("{:?}", zone.state()),
                formed_at: temporal.formed_at.to_string(),
                created_at: temporal.created_at.to_string(),
                finalized_at: temporal.finalized_at.map(|at| at.to_string()),
                finalized_detected_at: temporal.finalized_detected_at.map(|at| at.to_string()),
                invalidated_at: temporal.invalidated_at.map(|at| at.to_string()),
                invalidated_detected_at: temporal.invalidated_detected_at.map(|at| at.to_string()),
            });
            for interaction in registry
                .interactions_for(zone.id())
                .map_err(|error| error.to_string())?
            {
                let temporal = interaction.temporal();
                interactions.push(KeyZoneInteraction {
                    interaction_id: interaction.id().value().to_string(),
                    keyzone_id: zone.id().value().to_string(),
                    observer_timeframe: interaction.observer_timeframe().to_string(),
                    observation_id: interaction.observation_id().value().to_string(),
                    observer: ObservationStateKey {
                        instrument_id: interaction.observer().instrument_id.to_string(),
                        timeframe: interaction.observer().timeframe.to_string(),
                    },
                    interrupted_at: temporal.interrupted_at.map(|t| t.to_string()),
                    interrupted_detected_at: temporal
                        .interrupted_detected_at
                        .map(|t| t.to_string()),
                    interruption_reason: temporal.interruption_reason.map(|r| format!("{r:?}")),
                    state: format!("{:?}", interaction.state()),
                    config_n: interaction.config().n().to_string(),
                    config_x: interaction.config().x(),
                    outside_count: interaction.outside_count().to_string(),
                    last_processed_at: interaction.last_processed_at().map(|at| at.to_string()),
                    started_at: temporal.started_at.to_string(),
                    started_detected_at: temporal.started_detected_at.to_string(),
                    ended_at: temporal.ended_at.map(|at| at.to_string()),
                    ended_detected_at: temporal.ended_detected_at.map(|at| at.to_string()),
                    invalidated_at: temporal.invalidated_at.map(|at| at.to_string()),
                    invalidated_detected_at: temporal
                        .invalidated_detected_at
                        .map(|at| at.to_string()),
                });
            }
        }
        Ok(Self {
            instrument_id: registry.instrument_id().to_string(),
            observations: registry
                .observations()
                .map(|o| {
                    let r = o.request();
                    KeyZoneObservation {
                        observation_id: o.id().value().to_string(),
                        consumer_id: r.consumer_id.clone(),
                        request_id: r.request_id.clone(),
                        keyzone_id: r.zone.id.value().to_string(),
                        observer: ObservationStateKey {
                            instrument_id: r.observer.instrument_id.to_string(),
                            timeframe: r.observer.timeframe.to_string(),
                        },
                        start_mode: match r.start {
                            capitus_struxis::keyzone::ObservationStart::AfterCurrentCursor => {
                                "AfterCurrentCursor"
                            }
                            capitus_struxis::keyzone::ObservationStart::FromTime(_) => "FromTime",
                        }
                        .into(),
                        start_at: o.start_at().to_string(),
                        start_exclusive: o.start_exclusive(),
                        deadline: r.deadline.to_string(),
                        completion: format!("{:?}", r.completion),
                        config_n: r.config.n().to_string(),
                        config_x: r.config.x(),
                        created_at: o.created_at().to_string(),
                        state: format!("{:?}", o.state()),
                        reason: o.reason().map(|r| format!("{r:?}")),
                        last_processed_at: o.last_processed_at().map(|t| t.to_string()),
                        terminal_at: o.terminal_at().map(|t| t.to_string()),
                        terminal_detected_at: o.terminal_detected_at().map(|t| t.to_string()),
                    }
                })
                .collect(),
            zones,
            interactions,
        })
    }
}

#[cfg(test)]
mod trend_checkpoint_tests {
    use super::{FeatureElementCheckpoint, TrendCheckpoint};

    #[test]
    fn feature_element_checkpoint_preserves_price_precision_and_source_anchors() {
        let feature = FeatureElementCheckpoint {
            feature_id: "9007199254740993:9007199254740999".into(),
            high: "12345678901234567890.123456".into(),
            low: "12345678901234567889.654321".into(),
            source_start_swing_id: "9007199254740993".into(),
            source_end_swing_id: "9007199254740999".into(),
            sbar_start_id: "1700000000000000001".into(),
            sbar_end_id: "1700000000000000009".into(),
        };
        let value = serde_json::to_value(feature).unwrap();
        assert_eq!(value["high"], "12345678901234567890.123456");
        assert_eq!(value["low"], "12345678901234567889.654321");
        assert_eq!(value["sourceStartSwingId"], "9007199254740993");
        assert_eq!(value["sourceEndSwingId"], "9007199254740999");
        assert_eq!(value["sbarStartId"], "1700000000000000001");
        assert_eq!(value["sbarEndId"], "1700000000000000009");
    }

    #[test]
    fn trend_checkpoint_preserves_domain_precision_and_camel_case() {
        let trend = TrendCheckpoint {
            trend_id: "18446744073709551614".into(),
            direction: "Up".into(),
            high: "12345678901234567890.123".into(),
            low: "12345678901234567889.123".into(),
            swing_start_id: "9007199254740993".into(),
            swing_end_id: "9007199254740995".into(),
            sbar_start_id: "1700000000000000001".into(),
            sbar_end_id: "1700000000000000009".into(),
            start_oi: Some("100.25".into()),
            end_oi: None,
            volume: "987654321.125".into(),
            span_sbars: 9,
            state: "Tentative".into(),
            created_at: "1700000000000000001".into(),
            updated_at: "1700000000000000009".into(),
        };
        let value = serde_json::to_value(trend).unwrap();
        assert_eq!(value["trendId"], "18446744073709551614");
        assert_eq!(value["high"], "12345678901234567890.123");
        assert_eq!(value["swingStartId"], "9007199254740993");
        assert_eq!(value["sbarStartId"], "1700000000000000001");
        assert_eq!(value["startOi"], "100.25");
        assert!(value["endOi"].is_null());
        assert_eq!(value["spanSbars"], 9);
        assert_eq!(value["state"], "Tentative");
        assert!(value.get("trend_id").is_none());
    }
}

#[cfg(test)]
pub(crate) mod keyzone_projection_tests {
    use super::*;
    use capitus_struxis::{
        Timeframe,
        keyzone::{KeyZoneRegistry, PriceRange},
    };
    use nautilus_model::{identifiers::InstrumentId, types::Price};
    use std::num::NonZeroU32;

    pub(crate) fn fixed_projection() -> KeyZoneCheckpoint {
        let mut registry = KeyZoneRegistry::new(InstrumentId::from("AUD/USD.SIM"));
        registry
            .create_fixed(
                Timeframe::minutes(NonZeroU32::new(5).unwrap()),
                PriceRange::new(Price::from("9.00001"), Price::from("12.00002")).unwrap(),
                9007199254740993_u64.into(),
            )
            .unwrap();
        KeyZoneCheckpoint::from_registry(&registry).unwrap()
    }

    pub(crate) fn observation_projection() -> KeyZoneCheckpoint {
        use capitus_struxis::{
            NautilusRuntime, Struxis, StruxisConfig, StruxisRegistrant, StruxisStateKey, keyzone::*,
        };
        use nautilus_common::cache::Cache;
        use nautilus_model::{
            data::{Bar, BarType},
            identifiers::StrategyId,
            types::Quantity,
        };
        use std::{cell::RefCell, rc::Rc, str::FromStr};
        let instrument = InstrumentId::from("AUD/USD.SIM");
        let bt = BarType::from_str("AUD/USD.SIM-5-MINUTE-LAST-EXTERNAL").unwrap();
        let key = StruxisStateKey::from_bar_type(&bt);
        let cache = Rc::new(RefCell::new(Cache::default()));
        let binding = Struxis::new(
            StruxisConfig::builder().enable_structure(false).build(),
            NautilusRuntime::new(Rc::clone(&cache)),
        );
        binding.register(
            key,
            StruxisRegistrant::Strategy(StrategyId::from("PROJECTION-TEST")),
        );
        let mut registry = KeyZoneRegistry::new(instrument);
        let (id, _) = registry
            .create_fixed(
                key.timeframe,
                PriceRange::new(Price::from("9"), Price::from("12")).unwrap(),
                100_u64.into(),
            )
            .unwrap();
        for (time, low, high, close) in [
            (100, "10", "11", "10"),
            (200, "14", "16", "15"),
            (300, "10", "11", "10"),
        ] {
            let bar = Bar::new(
                bt,
                Price::from(close),
                Price::from(high),
                Price::from(low),
                Price::from(close),
                Quantity::from("1"),
                time.into(),
                time.into(),
            );
            cache.borrow_mut().add_bar(bar).unwrap();
            binding.process(&bar);
            if time == 100 {
                let state = binding.state(key).unwrap();
                let history = ObserverHistory::new(state.sbars(), 100_u64.into(), None).unwrap();
                registry
                    .create_observation(
                        ObservationRequest {
                            consumer_id: "projection".into(),
                            request_id: "record".into(),
                            zone: KeyZoneRef {
                                instrument_id: instrument,
                                id,
                            },
                            observer: key,
                            start: ObservationStart::FromTime(100_u64.into()),
                            config: InteractionConfig::new(1, 0.5).unwrap(),
                            completion: ObservationCompletion::UntilDeadline,
                            deadline: 400_u64.into(),
                        },
                        history,
                        1000_u64.into(),
                    )
                    .unwrap();
            } else {
                registry.advance(&bar, 1000_u64.into()).unwrap();
            }
        }
        let task = registry.observations().next().unwrap().id();
        registry
            .cancel_observation(
                ObservationRef {
                    instrument_id: instrument,
                    id: task,
                },
                2000_u64.into(),
            )
            .unwrap();
        KeyZoneCheckpoint::from_registry(&registry).unwrap()
    }
    #[test]
    fn observation_projection_preserves_task_ownership_and_interruption() {
        let p = observation_projection();
        let tasks = &p.observations;
        assert_eq!(tasks.len(), 1);
        assert_eq!(tasks[0].observer.instrument_id, p.instrument_id);
        assert_eq!(tasks[0].state, "Cancelled");
        assert_eq!(tasks[0].config_n, "1");
        assert_eq!(tasks[0].config_x, 0.5);
        assert!(
            p.interactions
                .iter()
                .all(|i| i.config_n == "1" && i.config_x == 0.5)
        );
        assert_eq!(tasks[0].reason.as_deref(), Some("Cancelled"));
        assert_eq!(tasks[0].last_processed_at.as_deref(), Some("300"));
        assert_eq!(p.interactions.len(), 2);
        assert_eq!(p.interactions[0].state, "Ended");
        assert_eq!(p.interactions[0].ended_at.as_deref(), Some("200"));
        assert_eq!(p.interactions[1].state, "Interrupted");
        assert_eq!(
            p.interactions[1].interruption_reason.as_deref(),
            Some("Cancelled")
        );
        assert!(
            p.interactions
                .iter()
                .all(|i| i.observation_id == tasks[0].observation_id)
        );
    }

    #[test]
    fn keyzone_projection_keeps_domain_precision_origin_and_market_times() {
        let projection = fixed_projection();
        assert_eq!(projection.instrument_id, "AUD/USD.SIM");
        assert!(projection.observations.is_empty());
        assert_eq!(projection.zones.len(), 1);
        let zone = &projection.zones[0];
        assert_eq!(zone.origin_kind, "FixedPriceRange");
        assert_eq!(zone.origin_id, None);
        assert_eq!(zone.lower, "9.00001");
        assert_eq!(zone.upper, "12.00002");
        assert_eq!(zone.state, "Finalized");
        assert_eq!(zone.formed_at, "9007199254740993");
        assert_eq!(zone.finalized_at.as_deref(), Some("9007199254740993"));
        assert!(projection.interactions.is_empty());
    }

    #[test]
    fn keyzone_projection_matches_real_structure_dataflow() {
        use capitus_struxis::{
            NautilusRuntime, ProcessOutcome, Struxis, StruxisConfig, StruxisRegistrant,
            StruxisStateKey,
        };
        use nautilus_common::cache::Cache;
        use nautilus_model::{
            data::{Bar, BarType},
            identifiers::StrategyId,
            types::Quantity,
        };
        use std::{cell::RefCell, rc::Rc, str::FromStr};
        let cache = Rc::new(RefCell::new(Cache::default()));
        let struxis = Struxis::new(
            StruxisConfig::builder().build(),
            NautilusRuntime::new(Rc::clone(&cache)),
        );
        let bar_type = BarType::from_str("AUD/USD.SIM-1-MINUTE-LAST-EXTERNAL").unwrap();
        let key = StruxisStateKey::from_bar_type(&bar_type);
        struxis.register(
            key,
            StruxisRegistrant::Strategy(StrategyId::from("DEBUGGER-KEYZONE")),
        );
        for (index, (low, high)) in [
            ("17", "22"),
            ("5", "10"),
            ("15", "20"),
            ("23", "27"),
            ("30", "35"),
            ("24", "29"),
            ("15", "20"),
            ("22", "27"),
            ("10", "15"),
            ("14", "20"),
            ("20", "25"),
            ("24", "29"),
            ("28", "33"),
            ("34", "39"),
            ("26", "31"),
        ]
        .into_iter()
        .enumerate()
        {
            let time = ((index as u64 + 1) * 10).into();
            let bar = Bar::new(
                bar_type,
                Price::from(low),
                Price::from(high),
                Price::from(low),
                Price::from(low),
                Quantity::from("1"),
                time,
                time,
            );
            cache.borrow_mut().add_bar(bar).unwrap();
            assert!(matches!(
                struxis.process(&bar).outcome,
                ProcessOutcome::Processed { .. }
            ));
        }
        let registry = struxis.keyzones(key.instrument_id).unwrap();
        let projected = KeyZoneCheckpoint::from_registry(&registry).unwrap();
        assert_eq!(projected.zones.len(), 4);
        assert_eq!(
            projected
                .zones
                .iter()
                .filter(|zone| zone.origin_kind == "Swing")
                .count(),
            3
        );
        assert_eq!(
            projected
                .zones
                .iter()
                .filter(|zone| zone.origin_kind == "Trend")
                .count(),
            1
        );
        let first = projected
            .zones
            .iter()
            .find(|zone| zone.origin_kind == "Swing" && zone.origin_id.as_deref() == Some("20"))
            .unwrap();
        assert_eq!(first.lower, "5");
        assert_eq!(first.upper, "10");
        assert_eq!(first.finalized_at.as_deref(), Some("100"));
        assert!(projected.interactions.is_empty());
        assert!(projected.observations.is_empty());
    }
}
