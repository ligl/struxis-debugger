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
  testStatus: string;
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
  sbarClick: [sbarId: string];
  objectClick: [selection: Extract<OriginObjectSelection, { kind: "cbar" | "swing" }>];
  rangeBoundaryChange: [edge: "start" | "end", sbarId: string];
  selectionError: [message: string];
  cancelRangeSelection: [];
}>();

function handleRangeBoundaryChange(edge: "start" | "end", sbarId: string): void {
  emit("rangeBoundaryChange", edge, sbarId);
}
</script>

<template>
  <div v-if="active" class="dataset-controls-host" data-testid="dataset-workspace">
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
      :test-status="testStatus"
      @create="emit('createTestDataset')"
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
    v-if="active && origin"
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
</template>
