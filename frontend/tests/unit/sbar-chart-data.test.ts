import { describe, expect, it } from "vitest";
import { mapSBarsToChart, SBarChartDataError } from "../../src/sbar-chart-data";
import type { SBarDto } from "../../src/origin-types";

function bar(overrides: Partial<SBarDto> = {}): SBarDto {
  return {
    sbarId: "1700000000000000000",
    barType: "TEST-1-MINUTE-LAST-EXTERNAL",
    tsEvent: "1700000000000000000",
    tsInit: "1700000000000000001",
    open: "10.25",
    high: "12",
    low: "9.5",
    close: "11.75",
    volume: "123",
    ...overrides,
  };
}

describe("mapSBarsToChart", () => {
  it("converts nanoseconds to chart seconds while preserving exact SBar IDs", () => {
    const first = bar();
    const second = bar({
      sbarId: "1700000001000000000",
      tsEvent: "1700000001000000000",
      tsInit: "1700000001000000001",
      open: "11.75",
      high: "13",
      low: "11",
      close: "12.5",
      volume: "88",
    });

    const result = mapSBarsToChart([first, second]);
    expect(result.candles.map((candle) => candle.time)).toEqual([1700000000, 1700000001]);
    expect(result.candles[0]).toMatchObject({ open: 10.25, high: 12, low: 9.5, close: 11.75 });
    expect(result.candles[0]).toMatchObject({ color: "#557E65", borderColor: "#557E65", wickColor: "#557E65" });
    expect(result.candles[1]).toMatchObject({ color: "#557E65", borderColor: "#557E65", wickColor: "#557E65" });
    expect(result.volume.map((point) => point.color)).toEqual(["#557E65", "#557E65"]);
    expect(result.volume.map((point) => point.value)).toEqual([123, 88]);
    expect(result.sbarIdByTime.get(1700000000)).toBe("1700000000000000000");
    expect(result.sbarIdByTime.get(1700000001)).toBe("1700000001000000000");
  });

  it("uses the established directional palette for candles and volume", () => {
    const bearish = bar({ close: "9.75" });
    const result = mapSBarsToChart([bearish]);

    expect(result.candles[0]).toMatchObject({
      color: "#8D555B",
      borderColor: "#8D555B",
      wickColor: "#8D555B",
    });
    expect(result.volume[0]?.color).toBe("#8D555B");
  });

  it("uses neutral styling for unchanged SBar closes", () => {
    const unchanged = bar({ close: "10.25" });
    const result = mapSBarsToChart([unchanged]);
    expect(result.candles[0]).toMatchObject({ color: "#858D97", borderColor: "#858D97", wickColor: "#858D97" });
    expect(result.volume[0]?.color).toBe("#858D97");
  });

  it("rejects multiple event timestamps that collapse to the same chart second", () => {
    const first = bar();
    const second = bar({
      sbarId: "1700000000500000000",
      tsEvent: "1700000000500000000",
      tsInit: "1700000000500000001",
    });
    expect(() => mapSBarsToChart([first, second])).toThrow(/refusing to merge timestamps/);
  });

  it("rejects non-finite OHLCV values", () => {
    expect(() => mapSBarsToChart([bar({ close: "NaN" })])).toThrow(/non-finite close/);
    expect(() => mapSBarsToChart([bar({ volume: "Infinity" })])).toThrow(/non-finite volume/);
  });

  it("rejects inconsistent OHLC values and negative volume", () => {
    expect(() => mapSBarsToChart([bar({ high: "10" })])).toThrow(/inconsistent OHLC/);
    expect(() => mapSBarsToChart([bar({ volume: "-1" })])).toThrow(/negative volume/);
  });

  it("rejects mismatched domain identity and non-increasing order", () => {
    expect(() => mapSBarsToChart([bar({ sbarId: "1700000000000000001" })]))
      .toThrow(SBarChartDataError);
    expect(() => mapSBarsToChart([bar(), bar()])).toThrow(/strictly increasing/);
  });

  it("rejects non-canonical and unsafe chart timestamps", () => {
    expect(() => mapSBarsToChart([bar({ tsEvent: "01700000000000000000", sbarId: "01700000000000000000" })]))
      .toThrow(/canonical non-negative integer/);
    const unsafe = "9007199254740992000000000";
    expect(() => mapSBarsToChart([bar({ tsEvent: unsafe, sbarId: unsafe })]))
      .toThrow(/safe Unix-second range/);
  });
});
