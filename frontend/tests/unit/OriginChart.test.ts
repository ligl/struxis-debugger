import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import OriginChart from "../../src/components/OriginChart.vue";
import type { SBarDto } from "../../src/origin-types";

const chartMocks = vi.hoisted(() => ({
  createChart: vi.fn(),
  candleSetData: vi.fn(),
  volumeSetData: vi.fn(),
  chartRemove: vi.fn(),
  fitContent: vi.fn(),
  applyChartOptions: vi.fn(),
  applyPriceScaleOptions: vi.fn(),
  observe: vi.fn(),
  disconnect: vi.fn(),
}));

vi.mock("lightweight-charts", () => ({
  CandlestickSeries: { kind: "candlestick" },
  ColorType: { Solid: "solid" },
  HistogramSeries: { kind: "histogram" },
  createChart: chartMocks.createChart,
}));

function bar(overrides: Partial<SBarDto> = {}): SBarDto {
  return {
    sbarId: "1700000000000000000",
    barType: "TEST-1-MINUTE-LAST-EXTERNAL",
    tsEvent: "1700000000000000000",
    tsInit: "1700000000000000001",
    open: "10",
    high: "12",
    low: "9",
    close: "11",
    volume: "100",
    ...overrides,
  };
}

function installResizeObserverMock() {
  class ResizeObserverMock {
    observe = chartMocks.observe;
    disconnect = chartMocks.disconnect;

    constructor(_callback: ResizeObserverCallback) {}
  }
  vi.stubGlobal("ResizeObserver", ResizeObserverMock);
}

function installChartMock() {
  const chart = {
    addSeries: vi.fn()
      .mockReturnValueOnce({ setData: chartMocks.candleSetData })
      .mockReturnValueOnce({ setData: chartMocks.volumeSetData }),
    priceScale: vi.fn(() => ({ applyOptions: chartMocks.applyPriceScaleOptions })),
    timeScale: vi.fn(() => ({ fitContent: chartMocks.fitContent })),
    applyOptions: chartMocks.applyChartOptions,
    remove: chartMocks.chartRemove,
  };
  chartMocks.createChart.mockReturnValue(chart);
  return chart;
}

describe("OriginChart", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    installResizeObserverMock();
    installChartMock();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("projects validated SBar data into candlestick and volume series without grid or branding", () => {
    const wrapper = mount(OriginChart, {
      props: {
        bars: [
          bar(),
          bar({
            sbarId: "1700000060000000000",
            tsEvent: "1700000060000000000",
            tsInit: "1700000060000000001",
            open: "11",
            high: "13",
            low: "10",
            close: "12",
          }),
        ],
        originDatasetId: "origin-1",
      },
    });

    expect(chartMocks.createChart).toHaveBeenCalledOnce();
    const chartOptions = chartMocks.createChart.mock.calls[0]?.[1] as {
      grid?: unknown;
      layout?: { attributionLogo?: boolean };
    };
    expect(chartOptions.grid).toBeUndefined();
    expect(chartOptions.layout?.attributionLogo).toBe(false);
    expect(wrapper.find(".chart-attribution").exists()).toBe(false);
    expect(wrapper.text()).not.toContain("TradingView");
    expect(chartMocks.candleSetData).toHaveBeenCalledWith([
      { time: 1700000000, open: 10, high: 12, low: 9, close: 11 },
      { time: 1700000060, open: 11, high: 13, low: 10, close: 12 },
    ]);
    expect(chartMocks.volumeSetData).toHaveBeenCalledWith([
      { time: 1700000000, value: 100, color: "#557e65" },
      { time: 1700000060, value: 100, color: "#557e65" },
    ]);
    expect(chartMocks.fitContent).toHaveBeenCalledOnce();
    expect(wrapper.get('[data-testid="origin-chart-canvas"]').attributes("data-origin-dataset-id"))
      .toBe("origin-1");
    const chartPanel = wrapper.get('[data-testid="origin-chart-panel"]');
    expect(chartPanel.attributes("data-sbar-count")).toBe("2");
    expect(chartPanel.attributes("data-first-sbar-id")).toBe("1700000000000000000");
    expect(chartPanel.attributes("data-second-sbar-id")).toBe("1700000060000000000");
    wrapper.unmount();
  });

  it("rejects invalid chart projection and clears both series", async () => {
    const wrapper = mount(OriginChart, {
      props: {
        bars: [bar({ close: "NaN" })],
        originDatasetId: "origin-invalid",
      },
    });
    // onMounted updates reactive chartError; wait for Vue to render that state.
    await nextTick();

    expect(wrapper.get('[data-testid="origin-chart-error"]').text())
      .toContain("SBar 1700000000000000000 has a non-finite close value.");
    expect(chartMocks.candleSetData).toHaveBeenCalledWith([]);
    expect(chartMocks.volumeSetData).toHaveBeenCalledWith([]);
    wrapper.unmount();
  });

  it("releases the chart and resize observer on unmount", () => {
    const wrapper = mount(OriginChart, {
      props: {
        bars: [],
        originDatasetId: "origin-empty",
      },
    });

    expect(chartMocks.observe).toHaveBeenCalledOnce();
    wrapper.unmount();

    expect(chartMocks.disconnect).toHaveBeenCalledOnce();
    expect(chartMocks.chartRemove).toHaveBeenCalledOnce();
  });
});
