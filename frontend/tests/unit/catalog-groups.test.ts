import { ref } from "vue";
import { describe, expect, it } from "vitest";
import { useCatalogGroups } from "../../src/composables/useCatalogGroups";
import type { CatalogDatasetEntry } from "../../src/origin-types";

const btcFiveMinute: CatalogDatasetEntry = {
  id: "BTC-5M",
  barType: "BTC-5M",
  instrumentId: "BTCUSDT-PERP.BINANCE",
  timeframe: "5m",
  available: true,
  diagnostic: null,
};

const btcDaily: CatalogDatasetEntry = {
  ...btcFiveMinute,
  id: "BTC-1D",
  barType: "BTC-1D",
  timeframe: "1d",
  available: false,
  diagnostic: "metadata unavailable",
};

const unresolved: CatalogDatasetEntry = {
  id: "UNKNOWN",
  barType: null,
  instrumentId: null,
  timeframe: null,
  available: false,
  diagnostic: "Instrument metadata is missing",
};

describe("useCatalogGroups", () => {
  it("groups by instrument and counts only available datasets", () => {
    const datasets = ref<CatalogDatasetEntry[]>([btcFiveMinute, btcDaily, unresolved]);
    const { instrumentGroups } = useCatalogGroups(datasets);

    expect(instrumentGroups.value).toHaveLength(2);
    expect(instrumentGroups.value[0]).toMatchObject({
      key: "BTCUSDT-PERP.BINANCE",
      label: "BTCUSDT-PERP.BINANCE",
      unresolved: false,
      readyCount: 1,
    });
    expect(instrumentGroups.value[0].datasets.map((entry) => entry.id)).toEqual([
      "BTC-5M",
      "BTC-1D",
    ]);
    expect(instrumentGroups.value[1]).toMatchObject({
      key: "__unresolved_instrument__",
      label: "Unresolved / Unavailable",
      unresolved: true,
      readyCount: 0,
    });
  });

  it("reacts to dataset updates and toggles collapsed groups immutably", () => {
    const datasets = ref<CatalogDatasetEntry[]>([btcFiveMinute]);
    const { instrumentGroups, collapsedInstrumentIds, toggleInstrumentGroup } =
      useCatalogGroups(datasets);

    toggleInstrumentGroup("BTCUSDT-PERP.BINANCE");
    expect(collapsedInstrumentIds.value.has("BTCUSDT-PERP.BINANCE")).toBe(true);

    toggleInstrumentGroup("BTCUSDT-PERP.BINANCE");
    expect(collapsedInstrumentIds.value.has("BTCUSDT-PERP.BINANCE")).toBe(false);

    datasets.value = [btcFiveMinute, unresolved];
    expect(instrumentGroups.value).toHaveLength(2);
  });
});
