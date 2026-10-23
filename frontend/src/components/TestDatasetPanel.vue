<script setup lang="ts">
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
  testStatus: string;
}>();

const emit = defineEmits<{ create: [] }>();

function displaySbarTime(sbarId: string): string {
  const bar = props.origin?.bars.find((item) => item.sbarId === sbarId);
  if (!bar || !props.origin) return sbarId;
  return formatDomainTimestamp(bar.tsEvent, props.origin.timeframe);
}
</script>

<template>
  <section class="dataset-controls-wrap" data-testid="test-dataset-controls">
    <div class="dataset-controls">
      <slot name="source" />

      <div class="dataset-range-summary">
        <div v-if="props.rangeSelectionReady" class="dataset-range-selected" data-testid="selected-test-range">
          <span>INCLUSIVE INTERVAL</span>
          <code data-testid="selected-test-range-start">{{ props.startSbarId }}</code>
          <span aria-hidden="true">→</span>
          <code data-testid="selected-test-range-end">{{ props.endSbarId }}</code>
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
        <span class="dataset-range-status" data-testid="props.origin-range-selection-status" aria-live="polite">
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

      <details v-if="props.testDataset" class="test-dataset-details">
        <summary data-testid="test-dataset-details-toggle">TEST DETAILS</summary>
        <div class="test-dataset-detail-list">
          <div><span>TEST DATASET ID</span><code>{{ props.testDataset.testDatasetId }}</code></div>
          <div><span>ORIGIN ID</span><code>{{ props.testDataset.originDatasetId }}</code></div>
          <div><span>VALIDATED RANGE</span><code>{{ displaySbarTime(props.testDataset.startSbarId) }} → {{ displaySbarTime(props.testDataset.endSbarId) }}</code></div>
          <div><span>SBAR COUNT</span><strong>{{ props.testDataset.sbarCount.toLocaleString() }}</strong></div>
          <div><span>SEQUENCE FINGERPRINT</span><code>{{ props.testDataset.sbarSequenceFingerprint }}</code></div>
        </div>
      </details>
    </div>

    <div v-if="!props.canMutateTest && props.origin || props.testError || props.testStatus" class="dataset-controls-feedback">
      <p v-if="!props.canMutateTest && props.origin" class="dataset-feedback-note">
        Stop or Reset the active Run before changing its Test Dataset.
      </p>
      <p v-if="props.testError" class="error-message" role="alert">{{ props.testError }}</p>
      <p v-else-if="props.testStatus" class="success-message" role="status">{{ props.testStatus }}</p>
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

.test-dataset-details {
  position: relative;
  flex: 0 0 auto;
  color: #aab4bb;
  font-size: 9px;
}

.test-dataset-details > summary {
  padding: 5px 6px;
  border: 1px solid #30383f;
  border-radius: 3px;
  color: #89949d;
  cursor: pointer;
  font: 7px ui-monospace, SFMono-Regular, Consolas, monospace;
  letter-spacing: .04em;
  list-style: none;
  white-space: nowrap;
}

.test-dataset-details > summary::-webkit-details-marker {
  display: none;
}

.test-dataset-details[open] {
  position: absolute;
  z-index: 15;
  top: calc(100% + 3px);
  right: 6px;
  width: min(460px, calc(100vw - 40px));
  padding: 8px;
  border: 1px solid #30383f;
  background: #191e23;
  box-shadow: 0 10px 28px rgb(0 0 0 / 38%);
}

.test-dataset-detail-list {
  display: grid;
  gap: 6px;
}

.test-dataset-detail-list > div {
  display: grid;
  grid-template-columns: 130px minmax(0, 1fr);
  gap: 8px;
}

.test-dataset-detail-list span {
  color: #89949d;
  font: 8px ui-monospace, SFMono-Regular, Consolas, monospace;
}

.test-dataset-detail-list code,
.test-dataset-detail-list strong {
  min-width: 0;
  overflow-wrap: anywhere;
  color: #e3e8eb;
  font: 8px ui-monospace, SFMono-Regular, Consolas, monospace;
}

.dataset-controls-feedback {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 4px 9px 6px;
  border-top: 1px solid #252c32;
  color: #89949d;
  font-size: 8px;
}

.dataset-controls-feedback p {
  margin: 0;
}

.dataset-controls-feedback .error-message,
.dataset-controls-feedback .success-message {
  padding: 0;
  border: 0;
  background: transparent;
  font-size: 8px;
}

.dataset-feedback-note {
  color: #d8b16b;
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
