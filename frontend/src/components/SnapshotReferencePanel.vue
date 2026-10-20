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

const selectedSnapshot = computed(
  () => props.snapshots.find((snapshot) => snapshot.snapshotId === props.selectedSnapshotId) ?? null,
);

function handleSelection(event: Event): void {
  const value = (event.target as HTMLSelectElement).value;
  emit("update:selectedSnapshotId", value || null);
}
</script>

<template>
  <section class="snapshot-reference-panel" data-testid="snapshot-reference-panel">
    <header class="snapshot-reference-heading">
      <div>
        <p class="section-index">FIXED HISTORICAL RESULT</p>
        <h3>Snapshot Reference</h3>
      </div>
      <label class="snapshot-reference-select">
        <span>REFERENCE</span>
        <select
          data-testid="replay-reference-select"
          :value="selectedSnapshotId ?? ''"
          :disabled="snapshots.length === 0"
          @change="handleSelection"
        >
          <option value="">Choose completed Snapshot…</option>
          <option v-for="snapshot in snapshots" :key="snapshot.snapshotId ?? snapshot.fileName" :value="snapshot.snapshotId ?? ''">
            {{ snapshot.snapshotId }} · {{ snapshot.generatedAt ?? "time unavailable" }}
          </option>
        </select>
      </label>
    </header>

    <div v-if="selectedSnapshot" class="snapshot-reference-body" data-testid="snapshot-reference-selected">
      <div class="snapshot-reference-identity">
        <span class="reference-status-dot" aria-hidden="true"></span>
        <strong>{{ selectedSnapshot.snapshotId }}</strong>
        <span class="reference-tag">COMPLETE SNAPSHOT</span>
      </div>
      <dl class="snapshot-reference-metadata">
        <div><dt>RUN ID</dt><dd>{{ selectedSnapshot.runId ?? "—" }}</dd></div>
        <div><dt>STATE KEY</dt><dd>{{ selectedSnapshot.stateKey ?? "—" }}</dd></div>
        <div><dt>GENERATED</dt><dd>{{ selectedSnapshot.generatedAt ?? "—" }}</dd></div>
        <div><dt>CHECKPOINTS</dt><dd>{{ selectedSnapshot.checkpointCount ?? "—" }}</dd></div>
      </dl>
      <p class="snapshot-reference-unavailable" role="status">
        The current frontend IPC projection exposes Snapshot artifact metadata, but not the historical SBar OHLCV sequence needed to draw this reference chart. Rendering is withheld until that authoritative projection is available; no market bars or Struxis objects are synthesized.
      </p>
    </div>
    <div v-else class="snapshot-reference-empty" data-testid="snapshot-reference-empty">
      <strong>{{ snapshots.length ? "Select a completed Snapshot" : "No completed Snapshot available" }}</strong>
      <p>{{ snapshots.length ? "Choose a fixed historical result to inspect here." : "A completed Run Snapshot will appear here after it is published and discovered." }}</p>
    </div>
  </section>
</template>
