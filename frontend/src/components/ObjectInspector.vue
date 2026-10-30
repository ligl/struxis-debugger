<script setup lang="ts">
import { computed, ref } from "vue";
import DatasetObjectDetails from "./DatasetObjectDetails.vue";
import CompareDifferenceDetails from "./CompareDifferenceDetails.vue";
import ReplayCheckpointSummary from "./ReplayCheckpointSummary.vue";
import ReplayObjectDetails from "./ReplayObjectDetails.vue";
import type { InspectorWorkspaceContext, OriginDatasetDto, ReplayInspectorStructureDto, SBarDto } from "../origin-types";
import { formatDomainTimestamp } from "../timestamp-format";

const props = defineProps<{
  context: InspectorWorkspaceContext;
  origin: OriginDatasetDto | null;
  originBars: SBarDto[];
  originStructure: ReplayInspectorStructureDto | null;
}>();

// These projections keep the existing view templates readable while ensuring
// that only one valid workspace-specific input shape can reach this component.
const workspaceMode = computed(() => props.context.workspace);
const selectedSbar = computed(() =>
  props.context.workspace === "dataset" && props.context.selectedObject?.kind === "sbar"
    ? props.context.selectedObject.object
    : null,
);
const selectedCbar = computed(() =>
  props.context.workspace === "dataset" && props.context.selectedObject?.kind === "cbar"
    ? props.context.selectedObject.object
    : null,
);
const selectedSwing = computed(() =>
  props.context.workspace === "dataset" && props.context.selectedObject?.kind === "swing"
    ? props.context.selectedObject.object
    : null,
);
const selectedTrend = computed(() =>
  props.context.workspace === "dataset" && props.context.selectedObject?.kind === "trend"
    ? props.context.selectedObject.object
    : null,
);
const originDatasetId = computed(() =>
  props.context.workspace === "dataset" ? props.context.originDatasetId : null,
);
const timeframe = computed(() =>
  props.context.workspace === "dataset" || props.context.workspace === "replay"
    ? props.context.timeframe
    : null,
);
const structureEnabled = computed(() =>
  props.context.workspace === "dataset" ? props.context.structureEnabled : false,
);
const selectedDifference = computed(() =>
  props.context.workspace === "compare" ? props.context.difference : null,
);
const compareBaselineSnapshotId = computed(() =>
  props.context.workspace === "compare" ? props.context.baselineSnapshotId : null,
);
const compareCandidateSnapshotId = computed(() =>
  props.context.workspace === "compare" ? props.context.candidateSnapshotId : null,
);
const replayInspector = computed(() =>
  props.context.workspace === "replay" ? props.context.checkpoint : null,
);
const selectedReplayObject = computed(() =>
  props.context.workspace === "replay" ? props.context.selectedObject : null,
);
const replayInspectorError = computed(() =>
  props.context.workspace === "replay" ? props.context.error : "",
);
const replaySnapshotId = computed(() =>
  props.context.workspace === "replay" ? props.context.snapshotId : null,
);
const replaySnapshotLabel = computed(() =>
  props.context.workspace === "replay" ? props.context.snapshotLabel : null,
);
const replayBars = computed(() =>
  props.context.workspace === "replay" && selectedReplayObject.value?.source === "snapshot"
    ? props.context.snapshotBars
    : props.originBars,
);
const replaySnapshotStructure = computed(() =>
  props.context.workspace === "replay" ? props.context.snapshotStructure : null,
);

function formatStructureCount(count: number | undefined): string {
  if (!props.origin?.enableStructure) return "DISABLED";
  return count?.toLocaleString() ?? "UNAVAILABLE";
}

const copyStatus = ref("");

async function handleInspectorContextMenu(event: MouseEvent): Promise<void> {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const valueNode = target.closest("dd, code");
  const root = event.currentTarget;
  if (!(root instanceof Element) || !valueNode || !root.contains(valueNode)) return;
  const value = valueNode.getAttribute("data-copy-value") ?? valueNode.textContent ?? "";
  if (value.length === 0) return;
  event.preventDefault();
  try {
    await navigator.clipboard.writeText(value);
    copyStatus.value = "COPIED";
  } catch {
    copyStatus.value = "COPY FAILED · CLIPBOARD UNAVAILABLE";
  }
}

</script>

