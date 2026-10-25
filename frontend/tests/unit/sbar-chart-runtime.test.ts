import { beforeEach, describe, expect, it, vi } from "vitest";

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

import { applySbarChartSeriesVisibility, createSbarChartRuntime, disposeSbarChartRuntime } from "../../src/sbar-chart-runtime";

describe("createSbarChartRuntime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.addSeries
      .mockReturnValueOnce({ kind: "candles" })
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

  it("creates the shared chart and both series while preserving the caller's last-value policy", () => {
    const host = document.createElement("div");
    const runtime = createSbarChartRuntime(host, {
      width: 640,
      height: 320,
      candleLastValueVisible: false,
    });

    expect(mocks.createChart).toHaveBeenCalledWith(host, expect.objectContaining({
      width: 640,
      height: 320,
      layout: expect.objectContaining({
        background: { type: "solid", color: "#121619" },
        textColor: "#a8b2b9",
      }),
      timeScale: expect.objectContaining({ rightOffset: 4, timeVisible: true }),
    }));
    expect(mocks.addSeries).toHaveBeenNthCalledWith(1, { kind: "candlestick" }, expect.objectContaining({
      lastValueVisible: false,
      priceLineVisible: false,
    }));
    expect(mocks.addSeries).toHaveBeenNthCalledWith(2, { kind: "histogram" }, expect.objectContaining({
      priceScaleId: "",
      lastValueVisible: false,
    }));
    expect(mocks.applyPriceScaleOptions).toHaveBeenCalledWith({
      scaleMargins: { top: 0.82, bottom: 0 },
    });
    expect(runtime.candleSeries).toEqual({ kind: "candles" });
    expect(runtime.volumeSeries).toEqual({ kind: "volume" });
    expect(runtime.cbarPrimitive).toEqual({ kind: "cbar-primitive" });
    expect(runtime.swingPrimitive).toEqual({ kind: "swing-primitive" });
    expect(mocks.registerCBarPrimitive).toHaveBeenCalledWith(runtime.primitiveHost, runtime.candleSeries);
    expect(mocks.registerSwingPrimitive).toHaveBeenCalledWith(runtime.primitiveHost, runtime.candleSeries);
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

describe("disposeSbarChartRuntime", () => {
  it("disposes the Primitive host before removing the chart", () => {
    const hostElement = document.createElement("div");
    const runtime = createSbarChartRuntime(hostElement, {
      width: 320,
      height: 240,
      candleLastValueVisible: true,
    });
    const disposeHost = vi.spyOn(runtime.primitiveHost, "dispose");
    const removeChart = vi.mocked(runtime.chart.remove);

    disposeSbarChartRuntime(runtime.chart, runtime.primitiveHost);

    expect(disposeHost).toHaveBeenCalledOnce();
    expect(removeChart).toHaveBeenCalledOnce();
    expect(disposeHost.mock.invocationCallOrder[0]).toBeLessThan(
      removeChart.mock.invocationCallOrder[0],
    );
  });
});
