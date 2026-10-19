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
  testLoading: boolean;
  canMutateTest: boolean;
  testError: string;
  testStatus: string;
}>();
const emit = defineEmits<{ create: [] }>();
</script>

<template>
  <section class="panel operations-panel">
    <div class="panel-heading">
      <div>
        <p class="section-index">03 / TEST INPUT</p>
        <h2>Test Dataset</h2>
      </div>
      <span class="status-label" :class="{ loaded: testDataset }">
        {{ testDataset ? "READY" : "NOT CREATED" }}
      </span>
    </div>

    <template v-if="origin">
      <p class="microcopy">Choose a continuous, inclusive interval by clicking the start SBar and then the end SBar in the Origin chart. The backend validates both exact SBar IDs before creating the Test Dataset.</p>

      <div v-if="rangeSelectionReady" class="detail-list" data-testid="selected-test-range">
        <div><span>SELECTED START SBAR ID</span><code>{{ startSbarId }}</code></div>
        <div><span>SELECTED END SBAR ID</span><code>{{ endSbarId }}</code></div>
        <div><span>INCLUSIVE SBAR COUNT</span><strong>{{ selectedRangeCount.toLocaleString() }}</strong></div>
      </div>
      <div v-else-if="rangeSelectionPending" class="empty-state" data-testid="test-range-awaiting-end">
        Start selected: <code>{{ startSbarId }}</code>. Click a second Origin candle to complete the interval.
      </div>
      <p v-else class="empty-state" data-testid="test-range-not-selected">
        No new interval selected. Click two candles in the Origin chart to define the Test input.
      </p>

      <button
        class="action-button action-primary"
        data-testid="test-dataset-create"
        :disabled="testLoading || !canMutateTest || !rangeSelectionReady"
        @click="emit('create')"
      >
        {{ testLoading ? "VALIDATING INTERVAL…" : testDataset ? "REPLACE TEST DATASET" : "CREATE TEST DATASET" }}
      </button>
      <p v-if="!canMutateTest" class="microcopy">Dispose the current Run before replacing its Test Dataset.</p>
    </template>
    <p v-else class="empty-state">Load a validated Origin before selecting a Test interval.</p>

    <p v-if="testError" class="error-message">{{ testError }}</p>
    <p v-else-if="testStatus" class="success-message">{{ testStatus }}</p>

    <div v-if="testDataset" class="detail-list">
      <div><span>TEST DATASET ID</span><code>{{ testDataset.testDatasetId }}</code></div>
      <div><span>ORIGIN ID</span><code>{{ testDataset.originDatasetId }}</code></div>
      <div><span>VALIDATED RANGE</span><code>{{ testDataset.startSbarId }} → {{ testDataset.endSbarId }}</code></div>
      <div><span>SBAR COUNT</span><strong>{{ testDataset.sbarCount.toLocaleString() }}</strong></div>
      <div><span>SEQUENCE FINGERPRINT</span><code>{{ testDataset.sbarSequenceFingerprint }}</code></div>
    </div>
  </section>
</template>
