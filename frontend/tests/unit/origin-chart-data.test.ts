import { describe, expect, it } from "vitest";
import { mapOriginBarsToChart, OriginChartDataError } from "../../src/origin-chart-data";
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

describe("mapOriginBarsToChart", () => {
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

    const result = mapOriginBarsToChart([first, second]);
    expect(result.candles.map((candle) => candle.time)).toEqual([1700000000, 1700000001]);
    expect(result.candles[0]).toMatchObject({ open: 10.25, high: 12, low: 9.5, close: 11.75 });
    expect(result.volume.map((point) => point.value)).toEqual([123, 88]);
    expect(result.sbarIdByTime.get(1700000000)).toBe("1700000000000000000");
    expect(result.sbarIdByTime.get(1700000001)).toBe("1700000001000000000");
  });

  it("rejects multiple event timestamps that collapse to the same chart second", () => {
    const first = bar();
    const second = bar({
      sbarId: "1700000000500000000",
      tsEvent: "1700000000500000000",
      tsInit: "1700000000500000001",
    });
    expect(() => mapOriginBarsToChart([first, second])).toThrow(/refusing to merge timestamps/);
  });

  it("rejects non-finite OHLCV values", () => {
    expect(() => mapOriginBarsToChart([bar({ close: "NaN" })])).toThrow(/non-finite close/);
    expect(() => mapOriginBarsToChart([bar({ volume: "Infinity" })])).toThrow(/non-finite volume/);
  });

  it("rejects inconsistent OHLC values and negative volume", () => {
    expect(() => mapOriginBarsToChart([bar({ high: "10" })])).toThrow(/inconsistent OHLC/);
    expect(() => mapOriginBarsToChart([bar({ volume: "-1" })])).toThrow(/negative volume/);
  });

  it("rejects mismatched domain identity and non-increasing order", () => {
    expect(() => mapOriginBarsToChart([bar({ sbarId: "1700000000000000001" })]))
      .toThrow(OriginChartDataError);
    expect(() => mapOriginBarsToChart([bar(), bar()])).toThrow(/strictly increasing/);
  });

  it("rejects non-canonical and unsafe chart timestamps", () => {
    expect(() => mapOriginBarsToChart([bar({ tsEvent: "01700000000000000000", sbarId: "01700000000000000000" })]))
      .toThrow(/canonical non-negative integer/);
    const unsafe = "9007199254740991000000000";
    expect(() => mapOriginBarsToChart([bar({ tsEvent: unsafe, sbarId: unsafe })]))
      .toThrow(/safe Unix-second range/);
  });
});
