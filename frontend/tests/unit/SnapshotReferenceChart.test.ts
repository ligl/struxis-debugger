import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SnapshotReferenceChart from "../../src/components/SnapshotReferenceChart.vue";
import type { SBarDto } from "../../src/origin-types";

const chartMocks = vi.hoisted(() => ({
  createChart: vi.fn(),
  candleSetData: vi.fn(),
  volumeSetData: vi.fn(),
  candleApplyOptions: vi.fn(),
  volumeApplyOptions: vi.fn(),
  priceToCoordinate: vi.fn(),
  coordinateToPrice: vi.fn(),
  setCrosshairPosition: vi.fn(),
  clearCrosshairPosition: vi.fn(),
  chartRemove: vi.fn(),
  fitContent: vi.fn(),
  setVisibleLogicalRange: vi.fn(),
  getVisibleLogicalRange: vi.fn(),
  timeToCoordinate: vi.fn(),
  logicalToCoordinate: vi.fn(),
  coordinateToLogical: vi.fn(),
  subscribeCrosshairMove: vi.fn(),
  unsubscribeCrosshairMove: vi.fn(),
  subscribeVisibleLogicalRangeChange: vi.fn(),
  unsubscribeVisibleLogicalRangeChange: vi.fn(),
  applyChartOptions: vi.fn(),
  applyPriceScaleOptions: vi.fn(),
  subscribeClick: vi.fn(),
  unsubscribeClick: vi.fn(),
  observe: vi.fn(),
  disconnect: vi.fn(),
}));

vi.mock("lightweight-charts", () => ({
  CandlestickSeries: { kind: "candlestick" },
  ColorType: { Solid: "solid" },
  CrosshairMode: { Normal: 0, Magnet: 1, Hidden: 2 },
  HistogramSeries: { kind: "histogram" },
  LineStyle: { Solid: 0, Dotted: 1, Dashed: 2, LargeDashed: 3, SparseDotted: 4 },
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

const snapshotDefaults = {
  bars: [bar()],
  structure: null,
  snapshotId: "snapshot-default",
  syncEnabled: false,
  syncRequest: null,
  crosshairSync: null,
  liveBarCount: 1,
  playbackEnabled: false,
  playbackOffset: null,
  processedCount: 0,
};

function installChartMock() {
  const chart = {
    addSeries: vi.fn()
      .mockReturnValueOnce({ setData: chartMocks.candleSetData, applyOptions: chartMocks.candleApplyOptions, priceToCoordinate: chartMocks.priceToCoordinate, coordinateToPrice: chartMocks.coordinateToPrice })
      .mockReturnValueOnce({ setData: chartMocks.volumeSetData, applyOptions: chartMocks.volumeApplyOptions }),
    priceScale: vi.fn(() => ({ applyOptions: chartMocks.applyPriceScaleOptions })),
    timeScale: vi.fn(() => ({
      width: () => 700,
      fitContent: chartMocks.fitContent,
      setVisibleLogicalRange: chartMocks.setVisibleLogicalRange,
      getVisibleLogicalRange: chartMocks.getVisibleLogicalRange,
      timeToCoordinate: chartMocks.timeToCoordinate,
      logicalToCoordinate: chartMocks.logicalToCoordinate,
      coordinateToLogical: chartMocks.coordinateToLogical,
      subscribeVisibleLogicalRangeChange: chartMocks.subscribeVisibleLogicalRangeChange,
      unsubscribeVisibleLogicalRangeChange: chartMocks.unsubscribeVisibleLogicalRangeChange,
    })),
    subscribeClick: chartMocks.subscribeClick,
    unsubscribeClick: chartMocks.unsubscribeClick,
    subscribeCrosshairMove: chartMocks.subscribeCrosshairMove,
    unsubscribeCrosshairMove: chartMocks.unsubscribeCrosshairMove,
    setCrosshairPosition: chartMocks.setCrosshairPosition,
    clearCrosshairPosition: chartMocks.clearCrosshairPosition,
    applyOptions: chartMocks.applyChartOptions,
    remove: chartMocks.chartRemove,
  };
  chartMocks.createChart.mockReturnValue(chart);
  return chart;
}

describe("SnapshotReferenceChart", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chartMocks.getVisibleLogicalRange.mockReturnValue({ from: 0, to: 1 });
    chartMocks.timeToCoordinate.mockImplementation((time: number) => {
      if (time === 1700000000) return 100;
      if (time === 1700000060) return 200;
      if (time === 1700000120) return 300;
      return null;
    });
    chartMocks.logicalToCoordinate.mockImplementation((logical: number) => 100 + logical * 100);
    chartMocks.coordinateToLogical.mockImplementation((x: number) => x < 150 ? 0 : 1);
    chartMocks.priceToCoordinate.mockImplementation((price: number) => price === 13 || price === 12 ? 30 : price === 9 ? 70 : null);
    installResizeObserverMock();
    installChartMock();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

[object Object][object Object][object Object][object Object][object Object][object Object][object Object][object Object][object Object]});
