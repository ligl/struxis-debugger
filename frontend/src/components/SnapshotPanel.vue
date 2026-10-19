<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { SnapshotArtifactDto, SnapshotCompareResultDto } from "../origin-types";

const props = defineProps<{
  snapshots: SnapshotArtifactDto[];
  snapshotsLoading: boolean;
  snapshotsError: string;
  snapshotKindLabel: (kind: SnapshotArtifactDto["kind"]) => string;
  formatTimestamp: (value: string | null) => string;
  compareResult: SnapshotCompareResultDto | null;
  compareLoading: boolean;
  compareError: string;
}>();
const emit = defineEmits<{
  refresh: [];
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

function pretty(value: unknown): string {
  return value === null || value === undefined ? "—" : JSON.stringify(value);
}
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
    <p v-else-if="snapshots.length === 0 && !snapshotsLoading" class="empty-state">
      No Snapshot artifacts were discovered in the configured Snapshot directory.
    </p>
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

    <div class="compare-controls">
      <div>
        <p class="section-index">06 / STRICT COMPARE</p>
        <h3>Compare complete Snapshots</h3>
        <p class="microcopy">Both Snapshots must have the same complete ordered SBar sequence fingerprint. Partial overlap is not accepted.</p>
      </div>
      <label>
        <span>Baseline</span>
        <select v-model="baselineId" :disabled="compareLoading">
          <option value="" disabled>Select baseline</option>
          <option v-for="snapshot in completeSnapshots" :key="snapshot.snapshotId!" :value="snapshot.snapshotId!">
            {{ snapshot.snapshotId }} · {{ snapshot.runId }}
          </option>
        </select>
      </label>
      <label>
        <span>Candidate</span>
        <select v-model="candidateId" :disabled="compareLoading">
          <option value="" disabled>Select candidate</option>
          <option v-for="snapshot in completeSnapshots" :key="snapshot.snapshotId!" :value="snapshot.snapshotId!">
            {{ snapshot.snapshotId }} · {{ snapshot.runId }}
          </option>
        </select>
      </label>
      <button class="primary-button" :disabled="!canCompare" @click="requestCompare">
        {{ compareLoading ? "Comparing…" : "Compare" }}
      </button>
    </div>
    <p v-if="completeSnapshots.length < 2" class="microcopy">At least two verified Complete Snapshots are required.</p>
    <p v-if="compareError" class="error-message" role="alert">{{ compareError }}</p>

    <section v-if="compareResult" class="compare-results" aria-live="polite">
      <div class="compare-summary">
        <div>
          <p class="section-index">FIRST STRUCTURAL DIVERGENCE</p>
          <strong v-if="compareResult.firstStructuralDivergence">
            Checkpoint {{ compareResult.firstStructuralDivergence.checkpointIndex }}
            · SBar {{ compareResult.firstStructuralDivergence.sbarId }}
          </strong>
          <strong v-else>No structural divergence</strong>
        </div>
        <div>
          <p class="section-index">CHECKPOINTS</p>
          <strong>{{ compareResult.checkpointCount }}</strong>
        </div>
        <div>
          <p class="section-index">OBJECT DIFFERENCES</p>
          <strong>{{ compareResult.differences.length }}</strong>
        </div>
        <div>
          <p class="section-index">DIAGNOSTIC DIFFERENCES</p>
          <strong>{{ compareResult.diagnosticsDifferences.length }}</strong>
        </div>
      </div>
      <div class="compare-metadata">
        <div><span>Baseline config</span><code>{{ compareResult.baseline.configFingerprint }}</code></div>
        <div><span>Candidate config</span><code>{{ compareResult.candidate.configFingerprint }}</code></div>
      </div>
      <p v-if="compareResult.differences.length === 0" class="empty-state">All compared CBar and Swing states are identical across the full input sequence.</p>
      <div v-else class="table-scroll">
        <table class="snapshot-table difference-table">
          <thead><tr><th>CHECKPOINT</th><th>SBAR ID</th><th>OBJECT</th><th>CHANGE</th><th>DOMAIN ID</th><th>PROPERTY DELTAS</th></tr></thead>
          <tbody>
            <tr v-for="(difference, index) in compareResult.differences" :key="index">
              <td>{{ difference.checkpointIndex }}</td>
              <td>{{ difference.sbarId }}</td>
              <td>{{ difference.objectType }}</td>
              <td>{{ difference.kind.toUpperCase() }}</td>
              <td>{{ difference.objectId }}</td>
              <td><div v-for="property in difference.properties" :key="property.field" class="property-delta"><strong>{{ property.field }}</strong><span>{{ pretty(property.baselineValue) }} → {{ pretty(property.candidateValue) }}</span></div></td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="compareResult.firstDiagnosticsDivergence !== null" class="microcopy">
        First diagnostics divergence: checkpoint {{ compareResult.firstDiagnosticsDivergence }}. Diagnostic changes are reported separately and do not alter the structural divergence point.
      </p>
    </section>
    <p class="microcopy">Discovery is read-only. Temporary or invalid artifacts are classified, never promoted or repaired by the UI.</p>
  </section>
</template>
