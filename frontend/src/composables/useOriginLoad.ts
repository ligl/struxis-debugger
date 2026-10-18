import { computed, ref } from "vue";
import {
  describeIpcError,
  getCurrentOrigin,
  listCatalogDatasets,
  loadOrigin,
} from "../origin-bridge";
import type { CatalogDatasetEntry, OriginDatasetDto } from "../origin-types";

export type LoadStatus = "idle" | "loading" | "loaded" | "failed";

/**
 * Owns Catalog discovery and the published Origin load state.
 * Cross-domain handoff to Test Dataset remains in App.vue.
 */
export function useOriginLoad() {
  const datasets = ref<CatalogDatasetEntry[]>([]);
  const selectedId = ref("");
  const enableStructure = ref(true);
  const loading = ref(false);
  const loadStatus = ref<LoadStatus>("idle");
  const loadError = ref("");
  const discoveryError = ref("");
  const origin = ref<OriginDatasetDto | null>(null);
  const refreshing = ref(false);

  const selectedDataset = computed(
    () => datasets.value.find((dataset) => dataset.id === selectedId.value) ?? null,
  );

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

  async function startLoad(): Promise<OriginDatasetDto | null> {
    const selected = selectedDataset.value;
    if (loading.value || !selected || !selected.available) return null;

    // Set synchronously before awaiting IPC so rapid clicks cannot overlap.
    loading.value = true;
    loadStatus.value = "loading";
    loadError.value = "";
    try {
      const loadedOrigin = await loadOrigin(selected.id, enableStructure.value);
      origin.value = loadedOrigin;
      loadStatus.value = "loaded";
      return loadedOrigin;
    } catch (error) {
      // Keep the previous Origin in place; only this attempt changes to Failed.
      loadStatus.value = "failed";
      loadError.value = describeIpcError(error);
      return null;
    } finally {
      loading.value = false;
    }
  }

  return {
    datasets,
    selectedId,
    enableStructure,
    loading,
    loadStatus,
    loadError,
    discoveryError,
    origin,
    refreshing,
    selectedDataset,
    refreshDatasets,
    refreshCurrentOrigin,
    startLoad,
  };
}
