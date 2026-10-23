<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { CatalogDatasetEntry, OriginDatasetDto } from "../origin-types";
import OriginPanel from "./OriginPanel.vue";

const sourceDetails = ref<HTMLDetailsElement | null>(null);

function closeOnOutsidePointerDown(event: PointerEvent): void {
  const details = sourceDetails.value;
  if (details?.open && event.target instanceof Node && !details.contains(event.target)) {
    details.open = false;
  }
}

onMounted(() => {
  if (props.discoveryError || props.loadError) {
    sourceDetails.value!.open = true;
  }
  document.addEventListener("pointerdown", closeOnOutsidePointerDown);
});

onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", closeOnOutsidePointerDown);
});

interface InstrumentGroup {
  key: string;
  label: string;
  unresolved: boolean;
  datasets: CatalogDatasetEntry[];
  readyCount: number;
}

const props = defineProps<{
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
}>();

const emit = defineEmits<{
  refresh: [];
  selectDataset: [id: string];
  "update:enableStructure": [value: boolean];
  load: [];
}>();
</script>

<template>
  <section class="catalog-controls" aria-label="Catalog source controls" data-testid="catalog-controls">
    <label class="catalog-source-field">
      <span>DATASET</span>
      <select
        data-testid="catalog-dataset-select"
        :value="selectedId"
        :disabled="loading || mutationBusy || datasets.length === 0"
        @change="emit('selectDataset', ($event.target as HTMLSelectElement).value)"
      >
        <option v-if="datasets.length === 0" value="">NO STREAMS</option>
        <optgroup v-for="group in instrumentGroups" :key="group.key" :label="group.label">
          <option
            v-for="dataset in group.datasets"
            :key="dataset.id"
            :value="dataset.id"
          >
            {{ dataset.barType ?? dataset.id }}{{ dataset.timeframe ? " · " + dataset.timeframe : "" }}{{ dataset.available ? "" : " · UNAVAILABLE" }}
          </option>
        </optgroup>
      </select>
    </label>

    <button
      class="catalog-icon-action"
      data-testid="catalog-refresh"
      type="button"
      :disabled="refreshing || loading"
      :aria-label="refreshing ? 'Refreshing Catalog' : 'Refresh Catalog'"
      :title="refreshing ? 'Refreshing Catalog' : 'Refresh Catalog'"
      @click="emit('refresh')"
    >
      {{ refreshing ? "…" : "↻" }}
    </button>

    <label class="catalog-structure-toggle">
      <input
        data-testid="catalog-enable-structure"
        :checked="enableStructure"
        @change="emit('update:enableStructure', ($event.target as HTMLInputElement).checked)"
        type="checkbox"
        :disabled="loading || mutationBusy"
      />
      <span>STRUCTURE</span>
    </label>

    <button
      class="primary-button catalog-load-action"
      data-testid="catalog-load"
      type="button"
      :disabled="loading || mutationBusy || !selectedDataset || !selectedDataset.available"
      @click="emit('load')"
    >
      {{ loading ? "LOADING…" : mutationBusy ? "BUSY…" : "LOAD ORIGIN" }}
    </button>

    <details
      ref="sourceDetails"
      class="catalog-source-details"
      @pointerdown.stop
      @mousedown.stop
      @click.stop
      @dblclick.stop
      @wheel.stop
      @contextmenu.stop
    >
      <summary data-testid="catalog-origin-details-toggle" aria-label="Catalog and Origin status" title="Catalog and Origin status">i</summary>
      <div class="catalog-source-popover">
        <p v-if="discoveryError" class="error-message" role="alert">{{ discoveryError }}</p>
        <p v-else-if="datasets.length === 0 && !refreshing" class="catalog-source-empty">
          No Bar streams were discovered in the configured Catalog.
        </p>
        <p v-if="selectedDataset && !selectedDataset.available" class="catalog-source-empty">
          {{ selectedDataset.diagnostic ?? "Dataset metadata is unavailable." }}
        </p>
        <OriginPanel
          :origin="origin"
          :load-status="loadStatus"
          :load-error="loadError"
          :format-domain-timestamp="formatDomainTimestamp"
        />
      </div>
    </details>
  </section>
</template>

<style scoped>
.catalog-controls {
  display: flex;
  min-width: 0;
  flex: 0 1 auto;
  align-items: center;
  gap: 7px;
}

.catalog-source-field {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 7px;
  color: #89949d;
  font: 8px ui-monospace, SFMono-Regular, Consolas, monospace;
  letter-spacing: .06em;
  white-space: nowrap;
}

