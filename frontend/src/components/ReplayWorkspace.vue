<script setup lang="ts">
import { computed, ref, watch } from "vue";
import DualChartStack from "./DualChartStack.vue";
import RunChart from "./RunChart.vue";
import SnapshotReferencePanel from "./SnapshotReferencePanel.vue";
import type { OriginDatasetDto, ReplayChartCrosshairSync, ReplayChartSelection, ReplayChartViewportSync, ReplayInspectorStructureDto, RunStateDto, SnapshotArtifactDto, TestDatasetDto } from "../origin-types";

const props = withDefaults(defineProps<{
  active: boolean;
  origin: OriginDatasetDto | null;
  testDataset: TestDatasetDto | null;
  runState: RunStateDto | null;
  playbackStatus?: "idle" | "playing" | "paused";
  structure: ReplayInspectorStructureDto | null;
  selectedObject: ReplayChartSelection | null;
  targetSbarId: string | null;
  snapshots: SnapshotArtifactDto[];
}>(), {
  runState: null,
});
const emit = defineEmits<{
  objectSelect: [selection: ReplayChartSelection];
  targetSelect: [sbarId: string];
  targetCancel: [];
}>();
const syncEligible = ref(false);
const syncOffset = ref<number | null>(null);
const syncRequest = ref<ReplayChartViewportSync | null>(null);
const crosshairSync = ref<ReplayChartCrosshairSync | null>(null);
const activeSyncRequest = computed(() => syncEligible.value ? syncRequest.value : null);
const activeCrosshairSync = computed(() => syncEligible.value ? crosshairSync.value : null);
let viewportRevision = 0;

const liveBars = computed(() => {
  const originDataset = props.origin;
  const test = props.testDataset;
  if (!originDataset || !test || originDataset.originDatasetId !== test.originDatasetId) return [];
  const start = originDataset.bars.findIndex((bar) => bar.sbarId === test.startSbarId);
  const end = originDataset.bars.findIndex((bar) => bar.sbarId === test.endSbarId);
  if (start < 0 || end < start) return [];
  const selected = originDataset.bars.slice(start, end + 1);
  return selected.length === test.sbarCount ? selected : [];
});

function handleSyncEligibility(eligible: boolean, offset: number | null): void {
  const nextEligible = eligible && offset !== null;
  const nextOffset = nextEligible ? offset : null;
  const offsetChanged = syncOffset.value !== nextOffset;
  syncEligible.value = nextEligible;
  syncOffset.value = nextOffset;
  if (!nextEligible || offsetChanged) {
    // If the coordinate origin changes, discard old cross-chart state.
    syncRequest.value = null;
    crosshairSync.value = null;
  }
}

function handleViewportChange(change: Omit<ReplayChartViewportSync, "revision" | "offset">): void {
  if (!syncEligible.value || syncOffset.value === null) return;
  syncRequest.value = { ...change, offset: syncOffset.value, revision: ++viewportRevision };
}

function handleCrosshairChange(change: Omit<ReplayChartCrosshairSync, "revision">): void {
  if (!syncEligible.value) return;
  crosshairSync.value = { ...change, revision: (crosshairSync.value?.revision ?? 0) + 1 };
}

watch(() => props.testDataset?.testDatasetId, () => {
  // A new Test Dataset invalidates the previous coordinate transform
  // immediately; never let the old pair synchronize while Snapshot rechecks
  // its SBar coverage against the new Live sequence.
  syncEligible.value = false;
  syncOffset.value = null;
  syncRequest.value = null;
  crosshairSync.value = null;
});

</script>

<template>
  <div v-show="active" class="workspace-mode replay-controls" data-testid="replay-workspace">
    <DualChartStack workspace="replay">
      <template #upper>
        <RunChart v-if="active" :origin="origin" :test-dataset="testDataset" :run-state="runState" :structure="structure" :selected-object="selectedObject" :target-sbar-id="targetSbarId" :sync-enabled="syncEligible" :sync-offset="syncOffset" :sync-request="activeSyncRequest" :crosshair-sync="activeCrosshairSync" @viewport-change="handleViewportChange" @crosshair-change="handleCrosshairChange" @object-select="emit('objectSelect', $event)" @target-select="emit('targetSelect', $event)" @target-cancel="emit('targetCancel')" />
      </template>
      <template #lower>
        <SnapshotReferencePanel
          :instrument-id="testDataset?.instrumentId ?? null"
          :snapshots="snapshots"
          :live-bar-type="testDataset?.barType ?? null"
          :live-sbar-ids="liveBars.map((bar) => bar.sbarId)"
          :sync-request="activeSyncRequest"
          :crosshair-sync="activeCrosshairSync"
          :progress-applies="runState !== null && testDataset !== null && runState.testDatasetId === testDataset.testDatasetId && runState.status !== 'disposed'"
          :processed-count="runState !== null && testDataset !== null && runState.testDatasetId === testDataset.testDatasetId ? runState.processedCount : 0"
          @sync-eligibility="handleSyncEligibility"
          @viewport-change="handleViewportChange"
          @crosshair-change="handleCrosshairChange"
        />
      </template>
    </DualChartStack>
  </div>
</template>
