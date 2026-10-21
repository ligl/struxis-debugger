<script setup lang="ts">
import type { CatalogDatasetEntry, OriginDatasetDto } from "../origin-types";
import OriginPanel from "./OriginPanel.vue";
interface InstrumentGroup { key: string; label: string; unresolved: boolean; datasets: CatalogDatasetEntry[]; readyCount: number; }
defineProps<{ datasets: CatalogDatasetEntry[]; selectedId: string; selectedDataset: CatalogDatasetEntry | null; instrumentGroups: InstrumentGroup[]; collapsedInstrumentIds: Set<string>; refreshing: boolean; loading: boolean; mutationBusy: boolean; discoveryError: string; enableStructure: boolean; origin: OriginDatasetDto | null; loadStatus: "idle" | "loading" | "loaded" | "failed"; loadError: string; formatTimestamp: (value: string | null) => string; }>();
const emit = defineEmits<{ refresh: []; selectDataset: [id: string]; toggleGroup: [key: string]; "update:enableStructure": [value: boolean]; load: []; }>();
</script>

<template>
<aside class="panel catalog-panel">
        <div class="panel-heading">
          <div>
            <p class="section-index">01 / SOURCE</p>
            <h2>Catalog streams</h2>
          </div>
          <button data-testid="catalog-refresh" class="subtle-button" :disabled="refreshing || loading || mutationBusy" @click="emit('refresh')">
            {{ refreshing ? "Scanning…" : "Refresh" }}
          </button>
        </div>

        <p v-if="discoveryError" class="error-message">{{ discoveryError }}</p>
        <p v-else-if="datasets.length === 0 && !refreshing" class="empty-state">
          No Bar streams were discovered in the configured Catalog.
        </p>

        <div class="instrument-list">
          <section
            v-for="group in instrumentGroups"
            :key="group.key"
            class="instrument-group"
            :class="{ unresolved: group.unresolved }"
          >
            <button
              class="instrument-group-row"
              data-testid="catalog-instrument-group"
              :data-instrument-key="group.key"
              :aria-expanded="!collapsedInstrumentIds.has(group.key)"
              @click="emit('toggleGroup', group.key)"
            >
              <span class="group-chevron" aria-hidden="true">
                {{ collapsedInstrumentIds.has(group.key) ? "▸" : "▾" }}
              </span>
              <span class="instrument-group-name">{{ group.label }}</span>
              <span class="group-count">{{ group.datasets.length }} DATASET{{ group.datasets.length === 1 ? "" : "S" }}</span>
              <span class="group-ready">{{ group.readyCount }}/{{ group.datasets.length }} READY</span>
            </button>
            <div v-if="!collapsedInstrumentIds.has(group.key)" class="dataset-list">
              <button
                v-for="dataset in group.datasets"
                :key="dataset.id"
                class="dataset-row"
                data-testid="catalog-dataset-row"
                :data-dataset-id="dataset.id"
                :class="{ selected: selectedId === dataset.id, unavailable: !dataset.available }"
                :disabled="loading || mutationBusy"
                :aria-pressed="selectedId === dataset.id"
                @click="emit('selectDataset', dataset.id)"
              >
                <span class="dataset-status" :class="{ ready: dataset.available }"></span>
                <span class="dataset-details">
                  <strong>{{ dataset.barType ?? dataset.id }}</strong>
                  <small><template v-if="dataset.timeframe">{{ dataset.timeframe }} · </template>{{ dataset.id }}</small>
                  <small v-if="!dataset.available" class="diagnostic">{{ dataset.diagnostic ?? "Dataset metadata is unavailable." }}</small>
                </span>
                <span class="dataset-state">{{ dataset.available ? "READY" : "UNAVAILABLE" }}</span>
              </button>
            </div>
          </section>
        </div>

        <div class="load-options">
          <label class="toggle-row">
            <input data-testid="catalog-enable-structure" :checked="enableStructure" @change="emit('update:enableStructure', ($event.target as HTMLInputElement).checked)" type="checkbox" :disabled="loading || mutationBusy" />
            <span>
              <strong>Calculate derived structure</strong>
              <small>Maps to StruxisConfig.enable_structure</small>
            </span>
          </label>
          <button
            class="primary-button"
            data-testid="catalog-load"
            :disabled="loading || mutationBusy || !selectedDataset || !selectedDataset.available"
            @click="emit('load')"
          >
            <span>{{ loading ? "PROCESSING FULL STREAM…" : mutationBusy ? "RUN / TEST BUSY…" : "LOAD COMPLETE STREAM" }}</span>
            <span aria-hidden="true">↗</span>
          </button>
          <p class="microcopy">Load reads the complete selected BarType stream. No range is applied.</p>
        </div>
        <details class="catalog-origin-details" :open="Boolean(loadError)">
          <summary data-testid="catalog-origin-details-toggle">ORIGIN STATUS</summary>
          <OriginPanel
            :origin="origin"
            :load-status="loadStatus"
            :load-error="loadError"
            :format-timestamp="formatTimestamp"
          />
        </details>
      </aside>
</template>

<style scoped>
.catalog-panel {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  gap: 0;
  margin-top: 0;
  overflow: hidden;
  color: #e3e8eb;
}

.catalog-panel > .panel-heading {
  flex: 0 0 auto;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 8px 9px;
  border-bottom: 1px solid #252c32;
}

.catalog-panel .panel-heading h2 {
  margin: 0;
  color: #e3e8eb;
  font-size: 10px;
  font-weight: 650;
  letter-spacing: .045em;
  text-transform: uppercase;
}

.catalog-panel .subtle-button {
  min-height: 25px;
  padding: 3px 7px;
  font-size: 9px;
}

.catalog-panel .error-message,
.catalog-panel .empty-state {
  margin: 7px 8px;
  padding: 8px;
  font-size: 10px;
}

.catalog-panel .instrument-list {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
}

.catalog-panel .instrument-group-row {
  min-height: 29px;
  gap: 5px;
  padding: 5px 8px;
  border-bottom-color: #252c32;
}

.catalog-panel .instrument-group-name {
  min-width: 0;
  font-size: 10px;
}

.catalog-panel .group-count,
.catalog-panel .group-ready {
  font-size: 8px;
  white-space: nowrap;
}

.catalog-panel .dataset-row {
  min-height: 42px;
  gap: 7px;
  padding: 6px 8px;
}

.catalog-panel .dataset-details {
  gap: 2px;
}

.catalog-panel .dataset-details strong {
  font-size: 10px;
  font-weight: 550;
}

.catalog-panel .dataset-details small,
.catalog-panel .dataset-state {
  font-size: 8px;
}

.catalog-panel .load-options {
  flex: 0 0 auto;
  margin: 0;
  padding: 8px;
  border-top: 1px solid #30383f;
  background: #14191d;
}

.catalog-panel .toggle-row {
  gap: 7px;
  font-size: 9px;
}

.catalog-panel .toggle-row strong {
  font-size: 9px;
  font-weight: 550;
}

.catalog-panel .toggle-row small,
.catalog-panel .microcopy {
  font-size: 8px;
  line-height: 1.45;
}

.catalog-panel .load-options > .primary-button {
  width: 100%;
  min-height: 29px;
  justify-content: space-between;
  margin-top: 7px;
  padding: 5px 8px;
  font-size: 9px;
}

.catalog-panel .catalog-origin-details {
  flex: 0 0 auto;
  margin: 0;
  padding: 7px 8px;
  border-top: 1px solid #252c32;
}

.catalog-panel .catalog-origin-details > summary {
  font-size: 8px;
}
</style>
