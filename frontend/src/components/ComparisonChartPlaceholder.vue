<script setup lang="ts">
defineProps<{
  side: "candidate" | "baseline";
  hasComparison: boolean;
  checkpointCount: number | null;
}>();
</script>

<template>
  <section
    class="comparison-chart-panel"
    :data-testid="`compare-${side}-chart`"
    :aria-label="side === 'candidate' ? 'Candidate chart' : 'Baseline chart'"
  >
    <header class="comparison-chart-heading">
      <h3>{{ side === "candidate" ? "Candidate" : "Baseline" }}</h3>
      <span class="comparison-chart-state" :class="{ 'is-ready': hasComparison, 'is-pending': !hasComparison }">
        {{ hasComparison ? `${checkpointCount ?? 0} CHECKPOINTS` : "NO RESULT" }}
      </span>
    </header>
    <div class="comparison-chart-empty">
      <span class="comparison-chart-empty-mark" aria-hidden="true">—</span>
      <strong>Historical chart data unavailable</strong>
      <p>
        {{ hasComparison
          ? "Comparison metadata is available, but this result does not include the historical SBar OHLCV sequence needed to render candles."
          : "Choose two completed Snapshots and run a comparison. Candles will appear only when an authoritative historical SBar sequence is available." }}
      </p>
      <span class="comparison-chart-integrity">AUTHORITATIVE DATA ONLY <i>·</i> NO SYNTHETIC CANDLES</span>
    </div>
  </section>
</template>

<style scoped>
.comparison-chart-empty > span {
  color: var(--dbg-text-muted);
  font: 8px ui-monospace, SFMono-Regular, Consolas, monospace;
  letter-spacing: .1em;
}

.comparison-chart-empty-mark {
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  border: 1px solid #343b40;
  border-radius: 3px;
  color: var(--dbg-text-muted);
  font: 18px/1 ui-monospace, SFMono-Regular, Consolas, monospace;
}

.comparison-chart-empty strong {
  margin-top: 3px;
  font-size: 12px;
  letter-spacing: .01em;
}

.comparison-chart-empty p {
  max-width: 560px;
  font-size: 10px;
  line-height: 1.65;
}

.comparison-chart-integrity {
  margin-top: 4px;
  color: #7f898f;
  font: 8px ui-monospace, SFMono-Regular, Consolas, monospace;
  letter-spacing: .07em;
}

.comparison-chart-integrity i {
  padding-inline: 3px;
  color: #b38a50;
  font-style: normal;
}
</style>
