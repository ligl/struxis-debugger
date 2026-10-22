<script setup lang="ts">
import type { ObjectDifferenceDto } from "../origin-types";
import InspectorPropertyField from "./InspectorPropertyField.vue";
import { formatInspectorValue } from "../inspector-format";

defineProps<{
  selectedDifference: ObjectDifferenceDto;
  compareBaselineSnapshotId: string | null;
  compareCandidateSnapshotId: string | null;
}>();

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
        <InspectorPropertyField label="Domain Object ID" :value="selectedDifference.objectId" :test-id="'inspector-difference-object-id'" wide />
        <InspectorPropertyField label="Baseline Snapshot" :value="compareBaselineSnapshotId ?? '—'" test-id="inspector-baseline-snapshot" wide />
        <InspectorPropertyField label="Candidate Snapshot" :value="compareCandidateSnapshotId ?? '—'" test-id="inspector-candidate-snapshot" wide />
        <InspectorPropertyField label="Object Type" :value="selectedDifference.objectType" />
        <InspectorPropertyField label="Change" :value="selectedDifference.kind.toUpperCase()" />
        <InspectorPropertyField label="Checkpoint" :value="String(selectedDifference.checkpointIndex)" test-id="inspector-difference-checkpoint" />
        <InspectorPropertyField label="Anchor SBar ID" :value="selectedDifference.sbarId" test-id="inspector-difference-sbar-id" wide />
      </dl>
      <div class="inspector-subsection">
        <p class="section-index">PROPERTY DELTAS</p>
        <div v-if="selectedDifference.properties.length" class="inspector-difference-properties" data-testid="inspector-difference-properties">
          <div v-for="property in selectedDifference.properties" :key="property.field" class="inspector-difference-property">
            <strong>{{ property.field }}</strong>
            <div class="inspector-difference-values">
              <div><span>BASELINE</span><code>{{ formatInspectorValue(property.baselineValue) }}</code></div>
              <div><span>CANDIDATE</span><code>{{ formatInspectorValue(property.candidateValue) }}</code></div>
            </div>
          </div>
        </div>
        <p v-else class="empty-state">No property deltas were supplied for this difference.</p>
      </div>
      <p class="inspector-provenance">Checkpoint and property values are read from the validated Snapshot Compare result. The Inspector does not reconstruct either Snapshot's domain state.</p>
</template>
