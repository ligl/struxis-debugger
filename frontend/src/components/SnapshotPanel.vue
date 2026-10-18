<script setup lang="ts">
import type { SnapshotArtifactDto } from "../origin-types";
defineProps<{ snapshots: SnapshotArtifactDto[]; snapshotsLoading: boolean; snapshotsError: string; snapshotKindLabel: (kind: SnapshotArtifactDto["kind"]) => string; formatTimestamp: (value: string | null) => string; }>();
const emit = defineEmits<{ refresh: []; }>();
</script>

<template>
<section class="panel snapshot-panel">
      <div class="panel-heading">
        <div>
          <p class="section-index">05 / ARTIFACTS</p>
          <h2>Snapshot Store</h2>
        </div>
        <button class="subtle-button" :disabled="snapshotsLoading" @click="emit('refresh')">
          {{ snapshotsLoading ? "Refreshing…" : "Refresh Snapshots" }}
        </button>
      </div>
      <p v-if="snapshotsError" class="error-message">{{ snapshotsError }}</p>
      <p v-else-if="snapshots.length === 0 && !snapshotsLoading" class="empty-state">No Snapshot artifacts were discovered in the configured Snapshot directory.</p>
      <div v-if="snapshots.length" class="table-scroll">
        <table class="snapshot-table">
          <thead>
            <tr>
              <th>ARTIFACT / SNAPSHOT ID</th>
              <th>RUN ID</th>
              <th>STATE KEY</th>
              <th>GENERATED AT · NS</th>
              <th>CHECKPOINTS</th>
              <th>CLASSIFICATION</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="snapshot in snapshots" :key="snapshot.fileName">
              <td><strong>{{ snapshot.snapshotId ?? snapshot.fileName }}</strong><small>{{ snapshot.fileName }}</small></td>
              <td>{{ snapshot.runId ?? "—" }}</td>
              <td>{{ snapshot.stateKey ?? "—" }}</td>
              <td>{{ formatTimestamp(snapshot.generatedAt) }}</td>
              <td>{{ snapshot.checkpointCount ?? "—" }}</td>
              <td><span class="artifact-kind" :class="{ verified: snapshot.kind === 'complete', invalid: snapshot.kind === 'invalidPublished' || snapshot.kind === 'unreadableTemporary' }">{{ snapshotKindLabel(snapshot.kind) }}</span><small v-if="snapshot.diagnostic" class="diagnostic">{{ snapshot.diagnostic }}</small></td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="microcopy">Discovery is read-only. Temporary or invalid artifacts are classified, never promoted or repaired by the UI.</p>
    </section>
</template>
