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
      .mockReturnValueOnce({ setData: chartMocks.candleSetData, applyOptions: chartMocks.candleApplyOptions, priceToCoordinate: chartMocks.priceToCoordinate, coordinateToPrice: chartMocks.coordinateToPrice, attachPrimitive: vi.fn(), detachPrimitive: vi.fn() })
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

  it("dims the full Snapshot plot while revealing processed candles one by one", async () => {
    const bars = [
      bar(),
      bar({ sbarId: "1700000060000000000", tsEvent: "1700000060000000000", tsInit: "1700000060000000001", open: "10", close: "11" }),
      bar({ sbarId: "1700000120000000000", tsEvent: "1700000120000000000", tsInit: "1700000120000000001", open: "11", close: "10" }),
    ];
    const wrapper = mount(SnapshotReferenceChart, {
      props: {
        ...snapshotDefaults,
        bars,
        snapshotId: "snapshot-playback-brightness",
        structure: {
          cbarCount: 1,
          cbars: [{
            cbarId: "cbar-checkpoint-1",
            high: "12",
            low: "9",
            sbarStartId: "1700000000000000000",
            sbarEndId: "1700000060000000000",
            spanSbars: 2,
            fractalType: null,
            createdAt: "1",
          }],
          swingCount: 1,
          swings: [{
            swingId: "swing-checkpoint-1",
            direction: "Up",
            high: "12",
            low: "9",
            cbarStartId: "cbar-checkpoint-1",
            cbarEndId: "cbar-checkpoint-1",
            sbarStartId: "1700000000000000000",
            sbarEndId: "1700000060000000000",
            startOi: null,
            endOi: null,
            volume: "200",
            spanSbars: 2,
            state: "Confirmed",
            createdAt: "1",
            updatedAt: "1",
          }],
        },
        syncEnabled: true,
        liveBarCount: 2,
        playbackEnabled: true,
        playbackOffset: 0,
        processedCount: 1,
      },
    });
    await nextTick();

    const initialSetDataCalls = chartMocks.candleSetData.mock.calls.length;
    expect(wrapper.get('[data-testid="snapshot-playback-dimming"]').attributes("fill-opacity")).toBe("0.68");
    expect(wrapper.findAll('[data-testid="snapshot-bright-candle-cutout"]').map((node) => node.attributes("data-sbar-id")))
      .toEqual(["1700000000000000000"]);
    expect(wrapper.findAll('[data-testid="snapshot-bright-cbar-cutout"]').map((node) => node.attributes("data-cbar-id")))
      .toEqual(["cbar-checkpoint-1"]);
    expect(wrapper.findAll('[data-testid="snapshot-bright-swing-cutout"]').map((node) => node.attributes("data-swing-id")))
      .toEqual(["swing-checkpoint-1"]);
    expect(chartMocks.candleSetData).toHaveBeenCalledTimes(initialSetDataCalls);

    await wrapper.setProps({ processedCount: 2 } as never);
    expect(wrapper.findAll('[data-testid="snapshot-bright-candle-cutout"]').map((node) => node.attributes("data-sbar-id")))
      .toEqual(["1700000000000000000", "1700000060000000000"]);
    expect(wrapper.find('[data-testid="snapshot-playback-dimming"]').exists()).toBe(true);
    expect(chartMocks.candleSetData).toHaveBeenCalledTimes(initialSetDataCalls);

    // Playback completion disables the overlay and restores the whole Snapshot,
    // including historical bars outside the Live/Snapshot overlap.
    await wrapper.setProps({ playbackEnabled: false } as never);
    expect(wrapper.find('[data-testid="snapshot-playback-dimming"]').exists()).toBe(false);
    expect(wrapper.findAll('[data-testid="snapshot-bright-candle-cutout"]')).toHaveLength(0);
    expect(chartMocks.candleSetData).toHaveBeenCalledTimes(initialSetDataCalls);
    wrapper.unmount();
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

  it("anchors Snapshot sync guides to the first and last Live SBars regardless of viewport", async () => {
    const bars = [
      bar(),
      bar({
        sbarId: "1700000060000000000",
        tsEvent: "1700000060000000000",
        tsInit: "1700000060000000001",
      }),
      bar({
        sbarId: "1700000120000000000",
        tsEvent: "1700000120000000000",
        tsInit: "1700000120000000001",
      }),
    ];
    const wrapper = mount(SnapshotReferenceChart, {
      props: {
        ...snapshotDefaults,
        bars,
        snapshotId: "snapshot-reference-live-range-guides",
        structure: null,
        syncEnabled: true,
        liveBarCount: 2,
        playbackOffset: 1,
        playbackEnabled: true,
        processedCount: 1,
        syncRequest: {
          revision: 1,
          source: "live",
          from: -0.5,
          to: 1.5,
          offset: 1,
        },
      },
    });
    await nextTick();

    const start = wrapper.get('[data-testid="snapshot-live-range-start"]');
    const end = wrapper.get('[data-testid="snapshot-live-range-end"]');
    expect(start.attributes("x1")).toBe("200");
    expect(end.attributes("x1")).toBe("300");
    expect(start.attributes("opacity")).toBe("0.42");
    expect(start.attributes("stroke-width")).toBe("0.9");
    expect(start.attributes("stroke-dasharray")).toBe("3 5");

    const startArrow = wrapper.get('[data-testid="snapshot-live-range-start-arrow"]');
    const endArrow = wrapper.get('[data-testid="snapshot-live-range-end-arrow"]');
    expect(startArrow.attributes("d")).toContain("H 208");
    expect(endArrow.attributes("d")).toContain("H 292");
    expect(startArrow.attributes("stroke")).toBe(start.attributes("stroke"));
    expect(endArrow.attributes("stroke")).toBe(end.attributes("stroke"));
    expect(startArrow.attributes("pointer-events")).toBe("none");

    // A viewport request outside the Live interval must not hide or redefine
    // the domain anchors. Only their projected pixel coordinates may change.
    await wrapper.setProps({
      syncRequest: {
        revision: 2,
        source: "live",
        from: 8.25,
        to: 9.75,
        offset: 1,
      },
    } as never);
    await nextTick();
    expect(wrapper.get('[data-testid="snapshot-live-range-start"]').attributes("x1")).toBe("200");
    expect(wrapper.get('[data-testid="snapshot-live-range-end"]').attributes("x1")).toBe("300");
    expect(wrapper.get('[data-testid="snapshot-live-range-start-arrow"]').attributes("d")).toContain("H 208");
    expect(wrapper.get('[data-testid="snapshot-live-range-end-arrow"]').attributes("d")).toContain("H 292");

    await wrapper.setProps({ syncEnabled: false } as never);
    await nextTick();
    expect(wrapper.find('[data-testid="snapshot-live-range-start"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="snapshot-live-range-end"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="snapshot-live-range-start-arrow"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="snapshot-live-range-end-arrow"]').exists()).toBe(false);
    // Run-progress brightness is a peer projection and must be invalidated with the Offset.
    expect(wrapper.find('[data-testid="snapshot-playback-dimming"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it("keeps Snapshot sync guides anchored to the same SBars at sub-candle zoom", async () => {
    const bars = [
      bar(),
      bar({
        sbarId: "1700000060000000000",
        tsEvent: "1700000060000000000",
        tsInit: "1700000060000000001",
      }),
      bar({
        sbarId: "1700000120000000000",
        tsEvent: "1700000120000000000",
        tsInit: "1700000120000000001",
      }),
    ];
    const wrapper = mount(SnapshotReferenceChart, {
      props: {
        ...snapshotDefaults,
        bars,
        snapshotId: "snapshot-reference-live-range-subcandle-zoom",
        structure: null,
        syncEnabled: true,
        liveBarCount: 2,
        playbackOffset: 1,
        syncRequest: {
          revision: 1,
          source: "live",
          from: 0.2,
          to: 0.4,
          offset: 1,
        },
      },
    });
    await nextTick();

    expect(wrapper.get('[data-testid="snapshot-live-range-start"]').attributes("x1")).toBe("200");
    expect(wrapper.get('[data-testid="snapshot-live-range-end"]').attributes("x1")).toBe("300");
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
