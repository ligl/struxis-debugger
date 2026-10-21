<script setup lang="ts">
import type { OriginDatasetDto, TestDatasetDto } from "../origin-types";

defineProps<{
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
</script>

<template>
  <section class="dataset-controls" data-testid="test-dataset-controls">
    <div class="dataset-controls-label">
      <span class="section-index">TEST INPUT</span>
      <strong>TEST DATASET</strong>
      <span class="status-label" :class="{ loaded: testDataset }">
        {{ testDataset ? "READY" : "NOT CREATED" }}
      </span>
    </div>

    <div class="dataset-range-summary">
      <div v-if="rangeSelectionReady" class="dataset-range-selected" data-testid="selected-test-range">
        <span>INCLUSIVE RANGE</span>
        <code data-testid="selected-test-range-start">{{ startSbarId }}</code>
        <span aria-hidden="true">→</span>
        <code data-testid="selected-test-range-end">{{ endSbarId }}</code>
        <strong data-testid="selected-test-range-count">{{ selectedRangeCount.toLocaleString() }}</strong><span>SBARS</span>
      </div>
      <div v-else-if="rangeSelectionPending" class="dataset-range-pending" data-testid="test-range-awaiting-end">
        START <code>{{ startSbarId }}</code> · Select the inclusive end on the chart
      </div>
      <div v-else-if="origin" class="dataset-range-empty" data-testid="test-range-not-selected">
        Select an inclusive interval directly on the Origin chart
      </div>
      <div v-else class="dataset-range-empty">
        Load a validated Origin before selecting a Test interval.
      </div>
      <span class="dataset-range-status" data-testid="origin-range-selection-status" aria-live="polite">
        {{ rangeSelectionStatus }}
      </span>
    </div>

    <span class="spacer"></span>

    <button
      class="primary-button dataset-create-button"
      data-testid="test-dataset-create"
      :disabled="testLoading || !canMutateTest || !rangeSelectionReady"
      @click="emit('create')"
    >
      {{ testLoading ? "VALIDATING…" : testDataset ? "REPLACE TEST DATASET" : "CREATE TEST DATASET" }}
    </button>

    <details v-if="testDataset" class="test-dataset-details">
      <summary data-testid="test-dataset-details-toggle">DETAILS</summary>
      <div class="test-dataset-detail-list">
        <div><span>TEST DATASET ID</span><code>{{ testDataset.testDatasetId }}</code></div>
        <div><span>ORIGIN ID</span><code>{{ testDataset.originDatasetId }}</code></div>
        <div><span>VALIDATED RANGE</span><code>{{ testDataset.startSbarId }} → {{ testDataset.endSbarId }}</code></div>
        <div><span>SBAR COUNT</span><strong>{{ testDataset.sbarCount.toLocaleString() }}</strong></div>
        <div><span>SEQUENCE FINGERPRINT</span><code>{{ testDataset.sbarSequenceFingerprint }}</code></div>
      </div>
    </details>

    <p v-if="!canMutateTest && origin" class="dataset-controls-message">
      Dispose the current Run before replacing its Test Dataset.
    </p>
    <p v-if="testError" class="error-message dataset-controls-message" role="alert">{{ testError }}</p>
    <p v-else-if="testStatus" class="success-message dataset-controls-message" role="status">{{ testStatus }}</p>
  </section>
</template>
