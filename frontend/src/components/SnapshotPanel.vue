<script setup lang="ts">
import type { ObjectDifferenceDto, SnapshotArtifactDto, SnapshotCompareResultDto } from "../origin-types";

defineProps<{
  snapshots: SnapshotArtifactDto[];
  snapshotsLoading: boolean;
  snapshotsError: string;
  formatLifecycleTimestamp: (value: string | null) => string;
  compareResult: SnapshotCompareResultDto | null;
  compareLoading: boolean;
  compareError: string;
  selectedDifferenceKey: string | null;
}>();
function snapshotKindLabel(kind: SnapshotArtifactDto["kind"]): string {
  const labels: Record<SnapshotArtifactDto["kind"], string> = {
    complete: "COMPLETE / PUBLISHED",
    invalidPublished: "INVALID PUBLISHED",
    recordingTemporary: "RECORDING TEMP",
    finalizingTemporary: "FINALIZING TEMP",
    failedTemporary: "FAILED TEMP",
    completeButUnpublished: "COMPLETE / UNPUBLISHED",
    unreadableTemporary: "UNREADABLE TEMP",
  };
  return labels[kind];
}

const emit = defineEmits<{
  refresh: [];
  selectDifference: [difference: ObjectDifferenceDto];
}>();

function pretty(value: unknown): string {
  return value === null || value === undefined ? "—" : JSON.stringify(value);
}

function differenceKey(difference: ObjectDifferenceDto): string {
  return [difference.checkpointIndex, difference.sbarId, difference.objectType, difference.objectId, difference.kind].join("|");
}
</script>

<template>
  <section
    class="panel snapshot-panel"
    data-testid="snapshot-panel"
    :data-selected-difference-key="selectedDifferenceKey ?? ''"
  >
    <div class="panel-heading">
      <div>
        <p class="section-index">ARTIFACTS / DIAGNOSTICS</p>
        <h2>Snapshot Store</h2>
      </div>
      <button class="subtle-button" data-testid="snapshot-refresh" :disabled="snapshotsLoading" @click="emit('refresh')">
        {{ snapshotsLoading ? "Refreshing…" : "Refresh Snapshots" }}
      </button>
    </div>
    <p v-if="snapshotsError" class="error-message" role="alert">{{ snapshotsError }}</p>
    <p v-else-if="snapshots.length === 0 && !snapshotsLoading" class="empty-state">
      No Snapshot artifacts were discovered in the configured Snapshot directory.
    </p>
    <p v-if="compareLoading" class="microcopy" data-testid="compare-loading">Strict comparison is running…</p>
    <div v-if="snapshots.length" class="table-scroll">
      <table class="snapshot-table">
        <thead>
          <tr>
            <th>ARTIFACT / SNAPSHOT ID</th>
            <th>RUN ID</th>
            <th>STATE KEY</th>
            <th>GENERATED AT · UTC</th>
            <th>CHECKPOINTS</th>
            <th>CLASSIFICATION</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="snapshot in snapshots" :key="snapshot.fileName" data-testid="snapshot-row" :data-snapshot-kind="snapshot.kind">
            <td><strong>{{ snapshot.snapshotId ?? snapshot.fileName }}</strong><small>{{ snapshot.fileName }}</small></td>
            <td>{{ snapshot.runId ?? "—" }}</td>
            <td>{{ snapshot.stateKey ?? "—" }}</td>
            <td>{{ formatLifecycleTimestamp(snapshot.generatedAt) }}</td>
            <td>{{ snapshot.checkpointCount ?? "—" }}</td>
            <td><span class="artifact-kind" :class="{ published: snapshot.kind === 'complete', invalid: snapshot.kind === 'invalidPublished' || snapshot.kind === 'unreadableTemporary' }">{{ snapshotKindLabel(snapshot.kind) }}</span><small v-if="snapshot.diagnostic" class="diagnostic">{{ snapshot.diagnostic }}</small></td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-if="compareError" class="error-message" data-testid="compare-detail-error" role="alert">{{ compareError }}</p>

    <section v-if="compareResult" class="compare-results" data-testid="compare-results" aria-live="polite">
      <div class="compare-metadata">
        <div><span>Baseline snapshot</span><code>{{ compareResult.baseline.snapshotId }}</code></div>
        <div><span>Candidate snapshot</span><code>{{ compareResult.candidate.snapshotId }}</code></div>
        <div><span>Baseline config</span><code>{{ compareResult.baseline.configFingerprint }}</code></div>
        <div><span>Candidate config</span><code>{{ compareResult.candidate.configFingerprint }}</code></div>
      </div>
      <p v-if="compareResult.differences.length === 0" class="empty-state">All compared CBar and Swing states are identical across the full input sequence.</p>
      <div v-else class="table-scroll">
        <table class="snapshot-table difference-table">
          <thead><tr><th>CHECKPOINT</th><th>SBAR ID</th><th>OBJECT</th><th>CHANGE</th><th>DOMAIN ID</th><th>PROPERTY DELTAS</th></tr></thead>
          <tbody>
            <tr v-for="(difference, index) in compareResult.differences" :key="index" :class="{ 'difference-row-selected': selectedDifferenceKey === differenceKey(difference) }" :data-testid="'compare-difference-row-' + index">
              <td>{{ difference.checkpointIndex }}</td>
              <td>{{ difference.sbarId }}</td>
              <td>{{ difference.objectType }}</td>
              <td>{{ difference.kind.toUpperCase() }}</td>
              <td><button class="difference-select-button" :class="{ selected: selectedDifferenceKey === differenceKey(difference) }" :aria-pressed="selectedDifferenceKey === differenceKey(difference)" :data-testid="'compare-select-difference-' + index" @click="emit('selectDifference', difference)">{{ difference.objectId }}</button></td>
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
