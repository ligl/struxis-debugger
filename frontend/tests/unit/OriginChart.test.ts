import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import OriginChart from "../../src/components/OriginChart.vue";
import type { SBarDto } from "../../src/origin-types";

const chartMocks = vi.hoisted(() => ({
  createChart: vi.fn(),
  candleSetData: vi.fn(),
  volumeSetData: vi.fn(),
  priceToCoordinate: vi.fn(),
  chartRemove: vi.fn(),
  fitContent: vi.fn(),
  setVisibleLogicalRange: vi.fn(),
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
      .mockReturnValueOnce({ setData: chartMocks.candleSetData, priceToCoordinate: chartMocks.priceToCoordinate })
      .mockReturnValueOnce({ setData: chartMocks.volumeSetData }),
    priceScale: vi.fn(() => ({ applyOptions: chartMocks.applyPriceScaleOptions })),
    timeScale: vi.fn(() => ({
      fitContent: chartMocks.fitContent,
      setVisibleLogicalRange: chartMocks.setVisibleLogicalRange,
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
    chartMocks.timeToCoordinate.mockImplementation((time: number) => {
      if (time === 1700000000) return 100;
      if (time === 1700000060) return 200;
      if (time === 1700000120) return 300;
      return null;
    });
    chartMocks.coordinateToLogical.mockImplementation((x: number) => x < 150 ? 0 : 1);
    chartMocks.priceToCoordinate.mockImplementation((price: number) => price === 13 ? 30 : price === 9 ? 70 : null);
    installResizeObserverMock();
    installChartMock();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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
    };
    expect(chartOptions.grid).toEqual({
      vertLines: { visible: false },
      horzLines: { visible: false },
    });
    expect(chartOptions.layout?.attributionLogo).toBe(false);
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
    expect(swingSegment.attributes("stroke")).toBe("#C6A06B");
    expect(swingSegment.attributes("stroke-dasharray")).toBeUndefined();
    expect(wrapper.text()).toContain("CBar");
    expect(wrapper.text()).toContain("Swing");
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
      ["Confirmed", "#C6A06B", ""],
      ["Tentative", "#D6A85D", "6 3"],
      ["Extending", "#8FA9C4", "2 3"],
    ]);
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

  it("allows both completed interval boundaries to be adjusted with the keyboard", async () => {
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
      },
    });
    await nextTick();

    await wrapper.get('[data-testid="origin-selection-start-handle"]').trigger("keydown", {
      key: "ArrowRight",
    });
    expect(wrapper.emitted("rangeBoundaryChange")).toEqual([
      ["start", "1700000060000000000"],
    ]);

    await wrapper.get('[data-testid="origin-selection-end-handle"]').trigger("keydown", {
      key: "ArrowLeft",
    });
    expect(wrapper.emitted("rangeBoundaryChange")).toEqual([
      ["start", "1700000060000000000"],
      ["end", "1700000060000000000"],
    ]);

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
