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
  let refreshDatasetsPromise: Promise<void> | null = null;
  let refreshDatasetsRequested = false;

  const selectedDataset = computed(
    () => datasets.value.find((dataset) => dataset.id === selectedId.value) ?? null,
  );

  function refreshDatasets(): Promise<void> {
    if (refreshDatasetsPromise) {
      // A refresh requested during an active read must not be dropped.
      refreshDatasetsRequested = true;
      return refreshDatasetsPromise;
    }

    refreshing.value = true;
    refreshDatasetsPromise = (async () => {
      try {
        do {
          refreshDatasetsRequested = false;
          discoveryError.value = "";
          try {
            datasets.value = await listCatalogDatasets();
            if (!datasets.value.some((dataset) => dataset.id === selectedId.value)) {
              selectedId.value = datasets.value.find((dataset) => dataset.available)?.id ?? "";
            }
          } catch (error) {
            // Keep the last successful Catalog projection on discovery failure.
            discoveryError.value = describeIpcError(error);
          }
        } while (refreshDatasetsRequested);
      } finally {
        refreshing.value = false;
      }
    })().finally(() => {
      refreshDatasetsPromise = null;
    });

    return refreshDatasetsPromise;
  }

  async function refreshCurrentOrigin(): Promise<void> {
    try {
      origin.value = await getCurrentOrigin();
    } catch (error) {
      // A failed refresh must not erase an already displayed valid Origin.
      loadError.value = describeIpcError(error);
    }
  }

  async function startLoad(
    onLoaded?: (loadedOrigin: OriginDatasetDto) => Promise<void>,
  ): Promise<void> {
    const selected = selectedDataset.value;
    if (loading.value || !selected || !selected.available) return;

    // Keep the busy guard active through the page's post-load handoff.
    loading.value = true;
    loadStatus.value = "loading";
    loadError.value = "";
    try {
      let loadedOrigin: OriginDatasetDto;
      try {
        loadedOrigin = await loadOrigin(selected.id, enableStructure.value);
      } catch (error) {
        // Keep the previous Origin in place; only this attempt changes to Failed.
        loadStatus.value = "failed";
        loadError.value = describeIpcError(error);
        return;
      }

      origin.value = loadedOrigin;
      loadStatus.value = "loaded";
      await onLoaded?.(loadedOrigin);
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
