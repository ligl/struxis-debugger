import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import OriginChart from "../../src/components/OriginChart.vue";
import type { SBarDto } from "../../src/origin-types";

const chartMocks = vi.hoisted(() => ({
  createChart: vi.fn(),
  candleSetData: vi.fn(),
  volumeSetData: vi.fn(),
  candleApplyOptions: vi.fn(),
  volumeApplyOptions: vi.fn(),
  priceToCoordinate: vi.fn(),
  chartRemove: vi.fn(),
  fitContent: vi.fn(),
  setVisibleLogicalRange: vi.fn(),
  getVisibleLogicalRange: vi.fn(),
  timeToCoordinate: vi.fn(),
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

function installChartMock() {
  const chart = {
    addSeries: vi.fn()
      .mockReturnValueOnce({ setData: chartMocks.candleSetData, applyOptions: chartMocks.candleApplyOptions, priceToCoordinate: chartMocks.priceToCoordinate })
      .mockReturnValueOnce({ setData: chartMocks.volumeSetData, applyOptions: chartMocks.volumeApplyOptions }),
    priceScale: vi.fn(() => ({ applyOptions: chartMocks.applyPriceScaleOptions })),
    timeScale: vi.fn(() => ({
      width: () => 700,
      fitContent: chartMocks.fitContent,
      setVisibleLogicalRange: chartMocks.setVisibleLogicalRange,
      getVisibleLogicalRange: chartMocks.getVisibleLogicalRange,
      timeToCoordinate: chartMocks.timeToCoordinate,
      coordinateToLogical: chartMocks.coordinateToLogical,
      subscribeVisibleLogicalRangeChange: chartMocks.subscribeVisibleLogicalRangeChange,
      unsubscribeVisibleLogicalRangeChange: chartMocks.unsubscribeVisibleLogicalRangeChange,
    })),
    subscribeClick: chartMocks.subscribeClick,
    unsubscribeClick: chartMocks.unsubscribeClick,
    subscribeCrosshairMove: chartMocks.subscribeCrosshairMove,
    unsubscribeCrosshairMove: chartMocks.unsubscribeCrosshairMove,
    applyOptions: chartMocks.applyChartOptions,
    remove: chartMocks.chartRemove,
  };
  chartMocks.createChart.mockReturnValue(chart);
  return chart;
}

describe("OriginChart", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chartMocks.getVisibleLogicalRange.mockReturnValue({ from: 0, to: 1 });
    chartMocks.timeToCoordinate.mockImplementation((time: number) => {
      if (time === 1700000000) return 100;
      if (time === 1700000060) return 200;
      if (time === 1700000120) return 300;
      return null;
    });
    chartMocks.coordinateToLogical.mockImplementation((x: number) => x < 150 ? 0 : 1);
    chartMocks.priceToCoordinate.mockImplementation((price: number) => price === 13 || price === 12 ? 30 : price === 9 ? 70 : null);
    installResizeObserverMock();
    installChartMock();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });


  it("dims only unprocessed Snapshot candles in the Live overlap without resetting candle data", async () => {
    const bars = [
      bar(),
      bar({ sbarId: "1700000060000000000", tsEvent: "1700000060000000000", tsInit: "1700000060000000001", open: "10", close: "11" }),
      bar({ sbarId: "1700000120000000000", tsEvent: "1700000120000000000", tsInit: "1700000120000000001", open: "11", close: "10" }),
    ];
    const wrapper = mount(OriginChart, {
      props: {
        bars,
        originDatasetId: "snapshot-playback-brightness",
        structure: null,
        displayContext: "snapshot-reference",
        syncEnabled: true,
        syncLiveBarCount: 2,
        snapshotPlaybackEnabled: true,
        snapshotPlaybackOffset: 0,
        snapshotProcessedCount: 1,
      },
    });
    await nextTick();

    const initialSetDataCalls = chartMocks.candleSetData.mock.calls.length;
    const dimmed = wrapper.findAll('[data-testid="snapshot-dimmed-candle"]');
    expect(dimmed.map((node) => node.attributes("data-sbar-id"))).toEqual(["1700000060000000000"]);
    expect(chartMocks.candleSetData).toHaveBeenCalledTimes(initialSetDataCalls);

    await wrapper.setProps({ snapshotProcessedCount: 2 });
    expect(wrapper.findAll('[data-testid="snapshot-dimmed-candle"]')).toHaveLength(0);
    expect(chartMocks.candleSetData).toHaveBeenCalledTimes(initialSetDataCalls);

    await wrapper.setProps({ snapshotProcessedCount: 1 });
    await wrapper.setProps({ snapshotPlaybackEnabled: false });
    expect(wrapper.findAll('[data-testid="snapshot-dimmed-candle"]')).toHaveLength(0);
    expect(chartMocks.candleSetData).toHaveBeenCalledTimes(initialSetDataCalls);
    wrapper.unmount();
  });

  it("cancels range selection and prevents chart right-click menus from propagating", async () => {
    const wrapper = mount(OriginChart, {
      attachTo: document.body,
      props: {
        bars: [bar()],
        originDatasetId: "origin-context-menu",
        structure: null,
        selectionStartSbarId: bar().sbarId,
        selectionEndSbarId: bar().sbarId,
        selectionPending: false,
      },
    });
    const parent = wrapper.element.parentElement;
    const parentContextMenu = vi.fn();
    parent?.addEventListener("contextmenu", parentContextMenu);
    const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });

    wrapper.element.dispatchEvent(event);

    expect(wrapper.emitted("cancelRangeSelection")).toHaveLength(1);
    expect(event.defaultPrevented).toBe(true);
    expect(parentContextMenu).not.toHaveBeenCalled();

    parent?.removeEventListener("contextmenu", parentContextMenu);
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
    const wrapper = mount(OriginChart, {
      props: {
        bars,
        originDatasetId: "snapshot-reference-sync-late-mount",
        structure: null,
        displayContext: "snapshot-reference",
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

  it("marks the first and last visible Live SBar centers on a compatible Snapshot Reference", async () => {
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
    const wrapper = mount(OriginChart, {
      props: {
        bars,
        originDatasetId: "snapshot-reference-live-range-guides",
        structure: null,
        displayContext: "snapshot-reference",
        syncEnabled: true,
        syncLiveBarCount: 2,
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

    await wrapper.setProps({ syncEnabled: false } as never);
    await nextTick();
    expect(wrapper.find('[data-testid="snapshot-live-range-start"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="snapshot-live-range-end"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it("hides the internal time-axis bottom border in Snapshot Reference", () => {
    mount(OriginChart, {
      props: {
        bars: [bar()],
        originDatasetId: "snapshot-reference-01",
        structure: null,
        displayContext: "snapshot-reference",
      },
    });

    const chartOptions = chartMocks.createChart.mock.calls[0]?.[1] as {
      timeScale?: { borderColor?: string };
      rightPriceScale?: { borderColor?: string };
    };
    expect(chartOptions.timeScale?.borderColor).toBe("#121619");
    expect(chartOptions.rightPriceScale?.borderColor).toBe("#121619");
  });

  it("hides the crosshair in Snapshot Reference without changing Origin chart behavior", () => {
    mount(OriginChart, {
      props: {
        bars: [bar()],
        originDatasetId: "snapshot-reference-no-crosshair",
        structure: null,
        displayContext: "snapshot-reference",
      },
    });

    const chartOptions = chartMocks.createChart.mock.calls[0]?.[1] as {
      crosshair?: {
        mode?: number;
        vertLine?: { visible?: boolean };
        horzLine?: { visible?: boolean };
      };
    };
    expect(chartOptions.crosshair?.mode).toBe(2);
    expect(chartOptions.crosshair?.vertLine?.visible).toBe(false);
    expect(chartOptions.crosshair?.horzLine?.visible).toBe(false);
  });

  it("hides the chart heading toolbar in Snapshot Reference to maximize plot height", () => {
    const wrapper = mount(OriginChart, {
      props: {
        bars: [bar()],
        originDatasetId: "snapshot-reference-01",
        structure: null,
        displayContext: "snapshot-reference",
      },
    });

    expect(wrapper.find(".origin-chart-heading").exists()).toBe(false);
    expect(wrapper.find(".origin-chart-foot").exists()).toBe(false);
    expect(wrapper.find(".snapshot-reference-chart").exists()).toBe(true);
    expect(wrapper.find('[data-testid="origin-chart-viewport"]').exists()).toBe(true);
  });

  it("projects validated SBar data into candlestick and volume series without grid or branding", async () => {
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
        structure: null,
      },
    });

    expect(chartMocks.createChart).toHaveBeenCalledOnce();
    const chartOptions = chartMocks.createChart.mock.calls[0]?.[1] as {
      grid?: {
        vertLines?: { visible?: boolean };
        horzLines?: { visible?: boolean };
      };
      layout?: { attributionLogo?: boolean };
      crosshair?: { mode?: number };
      timeScale?: { borderColor?: string };
    };
    expect(chartOptions.grid).toEqual({
      vertLines: { visible: false },
      horzLines: { visible: false },
    });
    expect(chartOptions.layout?.attributionLogo).toBe(false);
    expect(chartOptions.crosshair?.mode).toBe(0);
    expect(chartOptions.timeScale?.borderColor).toBe("#121619");
    expect(wrapper.find(".chart-attribution").exists()).toBe(false);
    expect(wrapper.text()).not.toContain("TradingView");
    expect(chartMocks.candleSetData).toHaveBeenCalledWith([
      { time: 1700000000, open: 10, high: 12, low: 9, close: 11, color: "#79B58B", borderColor: "#79B58B", wickColor: "#79B58B" },
      { time: 1700000060, open: 11, high: 13, low: 10, close: 12, color: "#79B58B", borderColor: "#79B58B", wickColor: "#79B58B" },
    ]);
    expect(chartMocks.volumeSetData).toHaveBeenCalledWith([
      { time: 1700000000, value: 100, color: "#557E65" },
      { time: 1700000060, value: 100, color: "#557E65" },
    ]);
    expect(chartMocks.fitContent).toHaveBeenCalledOnce();
    expect(chartMocks.setVisibleLogicalRange).toHaveBeenCalledOnce();
    expect(chartMocks.setVisibleLogicalRange).toHaveBeenCalledWith({
      from: -0.5,
      to: 5.5,
    });
    await nextTick();
    expect(wrapper.get('[data-testid="origin-chart-canvas"]').attributes("data-origin-dataset-id"))
      .toBe("origin-1");
    expect(wrapper.get('[data-testid="origin-structure-overlay"]').attributes("style")).toContain("width: 700px");
    const chartPanel = wrapper.get('[data-testid="origin-chart-panel"]');
    expect(chartPanel.attributes("data-sbar-count")).toBe("2");
    expect(chartPanel.attributes("data-first-sbar-id")).toBe("1700000000000000000");
    expect(chartPanel.attributes("data-second-sbar-id")).toBe("1700000060000000000");
    const chartHost = wrapper.get('[data-testid="origin-chart-canvas"]');
    expect(chartHost.attributes("data-first-sbar-x")).toBe("100");
    expect(chartHost.attributes("data-second-sbar-x")).toBe("200");
    expect(chartMocks.subscribeVisibleLogicalRangeChange).toHaveBeenCalledOnce();
    wrapper.unmount();
    expect(chartMocks.unsubscribeVisibleLogicalRangeChange).toHaveBeenCalledOnce();
  });

  it("renders authoritative CBar range rectangles and Swing endpoints from the Structure projection", async () => {
    const bars = [
      bar(),
      bar({
        sbarId: "1700000060000000000",
        tsEvent: "1700000060000000000",
        tsInit: "1700000060000000001",
        high: "13",
        low: "10",
      }),
    ];
    const wrapper = mount(OriginChart, {
      props: {
        bars,
        originDatasetId: "origin-structure",
        structure: {
          cbarCount: 1,
          cbars: [{
            cbarId: "1700000000000000000",
            high: "13",
            low: "9",
            sbarStartId: bars[0]!.sbarId,
            sbarEndId: bars[1]!.sbarId,
            spanSbars: 2,
            fractalType: null,
            createdAt: "1700000000000000000",
          }],
          swingCount: 1,
          swings: [{
            swingId: "1700000000000000000",
            direction: "Up",
            high: "13",
            low: "9",
            cbarStartId: "1700000000000000000",
            cbarEndId: "1700000000000000000",
            sbarStartId: bars[0]!.sbarId,
            sbarEndId: bars[1]!.sbarId,
            startOi: null,
            endOi: null,
            volume: "200",
            spanSbars: 2,
            state: "Confirmed",
            createdAt: "1700000000000000000",
            updatedAt: "1700000000000000000",
          }],
        },
      },
    });
    await nextTick();

    const cbarRectangle = wrapper.get('[data-testid="cbar-range-rectangle"]');
    expect(cbarRectangle.attributes("data-cbar-id")).toBe("1700000000000000000");
    expect(cbarRectangle.attributes("x")).toBe("100");
    expect(cbarRectangle.attributes("y")).toBe("30");
    expect(cbarRectangle.attributes("width")).toBe("100");
    expect(cbarRectangle.attributes("height")).toBe("40");
    expect(cbarRectangle.attributes("fill")).toBe("none");
    const swingSegment = wrapper.get('[data-testid="swing-state-segment"]');
    expect(swingSegment.attributes("data-swing-id")).toBe("1700000000000000000");
    expect(swingSegment.attributes("data-swing-state")).toBe("Confirmed");
    expect(swingSegment.attributes("x1")).toBe("100");
    expect(swingSegment.attributes("y1")).toBe("70");
    expect(swingSegment.attributes("x2")).toBe("200");
    expect(swingSegment.attributes("y2")).toBe("30");
    expect(swingSegment.attributes("stroke")).toBe("#B49ACD");
    expect(swingSegment.attributes("stroke-dasharray")).toBeUndefined();
    expect(wrapper.text()).toContain("CBar");
    expect(wrapper.text()).toContain("Swing");
    wrapper.unmount();
  });

  it("selects the exact visible CBar or Swing geometry before falling back to SBar range selection", async () => {
    const bars = [
      bar(),
      bar({
        sbarId: "1700000060000000000",
        tsEvent: "1700000060000000000",
        tsInit: "1700000060000000001",
        high: "13",
        low: "10",
      }),
    ];
    const wrapper = mount(OriginChart, {
      props: {
        bars,
        originDatasetId: "origin-object-hit-test",
        structure: {
          cbarCount: 1,
          cbars: [{
            cbarId: "cbar-exact",
            high: "13",
            low: "9",
            sbarStartId: bars[0]!.sbarId,
            sbarEndId: bars[1]!.sbarId,
            spanSbars: 2,
            fractalType: null,
            createdAt: "1700000000000000000",
          }],
          swingCount: 1,
          swings: [{
            swingId: "swing-exact",
            direction: "Up",
            high: "13",
            low: "9",
            cbarStartId: "cbar-exact",
            cbarEndId: "cbar-exact",
            sbarStartId: bars[0]!.sbarId,
            sbarEndId: bars[1]!.sbarId,
            startOi: null,
            endOi: null,
            volume: "200",
            spanSbars: 2,
            state: "Confirmed",
            createdAt: "1700000000000000000",
            updatedAt: "1700000000000000000",
          }],
        },
      },
    });

    const clickHandler = chartMocks.subscribeClick.mock.calls[0]?.[0] as
      ((param: { point?: { x: number; y: number } }) => void) | undefined;
    expect(clickHandler).toBeTypeOf("function");

    // Near the CBar rectangle edge but away from the Swing diagonal.
    clickHandler?.({ point: { x: 100, y: 50 } });
    // Exactly on the Swing diagonal and away from the CBar rectangle border.
    clickHandler?.({ point: { x: 150, y: 50 } });

    expect(wrapper.emitted("objectClick")).toEqual([
      [{ kind: "cbar", id: "cbar-exact", originDatasetId: "origin-object-hit-test" }],
      [{ kind: "swing", id: "swing-exact", originDatasetId: "origin-object-hit-test" }],
    ]);
    expect(wrapper.emitted("sbarClick")).toBeUndefined();
    wrapper.unmount();
  });

  it("shows transient hover feedback without replacing the persistent selected object", async () => {
    const bars = [
      bar(),
      bar({
        sbarId: "1700000060000000000",
        tsEvent: "1700000060000000000",
        tsInit: "1700000060000000001",
        high: "13",
        low: "10",
      }),
    ];
    const structure = {
      cbarCount: 1,
      cbars: [{
        cbarId: "cbar-hover",
        high: "13",
        low: "9",
        sbarStartId: bars[0]!.sbarId,
        sbarEndId: bars[1]!.sbarId,
        spanSbars: 2,
        fractalType: null,
        createdAt: "1700000000000000000",
      }],
      swingCount: 1,
      swings: [{
        swingId: "swing-hover",
        direction: "Up",
        high: "13",
        low: "9",
        cbarStartId: "cbar-hover",
        cbarEndId: "cbar-hover",
        sbarStartId: bars[0]!.sbarId,
        sbarEndId: bars[1]!.sbarId,
        startOi: null,
        endOi: null,
        volume: "200",
        spanSbars: 2,
        state: "Confirmed",
        createdAt: "1700000000000000000",
        updatedAt: "1700000000000000000",
      }],
    };
    const wrapper = mount(OriginChart, {
      props: {
        bars,
        originDatasetId: "origin-hover-state",
        structure,
        selectedObject: { kind: "sbar", id: bars[0]!.sbarId, originDatasetId: "origin-hover-state" },
      },
    });
    await nextTick();

    const moveHandler = chartMocks.subscribeCrosshairMove.mock.calls[0]?.[0] as
      ((param: { point?: { x: number; y: number } }) => void) | undefined;
    expect(moveHandler).toBeTypeOf("function");
    // Hover a Swing segment while an SBar remains selected in the Inspector.
    moveHandler?.({ point: { x: 150, y: 50 } });
    await nextTick();

    expect(wrapper.get('[data-testid="origin-object-hover-label"]').text()).toBe("SWING · swing-hover");
    expect(wrapper.get('[data-testid="origin-selected-sbar"]').attributes("data-sbar-id")).toBe(bars[0]!.sbarId);
    expect(wrapper.get('[data-testid="origin-hover-swing"]').attributes("data-swing-id")).toBe("swing-hover");
    expect(wrapper.find('[data-testid="origin-selected-swing"]').exists()).toBe(false);

    moveHandler?.({});
    await nextTick();
    expect(wrapper.find('[data-testid="origin-object-hover-label"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="origin-selected-sbar"]').exists()).toBe(true);
    wrapper.unmount();
  });

  it("encodes every authoritative SwingState with its documented color and line pattern", async () => {
    const bars = [
      bar(),
      bar({
        sbarId: "1700000060000000000",
        tsEvent: "1700000060000000000",
        tsInit: "1700000060000000001",
        high: "13",
        low: "10",
      }),
    ];
    const baseSwing = {
      direction: "Up",
      high: "13",
      low: "9",
      cbarStartId: bars[0]!.sbarId,
      cbarEndId: bars[1]!.sbarId,
      sbarStartId: bars[0]!.sbarId,
      sbarEndId: bars[1]!.sbarId,
      startOi: null,
      endOi: null,
      volume: "200",
      spanSbars: 2,
      createdAt: "1700000000000000000",
      updatedAt: "1700000000000000000",
    };
    const wrapper = mount(OriginChart, {
      props: {
        bars,
        originDatasetId: "origin-swing-states",
        structure: {
          cbarCount: 0,
          cbars: [],
          swingCount: 3,
          swings: [
            { ...baseSwing, swingId: "1", state: "Confirmed" },
            { ...baseSwing, swingId: "2", state: "Tentative" },
            { ...baseSwing, swingId: "3", state: "Extending" },
          ],
        },
      },
    });
    await nextTick();

    const segments = wrapper.findAll('[data-testid="swing-state-segment"]');
    expect(segments).toHaveLength(3);
    expect(segments.map((segment) => [
      segment.attributes("data-swing-state"),
      segment.attributes("stroke"),
      segment.attributes("stroke-dasharray") ?? "",
    ])).toEqual([
      ["Confirmed", "#B49ACD", ""],
      ["Tentative", "#D6A85D", "6 3"],
      ["Extending", "#8FA9C4", "2 3"],
    ]);
    wrapper.unmount();
  });

  it("reprojects CBar and Swing overlays after the visible chart range changes", async () => {
    const bars = [
      bar(),
      bar({
        sbarId: "1700000060000000000",
        tsEvent: "1700000060000000000",
        tsInit: "1700000060000000001",
        high: "13",
        low: "10",
      }),
    ];
    const wrapper = mount(OriginChart, {
      props: {
        bars,
        originDatasetId: "origin-zoom-overlay",
        structure: {
          cbarCount: 1,
          cbars: [{
            cbarId: "cbar-zoom",
            high: "13",
            low: "9",
            sbarStartId: bars[0]!.sbarId,
            sbarEndId: bars[1]!.sbarId,
          }],
          swingCount: 1,
          swings: [{
            swingId: "swing-zoom",
            direction: "Up",
            high: "13",
            low: "9",
            sbarStartId: bars[0]!.sbarId,
            sbarEndId: bars[1]!.sbarId,
            state: "Confirmed",
          }],
        } as never,
      },
    });
    await nextTick();

    expect(wrapper.get('[data-testid="cbar-range-rectangle"]').attributes("x")).toBe("100");
    expect(wrapper.get('[data-testid="swing-state-segment"]').attributes("x2")).toBe("200");

    chartMocks.timeToCoordinate.mockImplementation((time: number) => {
      if (time === 1700000000) return 60;
      if (time === 1700000060) return 260;
      return null;
    });
    const rangeChange = chartMocks.subscribeVisibleLogicalRangeChange.mock.calls[0]?.[0] as
      (() => void) | undefined;
    expect(rangeChange).toBeTypeOf("function");
    rangeChange?.();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await nextTick();

    expect(wrapper.get('[data-testid="cbar-range-rectangle"]').attributes("x")).toBe("60");
    expect(wrapper.get('[data-testid="cbar-range-rectangle"]').attributes("width")).toBe("200");
    expect(wrapper.get('[data-testid="swing-state-segment"]').attributes("x1")).toBe("60");
    expect(wrapper.get('[data-testid="swing-state-segment"]').attributes("x2")).toBe("260");
    wrapper.unmount();
  });

  it("maps horizontal chart positions to lossless SBar IDs regardless of pointer y", async () => {
    const wrapper = mount(OriginChart, {
      props: {
        bars: [
          bar(),
          bar({
            sbarId: "1700000060000000000",
            tsEvent: "1700000060000000000",
            tsInit: "1700000060000000001",
          }),
        ],
        originDatasetId: "origin-clicks",
        structure: null,
      },
    });

    const clickHandler = chartMocks.subscribeClick.mock.calls[0]?.[0] as
      ((param: { point?: { x: number; y: number } }) => void) | undefined;
    expect(clickHandler).toBeTypeOf("function");

    clickHandler?.({ point: { x: 200, y: 12 } });
    clickHandler?.({ point: { x: 200, y: 410 } });
    await nextTick();
    expect(wrapper.find('[data-testid="origin-selection-start-line"]').exists()).toBe(true);
    expect(wrapper.emitted("sbarClick")).toEqual([
      ["1700000060000000000"],
      ["1700000060000000000"],
    ]);

    clickHandler?.({});
    expect(wrapper.emitted("selectionError")).toEqual([
      ["The click did not resolve to a horizontal position inside the chart plot."],
    ]);

    wrapper.unmount();
    expect(chartMocks.unsubscribeClick).toHaveBeenCalledOnce();
    expect(chartMocks.unsubscribeCrosshairMove).toHaveBeenCalledOnce();
  });

  it("pans to a related off-screen selection while preserving the logical zoom span", async () => {
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
    const wrapper = mount(OriginChart, {
      props: {
        bars,
        originDatasetId: "origin-related-navigation",
        structure: null,
        selectedObject: null,
      },
    });

    // Vue Test Utils infers setProps from the mount overload and omits
    // this script-setup prop from the wrapper's accepted type.
    const setSelectedObject = (selectedObject: {
      kind: "sbar";
      id: string;
      originDatasetId: string;
    }) => wrapper.setProps({ selectedObject } as never);

    await setSelectedObject({
      kind: "sbar",
      id: bars[2]!.sbarId,
      originDatasetId: "origin-related-navigation",
    });
    await nextTick();

    expect(chartMocks.setVisibleLogicalRange).toHaveBeenLastCalledWith({ from: 1.5, to: 2.5 });
    wrapper.unmount();
  });

  it("accepts an exact SBar ID through the component selection command and emits the normal selection event", async () => {
    const wrapper = mount(OriginChart, {
      props: {
        bars: [
          bar(),
          bar({
            sbarId: "1700000060000000000",
            tsEvent: "1700000060000000000",
            tsInit: "1700000060000000001",
          }),
        ],
        originDatasetId: "origin-command",
        structure: null,
      },
    });

    wrapper.get('[data-testid="origin-chart-panel"]').element.dispatchEvent(
      new CustomEvent("struxis-select-sbar", {
        bubbles: true,
        detail: { sbarId: "1700000060000000000" },
      }),
    );
    await nextTick();

    expect(wrapper.emitted("sbarClick")).toEqual([["1700000060000000000"]]);
    expect(wrapper.get('[data-testid="origin-chart-canvas"]').attributes("data-selection-start-x"))
      .toBe("200");
    wrapper.get('[data-testid="origin-chart-panel"]').element.dispatchEvent(
      new CustomEvent("struxis-select-sbar", {
        bubbles: true,
        detail: { sbarId: "9999999999999999999" },
      }),
    );
    await nextTick();

    expect(wrapper.emitted("selectionError")).toEqual([
      ["The selected SBar is not part of the current Origin chart."],
    ]);
    wrapper.unmount();
  });

  it("previews a full-height range overlay and fixes both boundary lines on completion", async () => {
    const wrapper = mount(OriginChart, {
      props: {
        bars: [
          bar(),
          bar({
            sbarId: "1700000060000000000",
            tsEvent: "1700000060000000000",
            tsInit: "1700000060000000001",
          }),
        ],
        originDatasetId: "origin-overlay",
        structure: null,
        selectionStartSbarId: "1700000000000000000",
        selectionEndSbarId: null,
        selectionPending: true,
      },
    });
    await nextTick();

    const moveHandler = chartMocks.subscribeCrosshairMove.mock.calls[0]?.[0] as
      ((param: { point?: { x: number; y: number } }) => void) | undefined;
    moveHandler?.({ point: { x: 180, y: 15 } });
    await nextTick();

    const preview = wrapper.get('[data-testid="origin-selection-preview"]');
    expect(preview.attributes("style")).toContain("left: 100px");
    expect(preview.attributes("style")).toContain("width: 80px");
    expect(wrapper.find('[data-testid="origin-selection-start-line"]').exists()).toBe(true);

    // Vue Test Utils infers setProps from the mount overload and omits
    // some script-setup props; keep the workaround local to this test.
    const setOriginChartSelectionProps = (
      props: Partial<{ selectionPending: boolean; selectionEndSbarId: string | null }>,
    ) => wrapper.setProps(props as never);

    await setOriginChartSelectionProps({
      selectionPending: false,
      selectionEndSbarId: "1700000060000000000",
    });
    await nextTick();

    expect(wrapper.find('[data-testid="origin-selection-preview"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="origin-selection-completed"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="origin-selection-end-line"]').exists()).toBe(true);
    wrapper.unmount();
  });

  it("drags a completed interval boundary to another exact SBar", async () => {
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
    chartMocks.coordinateToLogical.mockImplementation((x: number) => x < 150 ? 0 : x < 250 ? 1 : 2);
    const wrapper = mount(OriginChart, {
      props: {
        bars,
        originDatasetId: "origin-boundary-drag",
        structure: null,
        selectionStartSbarId: bars[0]!.sbarId,
        selectionEndSbarId: bars[2]!.sbarId,
        selectionPending: false,
        selectionEditable: true,
      },
    });
    await nextTick();

    await wrapper.get('[data-testid="origin-selection-end-line"]').trigger("pointerdown", {
      button: 0,
    });
    const move = new Event("pointermove");
    Object.defineProperty(move, "clientX", { value: 200 });
    window.dispatchEvent(move);
    window.dispatchEvent(new Event("pointerup"));

    expect(wrapper.emitted("rangeBoundaryChange")).toEqual([
      ["end", "1700000060000000000"],
    ]);
    wrapper.unmount();
  });

  it("renders draggable boundary lines without separate handles", async () => {
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
    const wrapper = mount(OriginChart, {
      props: {
        bars,
        originDatasetId: "origin-boundary-edit",
        structure: null,
        selectionStartSbarId: bars[0]!.sbarId,
        selectionEndSbarId: bars[2]!.sbarId,
        selectionPending: false,
        selectionEditable: true,
      },
    });
    await nextTick();

    expect(wrapper.find('[data-testid="origin-selection-start-line"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="origin-selection-end-line"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="origin-selection-start-handle"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="origin-selection-end-handle"]').exists()).toBe(false);

    wrapper.unmount();
  });

  it("toggles SBar, volume, CBar and Swing layers independently", async () => {
    const wrapper = mount(OriginChart, {
      props: {
        bars: [bar()],
        originDatasetId: "origin-layer-visibility",
        structure: {
          cbars: [{
            cbarId: "cbar-1",
            sbarStartId: "1700000000000000000",
            sbarEndId: "1700000000000000000",
            high: "12",
            low: "9",
          }],
          swings: [{
            swingId: "swing-1",
            sbarStartId: "1700000000000000000",
            sbarEndId: "1700000000000000000",
            high: "12",
            low: "9",
            direction: "Up",
            state: "Confirmed",
          }],
          swingCount: 1,
        } as never,
      },
    });
    await nextTick();

    await wrapper.get('[data-testid="layer-toggle-sbar"]').trigger("click");
    await wrapper.get('[data-testid="layer-toggle-volume"]').trigger("click");
    await wrapper.get('[data-testid="layer-toggle-cbar"]').trigger("click");
    await wrapper.get('[data-testid="layer-toggle-swing"]').trigger("click");
    await nextTick();

    expect(chartMocks.candleApplyOptions).toHaveBeenCalledWith({ visible: false });
    expect(chartMocks.volumeApplyOptions).toHaveBeenCalledWith({ visible: false });
    expect(wrapper.find('[data-testid="cbar-range-rectangle"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="swing-state-segment"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="layer-toggle-sbar"]').attributes("aria-pressed")).toBe("false");
    expect(wrapper.get('[data-testid="layer-toggle-volume"]').attributes("aria-pressed")).toBe("false");

    // Hidden layers remain represented in the Legend and can be restored from
    // the same item; no separate toolbar control is required.
    await wrapper.get('[data-testid="layer-toggle-sbar"]').trigger("click");
    await wrapper.get('[data-testid="layer-toggle-volume"]').trigger("click");
    await wrapper.get('[data-testid="layer-toggle-cbar"]').trigger("click");
    await wrapper.get('[data-testid="layer-toggle-swing"]').trigger("click");
    await nextTick();

    expect(chartMocks.candleApplyOptions).toHaveBeenCalledWith({ visible: true });
    expect(chartMocks.volumeApplyOptions).toHaveBeenCalledWith({ visible: true });
    expect(wrapper.find('[data-testid="cbar-range-rectangle"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="swing-state-segment"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="layer-toggle-sbar"]').attributes("aria-pressed")).toBe("true");
    expect(wrapper.get('[data-testid="layer-toggle-volume"]').attributes("aria-pressed")).toBe("true");

    wrapper.unmount();
  });

  it("preserves the current viewport for same-dataset updates and fits a new dataset", async () => {
    const wrapper = mount(OriginChart, {
      props: {
        bars: [],
        originDatasetId: "origin-1",
        structure: null,
      },
    });

    expect(chartMocks.fitContent).not.toHaveBeenCalled();

    // Vue Test Utils currently infers only the generic vnode props for this
    // SFC's setProps overload, so narrow the helper to this component's public props.
    const setOriginChartProps = (props: Partial<{ bars: SBarDto[]; originDatasetId: string }>) =>
      wrapper.setProps(props as never);

    await setOriginChartProps({ bars: [bar()] });
    expect(chartMocks.fitContent).toHaveBeenCalledOnce();
    expect(chartMocks.setVisibleLogicalRange).toHaveBeenCalledOnce();

    await setOriginChartProps({
      bars: [
        bar(),
        bar({
          sbarId: "1700000060000000000",
          tsEvent: "1700000060000000000",
          tsInit: "1700000060000000001",
        }),
      ],
    });
    expect(chartMocks.fitContent).toHaveBeenCalledOnce();

    await setOriginChartProps({
      originDatasetId: "origin-2",
      bars: [bar({
        sbarId: "1700000120000000000",
        tsEvent: "1700000120000000000",
        tsInit: "1700000120000000001",
      })],
    });
    expect(chartMocks.fitContent).toHaveBeenCalledTimes(2);
    expect(chartMocks.setVisibleLogicalRange).toHaveBeenCalledTimes(2);
    expect(chartMocks.setVisibleLogicalRange).toHaveBeenLastCalledWith({
      from: -0.5,
      to: 4.5,
    });
    wrapper.unmount();
  });

  it("rejects invalid chart projection and clears all chart projections", async () => {
    const wrapper = mount(OriginChart, {
      props: {
        bars: [bar({ close: "NaN" })],
        originDatasetId: "origin-invalid",
        structure: null,
      },
    });
    // onMounted updates reactive chartError; wait for Vue to render that state.
    await nextTick();

    expect(wrapper.get('[data-testid="origin-chart-error"]').text())
      .toContain("SBar 1700000000000000000 has a non-finite close value.");
    expect(chartMocks.candleSetData).toHaveBeenCalledWith([]);
    expect(chartMocks.volumeSetData).toHaveBeenCalledWith([]);
    expect(wrapper.findAll('[data-testid="cbar-range-rectangle"]')).toHaveLength(0);
    expect(wrapper.findAll('[data-testid="swing-state-segment"]')).toHaveLength(0);
    wrapper.unmount();
  });

  it("releases the chart and resize observer on unmount", () => {
    const wrapper = mount(OriginChart, {
      props: {
        bars: [],
        originDatasetId: "origin-empty",
        structure: null,
      },
    });

    expect(chartMocks.observe).toHaveBeenCalledOnce();
    wrapper.unmount();

    expect(chartMocks.disconnect).toHaveBeenCalledOnce();
    expect(chartMocks.unsubscribeVisibleLogicalRangeChange).toHaveBeenCalledOnce();
    expect(chartMocks.chartRemove).toHaveBeenCalledOnce();
  });
});
