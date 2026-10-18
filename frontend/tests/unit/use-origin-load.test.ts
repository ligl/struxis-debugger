import { beforeEach, describe, expect, it, vi } from "vitest";
import { useOriginLoad } from "../../src/composables/useOriginLoad";
import type { CatalogDatasetEntry } from "../../src/origin-types";

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

const dataset = (id: string): CatalogDatasetEntry => ({
  id, barType: `${id}-BAR`, instrumentId: id, timeframe: "5m",
  available: true, diagnostic: null,
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
});
