<script setup lang="ts">
import { ref, watch } from "vue";
import CompareSummary from "./CompareSummary.vue";
import DualChartStack from "./DualChartStack.vue";
import ComparisonChartPlaceholder from "./ComparisonChartPlaceholder.vue";
import SnapshotPanel from "./SnapshotPanel.vue";
import type { ObjectDifferenceDto, SnapshotArtifactDto, SnapshotCompareResultDto } from "../origin-types";

const props = defineProps<{
  active: boolean;
  snapshots: SnapshotArtifactDto[];
  snapshotsLoading: boolean;
  snapshotsError: string;
  compareResult: SnapshotCompareResultDto | null;
  compareLoading: boolean;
  compareError: string;
  formatLifecycleTimestamp: (value: string | null | undefined) => string;
}>();

const emit = defineEmits<{
  refreshSnapshots: [];
  selectDifference: [difference: ObjectDifferenceDto | null];
}>();

const selectedDifferenceKey = ref<string | null>(null);

function differenceKey(difference: ObjectDifferenceDto): string {
  return [
    difference.checkpointIndex,
    difference.sbarId,
    difference.objectType,
    difference.objectId,
    difference.kind,
  ].join("|");
}

function selectDifference(difference: ObjectDifferenceDto): void {
  selectedDifferenceKey.value = differenceKey(difference);
  emit("selectDifference", difference);
}

function clearSelection(): void {
  selectedDifferenceKey.value = null;
  emit("selectDifference", null);
}

watch(() => props.compareResult, clearSelection);
watch(() => props.active, (active) => {
  if (!active) clearSelection();
});
</script>

<template>
  <div v-show="active" class="workspace-mode compare-workspace" data-testid="compare-workspace">
    <CompareSummary
      :compare-result="compareResult"
      :compare-loading="compareLoading"
      :compare-error="compareError"
    />
    <DualChartStack workspace="compare">
      <template #upper>
        <ComparisonChartPlaceholder
          side="candidate"
          :has-comparison="Boolean(compareResult)"
          :checkpoint-count="compareResult?.checkpointCount ?? null"
        />
      </template>
      <template #lower>
        <ComparisonChartPlaceholder
          side="baseline"
          :has-comparison="Boolean(compareResult)"
          :checkpoint-count="compareResult?.checkpointCount ?? null"
        />
      </template>
    </DualChartStack>
    <details class="snapshot-store-disclosure" data-testid="snapshot-store-disclosure">
      <summary data-testid="snapshot-store-toggle">
        <span class="snapshot-store-title">SNAPSHOT STORE <span>/</span> DIFFERENCES</span>
        <span class="snapshot-store-counts">
          {{ snapshots.length }} ARTIFACTS
          <span class="snapshot-store-separator">·</span>
          {{ compareResult?.differences.length ?? 0 }} DIFFERENCES
        </span>
      </summary>
      <SnapshotPanel
        :snapshots="snapshots"
        :snapshots-loading="snapshotsLoading"
        :snapshots-error="snapshotsError"
        :format-lifecycle-timestamp="formatLifecycleTimestamp"
        :compare-result="compareResult"
        :compare-loading="compareLoading"
        :compare-error="compareError"
        :selected-difference-key="selectedDifferenceKey"
        @refresh="emit('refreshSnapshots')"
        @select-difference="selectDifference"
      />
    </details>
  </div>
</template>
