<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import type { OriginDatasetDto, TestDatasetDto } from "../origin-types";
import { formatDomainTimestamp } from "../timestamp-format";

const props = defineProps<{
  origin: OriginDatasetDto | null;
  testDataset: TestDatasetDto | null;
  startSbarId: string;
  endSbarId: string;
  rangeSelectionReady: boolean;
  rangeSelectionPending: boolean;
  selectedRangeCount: number;
  rangeSelectionStatus: string;
  testLoading: boolean;
  canMutateTest: boolean;
  testError: string;
}>();

const emit = defineEmits<{ create: [] }>();
const detailsOpen = ref(false);
const controlsRoot = ref<HTMLElement | null>(null);

function handleDocumentPointerDown(event: PointerEvent): void {
  const target = event.target;
  if (target instanceof Node && !controlsRoot.value?.contains(target)) {
    detailsOpen.value = false;
  }
}

function handleDocumentKeyDown(event: KeyboardEvent): void {
  if (event.key === "Escape") detailsOpen.value = false;
}

onMounted(() => {
  document.addEventListener("pointerdown", handleDocumentPointerDown);
  document.addEventListener("keydown", handleDocumentKeyDown);
});

onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", handleDocumentPointerDown);
  document.removeEventListener("keydown", handleDocumentKeyDown);
});

function displaySbarTime(sbarId: string): string {
  const bar = props.origin?.bars.find((item) => item.sbarId === sbarId);
  if (!bar || !props.origin) return sbarId;
  return formatDomainTimestamp(bar.tsEvent, props.origin.timeframe);
}
</script>

<template>
  <section ref="controlsRoot" class="dataset-controls-wrap" data-testid="test-dataset-controls">
    <div class="dataset-controls">
      <slot name="source" />

      <div class="dataset-range-summary">
        <div v-if="props.rangeSelectionReady" class="dataset-range-selected" data-testid="selected-test-range">
          <span>INCLUSIVE INTERVAL</span>
          <code data-testid="selected-test-range-start" :data-sbar-id="props.startSbarId">{{ displaySbarTime(props.startSbarId) }}</code>
          <span aria-hidden="true">→</span>
          <code data-testid="selected-test-range-end" :data-sbar-id="props.endSbarId">{{ displaySbarTime(props.endSbarId) }}</code>
          <strong data-testid="selected-test-range-count">{{ props.selectedRangeCount.toLocaleString() }}</strong>
          <span>SBARS</span>
        </div>
        <div v-else-if="props.rangeSelectionPending" class="dataset-range-pending" data-testid="test-range-awaiting-end">
          START <code>{{ displaySbarTime(props.startSbarId) }}</code> · Select end on chart
        </div>
        <div v-else-if="props.origin" class="dataset-range-empty" data-testid="test-range-not-selected">
          Select inclusive interval on chart
        </div>
        <div v-else class="dataset-range-empty">
          Load Origin to select interval
        </div>
        <span class="dataset-range-status" data-testid="origin-range-selection-status" aria-live="polite">
          {{ props.rangeSelectionStatus }}
        </span>
      </div>

      <span class="spacer"></span>

      <button
        class="primary-button dataset-create-button"
        data-testid="test-dataset-create"
        :disabled="props.testLoading || !props.canMutateTest || !props.rangeSelectionReady"
        @click="emit('create')"
      >
        {{ props.testLoading ? "VALIDATING…" : props.testDataset ? "REPLACE TEST DATASET" : "CREATE TEST DATASET" }}
      </button>

      <button
        class="test-dataset-details-toggle"
        data-testid="test-dataset-details-toggle"
        type="button"
        :disabled="!props.testDataset"
        :aria-expanded="detailsOpen"
        aria-controls="test-dataset-details-popover"
        @click.stop="detailsOpen = !detailsOpen"
      >
        TEST DETAILS
      </button>

      <section
        v-if="props.testDataset && detailsOpen"
        id="test-dataset-details-popover"
        class="test-dataset-details-popover"
        data-testid="test-dataset-details-popover"
        aria-label="Test Dataset details"
        @pointerdown.stop
      >
        <header class="details-popover-header">
          <div>
            <span class="details-eyebrow">DATASET / VALIDATION</span>
            <h3>Test Dataset</h3>
          </div>
          <span class="details-state"><span aria-hidden="true"></span> VALIDATED</span>
        </header>

        <div class="details-range-card">
          <span class="details-field-label">INCLUSIVE INTERVAL</span>
          <div class="details-range-values">
            <code>{{ displaySbarTime(props.testDataset.startSbarId) }}</code>
            <span aria-hidden="true">→</span>
            <code>{{ displaySbarTime(props.testDataset.endSbarId) }}</code>
          </div>
          <div class="details-range-count">
            <strong>{{ props.testDataset.sbarCount.toLocaleString() }}</strong>
            <span>SBARS</span>
          </div>
        </div>

        <div class="test-dataset-detail-list">
          <div class="details-id-row">
            <span>INSTRUMENT</span>
            <code>{{ props.testDataset.instrumentId }}</code>
          </div>
          <div class="details-id-row">
            <span>TIMEFRAME</span>
            <code>{{ props.testDataset.timeframe }}</code>
          </div>
          <div class="details-id-row">
            <span>TEST DATASET ID</span>
            <code>{{ props.testDataset.testDatasetId }}</code>
          </div>
          <div class="details-id-row">
            <span>ORIGIN DATASET ID</span>
            <code>{{ props.testDataset.originDatasetId }}</code>
          </div>
          <div class="details-fingerprint">
            <span class="details-field-label">SBar SEQUENCE FINGERPRINT</span>
            <code>{{ props.testDataset.sbarSequenceFingerprint }}</code>
          </div>
        </div>
      </section>
    </div>

  </section>
