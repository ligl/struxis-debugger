import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UTCTimestamp } from "lightweight-charts";

const mocks = vi.hoisted(() => ({
  createChart: vi.fn(),
  addSeries: vi.fn(),
  priceScale: vi.fn(),
  applyPriceScaleOptions: vi.fn(),
  registerCBarPrimitive: vi.fn(),
  registerSwingPrimitive: vi.fn(),
}));

vi.mock("../../src/sbar-chart-structure-primitives", () => ({
  registerCBarPrimitive: mocks.registerCBarPrimitive,
  registerSwingPrimitive: mocks.registerSwingPrimitive,
}));

vi.mock("lightweight-charts", () => ({
  CandlestickSeries: { kind: "candlestick" },
  ColorType: { Solid: "solid" },
  CrosshairMode: { Normal: 0 },
  HistogramSeries: { kind: "histogram" },
  createChart: mocks.createChart,
}));

import { applySbarChartSeriesVisibility, createSbarChartRuntime, disposeSbarChartRuntime, replaceSbarChartSeriesData, updateSbarChartSeriesData } from "../../src/sbar-chart-runtime";

describe("createSbarChartRuntime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.addSeries
      .mockReturnValueOnce({ kind: "candles", attachPrimitive: vi.fn(), detachPrimitive: vi.fn() })
      .mockReturnValueOnce({ kind: "volume" });
    mocks.priceScale.mockReturnValue({ applyOptions: mocks.applyPriceScaleOptions });
    mocks.registerCBarPrimitive.mockReturnValue({ kind: "cbar-primitive" });
    mocks.registerSwingPrimitive.mockReturnValue({ kind: "swing-primitive" });
    mocks.createChart.mockReturnValue({
      addSeries: mocks.addSeries,
      priceScale: mocks.priceScale,
      remove: vi.fn(),
    });
  });

describe("applySbarChartSeriesVisibility", () => {
  it("applies visibility at the series level without rewriting point data", () => {
    const candleApplyOptions = vi.fn();
    const volumeApplyOptions = vi.fn();
    const candleSeries = { applyOptions: candleApplyOptions } as never;
    const volumeSeries = { applyOptions: volumeApplyOptions } as never;

    applySbarChartSeriesVisibility(candleSeries, volumeSeries, { sbar: false, volume: true });

    expect(candleApplyOptions).toHaveBeenCalledWith({ visible: false });
    expect(volumeApplyOptions).toHaveBeenCalledWith({ visible: true });
  });

  it("tolerates series not yet created or already released", () => {
    expect(() => applySbarChartSeriesVisibility(null, undefined, { sbar: true, volume: false })).not.toThrow();
  });
});

describe("paired SBar / Volume data application", () => {
  it("replaces both series with the supplied authoritative projection", () => {
    const candleSetData = vi.fn();
    const volumeSetData = vi.fn();
    const candles = [{ time: 10, open: 1, high: 2, low: 0, close: 1 }];
    const volume = [{ time: 10 as UTCTimestamp, value: 5 }];

    expect(replaceSbarChartSeriesData(
      { setData: candleSetData } as never,
      { setData: volumeSetData } as never,
      candles as never,
      volume,
    )).toBe(true);

    expect(candleSetData).toHaveBeenCalledWith(candles);
    expect(volumeSetData).toHaveBeenCalledWith(volume);
  });

  it("updates both series with the same historical-update policy", () => {
    const candleUpdate = vi.fn();
    const volumeUpdate = vi.fn();
    const candle = { time: 10, open: 1, high: 2, low: 0, close: 1 };
    const volume = { time: 10 as UTCTimestamp, value: 5 };

    expect(updateSbarChartSeriesData(
      { update: candleUpdate } as never,
      { update: volumeUpdate } as never,
      candle as never,
      volume,
      true,
    )).toBe(true);

    expect(candleUpdate).toHaveBeenCalledWith(candle, true);
    expect(volumeUpdate).toHaveBeenCalledWith(volume, true);
  });

  it("does not partially update when one series is unavailable", () => {
    const candleUpdate = vi.fn();
    expect(updateSbarChartSeriesData(
      { update: candleUpdate } as never,
      null,
      { time: 10, open: 1, high: 2, low: 0, close: 1 } as never,
      { time: 10, value: 5 } as never,
      true,
    )).toBe(false);
    expect(candleUpdate).not.toHaveBeenCalled();
  });
});
});
