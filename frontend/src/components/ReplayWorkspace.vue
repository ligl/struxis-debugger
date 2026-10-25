<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { resolveReplaySyncOffset, type ReplaySyncSequenceDescriptor } from "../replay-sync";
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
type ReplayChartOwner = "live" | "snapshot";
const activeChartOwner = ref<ReplayChartOwner>("live");

function activateChart(owner: ReplayChartOwner): void {
  activeChartOwner.value = owner;
}

watch(() => props.active, (active) => {
  if (!active) activeChartOwner.value = "live";
});

const referenceSequence = ref<ReplaySyncSequenceDescriptor | null>(null);
const syncOffset = computed(() => resolveReplaySyncOffset(
  props.testDataset?.barType ?? null,
  liveBars.value.map((bar) => bar.sbarId),
  referenceSequence.value,
));
const syncEligible = computed(() => syncOffset.value !== null);
const syncRequest = ref<ReplayChartViewportSync | null>(null);
const crosshairSync = ref<ReplayChartCrosshairSync | null>(null);
const activeSyncRequest = computed(() => syncEligible.value ? syncRequest.value : null);
const activeCrosshairSync = computed(() => syncEligible.value ? crosshairSync.value : null);
let viewportRevision = 0;
let crosshairRevision = 0;

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

function handleSyncSequence(sequence: ReplaySyncSequenceDescriptor | null): void {
  // Every descriptor transition invalidates peer commands, even when a new
  // Snapshot happens to resolve to the same numeric Offset.
  if (!sequence) activeChartOwner.value = "live";
  referenceSequence.value = sequence;
  syncRequest.value = null;
  crosshairSync.value = null;
}

function handleViewportChange(change: Omit<ReplayChartViewportSync, "revision" | "offset">): void {
  const offset = syncOffset.value;
  if (offset === null) return;
  syncRequest.value = { ...change, offset, revision: ++viewportRevision };
}

function handleCrosshairChange(change: Omit<ReplayChartCrosshairSync, "revision">): void {
  if (!syncEligible.value) return;
  crosshairSync.value = { ...change, revision: ++crosshairRevision };
}

watch(
  () => JSON.stringify([
    props.testDataset?.testDatasetId,
    props.testDataset?.barType,
    liveBars.value.map((bar) => bar.sbarId),
  ]),
  () => {
    // A reference sequence is qualified against one specific Live Dataset
    // identity and SBar sequence. Invalidate that qualification as well as
    // both peer commands; otherwise an old Snapshot could remain sync-eligible
    // when a replacement Dataset happens to have the same bar IDs / Offset.
    referenceSequence.value = null;
    syncRequest.value = null;
    crosshairSync.value = null;
  },
);

</script>

<template>
  <div v-show="active" class="workspace-mode replay-controls" data-testid="replay-workspace">
    <DualChartStack workspace="replay">
      <template #upper>
        <RunChart v-if="active" :origin="origin" :test-dataset="testDataset" :run-state="runState" :structure="structure" :selected-object="selectedObject" :target-sbar-id="targetSbarId" :keyboard-active="activeChartOwner === 'live'" :sync-enabled="syncEligible" :sync-offset="syncOffset" :sync-request="activeSyncRequest" :crosshair-sync="activeCrosshairSync" @activate="activateChart('live')" @viewport-change="handleViewportChange" @crosshair-change="handleCrosshairChange" @object-select="emit('objectSelect', $event)" @target-select="emit('targetSelect', $event)" @target-cancel="emit('targetCancel')" />
      </template>
      <template #lower>
        <SnapshotReferencePanel
          :instrument-id="testDataset?.instrumentId ?? null"
          :snapshots="snapshots"
          :live-sbar-ids="liveBars.map((bar) => bar.sbarId)"
          :sync-identity="JSON.stringify([testDataset?.testDatasetId, testDataset?.barType, liveBars.map((bar) => bar.sbarId)])"
          :sync-eligible="syncEligible"
          :keyboard-active="activeChartOwner === 'snapshot'"
          :sync-offset="syncOffset"
          :sync-request="activeSyncRequest"
          :crosshair-sync="activeCrosshairSync"
          :progress-applies="runState !== null && testDataset !== null && runState.testDatasetId === testDataset.testDatasetId && runState.status !== 'disposed'"
          :processed-count="runState !== null && testDataset !== null && runState.testDatasetId === testDataset.testDatasetId ? runState.processedCount : 0"
          @sync-sequence="handleSyncSequence"
          @chart-activate="activateChart('snapshot')"
          @viewport-change="handleViewportChange"
          @crosshair-change="handleCrosshairChange"
        />
      </template>
    </DualChartStack>
  </div>
</template>
