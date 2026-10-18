<script setup lang="ts">
import type { CatalogDatasetEntry } from "../origin-types";
interface InstrumentGroup { key: string; label: string; unresolved: boolean; datasets: CatalogDatasetEntry[]; readyCount: number; }
defineProps<{ datasets: CatalogDatasetEntry[]; selectedId: string; selectedDataset: CatalogDatasetEntry | null; instrumentGroups: InstrumentGroup[]; collapsedInstrumentIds: Set<string>; refreshing: boolean; loading: boolean; mutationBusy: boolean; discoveryError: string; enableStructure: boolean; }>();
const emit = defineEmits<{ refresh: []; selectDataset: [id: string]; toggleGroup: [key: string]; "update:enableStructure": [value: boolean]; load: []; }>();
</script>

<template>
<aside class="panel catalog-panel">
        <div class="panel-heading">
          <div>
            <p class="section-index">01 / SOURCE</p>
            <h2>Catalog streams</h2>
          </div>
          <button class="subtle-button" :disabled="refreshing || loading || mutationBusy" @click="emit('refresh')">
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
            <input :checked="enableStructure" @change="emit('update:enableStructure', ($event.target as HTMLInputElement).checked)" type="checkbox" :disabled="loading || mutationBusy" />
            <span>
              <strong>Calculate derived structure</strong>
              <small>Maps to StruxisConfig.enable_structure</small>
            </span>
          </label>
          <button
            class="primary-button"
            :disabled="loading || mutationBusy || !selectedDataset || !selectedDataset.available"
            @click="emit('load')"
          >
            <span>{{ loading ? "PROCESSING FULL STREAM…" : mutationBusy ? "RUN / TEST BUSY…" : "LOAD COMPLETE STREAM" }}</span>
            <span aria-hidden="true">↗</span>
          </button>
          <p class="microcopy">Load reads the complete selected BarType stream. No range is applied.</p>
        </div>
      </aside>
</template>
