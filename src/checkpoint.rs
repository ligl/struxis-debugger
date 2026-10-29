//! Owned, immutable projection of one confirmed Struxis checkpoint.
//!
//! This is the boundary between thread-local Nautilus / Struxis objects and
//! later checkpoint persistence or UI transport. No borrowed domain view or
//! Cache-backed series escapes this module.

use serde::Serialize;

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
}

impl OwnedCheckpoint {
    pub(crate) fn from_projection(
        checkpoint_index: usize,
        sbar_id: &str,
        projection: &ReplayCheckpointProjection,
    ) -> Result<Self, String> {
        if projection.last_ts_event.as_deref() != Some(sbar_id) {
            return Err(format!("Owned Checkpoint SBar mismatch at index {checkpoint_index}"));
        }
        let current_sbar = projection.sbars.iter()
            .find(|bar| bar.sbar_id == sbar_id)
            .ok_or_else(|| format!("Owned Checkpoint SBar {sbar_id} is absent from projection"))?;
        Ok(Self {
            checkpoint_index,
            sbar_id: sbar_id.to_owned(),
            ts_event: current_sbar.ts_event.clone(),
            state_key: projection.state_key.clone(),
            structure: projection.structure.clone(),
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

impl ReplayCheckpointProjection {
    /// Creates a compact Inspector projection from this already confirmed checkpoint.
    /// All domain values are copied verbatim from the Struxis state projection.
    pub(crate) fn inspector_projection(
        &self,
        checkpoint_index: usize,
        sbar_id: &str,
    ) -> Result<ReplayInspectorProjection, String> {
        let sbar = self.sbars.iter()
            .find(|sbar| sbar.sbar_id == sbar_id)
            .cloned()
            .ok_or_else(|| format!("Confirmed checkpoint SBar {sbar_id} is absent from projection"))?;
        Ok(ReplayInspectorProjection {
            state_key: self.state_key.clone(),
            checkpoint_index,
            sbar_id: sbar_id.to_owned(),
            sbar,
            structure: self.structure.clone(),
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
            diagnostics: Vec::new(),
        }
    }
}

fn project_sbars(series: &SBarSeries) -> Vec<SBarCheckpoint> {
    series.last_n(series.len()).into_iter().map(|bar| SBarCheckpoint {
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
    }).collect()
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
        StructureCheckpoint {
            cbar_count: cbars.len(),
            cbars,
            swing_count: swings.len(),
            swings,
            trend_count: trends.len(),
            trends,
        }
    })
}

fn project_trends(series: &TrendSeries) -> Vec<TrendCheckpoint> {
    series.iter().map(TrendCheckpoint::from).collect()
}

#[cfg(test)]
mod trend_projection_tests {
    use super::TrendCheckpoint;
    use serde_json::json;

    #[test]
    fn trend_checkpoint_uses_camel_case_and_preserves_exact_values_as_strings() {
        let checkpoint = TrendCheckpoint {
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

        let value = serde_json::to_value(checkpoint).expect("Trend DTO should serialize");

        assert_eq!(value["trendId"], json!("18446744073709551614"));
        assert_eq!(value["high"], json!("12345678901234567890.123"));
        assert_eq!(value["swingStartId"], json!("9007199254740993"));
        assert_eq!(value["sbarStartId"], json!("1700000000000000001"));
        assert_eq!(value["startOi"], json!("100.25"));
        assert_eq!(value["endOi"], serde_json::Value::Null);
        assert_eq!(value["spanSbars"], json!(9));
        assert_eq!(value["state"], json!("Tentative"));
        assert!(value.get("trend_id").is_none());
    }
}
