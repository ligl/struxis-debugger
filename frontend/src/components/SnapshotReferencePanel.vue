<script setup lang="ts">
import { computed } from "vue";
import type { SnapshotArtifactDto } from "../origin-types";

const props = defineProps<{
  snapshots: SnapshotArtifactDto[];
  selectedSnapshotId: string | null;
}>();

const emit = defineEmits<{
  "update:selectedSnapshotId": [snapshotId: string | null];
}>();

const availableSnapshots = computed(() =>
  props.snapshots.filter((snapshot) => snapshot.kind === "complete" && snapshot.snapshotId !== null),
);
const selectedSnapshot = computed(
  () => availableSnapshots.value.find((snapshot) => snapshot.snapshotId === props.selectedSnapshotId) ?? null,
);

function handleSelection(event: Event): void {
  const value = (event.target as HTMLSelectElement).value;
  emit("update:selectedSnapshotId", value || null);
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

    <div class="snapshot-reference-stage" :class="{ 'has-reference': selectedSnapshot }" data-testid="snapshot-reference-stage">
      <div v-if="selectedSnapshot" class="snapshot-reference-state" data-testid="snapshot-reference-selected">
        <div class="snapshot-reference-identity">
          <span class="reference-status-dot" aria-hidden="true"></span>
          <strong>{{ selectedSnapshot.snapshotId }}</strong>
          <span class="reference-tag">COMPLETE SNAPSHOT</span>
        </div>
        <p class="snapshot-reference-unavailable" role="status">
          Historical chart unavailable: the current Snapshot IPC exposes artifact metadata, but not the authoritative SBar OHLCV sequence or enough instrument metadata to verify compatibility. No bars or Struxis objects are synthesized.
        </p>
      </div>
      <div v-else class="snapshot-reference-empty" data-testid="snapshot-reference-empty">
        <strong>{{ availableSnapshots.length ? "SELECT A COMPLETED SNAPSHOT" : "NO COMPLETED SNAPSHOT AVAILABLE" }}</strong>
        <p>{{ availableSnapshots.length ? "Choose an immutable reference from the control above." : "A completed Run Snapshot will appear here after it is published and discovered." }}</p>
      </div>
    </div>

    <footer v-if="selectedSnapshot" class="snapshot-reference-foot" data-testid="snapshot-reference-metadata">
      <span>RUN <b>{{ selectedSnapshot.runId ?? "—" }}</b></span>
      <span>CHECKPOINTS <b>{{ selectedSnapshot.checkpointCount ?? "—" }}</b></span>
      <span>GENERATED <b>{{ selectedSnapshot.generatedAt ?? "—" }}</b></span>
      <span class="snapshot-reference-state-key">STATE KEY <b>{{ selectedSnapshot.stateKey ?? "—" }}</b></span>
    </footer>
  </section>
</template>
