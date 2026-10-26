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