.catalog-source-field select {
  width: 190px;
  max-width: 24vw;
  min-width: 100px;
  height: 27px;
  padding: 0 7px;
  overflow: hidden;
  border: 1px solid #30383f;
  border-radius: 3px;
  background: #111619;
  color: #e3e8eb;
  font: 9px ui-monospace, SFMono-Regular, Consolas, monospace;
  text-overflow: ellipsis;
}

.catalog-icon-action {
  display: inline-grid;
  width: 27px;
  min-width: 27px;
  height: 27px;
  padding: 0;
  place-items: center;
  border: 0;
  border-radius: 3px;
  background: transparent;
  color: #727b83;
  cursor: pointer;
  font-size: 15px;
  line-height: 1;
  transition: background-color 120ms ease, color 120ms ease;
}

.catalog-icon-action:hover:not(:disabled) {
  background: #242321;
  color: #9b805c;
}

.catalog-icon-action:active:not(:disabled) {
  background: #33291f;
  transform: translateY(1px);
}

.catalog-icon-action:disabled {
  cursor: not-allowed;
}

.catalog-icon-action:disabled:hover {
  background: transparent;
  color: #727b83;
}

.catalog-structure-toggle {
  display: inline-flex;
  min-height: 25px;
  align-items: center;
  gap: 6px;
  padding: 0 7px;
  border: 1px solid transparent;
  border-radius: 3px;
  color: #89949d;
  font: 8px ui-monospace, SFMono-Regular, Consolas, monospace;
  letter-spacing: .045em;
  white-space: nowrap;
  cursor: pointer;
  transition: background-color 120ms ease, border-color 120ms ease, color 120ms ease;
}

.catalog-structure-toggle:hover {
  border-color: #343d44;
  background: #1a2024;
  color: #b8c1c7;
}

.catalog-structure-toggle:focus-within {
  outline: 1px solid #8b6b3f;
  outline-offset: 1px;
}

.catalog-structure-toggle input {
  position: relative;
  display: inline-grid;
  width: 12px;
  height: 12px;
  flex: 0 0 12px;
  place-items: center;
  margin: 0;
  appearance: none;
  border: 1px solid #4a535a;
  border-radius: 2px;
  background: #14191d;
  cursor: pointer;
  transition: background-color 120ms ease, border-color 120ms ease;
}

.catalog-structure-toggle input::after {
  width: 5px;
  height: 3px;
  content: "";
  transform: translateY(-1px) rotate(-45deg);
  border-bottom: 1.5px solid transparent;
  border-left: 1.5px solid transparent;
}

.catalog-structure-toggle input:checked {
  border-color: #9a7848;
  background: #8d6a3b;
}

.catalog-structure-toggle input:checked::after {
  border-color: #f0e5d4;
}

.catalog-structure-toggle input:disabled {
  opacity: .45;
  cursor: not-allowed;
}

.catalog-structure-toggle:has(input:checked) {
  color: #b5a184;
}

.catalog-load-action {
  min-height: 27px;
  padding: 0 8px;
  font-size: 8px;
  white-space: nowrap;
}

.catalog-source-details {
  position: relative;
  z-index: 31;
  flex: 0 0 auto;
}

.catalog-source-details > summary {
  display: grid;
  width: 22px;
  height: 22px;
  place-items: center;
  border: 1px solid #30383f;
  border-radius: 50%;
  color: #89949d;
  cursor: pointer;
  font: 9px ui-monospace, SFMono-Regular, Consolas, monospace;
  list-style: none;
}

.catalog-source-details > summary::-webkit-details-marker {
  display: none;
}

.catalog-source-popover {
  position: absolute;
  pointer-events: auto;
  z-index: 20;
  top: calc(100% + 7px);
  right: 0;
  width: min(360px, calc(100vw - 32px));
  max-height: min(460px, 70vh);
  padding: 10px;
  overflow: auto;
  border: 1px solid #30383f;
  background: #191e23;
  box-shadow: 0 10px 28px rgb(0 0 0 / 38%);
}

.catalog-source-empty {
  margin: 0 0 8px;
  color: #89949d;
  font-size: 9px;
  line-height: 1.5;
}

.catalog-source-popover :deep(.panel-heading) {
  margin-bottom: 6px;
}

.catalog-source-popover :deep(.panel-heading h2) {
  font-size: 10px;
}

@media (max-width: 1100px) {
  .catalog-source-field select {
    width: 145px;
  }

  .catalog-structure-toggle span {
    display: none;
  }
}
</style>