</template>

<style scoped>
.dataset-controls-wrap {
  position: relative;
  /* Keep Catalog popovers above the chart canvas and its positioned overlays. */
  z-index: 30;
  flex: 0 0 auto;
  min-width: 0;
  overflow: visible;
  border-bottom: 1px solid #252c32;
  background: #14191d;
}

.dataset-controls {
  display: flex;
  min-width: 0;
  min-height: 39px;
  align-items: center;
  gap: 9px;
  padding: 5px 9px;
}

.dataset-range-summary {
  display: flex;
  flex: 1 1 260px;
  min-width: 0;
  align-items: center;
  gap: 8px;
}

.dataset-range-selected {
  display: flex;
  flex: 0 0 auto;
  min-width: 0;
  align-items: center;
  gap: 5px;
  color: #aab4bb;
  font: 8px ui-monospace, SFMono-Regular, Consolas, monospace;
  white-space: nowrap;
}

.dataset-range-selected > span:first-child {
  color: #89949d;
  font-size: 7px;
  letter-spacing: .04em;
}

.dataset-range-selected code {
  max-width: 170px;
  overflow: hidden;
  color: #e3e8eb;
  font-size: 8px;
  text-overflow: ellipsis;
}

.dataset-range-selected strong {
  color: #75c6a1;
  font-weight: 600;
}

