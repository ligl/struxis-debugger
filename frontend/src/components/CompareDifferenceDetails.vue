<script setup lang="ts">
import type { ObjectDifferenceDto } from "../origin-types";

defineProps<{
  selectedDifference: ObjectDifferenceDto;
  compareBaselineSnapshotId: string | null;
  compareCandidateSnapshotId: string | null;
}>();

function formatValue(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "—";
  if (typeof value === "string") return value;
  return JSON.stringify(value) ?? String(value);
}
</script>

<template>

      <div class="inspector-object-heading">
        <div>
          <p class="section-index">SELECTED COMPARE DIFFERENCE</p>
          <h3>{{ selectedDifference.objectType }}</h3>
        </div>
        <span class="inspector-object-kind" :class="'difference-kind-' + selectedDifference.kind">{{ selectedDifference.kind.toUpperCase() }}</span>
      </div>
      <dl class="inspector-fields">
        <div class="inspector-field inspector-field-wide">
          <dt>Domain Object ID</dt>
          <dd><code data-testid="inspector-difference-object-id" :title="selectedDifference.objectId">{{ selectedDifference.objectId }}</code></dd>
        </div>
        <div class="inspector-field inspector-field-wide">
          <dt>Baseline Snapshot</dt>
          <dd><code data-testid="inspector-baseline-snapshot">{{ compareBaselineSnapshotId ?? "—" }}</code></dd>
        </div>
        <div class="inspector-field inspector-field-wide">
          <dt>Candidate Snapshot</dt>
          <dd><code data-testid="inspector-candidate-snapshot">{{ compareCandidateSnapshotId ?? "—" }}</code></dd>
        </div>
        <div class="inspector-field">
          <dt>Object Type</dt>
          <dd><code>{{ selectedDifference.objectType }}</code></dd>
        </div>
        <div class="inspector-field">
          <dt>Change</dt>
          <dd><code>{{ selectedDifference.kind.toUpperCase() }}</code></dd>
        </div>
        <div class="inspector-field">
          <dt>Checkpoint</dt>
          <dd><code data-testid="inspector-difference-checkpoint">{{ selectedDifference.checkpointIndex }}</code></dd>
        </div>
        <div class="inspector-field inspector-field-wide">
          <dt>Anchor SBar ID</dt>
          <dd><code data-testid="inspector-difference-sbar-id">{{ selectedDifference.sbarId }}</code></dd>
        </div>
      </dl>
      <div class="inspector-subsection">
        <p class="section-index">PROPERTY DELTAS</p>
        <div v-if="selectedDifference.properties.length" class="inspector-difference-properties" data-testid="inspector-difference-properties">
          <div v-for="property in selectedDifference.properties" :key="property.field" class="inspector-difference-property">
            <strong>{{ property.field }}</strong>
            <div class="inspector-difference-values">
              <div><span>BASELINE</span><code>{{ formatValue(property.baselineValue) }}</code></div>
              <div><span>CANDIDATE</span><code>{{ formatValue(property.candidateValue) }}</code></div>
            </div>
          </div>
        </div>
        <p v-else class="empty-state">No property deltas were supplied for this difference.</p>
      </div>
      <p class="inspector-provenance">Checkpoint and property values are read from the validated Snapshot Compare result. The Inspector does not reconstruct either Snapshot's domain state.</p>
</template>
