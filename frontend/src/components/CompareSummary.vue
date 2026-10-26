<script setup lang="ts">
import { computed } from "vue";
import type { SnapshotCompareResultDto } from "../origin-types";

const props = defineProps<{
  compareResult: SnapshotCompareResultDto | null;
  compareLoading: boolean;
  compareError: string;
}>();

const sequenceLabel = computed(() => {
  const result = props.compareResult;
  if (!result) return "—";
  return `${result.baseline.inputBarCount} / ${result.candidate.inputBarCount}`;
});
const firstDivergenceLabel = computed(() => {
  const result = props.compareResult;
  if (!result) return props.compareLoading ? "COMPARING…" : "NOT RUN";
  const divergence = result.firstStructuralDivergence;
  return divergence ? `#${divergence.checkpointIndex} · ${divergence.sbarId}` : "NONE";
});
const identityLabel = computed(() => {
  const result = props.compareResult;
  if (!result) return "—";
  return result.baseline.inputBarCount === result.candidate.inputBarCount &&
    result.baseline.sbarSequenceFingerprint === result.candidate.sbarSequenceFingerprint
    ? "MATCH"
    : "MISMATCH";
});
</script>

<template>
  <div class="compare-summary" data-testid="compare-summary">
    <div class="metric">
      <span class="label">SBAR SEQUENCE</span>
      <span class="value" data-testid="compare-summary-sequence">{{ sequenceLabel }}</span>
    </div>
    <div class="metric">
      <span class="label">FIRST DIVERGENCE</span>
      <span class="value" data-testid="compare-summary-first-divergence" :class="{ 'compare-divergence': compareResult?.firstStructuralDivergence }">
        {{ firstDivergenceLabel }}
      </span>
    </div>
    <div class="metric">
      <span class="label">OBJECT DIFFERENCES</span>
      <span class="value" data-testid="compare-summary-difference-count" :class="{ 'compare-difference-count': (compareResult?.differences.length ?? 0) > 0 }">
        {{ compareResult ? String(compareResult.differences.length).padStart(2, "0") : "—" }}
      </span>
    </div>
    <div class="metric">
      <span class="label">IDENTITY</span>
      <span class="value" data-testid="compare-summary-identity"  :class="{ 'compare-identity-match': identityLabel === 'MATCH', 'compare-identity-mismatch': identityLabel === 'MISMATCH' }">
        {{ identityLabel }}
      </span>
    </div>
    <span class="spacer"></span>
    <span v-if="compareError" class="error-message compare-summary-error" data-testid="compare-summary-error" role="alert">{{ compareError }}</span>
    <span v-else class="footnote">SAME COMPLETE ORDERED SBAR SEQUENCE REQUIRED</span>
  </div>
</template>
