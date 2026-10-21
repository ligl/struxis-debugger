<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { SnapshotArtifactDto } from "../origin-types";

const props = defineProps<{
  snapshots: SnapshotArtifactDto[];
  compareLoading: boolean;
}>();
const emit = defineEmits<{
  compare: [baselineSnapshotId: string, candidateSnapshotId: string];
}>();

const completeSnapshots = computed(() => props.snapshots.filter(
  (snapshot) => snapshot.kind === "complete" && snapshot.snapshotId,
));
const baselineId = ref("");
const candidateId = ref("");

watch(completeSnapshots, (items) => {
  const ids = new Set(items.map((item) => item.snapshotId as string));
  if (!ids.has(baselineId.value)) baselineId.value = items[0]?.snapshotId ?? "";
  if (!ids.has(candidateId.value) || candidateId.value === baselineId.value) {
    candidateId.value = items.find((item) => item.snapshotId !== baselineId.value)?.snapshotId ?? "";
  }
}, { immediate: true });

const canCompare = computed(() =>
  Boolean(baselineId.value && candidateId.value) &&
  baselineId.value !== candidateId.value &&
  !props.compareLoading,
);

function requestCompare(): void {
  if (canCompare.value) emit("compare", baselineId.value, candidateId.value);
}
</script>

<template>
  <div class="toolbar-actions compare-toolbar-actions" data-testid="compare-toolbar-controls">
    <label class="compare-toolbar-select">
      <span>BASELINE</span>
      <select v-model="baselineId" data-testid="compare-baseline-select" :disabled="compareLoading">
        <option value="" disabled>Select baseline</option>
        <option v-for="snapshot in completeSnapshots" :key="snapshot.snapshotId!" :value="snapshot.snapshotId!">
          {{ snapshot.snapshotId }} · {{ snapshot.runId }}
        </option>
      </select>
    </label>
    <label class="compare-toolbar-select">
      <span>CANDIDATE</span>
      <select v-model="candidateId" data-testid="compare-candidate-select" :disabled="compareLoading">
        <option value="" disabled>Select candidate</option>
        <option v-for="snapshot in completeSnapshots" :key="snapshot.snapshotId!" :value="snapshot.snapshotId!">
          {{ snapshot.snapshotId }} · {{ snapshot.runId }}
        </option>
      </select>
    </label>
    <button
      class="primary-button compare-run-button"
      data-testid="compare-run"
      :disabled="!canCompare"
      @click="requestCompare"
    >
      {{ compareLoading ? "COMPARING…" : "RUN COMPARISON" }}
    </button>
  </div>
</template>
