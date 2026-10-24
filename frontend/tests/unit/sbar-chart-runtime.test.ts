import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createChart: vi.fn(),
  addSeries: vi.fn(),
  priceScale: vi.fn(),
  applyPriceScaleOptions: vi.fn(),
}));

vi.mock("lightweight-charts", () => ({
  CandlestickSeries: { kind: "candlestick" },
  ColorType: { Solid: "solid" },
  CrosshairMode: { Normal: 0 },
  HistogramSeries: { kind: "histogram" },
  createChart: mocks.createChart,
}));

import { createSbarChartRuntime } from "../../src/sbar-chart-runtime";

describe("createSbarChartRuntime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.addSeries
      .mockReturnValueOnce({ kind: "candles" })
      .mockReturnValueOnce({ kind: "volume" });
    mocks.priceScale.mockReturnValue({ applyOptions: mocks.applyPriceScaleOptions });
    mocks.createChart.mockReturnValue({
      addSeries: mocks.addSeries,
      priceScale: mocks.priceScale,
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
  });
});
