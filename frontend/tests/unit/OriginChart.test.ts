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
      return null;
    });
    chartMocks.coordinateToLogical.mockImplementation((x: number) => x < 150 ? 0 : 1);
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
      { time: 1700000000, open: 10, high: 12, low: 9, close: 11 },
      { time: 1700000060, open: 11, high: 13, low: 10, close: 12 },
    ]);
    expect(chartMocks.volumeSetData).toHaveBeenCalledWith([
      { time: 1700000000, value: 100, color: "#1d756d" },
      { time: 1700000060, value: 100, color: "#1d756d" },
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

  it("maps horizontal chart positions to lossless SBar IDs regardless of pointer y", () => {
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
      },
    });

    const clickHandler = chartMocks.subscribeClick.mock.calls[0]?.[0] as
      ((param: { point?: { x: number; y: number } }) => void) | undefined;
    expect(clickHandler).toBeTypeOf("function");

    clickHandler?.({ point: { x: 200, y: 12 } });
    clickHandler?.({ point: { x: 200, y: 410 } });
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

  it("preserves the current viewport for same-dataset updates and fits a new dataset", async () => {
    const wrapper = mount(OriginChart, {
      props: {
        bars: [],
        originDatasetId: "origin-1",
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
    expect(chartMocks.unsubscribeVisibleLogicalRangeChange).toHaveBeenCalledOnce();
    expect(chartMocks.chartRemove).toHaveBeenCalledOnce();
  });
});
