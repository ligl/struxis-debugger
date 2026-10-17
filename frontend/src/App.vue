<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import {
  describeIpcError,
  getCurrentOrigin,
  listCatalogDatasets,
  loadOrigin,
} from "./origin-bridge";
import type { CatalogDatasetEntry, OriginDatasetDto } from "./origin-types";

type LoadStatus = "idle" | "loading" | "loaded" | "failed";

const datasets = ref<CatalogDatasetEntry[]>([]);
const selectedId = ref("");
const enableStructure = ref(true);
const loading = ref(false);
const loadStatus = ref<LoadStatus>("idle");
const loadError = ref("");
const discoveryError = ref("");
const origin = ref<OriginDatasetDto | null>(null);
const refreshing = ref(false);

interface InstrumentGroup {
  key: string;
  label: string;
  unresolved: boolean;
  datasets: CatalogDatasetEntry[];
  readyCount: number;
}

const selectedDataset = computed(
  () => datasets.value.find((dataset) => dataset.id === selectedId.value) ?? null,
);
const collapsedInstrumentIds = ref<Set<string>>(new Set());
const instrumentGroups = computed<InstrumentGroup[]>(() => {
  const groups = new Map<string, InstrumentGroup>();

  for (const dataset of datasets.value) {
    const unresolved = !dataset.instrumentId;
    const key = unresolved ? "__unresolved_instrument__" : dataset.instrumentId!;
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        label: unresolved ? "Unresolved / Unavailable" : dataset.instrumentId!,
        unresolved,
        datasets: [],
        readyCount: 0,
      };
      groups.set(key, group);
    }
    group.datasets.push(dataset);
    if (dataset.available) group.readyCount += 1;
  }

  return [...groups.values()];
});
const previewBars = computed(() => origin.value?.bars.slice(0, 12) ?? []);

function toggleInstrumentGroup(key: string): void {
  const next = new Set(collapsedInstrumentIds.value);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  collapsedInstrumentIds.value = next;
}

async function refreshDatasets(): Promise<void> {
  refreshing.value = true;
  discoveryError.value = "";
  try {
    datasets.value = await listCatalogDatasets();
    if (!datasets.value.some((dataset) => dataset.id === selectedId.value)) {
      selectedId.value = datasets.value.find((dataset) => dataset.available)?.id ?? "";
    }
  } catch (error) {
    discoveryError.value = describeIpcError(error);
  } finally {
    refreshing.value = false;
  }
}

async function refreshCurrentOrigin(): Promise<void> {
  try {
    origin.value = await getCurrentOrigin();
  } catch (error) {
    // A failed refresh must not erase an already displayed valid Origin.
    loadError.value = describeIpcError(error);
  }
}

async function startLoad(): Promise<void> {
  const selected = selectedDataset.value;
  if (loading.value || !selected || !selected.available) return;

  // Set synchronously before awaiting IPC so rapid clicks cannot overlap.
  loading.value = true;
  loadStatus.value = "loading";
  loadError.value = "";
  try {
    origin.value = await loadOrigin(selected.id, enableStructure.value);
    loadStatus.value = "loaded";
  } catch (error) {
    // Keep the previous Origin in place; only this attempt changes to Failed.
    loadStatus.value = "failed";
    loadError.value = describeIpcError(error);
  } finally {
    loading.value = false;
  }
}

function formatTimestamp(value: string): string {
  return value || "—";
}

onMounted(async () => {
  await Promise.all([refreshDatasets(), refreshCurrentOrigin()]);
});
</script>

