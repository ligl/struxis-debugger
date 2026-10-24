<script setup lang="ts">
import { computed, ref, watch } from "vue";
import DualChartStack from "./DualChartStack.vue";
import RunChart from "./RunChart.vue";
import SnapshotReferencePanel from "./SnapshotReferencePanel.vue";
import type { OriginDatasetDto, ReplayChartSelection, ReplayChartViewportSync, ReplayInspectorStructureDto, RunStateDto, SnapshotArtifactDto, TestDatasetDto } from "../origin-types";

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
    // If the coordinate origin changes, discard the old request. RunChart
    // publishes its current Live range when syncOffset changes, avoiding
    // reinterpreting an old Snapshot-origin range with a new offset.
    syncRequest.value = null;
  }
}

function handleViewportChange(change: Omit<ReplayChartViewportSync, "revision" | "offset">): void {
  if (!syncEligible.value || syncOffset.value === null) return;
  syncRequest.value = { ...change, offset: syncOffset.value, revision: ++viewportRevision };
}

watch(() => props.testDataset?.testDatasetId, () => {
  syncRequest.value = null;
});

</script>

<template>
  <div v-show="active" class="workspace-mode replay-controls" data-testid="replay-workspace">
    <DualChartStack workspace="replay">
      <template #upper>
        <RunChart v-if="active" :origin="origin" :test-dataset="testDataset" :run-state="runState" :structure="structure" :selected-object="selectedObject" :target-sbar-id="targetSbarId" :sync-enabled="syncEligible" :sync-offset="syncOffset" :sync-request="syncRequest" @viewport-change="handleViewportChange" @object-select="emit('objectSelect', $event)" @target-select="emit('targetSelect', $event)" @target-cancel="emit('targetCancel')" />
      </template>
      <template #lower>
        <SnapshotReferencePanel
          :instrument-id="testDataset?.instrumentId ?? null"
          :snapshots="snapshots"
          :live-bar-type="testDataset?.barType ?? null"
          :live-sbar-ids="liveBars.map((bar) => bar.sbarId)"
          :sync-request="syncRequest"
          :is-playing="playbackStatus === 'playing' && runState?.testDatasetId === testDataset?.testDatasetId"
          :replay-progress="runState?.testDatasetId === testDataset?.testDatasetId && runState.inputCount > 0 ? runState.processedCount / runState.inputCount : 0"
          @sync-eligibility="handleSyncEligibility"
          @viewport-change="handleViewportChange"
        />
      </template>
    </DualChartStack>
  </div>
</template>
