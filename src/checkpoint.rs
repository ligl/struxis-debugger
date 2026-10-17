//! Owned, immutable projection of one confirmed Struxis checkpoint.
//!
//! This is the boundary between thread-local Nautilus / Struxis objects and
//! later checkpoint persistence or UI transport. No borrowed domain view or
//! Cache-backed series escapes this module.

use serde::Serialize;

use capitus_struxis::{
    StruxisStateView,
    sbar::{SBar, SBarSeries},
    structure::{
        cbar::CBarSeries,
        swing::SwingSeries,
    },
};

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReplayCheckpointProjection {
    pub state_key: String,
    pub last_ts_event: Option<String>,
    pub sbar_count: usize,
    pub sbars: Vec<SBarCheckpoint>,
    pub structure: Option<StructureCheckpoint>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SBarCheckpoint {
    pub sbar_id: String,
    pub bar_type: String,
    pub ts_event: String,
    pub ts_init: String,
    pub open: String,
    pub high: String,
    pub low: String,
    pub close: String,
    pub volume: String,
    pub body: String,
    pub upper_shadow: String,
    pub lower_shadow: String,
    pub total_range: String,
    pub body_ratio: f64,
    pub shadow_ratio: f64,
    pub direction: String,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StructureCheckpoint {
    pub cbar_count: usize,
    pub cbars: Vec<CBarCheckpoint>,
    pub swing_count: usize,
    pub swings: Vec<SwingCheckpoint>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CBarCheckpoint {
    pub cbar_id: String,
    pub high: String,
    pub low: String,
    pub sbar_start_id: String,
    pub sbar_end_id: String,
    pub span_sbars: u32,
    pub fractal_type: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SwingCheckpoint {
    pub swing_id: String,
    pub direction: String,
    pub high: String,
    pub low: String,
    pub cbar_start_id: String,
    pub cbar_end_id: String,
    pub sbar_start_id: String,
    pub sbar_end_id: String,
    pub start_oi: Option<String>,
    pub end_oi: Option<String>,
    pub volume: String,
    pub span_sbars: u32,
    pub state: String,
    pub created_at: String,
    pub updated_at: String,
}

impl ReplayCheckpointProjection {
    /// Extracts all currently retained state from a short-lived read-only view.
    ///
    /// Callers must drop the supplied view before the next Strategy callback,
    /// Struxis mutation, worker message wait, or thread boundary.
    pub fn from_state_view(state: &StruxisStateView<'_>) -> Self {
        let sbars = project_sbars(state.sbars());
        let structure = state.structure().map(|structure| {
            let cbars = structure.cbars().last_n(structure.cbars().len())
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
            let swings = structure.swings().iter()
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
            StructureCheckpoint {
                cbar_count: cbars.len(),
                cbars,
                swing_count: swings.len(),
                swings,
            }
        });

        Self {
            state_key: format!("{:?}", state.key()),
            last_ts_event: state.last_ts_event().map(|value| value.to_string()),
            sbar_count: sbars.len(),
            sbars,
            structure,
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

