<script setup lang="ts">
import DualChartStack from "./DualChartStack.vue";
import RunChart from "./RunChart.vue";
import SnapshotReferencePanel from "./SnapshotReferencePanel.vue";
import type { OriginDatasetDto, ReplayChartSelection, ReplayInspectorStructureDto, RunStateDto, SnapshotArtifactDto, TestDatasetDto } from "../origin-types";

withDefaults(defineProps<{
  active: boolean;
  origin: OriginDatasetDto | null;
  testDataset: TestDatasetDto | null;
  runState: RunStateDto | null;
  structure: ReplayInspectorStructureDto | null;
  selectedObject: ReplayChartSelection | null;
  snapshots: SnapshotArtifactDto[];
}>(), {
  runState: null,
});
const emit = defineEmits<{ objectSelect: [selection: ReplayChartSelection] }>();
</script>

<template>
  <div v-show="active" class="workspace-mode replay-controls" data-testid="replay-workspace">
    <DualChartStack workspace="replay">
      <template #upper>
        <RunChart v-if="active" :origin="origin" :test-dataset="testDataset" :run-state="runState" :structure="structure" :selected-object="selectedObject" @object-select="emit('objectSelect', $event)" />
      </template>
      <template #lower>
        <SnapshotReferencePanel :snapshots="snapshots" />
      </template>
    </DualChartStack>
  </div>
</template>
