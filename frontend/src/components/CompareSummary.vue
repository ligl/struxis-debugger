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
      <span class="value" data-testid="compare-summary-identity" :class="{ 'compare-identity-match': identityLabel === 'MATCH', 'compare-identity-mismatch': identityLabel === 'MISMATCH' }">
        {{ identityLabel }}
      </span>
    </div>
    <span class="spacer"></span>
    <span v-if="compareError" class="error-message compare-summary-error" data-testid="compare-summary-error" role="alert">{{ compareError }}</span>
    <span v-else class="footnote">SAME COMPLETE ORDERED SBAR SEQUENCE REQUIRED</span>
  </div>
</template>

<style scoped>
.compare-summary .metric {
  display: flex;
  flex: 0 1 auto;
  align-items: center;
  gap: 7px;
  font-size: 9px;
  white-space: nowrap;
}

.compare-summary .metric .label {
  color: var(--dbg-text-muted);
  font-size: 8px;
  letter-spacing: .03em;
}

.compare-summary .metric .value {
  color: var(--dbg-text-primary);
  font: 10px ui-monospace, SFMono-Regular, Consolas, monospace;
}

.compare-summary .compare-divergence { color: var(--dbg-warning) !important; }
.compare-summary .compare-difference-count { color: var(--dbg-error) !important; }
.compare-summary .compare-identity-match { color: var(--dbg-success) !important; }
.compare-summary .compare-identity-mismatch { color: var(--dbg-warning) !important; }

.compare-summary .metric {
  position: relative;
  min-width: 0;
}

.compare-summary .metric + .metric {
  padding-left: 10px;
}

.compare-summary .metric + .metric::before {
  position: absolute;
  top: 7px;
  bottom: 7px;
  left: 0;
  width: 1px;
  background: #2a3136;
  content: "";
  pointer-events: none;
}

.compare-summary .metric .value {
  overflow: hidden;
  max-width: 240px;
  text-overflow: ellipsis;
}

.compare-summary .footnote {
  min-width: 0;
  margin-left: auto;
  overflow: hidden;
  font: 8px ui-monospace, SFMono-Regular, Consolas, monospace;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.compare-summary-error {
  max-width: 240px;
  margin: 0;
  overflow: hidden;
  font-size: 9px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 1280px) {
  .compare-summary .footnote {
    display: none;
  }
}

@media (max-width: 1050px) {
  .compare-summary .metric { gap: 4px; }
  .compare-summary .metric + .metric { padding-left: 6px; }
  .compare-summary .metric + .metric::before { top: 8px; bottom: 8px; }
}
.compare-summary > div {
  min-width: 0;
  padding: 13px;
  border: 1px solid var(--line, #343a40);
}

</style>
