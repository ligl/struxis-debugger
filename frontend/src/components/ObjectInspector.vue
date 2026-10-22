<script setup lang="ts">
import { ref } from "vue";
import DatasetObjectDetails from "./DatasetObjectDetails.vue";
import CompareDifferenceDetails from "./CompareDifferenceDetails.vue";
import ReplayCheckpointSummary from "./ReplayCheckpointSummary.vue";
import type { ObjectDifferenceDto, ReplayInspectorCBarDto, ReplayInspectorDto, ReplayInspectorSwingDto, SBarDto } from "../origin-types";

defineProps<{
  selectedSbar: SBarDto | null;
  selectedCbar: ReplayInspectorCBarDto | null;
  selectedSwing: ReplayInspectorSwingDto | null;
  originDatasetId: string | null;
  timeframe: string | null;
  structureEnabled: boolean;
  workspaceMode: "dataset" | "replay" | "compare";
  selectedDifference: ObjectDifferenceDto | null;
  compareBaselineSnapshotId: string | null;
  compareCandidateSnapshotId: string | null;
  replayInspector: ReplayInspectorDto | null;
  replayInspectorError: string;
}>();

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
  <section class="inspector-object" data-testid="inspector-object" @contextmenu="handleInspectorContextMenu">
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
      />
    </template>
    <template v-else-if="workspaceMode === 'compare' && selectedDifference">
      <CompareDifferenceDetails
        :selected-difference="selectedDifference"
        :compare-baseline-snapshot-id="compareBaselineSnapshotId"
        :compare-candidate-snapshot-id="compareCandidateSnapshotId"
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
