import { computed, ref, type Ref } from "vue";
import type { CatalogDatasetEntry } from "../origin-types";

export interface InstrumentGroup {
  key: string;
  label: string;
  unresolved: boolean;
  datasets: CatalogDatasetEntry[];
  readyCount: number;
}

/** Owns the Catalog's instrument grouping and collapsed-group presentation state. */
export function useCatalogGroups(datasets: Ref<CatalogDatasetEntry[]>) {
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

  function toggleInstrumentGroup(key: string): void {
    const next = new Set(collapsedInstrumentIds.value);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    collapsedInstrumentIds.value = next;
  }

  return {
    collapsedInstrumentIds,
    instrumentGroups,
    toggleInstrumentGroup,
  };
}
