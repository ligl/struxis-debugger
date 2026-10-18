import { beforeEach, describe, expect, it, vi } from "vitest";
import { useOriginLoad } from "../../src/composables/useOriginLoad";
import type { CatalogDatasetEntry, OriginDatasetDto } from "../../src/origin-types";

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

const dataset = (id: string): CatalogDatasetEntry => ({
  id, barType: `${id}-BAR`, instrumentId: id, timeframe: "5m",
  available: true, diagnostic: null,
});


const origin = (id: string): OriginDatasetDto => ({
  originDatasetId: id, sourceCatalog: "/catalog", enableStructure: true,
  instrumentId: id, barType: `${id}-BAR`, timeframe: "300s",
  sbarSequenceFingerprint: `fingerprint-${id}`, sbarCount: 1,
  firstSbarId: "100", lastSbarId: "100", firstTsEvent: "100", lastTsEvent: "100", bars: [],
});

describe("useOriginLoad Catalog refresh", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("performs a follow-up read for a refresh requested during an active read", async () => {
    let resolveFirst!: (value: CatalogDatasetEntry[]) => void;
    const firstRead = new Promise<CatalogDatasetEntry[]>((resolve) => { resolveFirst = resolve; });
    invokeMock.mockReturnValueOnce(firstRead).mockResolvedValueOnce([dataset("new-dataset")]);

    const { datasets, refreshing, refreshDatasets } = useOriginLoad();
    const activeRefresh = refreshDatasets();
    const overlappingRefresh = refreshDatasets();

    expect(overlappingRefresh).toBe(activeRefresh);
    expect(invokeMock).toHaveBeenCalledTimes(1);
    expect(invokeMock).toHaveBeenCalledWith("list_catalog_datasets");
    expect(refreshing.value).toBe(true);

    resolveFirst([dataset("old-dataset")]);
    await Promise.all([activeRefresh, overlappingRefresh]);

    expect(invokeMock).toHaveBeenCalledTimes(2);
    expect(datasets.value.map((item) => item.id)).toEqual(["new-dataset"]);
    expect(refreshing.value).toBe(false);
  });

  it("preserves the last successful Catalog list when discovery fails", async () => {
    invokeMock.mockResolvedValueOnce([dataset("kept-dataset")]).mockRejectedValueOnce(new Error("catalog discovery failed"));
    const { datasets, discoveryError, refreshing, refreshDatasets } = useOriginLoad();

    await refreshDatasets();
    await refreshDatasets();

    expect(datasets.value.map((item) => item.id)).toEqual(["kept-dataset"]);
    expect(discoveryError.value).toContain("catalog discovery failed");
    expect(refreshing.value).toBe(false);
  });

  it("does not let a stale current-Origin read overwrite a successful Load", async () => {
    let resolveCurrent!: (value: OriginDatasetDto | null) => void;
    const oldRead = new Promise<OriginDatasetDto | null>((resolve) => { resolveCurrent = resolve; });
    invokeMock
      .mockResolvedValueOnce([dataset("dataset-1")])
      .mockReturnValueOnce(oldRead)
      .mockResolvedValueOnce(origin("origin-new"));

    const state = useOriginLoad();
    await state.refreshDatasets();
    const staleRefresh = state.refreshCurrentOrigin();
    await state.startLoad();
    resolveCurrent(origin("origin-old"));
    await staleRefresh;

    expect(state.origin.value?.originDatasetId).toBe("origin-new");
  });

});