<template>
  <section class="inspector-object" data-testid="inspector-object" @contextmenu.stop.prevent="handleInspectorContextMenu">
    <div
      v-if="workspaceMode === 'dataset' && (selectedSbar || selectedCbar || selectedSwing || selectedTrend)"
      class="inspector-runtime-context"
      data-testid="inspector-runtime-context"
    >
      <span>ORIGIN <code>{{ originDatasetId ?? "—" }}</code></span>
      <span>TIMEFRAME <code>{{ timeframe ?? "—" }}</code></span>
      <span>STRUCTURE <code>{{ structureEnabled ? "ENABLED" : "DISABLED" }}</code></span>
    </div>
    <template v-if="workspaceMode === 'dataset'">
      <section
        v-if="origin && !selectedSbar && !selectedCbar && !selectedSwing && !selectedTrend"
        class="inspector-dataset-summary"
        data-testid="inspector-dataset-summary"
      >
        <div class="inspector-object-heading">
          <div>
            <p class="section-index">LOADED ORIGIN DATASET</p>
            <h3>{{ origin.instrumentId }}</h3>
          </div>
          <span class="inspector-object-kind">DATASET</span>
        </div>
        <dl class="inspector-fields">
          <div class="inspector-field">
            <dt>Origin Dataset ID</dt>
            <dd data-testid="inspector-dataset-id">{{ origin.originDatasetId }}</dd>
          </div>
          <div class="inspector-field">
            <dt>Timeframe</dt>
            <dd data-testid="inspector-dataset-timeframe">{{ origin.timeframe }}</dd>
          </div>
        </dl>
        <div class="inspector-dataset-counts" aria-label="Dataset object counts">
          <div><span>SBAR</span><strong data-testid="inspector-dataset-sbar-count">{{ origin.sbarCount.toLocaleString() }}</strong></div>
          <div><span>CBAR</span><strong data-testid="inspector-dataset-cbar-count">{{ formatStructureCount(origin.structure?.cbarCount) }}</strong></div>
          <div><span>SWING</span><strong data-testid="inspector-dataset-swing-count">{{ formatStructureCount(origin.structure?.swingCount) }}</strong></div>
          <div><span>TREND</span><strong data-testid="inspector-dataset-trend-count">{{ formatStructureCount(origin.structure?.trendCount) }}</strong></div>
        </div>
        <div class="inspector-dataset-range">
          <p class="section-index">SBAR EVENT-TIME RANGE · UTC</p>
          <div>
            <span>FIRST · {{ origin.firstSbarId }}</span>
            <strong data-testid="inspector-dataset-first-time">{{ formatDomainTimestamp(origin.firstTsEvent, origin.timeframe) }}</strong>
          </div>
          <div>
            <span>LAST · {{ origin.lastSbarId }}</span>
            <strong data-testid="inspector-dataset-last-time">{{ formatDomainTimestamp(origin.lastTsEvent, origin.timeframe) }}</strong>
          </div>
        </div>
      </section>
      <DatasetObjectDetails
        v-else
        :selected-sbar="selectedSbar"
        :selected-cbar="selectedCbar"
        :selected-swing="selectedSwing"
        :selected-trend="selectedTrend"
        :origin-dataset-id="originDatasetId"
        :timeframe="timeframe"
        :bars="originBars"
        :structure="originStructure"
      />
    </template>
    <template v-else-if="workspaceMode === 'compare' && selectedDifference">
      <CompareDifferenceDetails
        :selected-difference="selectedDifference"
        :compare-baseline-snapshot-id="compareBaselineSnapshotId"
        :compare-candidate-snapshot-id="compareCandidateSnapshotId"
      />
    </template>

    <template v-else-if="workspaceMode === 'replay' && selectedReplayObject">
      <ReplayObjectDetails
        :selected-object="selectedReplayObject"
        :timeframe="timeframe"
        :checkpoint="replayInspector"
        :bars="replayBars"
        :snapshot-structure="replaySnapshotStructure"
        :snapshot-id="replaySnapshotId"
        :snapshot-label="replaySnapshotLabel"
      />
    </template>
    <template v-else-if="workspaceMode === 'replay' && replayInspector">
      <ReplayCheckpointSummary
        :replay-inspector="replayInspector"
        :timeframe="timeframe"
      />
    </template>
    <div v-else-if="workspaceMode === 'replay' && replayInspectorError" class="inspector-empty" data-testid="inspector-replay-error">
      <h3>Replay Inspector unavailable</h3>
      <p>{{ replayInspectorError }}</p>
    </div>
    <div v-else-if="workspaceMode === 'replay'" class="inspector-empty" data-testid="inspector-empty">
      <span class="placeholder-mark">[ ]</span>
      <h3>Object Inspector</h3>
      <p>Step or Play a Run to inspect its first backend-confirmed Struxis checkpoint.</p>
      <small>No inferred or fabricated domain state is displayed.</small>
    </div>
    <div v-else-if="workspaceMode === 'compare'" class="inspector-empty" data-testid="inspector-empty">
      <span class="placeholder-mark">Δ/</span>
      <h3>Compare Inspector</h3>
      <p>Select an object difference in the Compare results to inspect its domain identity, checkpoint and exact property deltas.</p>
      <small>Validated Compare result only</small>
    </div>
    <div v-else class="inspector-empty" data-testid="inspector-empty">
      <span class="placeholder-mark">[ ]</span>
      <h3>Object Inspector</h3>
      <p>Structural-object selection for Replay is not connected to an authoritative object projection yet.</p>
      <small>No inferred or fabricated domain state is displayed.</small>
    </div>
    <p v-if="copyStatus" class="inspector-copy-status" role="status">{{ copyStatus }}</p>
  </section>
</template>
