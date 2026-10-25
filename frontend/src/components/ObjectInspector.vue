<script setup lang="ts">
import { computed, ref } from "vue";
import DatasetObjectDetails from "./DatasetObjectDetails.vue";
import CompareDifferenceDetails from "./CompareDifferenceDetails.vue";
import ReplayCheckpointSummary from "./ReplayCheckpointSummary.vue";
import ReplayObjectDetails from "./ReplayObjectDetails.vue";
import type { InspectorWorkspaceContext, ReplayInspectorStructureDto, SBarDto } from "../origin-types";

const props = defineProps<{
  context: InspectorWorkspaceContext;
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
const replayBars = computed(() =>
  props.context.workspace === "replay" && selectedReplayObject.value?.source === "snapshot"
    ? props.context.snapshotBars
    : props.originBars,
);
const replaySnapshotStructure = computed(() =>
  props.context.workspace === "replay" ? props.context.snapshotStructure : null,
);

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
      v-if="workspaceMode === 'dataset' && (selectedSbar || selectedCbar || selectedSwing)"
      class="inspector-runtime-context"
      data-testid="inspector-runtime-context"
    >
      <span>ORIGIN <code>{{ originDatasetId ?? "—" }}</code></span>
      <span>TIMEFRAME <code>{{ timeframe ?? "—" }}</code></span>
      <span>STRUCTURE <code>{{ structureEnabled ? "ENABLED" : "DISABLED" }}</code></span>
    </div>
    <template v-if="workspaceMode === 'dataset'">
      <DatasetObjectDetails
        :selected-sbar="selectedSbar"
        :selected-cbar="selectedCbar"
        :selected-swing="selectedSwing"
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
