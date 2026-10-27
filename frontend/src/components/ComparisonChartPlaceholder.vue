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

.comparison-chart-panel {
  display: flex;
  min-width: 0;
  min-height: 0;
  height: 100%;
  border-top: 1px solid var(--dbg-border);
  flex-direction: column;
  overflow: hidden;
  background: #121619;
}

.comparison-chart-heading {
  display: flex;
  flex: 0 0 30px;
  min-height: 30px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 2px 10px;
  border-bottom: 1px solid var(--dbg-border);
  background: #191e22;
}

.comparison-chart-heading h3 {
  min-width: 0;
  margin: 0;
  color: var(--dbg-text-primary);
  font-size: 11px;
  line-height: 1;
  letter-spacing: .04em;
}

.comparison-chart-state {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 5px;
  padding: 4px 6px;
  border: 1px solid var(--dbg-border);
  border-radius: 2px;
  color: var(--dbg-text-secondary);
  font: 8px ui-monospace, SFMono-Regular, Consolas, monospace;
  letter-spacing: .04em;
  white-space: nowrap;
}

.comparison-chart-state.is-ready {
  border-color: #57452f;
  color: #d8b47b;
}

.comparison-chart-state.is-pending {
  color: var(--dbg-text-muted);
}

.comparison-chart-empty {
  position: relative;
  display: flex;
  flex: 1 1 auto;
  min-width: 0;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 8px;
  padding: 22px 24px;
  background:
    linear-gradient(90deg, rgba(214, 168, 93, .035) 1px, transparent 1px),
    linear-gradient(rgba(214, 168, 93, .025) 1px, transparent 1px),
    #121619;
  background-size: 32px 32px;
}

.comparison-chart-empty strong {
  margin-top: 3px;
  color: var(--dbg-text-primary);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: .01em;
}

.comparison-chart-empty p {
  max-width: 560px;
  margin: 0;
  color: var(--dbg-text-secondary);
  font-size: 10px;
  line-height: 1.65;
}

.comparison-chart-heading .section-index {
  margin: 0;
  color: var(--dbg-text-muted);
  font: 8px ui-monospace, SFMono-Regular, Consolas, monospace;
  letter-spacing: .08em;
}

</style>
