import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SnapshotReferenceChart from "../../src/components/SnapshotReferenceChart.vue";
import { SnapshotRangeMarkerPrimitive } from "../../src/snapshot-reference-primitives";
import type { SBarDto } from "../../src/origin-types";

const chartMocks = vi.hoisted(() => ({
  createChart: vi.fn(),
  candleSetData: vi.fn(),
  volumeSetData: vi.fn(),
  candleUpdate: vi.fn(),
  volumeUpdate: vi.fn(),
  candleApplyOptions: vi.fn(),
  volumeApplyOptions: vi.fn(),
  attachPrimitive: vi.fn(),
  detachPrimitive: vi.fn(),
  attachVolumePrimitive: vi.fn(),
  detachVolumePrimitive: vi.fn(),
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
  crosshairMoveListener: null as ((param: { point?: { x: number; y: number } }) => void) | null,
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
      .mockReturnValueOnce({ setData: chartMocks.candleSetData, update: chartMocks.candleUpdate, applyOptions: chartMocks.candleApplyOptions, priceToCoordinate: chartMocks.priceToCoordinate, coordinateToPrice: chartMocks.coordinateToPrice, attachPrimitive: chartMocks.attachPrimitive, detachPrimitive: chartMocks.detachPrimitive })
      .mockReturnValueOnce({ setData: chartMocks.volumeSetData, update: chartMocks.volumeUpdate, applyOptions: chartMocks.volumeApplyOptions, attachPrimitive: chartMocks.attachVolumePrimitive, detachPrimitive: chartMocks.detachVolumePrimitive }),
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
  it("keeps range markers as background Primitives and uses native series for playback styling", async () => {
    const wrapper = mount(SnapshotReferenceChart, {
      props: {
        ...snapshotDefaults,
        snapshotId: "snapshot-native-playback",
        syncEnabled: true,
        playbackOffset: 0,
        liveBarCount: 1,
        playbackEnabled: true,
        processedCount: 0,
      },
    });
    await nextTick();

    const candleMarker = chartMocks.attachPrimitive.mock.calls
      .map((call) => call[0])
      .find((primitive) => primitive instanceof SnapshotRangeMarkerPrimitive);
    const volumeMarker = chartMocks.attachVolumePrimitive.mock.calls
      .map((call) => call[0])
      .find((primitive) => primitive instanceof SnapshotRangeMarkerPrimitive);
    expect(candleMarker).toBeDefined();
    expect(volumeMarker).toBeDefined();
    expect(chartMocks.candleSetData).toHaveBeenCalled();
    expect(chartMocks.volumeSetData).toHaveBeenCalled();
    const candleSetDataCalls = chartMocks.candleSetData.mock.calls;
    const candleData = candleSetDataCalls[candleSetDataCalls.length - 1]?.[0] as Array<{ color: string }>;
    expect(candleData[0]?.color).not.toBe("#79B58B");
    expect(wrapper.find('[data-testid="snapshot-playback-dimming"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="snapshot-live-range-start"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="snapshot-live-range-end"]').exists()).toBe(false);

    wrapper.unmount();
    expect(chartMocks.detachPrimitive).toHaveBeenCalledWith(candleMarker);
    expect(chartMocks.detachVolumePrimitive).toHaveBeenCalledWith(volumeMarker);
  });

  it("restores only the newly processed native candle and volume point on a one-SBar advance", async () => {
    const bars = [
      bar(),
      bar({
        sbarId: "1700000060000000000",
        tsEvent: "1700000060000000000",
        tsInit: "1700000060000000001",
        open: "10",
        close: "9",
      }),
    ];
    const wrapper = mount(SnapshotReferenceChart, {
      props: {
        ...snapshotDefaults,
        bars,
        snapshotId: "snapshot-incremental-native-style",
        syncEnabled: true,
        playbackOffset: 0,
        liveBarCount: 2,
        playbackEnabled: true,
        processedCount: 0,
      },
    });
    await nextTick();
    chartMocks.candleUpdate.mockClear();
    chartMocks.volumeUpdate.mockClear();
    chartMocks.candleSetData.mockClear();
    chartMocks.volumeSetData.mockClear();

    await wrapper.setProps({ processedCount: 1 });
    await nextTick();

    expect(chartMocks.candleUpdate).toHaveBeenCalledTimes(1);
    expect(chartMocks.volumeUpdate).toHaveBeenCalledTimes(1);
    expect(chartMocks.candleUpdate).toHaveBeenCalledWith(expect.objectContaining({ time: 1700000000, color: "#79B58B" }), true);
    expect(chartMocks.volumeUpdate).toHaveBeenCalledWith(expect.objectContaining({ time: 1700000000 }), true);
    expect(chartMocks.candleSetData).not.toHaveBeenCalled();
    expect(chartMocks.volumeSetData).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("exposes generic Primitive injection and owns attachment cleanup", async () => {
    const wrapper = mount(SnapshotReferenceChart, {
      props: { ...snapshotDefaults, snapshotId: "snapshot-primitive-injection" },
    });
    await nextTick();

    const primitive = {} as import("lightweight-charts").ISeriesPrimitive<import("lightweight-charts").Time>;
    const dispose = vi.fn();
    const surface = wrapper.findComponent({ name: "ChartSurface" });
    const register = (surface.vm as unknown as {
      registerPrimitive: (id: string, primitive: import("lightweight-charts").ISeriesPrimitive<import("lightweight-charts").Time>, dispose?: () => void) => () => void;
    }).registerPrimitive;

    const unregister = register("test-consumer-primitive", primitive, dispose);
    expect(chartMocks.attachPrimitive).toHaveBeenCalledWith(primitive);

    unregister();
    expect(chartMocks.detachPrimitive).toHaveBeenCalledWith(primitive);
    expect(dispose).toHaveBeenCalledTimes(1);

    wrapper.unmount();
  });

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

  it("applies an existing Live viewport request when Snapshot Reference mounts late", () => {
    const bars = [
      bar(),
      bar({
        sbarId: "1700000060000000000",
        tsEvent: "1700000060000000000",
        tsInit: "1700000060000000001",
      }),
    ];
    const wrapper = mount(SnapshotReferenceChart, {
      props: {
        ...snapshotDefaults,
        bars,
        snapshotId: "snapshot-reference-sync-late-mount",
        structure: null,
        syncEnabled: true,
        syncRequest: {
          revision: 1,
          source: "live",
          from: 0.25,
          to: 1.75,
          offset: 100,
        },
      },
    });

    expect(chartMocks.setVisibleLogicalRange).toHaveBeenLastCalledWith({
      from: 100.25,
      to: 101.75,
    });
    wrapper.unmount();
  });

  it("emits the Snapshot SBar selection from a chart click", async () => {
    const wrapper = mount(SnapshotReferenceChart, {
      props: {
        ...snapshotDefaults,
        bars: [bar()],
        snapshotId: "snapshot-object-selection",
        structure: null,
      },
    });
    await nextTick();

    const clickHandler = chartMocks.subscribeClick.mock.calls[0]?.[0] as
      ((param: { point?: { x: number; y: number } }) => void) | undefined;
    clickHandler?.({ point: { x: 100, y: 50 } });

    expect(wrapper.emitted("objectSelect")?.[0]?.[0]).toEqual({
      kind: "sbar",
      id: "1700000000000000000",
      checkpointSbarId: "1700000000000000000",
    });
    wrapper.unmount();
  });

  it("hides the internal time-axis bottom border in Snapshot Reference", () => {
    mount(SnapshotReferenceChart, {
      props: {
        ...snapshotDefaults,
        bars: [bar()],
        snapshotId: "snapshot-reference-01",
        structure: null,
      },
    });

    const chartOptions = chartMocks.createChart.mock.calls[0]?.[1] as {
      timeScale?: { borderColor?: string };
      rightPriceScale?: { borderColor?: string };
    };
    expect(chartOptions.timeScale?.borderColor).toBe("#121619");
    expect(chartOptions.rightPriceScale?.borderColor).toBe("#121619");
  });

  it("keeps the Snapshot Reference crosshair locally visible when synchronization is ineligible", () => {
    mount(SnapshotReferenceChart, {
      props: {
        ...snapshotDefaults,
        bars: [bar()],
        snapshotId: "snapshot-reference-local-crosshair",
        structure: null,
      },
    });

    const chartOptions = chartMocks.createChart.mock.calls[0]?.[1] as {
      crosshair?: {
        mode?: number;
        vertLine?: { visible?: boolean };
        horzLine?: { visible?: boolean };
      };
    };
    expect(chartOptions.crosshair?.mode).toBe(0);
    expect(chartOptions.crosshair?.vertLine?.visible).toBe(true);
    expect(chartOptions.crosshair?.horzLine?.visible).toBe(true);
  });

  it("projects a Live crosshair onto the matching Snapshot SBar", async () => {
    mount(SnapshotReferenceChart, {
      props: {
        ...snapshotDefaults,
        bars: [bar()],
        snapshotId: "snapshot-reference-crosshair-target",
        structure: null,
        syncEnabled: true,
        crosshairSync: {
          revision: 1,
          source: "live",
          sbarId: bar().sbarId,
          price: 10.5,
        },
      },
    });
    await nextTick();

    expect(chartMocks.setCrosshairPosition).toHaveBeenCalledWith(
      10.5,
      1700000000,
      expect.anything(),
    );
  });

  it("clears the stale peer Crosshair without changing local Crosshair options when sync becomes ineligible", async () => {
    chartMocks.subscribeCrosshairMove.mockImplementation((listener) => {
      chartMocks.crosshairMoveListener = listener as (param: { point?: { x: number; y: number } }) => void;
    });
    const wrapper = mount(SnapshotReferenceChart, {
      props: {
        ...snapshotDefaults,
        bars: [bar()],
        snapshotId: "snapshot-reference-crosshair-sync",
        structure: null,
        syncEnabled: true,
        crosshairSync: {
          revision: 1,
          source: "live",
          sbarId: bar().sbarId,
          price: 10.5,
        },
      },
    });
    await nextTick();

    expect(chartMocks.setCrosshairPosition).toHaveBeenCalledWith(10.5, 1700000000, expect.anything());

    const initialOptions = chartMocks.createChart.mock.calls[0]?.[1] as {
      crosshair?: { mode?: number; vertLine?: { visible?: boolean }; horzLine?: { visible?: boolean } };
    };
    expect(initialOptions.crosshair?.mode).toBe(0);
    expect(initialOptions.crosshair?.vertLine?.visible).toBe(true);
    expect(initialOptions.crosshair?.horzLine?.visible).toBe(true);
    const chartOptionsCallCount = chartMocks.applyChartOptions.mock.calls.length;

    chartMocks.clearCrosshairPosition.mockImplementationOnce(() => {
      chartMocks.crosshairMoveListener?.({});
    });
    await wrapper.setProps({ syncEnabled: false } as never);
    await nextTick();
    expect(chartMocks.clearCrosshairPosition).toHaveBeenCalledTimes(1);
    expect(wrapper.emitted("crosshairChange")).toBeUndefined();
    expect(initialOptions.crosshair?.mode).toBe(0);
    expect(initialOptions.crosshair?.vertLine?.visible).toBe(true);
    expect(initialOptions.crosshair?.horzLine?.visible).toBe(true);
    expect(chartMocks.applyChartOptions).toHaveBeenCalledTimes(chartOptionsCallCount);
  });

  it("keeps the layer legend visible in Snapshot Reference after the shared Surface migration", () => {
    const wrapper = mount(SnapshotReferenceChart, {
      props: {
        ...snapshotDefaults,
        bars: [bar()],
        snapshotId: "snapshot-reference-layer-legend",
        structure: null,
      },
    });

    expect(wrapper.get('[aria-label="Chart layer visibility"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="layer-toggle-sbar"]').text()).toContain("SBar");
    expect(wrapper.get('[data-testid="layer-toggle-volume"]').text()).toContain("Volume");
    wrapper.unmount();
  });

  it("hides the chart heading toolbar in Snapshot Reference to maximize plot height", () => {
    const wrapper = mount(SnapshotReferenceChart, {
      props: {
        ...snapshotDefaults,
        bars: [bar()],
        snapshotId: "snapshot-reference-01",
        structure: null,
      },
    });

    expect(wrapper.find(".origin-chart-heading").exists()).toBe(false);
    expect(wrapper.find(".origin-chart-foot").exists()).toBe(false);
    expect(wrapper.find(".snapshot-reference-chart").exists()).toBe(true);
    expect(wrapper.find('[data-testid="origin-chart-viewport"]').exists()).toBe(true);
  });

});
