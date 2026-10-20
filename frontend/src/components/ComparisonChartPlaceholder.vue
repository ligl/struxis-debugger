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
      <div>
        <p class="section-index">{{ side === "candidate" ? "CANDIDATE / UPPER" : "BASELINE / LOWER" }}</p>
        <h3>{{ side === "candidate" ? "Candidate" : "Baseline" }}</h3>
      </div>
      <span class="comparison-chart-state">{{ hasComparison ? `${checkpointCount ?? 0} CHECKPOINTS COMPARED` : "AWAITING VERIFIED COMPARE" }}</span>
    </header>
    <div class="comparison-chart-empty">
      <strong>Authoritative chart projection not connected</strong>
      <p>
        {{ hasComparison
          ? "The current Compare DTO exposes checkpoint and difference metadata, not the historical SBar OHLCV sequence required for chart rendering."
          : "Select two eligible completed Snapshots in the Compare controls below. Chart data will only be drawn from an authoritative historical SBar projection." }}
      </p>
      <span>NO SYNTHETIC MARKET DATA</span>
    </div>
  </section>
</template>