.dataset-range-pending,
.dataset-range-empty {
  min-width: 0;
  overflow: hidden;
  color: #89949d;
  font-size: 8px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dataset-range-pending code {
  color: #e3e8eb;
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
}

.dataset-range-status {
  flex: 0 1 170px;
  min-width: 0;
  overflow: hidden;
  color: #66727b;
  font: 8px ui-monospace, SFMono-Regular, Consolas, monospace;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dataset-create-button {
  flex: 0 0 auto;
  min-height: 27px;
  padding: 0 9px;
  font-size: 8px;
  letter-spacing: .025em;
  white-space: nowrap;
}

.test-dataset-details-toggle {
  display: inline-flex;
  flex: 0 0 auto;
  min-height: 28px;
  align-items: center;
  gap: 6px;
  padding: 0 8px;
  border: 1px solid #343d44;
  border-radius: 4px;
  background: #1a2025;
  color: #c3cbd0;
  cursor: pointer;
  font: 8px ui-monospace, SFMono-Regular, Consolas, monospace;
  letter-spacing: .045em;
  white-space: nowrap;
}

.test-dataset-details-toggle:hover:not(:disabled),
.test-dataset-details-toggle[aria-expanded="true"] {
  border-color: #8c6a3d;
  background: #24221e;
  color: #e5c18a;
}

.test-dataset-details-toggle:disabled {
  border-color: #2a3136;
  background: #171c20;
  color: #626d75;
  cursor: not-allowed;
}

.test-dataset-details-popover {
  position: absolute;
  z-index: 40;
  top: calc(100% + 6px);
  right: 9px;
  width: min(440px, calc(100vw - 28px));
  padding: 0;
  overflow: hidden;
  border: 1px solid #3a434a;
  border-radius: 6px;
  background: #191f24;
  box-shadow: 0 16px 38px rgb(0 0 0 / 48%), 0 2px 8px rgb(0 0 0 / 24%);
}

.details-popover-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 15px 12px;
  border-bottom: 1px solid #2d353b;
  background: linear-gradient(110deg, #22282d, #191f24 72%);
}

.details-popover-header > div {
  display: grid;
  gap: 4px;
}

.details-eyebrow,
.details-field-label {
  color: #8f9aa2;
  font: 8px ui-monospace, SFMono-Regular, Consolas, monospace;
  letter-spacing: .09em;
}

.details-popover-header h3 {
  margin: 0;
  color: #e2e7ea;
  font-size: 13px;
  font-weight: 550;
  letter-spacing: .01em;
}

.details-state {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 7px;
  border: 1px solid #385344;
  border-radius: 3px;
  color: #9bc9ae;
  font: 8px ui-monospace, SFMono-Regular, Consolas, monospace;
  white-space: nowrap;
}

.details-state > span {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #79b792;
}

.details-range-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 9px 12px;
  margin: 12px;
  padding: 11px 12px;
  border: 1px solid #353c40;
  border-radius: 4px;
  background: #14191d;
}

.details-range-card > .details-field-label {
  grid-column: 1 / -1;
}

.details-range-values {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 7px;
  color: #7e8991;
  font: 9px ui-monospace, SFMono-Regular, Consolas, monospace;
}

.details-range-values code {
  min-width: 0;
  color: #e1e6e9;
  overflow-wrap: anywhere;
}

.details-range-count {
  display: grid;
  align-content: center;
  justify-items: end;
  gap: 2px;
  padding-left: 10px;
  border-left: 1px solid #30383e;
}

.details-range-count strong {
  color: #d6ad72;
  font: 600 16px ui-monospace, SFMono-Regular, Consolas, monospace;
}

.details-range-count span {
  color: #87929a;
  font: 7px ui-monospace, SFMono-Regular, Consolas, monospace;
  letter-spacing: .08em;
}

.test-dataset-detail-list {
  display: grid;
  gap: 0;
  padding: 0 12px 12px;
}

.details-id-row {
  display: grid;
  grid-template-columns: 125px minmax(0, 1fr);
  align-items: baseline;
  gap: 10px;
  padding: 9px 2px;
  border-bottom: 1px solid #2b3339;
}

.details-id-row > span {
  color: #89949d;
  font: 8px ui-monospace, SFMono-Regular, Consolas, monospace;
  letter-spacing: .025em;
  text-align: right;
}

.details-id-row code,
.details-fingerprint code {
  min-width: 0;
  color: #cbd3d8;
  font: 9px ui-monospace, SFMono-Regular, Consolas, monospace;
  overflow-wrap: anywhere;
  user-select: text;
}

.details-fingerprint {
  display: grid;
  gap: 7px;
  padding: 11px 2px 1px;
}

.details-fingerprint code {
  color: #aeb8be;
  line-height: 1.5;
  word-break: break-all;
}

@media (max-width: 560px) {
  .test-dataset-details-popover {
    right: 5px;
    width: calc(100vw - 20px);
  }

  .details-id-row {
    grid-template-columns: 105px minmax(0, 1fr);
  }

  .details-range-values {
    flex-wrap: wrap;
  }
}

@media (max-width: 1180px) {
  .dataset-controls {
    flex-wrap: wrap;
    row-gap: 6px;
  }

  .dataset-range-summary {
    flex-basis: 100%;
    order: 4;
  }

  .dataset-range-status {
    flex: 1 1 120px;
  }
}
</style>
