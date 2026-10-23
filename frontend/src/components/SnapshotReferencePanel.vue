<script setup lang="ts">
import { computed, ref, watch } from "vue";
import OriginChart from "./OriginChart.vue";
import { describeIpcError, getSnapshotReference } from "../origin-bridge";
import type { SnapshotArtifactDto, SnapshotReferenceDto } from "../origin-types";

const props = defineProps<{
  snapshots: SnapshotArtifactDto[];
}>();

const selectedSnapshotId = ref<string | null>(null);
const reference = ref<SnapshotReferenceDto | null>(null);
const referenceLoading = ref(false);
const referenceError = ref("");
let requestRevision = 0;

const availableSnapshots = computed(() =>
  props.snapshots.filter((snapshot) => snapshot.kind === "complete" && snapshot.snapshotId !== null),
);
const selectedSnapshot = computed(
  () => availableSnapshots.value.find((snapshot) => snapshot.snapshotId === selectedSnapshotId.value) ?? null,
);

watch(availableSnapshots, (available) => {
  if (!available.some((snapshot) => snapshot.snapshotId === selectedSnapshotId.value)) {
    selectedSnapshotId.value = null;
    reference.value = null;
    referenceError.value = "";
  }
});

watch(selectedSnapshotId, async (snapshotId) => {
  const revision = ++requestRevision;
  reference.value = null;
  referenceError.value = "";
  if (!snapshotId) {
    referenceLoading.value = false;
    return;
  }

  referenceLoading.value = true;
  try {
    const result = await getSnapshotReference(snapshotId);
    if (revision !== requestRevision || selectedSnapshotId.value !== snapshotId) return;
    reference.value = result;
  } catch (error) {
    if (revision !== requestRevision || selectedSnapshotId.value !== snapshotId) return;
    referenceError.value = describeIpcError(error);
  } finally {
    if (revision === requestRevision) referenceLoading.value = false;
  }
});

function handleSelection(event: Event): void {
  const value = (event.target as HTMLSelectElement).value;
  selectedSnapshotId.value = value || null;
}
</script>

<template>
  <section class="snapshot-reference-panel" data-testid="snapshot-reference-panel">
    <header class="snapshot-reference-heading">
      <div class="snapshot-reference-title">
        <p class="section-index">REFERENCE / IMMUTABLE</p>
        <h3>SNAPSHOT REFERENCE</h3>
      </div>
      <label class="snapshot-reference-select">
        <span>REFERENCE</span>
        <select
          data-testid="replay-reference-select"
          :value="selectedSnapshotId ?? ''"
          :disabled="availableSnapshots.length === 0"
          @change="handleSelection"
        >
          <option value="">Choose completed Snapshot…</option>
          <option v-for="snapshot in availableSnapshots" :key="snapshot.snapshotId ?? snapshot.fileName" :value="snapshot.snapshotId ?? ''">
            {{ snapshot.snapshotId }} · {{ snapshot.generatedAt ?? "time unavailable" }}
          </option>
        </select>
      </label>
    </header>

    <div class="snapshot-reference-stage" :class="{ 'has-reference': reference }" data-testid="snapshot-reference-stage">
      <div v-if="referenceLoading" class="snapshot-reference-empty" role="status" data-testid="snapshot-reference-loading">
        <strong>RESOLVING HISTORICAL INPUT</strong>
        <p>Reading the Snapshot manifest and validating its exact SBar sequence against Catalog.</p>
      </div>
      <div v-else-if="referenceError" class="snapshot-reference-state" role="alert" data-testid="snapshot-reference-error">
        <div class="snapshot-reference-identity">
          <span class="reference-status-dot reference-status-dot-error" aria-hidden="true"></span>
          <strong>{{ selectedSnapshotId }}</strong>
          <span class="reference-tag">REFERENCE UNAVAILABLE</span>
        </div>
        <p class="snapshot-reference-unavailable">{{ referenceError }}</p>
        <p class="snapshot-reference-unavailable">No candles or structure are shown unless the Catalog sequence matches the Snapshot fingerprint.</p>
      </div>
      <div v-else-if="reference" class="snapshot-reference-chart" data-testid="snapshot-reference-chart">
        <OriginChart
          :bars="reference.bars"
          :structure="reference.structure"
          :origin-dataset-id="reference.snapshotId"
          :selection-editable="false"
          display-context="snapshot-reference"
        />
      </div>
      <div v-else class="snapshot-reference-empty" data-testid="snapshot-reference-empty">
        <strong>{{ availableSnapshots.length ? "SELECT A COMPLETED SNAPSHOT" : "NO COMPLETED SNAPSHOT AVAILABLE" }}</strong>
        <p>{{ availableSnapshots.length ? "Choose an immutable reference from the control above." : "A completed Run Snapshot will appear here after it is published and discovered." }}</p>
      </div>
    </div>

    <footer v-if="reference" class="snapshot-reference-foot" data-testid="snapshot-reference-metadata">
      <span>RUN <b>{{ reference.runId }}</b></span>
      <span>SBARS <b>{{ reference.bars.length.toLocaleString() }}</b></span>
      <span>GENERATED <b>{{ reference.snapshotGeneratedAt }}</b></span>
      <span class="snapshot-reference-state-key">FINGERPRINT <b>{{ reference.sbarSequenceFingerprint.slice(0, 12) }}</b></span>
    </footer>
  </section>
</template>