<template>
  <main class="debugger-shell">
    <header class="topbar">
      <div>
        <p class="eyebrow">CAPITUS / STRUXIS DEBUGGER</p>
        <h1>Origin Load</h1>
        <p class="subtitle">Catalog → Nautilus → Strategy → Struxis</p>
      </div>
      <div class="runtime-mark">
        <span class="runtime-dot" :class="{ active: origin }"></span>
        <span>{{ origin ? "ORIGIN AVAILABLE" : "NO ORIGIN LOADED" }}</span>
      </div>
    </header>

    <section class="workspace">
      <aside class="panel catalog-panel">
        <div class="panel-heading">
          <div>
            <p class="section-index">01 / SOURCE</p>
            <h2>Catalog streams</h2>
          </div>
          <button class="subtle-button" :disabled="refreshing || loading" @click="refreshDatasets">
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
              @click="toggleInstrumentGroup(group.key)"
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
                :disabled="loading"
                :aria-pressed="selectedId === dataset.id"
                @click="selectedId = dataset.id"
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
            <input v-model="enableStructure" type="checkbox" :disabled="loading" />
            <span>
              <strong>Calculate derived structure</strong>
              <small>Maps to StruxisConfig.enable_structure</small>
            </span>
          </label>
          <button
            class="primary-button"
            :disabled="loading || !selectedDataset || !selectedDataset.available"
            @click="startLoad"
          >
            <span>{{ loading ? "PROCESSING FULL STREAM…" : "LOAD COMPLETE STREAM" }}</span>
            <span aria-hidden="true">↗</span>
          </button>
          <p class="microcopy">Load reads the complete selected BarType stream. No range is applied.</p>
        </div>
      </aside>

      <section class="panel result-panel">
        <div class="panel-heading">
          <div>
            <p class="section-index">02 / RESULT</p>
            <h2>Current Origin</h2>
          </div>
          <span class="status-label" :class="loadStatus">
            {{ loadStatus === "loading" ? "LOADING" : loadStatus === "loaded" ? "LATEST LOAD OK" : loadStatus === "failed" ? "LATEST LOAD FAILED" : "SESSION STATE" }}
          </span>
        </div>

        <div v-if="loadError" class="error-message load-error">
          <strong>Latest attempt diagnostic</strong>
          <span>{{ loadError }}</span>
          <small v-if="origin">The previous Origin remains available and unchanged.</small>
        </div>

        <template v-if="origin">
          <div class="origin-identity">
            <span class="field-label">ORIGIN DATASET ID</span>
            <code>{{ origin.originDatasetId }}</code>
            <span class="field-label">SEQUENCE FINGERPRINT · SHA-256</span>
            <code class="fingerprint">{{ origin.sbarSequenceFingerprint }}</code>
          </div>

          <div class="metric-grid">
            <div class="metric">
              <span>SBAR COUNT</span>
              <strong>{{ origin.sbarCount.toLocaleString() }}</strong>
            </div>
            <div class="metric">
              <span>INSTRUMENT</span>
              <strong>{{ origin.instrumentId }}</strong>
            </div>
            <div class="metric">
              <span>BAR TYPE</span>
              <strong>{{ origin.barType }}</strong>
            </div>
            <div class="metric">
              <span>STRUCTURE</span>
              <strong>{{ origin.enableStructure ? "ENABLED" : "DISABLED" }}</strong>
            </div>
          </div>

          <div class="range-summary">
            <div>
              <span class="field-label">FIRST SBAR · EVENT TIME</span>
              <strong>{{ origin.firstSbarId }}</strong>
              <small>{{ formatTimestamp(origin.firstTsEvent) }}</small>
            </div>
            <div>
              <span class="field-label">LAST SBAR · EVENT TIME</span>
              <strong>{{ origin.lastSbarId }}</strong>
              <small>{{ formatTimestamp(origin.lastTsEvent) }}</small>
            </div>
          </div>

          <div class="table-heading">
            <div>
              <p class="section-index">VALIDATED PROJECTION</p>
              <h3>Oldest-first SBar sample</h3>
            </div>
            <span>{{ previewBars.length }} / {{ origin.sbarCount.toLocaleString() }} shown</span>
          </div>
          <div class="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>SBar ID / ts_event</th>
                  <th>Open</th>
                  <th>High</th>
                  <th>Low</th>
                  <th>Close</th>
                  <th>Volume</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="bar in previewBars" :key="bar.sbarId">
                  <td class="timestamp-cell">{{ bar.sbarId }}</td>
                  <td>{{ bar.open }}</td>
                  <td>{{ bar.high }}</td>
                  <td>{{ bar.low }}</td>
                  <td>{{ bar.close }}</td>
                  <td>{{ bar.volume }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p class="source-note">Source: {{ origin.sourceCatalog }} · Values are copied from the validated Struxis SBar series.</p>
        </template>

        <div v-else class="no-origin">
          <span class="no-origin-glyph">∅</span>
          <h3>No validated Origin Dataset</h3>
          <p>Choose an available Catalog stream and load it. An Origin is published only after processing, complete SBar validation, and runtime cleanup succeed.</p>
        </div>
      </section>
    </section>

    <footer class="footer-bar">
      <span>STRUXIS DEBUGGER / PHASE 01</span>
      <span>LOAD CONTRACT · COMPLETE INPUT · ATOMIC REPLACEMENT</span>
    </footer>
  </main>
</template>
