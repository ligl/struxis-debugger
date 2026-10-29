<script setup lang="ts">
import CatalogPanel from "./CatalogPanel.vue";
import OriginChart from "./OriginChart.vue";
import TestDatasetPanel from "./TestDatasetPanel.vue";
import type { InstrumentGroup } from "../composables/useCatalogGroups";
import type {
  CatalogDatasetEntry,
  OriginDatasetDto,
  OriginObjectSelection,
  TestDatasetDto,
} from "../origin-types";

defineProps<{
  active: boolean;
  datasets: CatalogDatasetEntry[];
  selectedId: string;
  selectedDataset: CatalogDatasetEntry | null;
  instrumentGroups: InstrumentGroup[];
  refreshing: boolean;
  loading: boolean;
  mutationBusy: boolean;
  discoveryError: string;
  enableStructure: boolean;
  origin: OriginDatasetDto | null;
  loadStatus: "idle" | "loading" | "loaded" | "failed";
  loadError: string;
  formatDomainTimestamp: (value: string | null, timeframe: string | null) => string;
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
  selectedObject: OriginObjectSelection | null;
  selectionStartSbarId: string | null;
  selectionEndSbarId: string | null;
  selectionPending: boolean;
  selectionEditable: boolean;
}>();

const emit = defineEmits<{
  refreshCatalog: [];
  selectDataset: [id: string];
  updateEnableStructure: [value: boolean];
  loadOrigin: [];
  createTestDataset: [];
  selectAllSbars: [];
  sbarClick: [sbarId: string];
  objectClick: [selection: Extract<OriginObjectSelection, { kind: "cbar" | "swing" | "trend" }>];
  rangeBoundaryChange: [edge: "start" | "end", sbarId: string];
  selectionError: [message: string];
  cancelRangeSelection: [];
}>();

function handleRangeBoundaryChange(edge: "start" | "end", sbarId: string): void {
  emit("rangeBoundaryChange", edge, sbarId);
}
</script>

<template>
  <div v-show="active" class="dataset-controls-host" data-testid="dataset-workspace">
    <TestDatasetPanel
      :origin="origin"
      :test-dataset="testDataset"
      :start-sbar-id="startSbarId"
      :end-sbar-id="endSbarId"
      :range-selection-ready="rangeSelectionReady"
      :range-selection-pending="rangeSelectionPending"
      :selected-range-count="selectedRangeCount"
      :range-selection-status="rangeSelectionStatus"
      :test-loading="testLoading"
      :can-mutate-test="canMutateTest"
      :test-error="testError"
      @create="emit('createTestDataset')"
      @select-all="emit('selectAllSbars')"
    >
      <template #source>
        <CatalogPanel
          :datasets="datasets"
          :selected-id="selectedId"
          :selected-dataset="selectedDataset"
          :instrument-groups="instrumentGroups"
          :refreshing="refreshing"
          :loading="loading"
          :mutation-busy="mutationBusy"
          :discovery-error="discoveryError"
          :enable-structure="enableStructure"
          :origin="origin"
          :load-status="loadStatus"
          :load-error="loadError"
          :format-domain-timestamp="formatDomainTimestamp"
          @refresh="emit('refreshCatalog')"
          @select-dataset="emit('selectDataset', $event)"
          @update:enable-structure="emit('updateEnableStructure', $event)"
          @load="emit('loadOrigin')"
        />
      </template>
    </TestDatasetPanel>
  </div>
  <OriginChart
    v-if="origin"
    v-show="active"
    :bars="origin.bars"
    :structure="origin.structure"
    :origin-dataset-id="origin.originDatasetId"
    :selected-object="selectedObject"
    :selection-start-sbar-id="selectionStartSbarId"
    :selection-end-sbar-id="selectionEndSbarId"
    :selection-pending="selectionPending"
    :selection-editable="selectionEditable"
    @sbar-click="emit('sbarClick', $event)"
    @object-click="emit('objectClick', $event)"
    @range-boundary-change="handleRangeBoundaryChange"
    @selection-error="emit('selectionError', $event)"
    @cancel-range-selection="emit('cancelRangeSelection')"
  />
  <section
    v-else-if="active"
    class="dataset-chart-empty"
    :data-load-status="loadStatus"
    data-testid="dataset-chart-empty"
    aria-label="Origin chart empty state"
  >
    <div class="dataset-chart-empty-content">
      <svg class="dataset-chart-empty-icon" viewBox="0 0 64 48" aria-hidden="true">
        <path d="M5 5.5H59M5 21.5H59M5 37.5H59" />
        <path d="M13 12V28M25 7V35M37 17V39M49 10V30" />
        <path d="M9 17H17M21 25H29M33 31H41M45 21H53" />
      </svg>
      <span class="dataset-chart-empty-eyebrow">DATASET / ORIGIN</span>
      <h2>{{ loadStatus === "loading" ? "LOADING ORIGIN DATA" : "ORIGIN DATA NOT LOADED" }}</h2>
      <p v-if="loadStatus === 'loading'">Reading and validating the selected SBar sequence…</p>
      <p v-else>Select a dataset in Catalog, then click <strong>LOAD</strong> to populate the chart.</p>
      <div v-if="loadStatus !== 'loading'" class="dataset-chart-empty-flow" aria-label="Load workflow">
        <span>SELECT DATASET</span>
        <span class="dataset-chart-empty-arrow">→</span>
        <span>LOAD</span>
        <span class="dataset-chart-empty-arrow">→</span>
        <span>INSPECT SBARS</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.dataset-controls-host {
  flex: 0 0 auto;
  min-width: 0;
  overflow: visible;
}

.dataset-chart-empty {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex: 1 1 auto;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border:0;
  border-bottom: 1px solid #30383f;
  background: radial-gradient(ellipse at center, rgb(214 168 93 / 3%), transparent 68%), #121619;
}

.dataset-chart-empty-content {
  display: flex;
  max-width: 460px;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 24px;
  text-align: center;
}

.dataset-chart-empty-icon {
  width: 58px;
  height: 44px;
  margin-bottom: 6px;
  fill: none;
  stroke: #59636b;
  stroke-width: 1.2;
  stroke-linecap: square;
  stroke-linejoin: miter;
}

.dataset-chart-empty-eyebrow {
  color: #D6A85D;
  font: 9px ui-monospace, SFMono-Regular, Consolas, monospace;
  letter-spacing: .14em;
}

.dataset-chart-empty-content h2 {
  margin: 0;
  color: #d6dfe3;
  font-size: 13px;
  font-weight: 650;
  letter-spacing: .06em;
}

.dataset-chart-empty-content p {
  margin: 0;
  color: #89949d;
  font-size: 11px;
  line-height: 1.6;
}

.dataset-chart-empty-content p strong {
  color: #d6dfe3;
  font: 10px ui-monospace, SFMono-Regular, Consolas, monospace;
}

.dataset-chart-empty-flow {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-top: 8px;
  color: #a5b0b7;
  font: 8px ui-monospace, SFMono-Regular, Consolas, monospace;
  letter-spacing: .04em;
}

.dataset-chart-empty-arrow {
  color: #59636b;
}

@media (max-width: 720px) {
  .dataset-chart-empty-content {
    padding: 16px;
  }

  .dataset-chart-empty-flow {
    gap: 5px;
    font-size: 7px;
  }
}
</style>
