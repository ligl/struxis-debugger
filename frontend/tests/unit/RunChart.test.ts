import { mount, type VueWrapper } from "@vue/test-utils";
import { nextTick } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RunChart from "../../src/components/RunChart.vue";
import type { OriginDatasetDto, RunStateDto, SBarDto, TestDatasetDto } from "../../src/origin-types";

const mocks = vi.hoisted(() => ({
  createChart: vi.fn(),
  candleSetData: vi.fn(),
  volumeSetData: vi.fn(),
  candleUpdate: vi.fn(),
  volumeUpdate: vi.fn(),
  chartRemove: vi.fn(),
  fitContent: vi.fn(),
  setVisibleLogicalRange: vi.fn(),
  applyChartOptions: vi.fn(),
  applyPriceScaleOptions: vi.fn(),
  coordinateToLogical: vi.fn(),
  subscribeClick: vi.fn(),
  unsubscribeClick: vi.fn(),
  subscribeCrosshairMove: vi.fn(),
  unsubscribeCrosshairMove: vi.fn(),
  crosshairMoveListener: null as ((param: { point?: { x: number; y: number } | undefined }) => void) | null,
  observe: vi.fn(),
  disconnect: vi.fn(),
  subscribeVisibleRangeChange: vi.fn(),
  unsubscribeVisibleRangeChange: vi.fn(),
  visibleRangeListener: null as (() => void) | null,
  animationFrameCallback: null as FrameRequestCallback | null,
  coordinateOffset: 0,
  cancelAnimationFrame: vi.fn(),
}));

vi.mock("lightweight-charts", () => ({
  CandlestickSeries: { kind: "candlestick" },
  ColorType: { Solid: "solid" },
  CrosshairMode: { Normal: 0 },
  HistogramSeries: { kind: "histogram" },
  createChart: mocks.createChart,
}));

function bar(sbarId: string, tsEvent: string): SBarDto {
  return {
    sbarId,
    barType: "TEST-1-MINUTE-LAST-EXTERNAL",
    tsEvent,
    tsInit: (BigInt(tsEvent) + 1n).toString(),
    open: "10",
    high: "12",
    low: "9",
    close: "11",
    volume: "100",
  };
}

const originBars = [
  bar("1700000000000000000", "1700000000000000000"),
  bar("1700000060000000000", "1700000060000000000"),
  bar("1700000120000000000", "1700000120000000000"),
];

function origin(): OriginDatasetDto {
  return {
    originDatasetId: "origin-1",
    sourceCatalog: "/catalog",
    enableStructure: true,
    structure: null,
    instrumentId: "TEST",
    barType: "TEST-1-MINUTE-LAST-EXTERNAL",
    timeframe: "1m",
    sbarSequenceFingerprint: "origin-fingerprint",
    sbarCount: originBars.length,
    firstSbarId: originBars[0]!.sbarId,
    lastSbarId: originBars[2]!.sbarId,
    firstTsEvent: originBars[0]!.tsEvent,
    lastTsEvent: originBars[2]!.tsEvent,
    bars: originBars,
  };
}

function testDataset(overrides: Partial<TestDatasetDto> = {}): TestDatasetDto {
  return {
    testDatasetId: "test-1",
    originDatasetId: "origin-1",
    instrumentId: "TEST",
    barType: "TEST-1-MINUTE-LAST-EXTERNAL",
    timeframe: "1m",
    startSbarId: originBars[1]!.sbarId,
    endSbarId: originBars[2]!.sbarId,
    sbarCount: 2,
    sbarSequenceFingerprint: "test-fingerprint",
    ...overrides,
  };
}

function runState(overrides: Partial<RunStateDto> = {}): RunStateDto {
  return {
    runId: "run-1",
    testDatasetId: "test-1",
    inputFingerprint: "input-fingerprint",
    inputCount: 2,
    status: "running",
    processedCount: 1,
    cursorSbarId: originBars[1]!.sbarId,
    failureDiagnostic: null,
    ...overrides,
  };
}

function installResizeObserverMock(): void {
  class ResizeObserverMock {
    observe = mocks.observe;
    disconnect = mocks.disconnect;
    constructor(_callback: ResizeObserverCallback) {}
  }
  vi.stubGlobal("ResizeObserver", ResizeObserverMock);
}

function installChartMock(): void {
  mocks.createChart.mockReturnValue({
    addSeries: vi.fn()
      .mockReturnValueOnce({ setData: mocks.candleSetData, update: mocks.candleUpdate, priceToCoordinate: (price: number) => 200 - price, applyOptions: vi.fn() })
      .mockReturnValueOnce({ setData: mocks.volumeSetData, update: mocks.volumeUpdate, applyOptions: vi.fn() }),
    priceScale: vi.fn(() => ({ applyOptions: mocks.applyPriceScaleOptions })),
    timeScale: vi.fn(() => ({
      fitContent: mocks.fitContent,
      setVisibleLogicalRange: mocks.setVisibleLogicalRange,
      timeToCoordinate: (time: number) => time - 1700000000 + mocks.coordinateOffset,
      coordinateToLogical: mocks.coordinateToLogical,
      subscribeVisibleLogicalRangeChange: (listener: () => void) => { mocks.visibleRangeListener = listener; mocks.subscribeVisibleRangeChange(); },
      unsubscribeVisibleLogicalRangeChange: mocks.unsubscribeVisibleRangeChange,
    })),
    subscribeClick: mocks.subscribeClick,
    unsubscribeClick: mocks.unsubscribeClick,
    subscribeCrosshairMove: (listener: (param: { point?: { x: number; y: number } | undefined }) => void) => {
      mocks.crosshairMoveListener = listener;
      mocks.subscribeCrosshairMove();
    },
    unsubscribeCrosshairMove: mocks.unsubscribeCrosshairMove,
    applyOptions: mocks.applyChartOptions,
    remove: mocks.chartRemove,
  });
}

describe("RunChart", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.visibleRangeListener = null;
    mocks.crosshairMoveListener = null;
    mocks.animationFrameCallback = null;
    mocks.coordinateOffset = 0;
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { mocks.animationFrameCallback = callback; return 1; });
    vi.stubGlobal("cancelAnimationFrame", mocks.cancelAnimationFrame);
    mocks.coordinateToLogical.mockImplementation((x: number) => x < 90 ? 0 : 1);
    installResizeObserverMock();
    installChartMock();
  });

  afterEach(() => vi.unstubAllGlobals());

  it("renders only the exact inclusive Test Dataset slice from its matching validated Origin", async () => {
    const wrapper = mount(RunChart, {
      props: { origin: origin(), testDataset: testDataset(), runState: null },
    });
    await nextTick();

    expect(mocks.candleSetData).toHaveBeenCalledWith([
      {
        time: 1700000060, open: 10, high: 12, low: 9, close: 11,
        color: "#79B58B", borderColor: "#79B58B", wickColor: "#79B58B",
      },
      {
        time: 1700000120, open: 10, high: 12, low: 9, close: 11,
        color: "#79B58B", borderColor: "#79B58B", wickColor: "#79B58B",
      },
    ]);
    expect(mocks.volumeSetData).toHaveBeenCalledWith([
      { time: 1700000060, value: 100, color: "#557E65" },
      { time: 1700000120, value: 100, color: "#557E65" },
    ]);
    expect(wrapper.get('[data-testid="run-chart-panel"]').attributes("data-sbar-count")).toBe("2");
    expect(mocks.fitContent).toHaveBeenCalledOnce();
    expect(mocks.setVisibleLogicalRange).toHaveBeenCalledWith({ from: -0.5, to: 5.5 });
    wrapper.unmount();
  });

  it("shows transient SBar hover feedback without changing Inspector selection", async () => {
    const wrapper = mount(RunChart, {
      props: { origin: origin(), testDataset: testDataset(), runState: null },
    });
    await nextTick();

    expect(mocks.crosshairMoveListener).not.toBeNull();
    mocks.crosshairMoveListener?.({ point: { x: 60, y: 190 } });
    await nextTick();

    expect(wrapper.get('[data-testid="run-hover-sbar"]').attributes("data-sbar-id")).toBe(originBars[1]!.sbarId);
    expect(wrapper.get('[data-testid="run-object-hover-label"]').text()).toBe(`SBAR · ${originBars[1]!.sbarId}`);
    expect(wrapper.emitted("objectSelect")).toBeUndefined();

    mocks.crosshairMoveListener?.({ point: undefined });
    await nextTick();
    expect(wrapper.find('[data-testid="run-hover-sbar"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="run-object-hover-label"]').exists()).toBe(false);
    wrapper.unmount();
    expect(mocks.unsubscribeCrosshairMove).toHaveBeenCalledOnce();
  });

  it("dims future input bars according to backend-confirmed cursor progress", async () => {
    const wrapper = mount(RunChart, {
      props: {
        origin: origin(),
        testDataset: testDataset(),
        runState: runState(),
      },
    });
    await nextTick();

    expect(mocks.candleSetData).toHaveBeenLastCalledWith([
      {
        time: 1700000060, open: 10, high: 12, low: 9, close: 11,
        color: "#79B58B", borderColor: "#79B58B", wickColor: "#79B58B",
      },
      {
        time: 1700000120,
        open: 10,
        high: 12,
        low: 9,
        close: 11,
        color: "#454b53",
        borderColor: "#454b53",
        wickColor: "#454b53",
      },
    ]);
    expect(mocks.volumeSetData).toHaveBeenLastCalledWith([
      { time: 1700000060, value: 100, color: "#557E65" },
      { time: 1700000120, value: 100, color: "#454b53" },
    ]);
    // Replay no longer renders a footer: progress is represented by the backend-driven candle/volume state.
    expect(wrapper.find(".run-chart-foot").exists()).toBe(false);
    wrapper.unmount();
  });


  it("updates only the newly confirmed candle and volume point during a normal Step", async () => {
    const wrapper = mount(RunChart, {
      props: {
        origin: origin(),
        testDataset: testDataset(),
        runState: runState(),
      },
    }) as VueWrapper<any>;
    await nextTick();
    const candleSetCalls = mocks.candleSetData.mock.calls.length;
    const volumeSetCalls = mocks.volumeSetData.mock.calls.length;

    await wrapper.setProps({
      runState: runState({
        processedCount: 2,
        cursorSbarId: originBars[2]!.sbarId,
        status: "completed",
      }),
    });
    await nextTick();

    expect(mocks.candleSetData).toHaveBeenCalledTimes(candleSetCalls);
    expect(mocks.volumeSetData).toHaveBeenCalledTimes(volumeSetCalls);
    expect(mocks.candleUpdate).toHaveBeenCalledWith({
      time: 1700000120,
      open: 10,
      high: 12,
      low: 9,
      close: 11,
      color: "#79B58B",
      borderColor: "#79B58B",
      wickColor: "#79B58B",
    }, true);
    expect(mocks.volumeUpdate).toHaveBeenCalledWith({
      time: 1700000120,
      value: 100,
      color: "#557E65",
    }, true);
    wrapper.unmount();
  });

  it("renders authoritative CBar and Swing layers from the confirmed Replay checkpoint", async () => {
    const structure = {
      cbarCount: 1,
      cbars: [{
        cbarId: "cbar-1",
        high: "12",
        low: "9",
        sbarStartId: originBars[1]!.sbarId,
        sbarEndId: originBars[2]!.sbarId,
        spanSbars: 2,
        fractalType: null,
        createdAt: "2026-10-23T00:00:00Z",
      }],
      swingCount: 1,
      swings: [{
        swingId: "swing-1",
        direction: "Up",
        high: "12",
        low: "9",
        cbarStartId: "cbar-1",
        cbarEndId: "cbar-1",
        sbarStartId: originBars[1]!.sbarId,
        sbarEndId: originBars[2]!.sbarId,
        startOi: null,
        endOi: null,
        volume: "200",
        spanSbars: 2,
        state: "Confirmed",
        createdAt: "2026-10-23T00:00:00Z",
        updatedAt: "2026-10-23T00:00:00Z",
      }],
    };
    const wrapper = mount(RunChart, {
      props: { origin: origin(), testDataset: testDataset(), runState: runState(), structure, selectedObject: { kind: "cbar", id: "cbar-1", checkpointSbarId: originBars[1]!.sbarId } },
    });
    await nextTick();

    expect(wrapper.find('[data-testid="run-cbar-rectangle"][data-cbar-id="cbar-1"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="run-cbar-rectangle"][data-cbar-id="cbar-1"]').attributes("stroke")).toBe("#D6A85D");
    expect(wrapper.find('[data-testid="run-swing-segment"][data-swing-id="swing-1"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="run-layer-toggle-cbar"]').attributes("aria-pressed")).toBe("true");

    const moveHandler = mocks.crosshairMoveListener;
    expect(moveHandler).not.toBeNull();
    moveHandler?.({ point: { x: 90, y: 189.5 } });
    await nextTick();
    expect(wrapper.get('[data-testid="run-hover-swing"]').attributes("data-swing-id")).toBe("swing-1");
    expect(wrapper.get('[data-testid="run-object-hover-label"]').text()).toBe("SWING · swing-1");
    expect(wrapper.get('[data-testid="run-cbar-rectangle"][data-cbar-id="cbar-1"]').attributes("stroke")).toBe("#D6A85D");
    expect(wrapper.emitted("objectSelect")).toBeUndefined();

    await wrapper.setProps({ selectedObject: null });
    await nextTick();
    moveHandler?.({ point: { x: 90, y: 188 } });
    await nextTick();
    expect(wrapper.get('[data-testid="run-hover-cbar"]').attributes("data-cbar-id")).toBe("cbar-1");
    expect(wrapper.get('[data-testid="run-object-hover-label"]').text()).toBe("CBAR · cbar-1");
    expect(wrapper.emitted("objectSelect")).toBeUndefined();

    await wrapper.get('[data-testid="run-layer-toggle-cbar"]').trigger("click");
    await nextTick();
    expect(wrapper.find('[data-testid="run-cbar-rectangle"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="run-layer-toggle-cbar"]').attributes("aria-pressed")).toBe("false");

    await wrapper.get('[data-testid="run-chart-fit"]').trigger("click");
    expect(mocks.fitContent).toHaveBeenCalledTimes(2);
    wrapper.unmount();
  });

  it("reconciles authoritative structure changes with the matching advancing Replay checkpoint", async () => {
    const initialStructure = {
      cbarCount: 1,
      cbars: [{
        cbarId: "cbar-stable",
        high: "12",
        low: "9",
        sbarStartId: originBars[1]!.sbarId,
        sbarEndId: originBars[1]!.sbarId,
        spanSbars: 1,
        fractalType: null,
        createdAt: "2026-10-23T00:00:00Z",
      }],
      swingCount: 1,
      swings: [{
        swingId: "swing-removed",
        direction: "Up",
        high: "12",
        low: "9",
        cbarStartId: "cbar-stable",
        cbarEndId: "cbar-stable",
        sbarStartId: originBars[1]!.sbarId,
        sbarEndId: originBars[1]!.sbarId,
        startOi: null,
        endOi: null,
        volume: "200",
        spanSbars: 1,
        state: "Confirmed",
        createdAt: "2026-10-23T00:00:00Z",
        updatedAt: "2026-10-23T00:00:00Z",
      }],
    };
    const wrapper = mount(RunChart, {
      props: { origin: origin(), testDataset: testDataset(), runState: runState(), structure: initialStructure },
    }) as VueWrapper<any>;
    await nextTick();
    expect(wrapper.find('[data-testid="run-cbar-rectangle"][data-cbar-id="cbar-stable"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="run-swing-segment"][data-swing-id="swing-removed"]').exists()).toBe(true);

    const candleSetCalls = mocks.candleSetData.mock.calls.length;
    const volumeSetCalls = mocks.volumeSetData.mock.calls.length;
    await wrapper.setProps({
      runState: runState({
        processedCount: 2,
        cursorSbarId: originBars[2]!.sbarId,
        status: "completed",
      }),
      structure: {
        cbarCount: 2,
        cbars: [
          { ...initialStructure.cbars[0]!, high: "13", sbarEndId: originBars[2]!.sbarId, spanSbars: 2 },
          {
            cbarId: "cbar-added",
            high: "11",
            low: "8",
            sbarStartId: originBars[1]!.sbarId,
            sbarEndId: originBars[2]!.sbarId,
            spanSbars: 2,
            fractalType: null,
            createdAt: "2026-10-23T00:00:00Z",
          },
        ],
        swingCount: 0,
        swings: [],
      },
    });
    await nextTick();

    expect(mocks.candleSetData).toHaveBeenCalledTimes(candleSetCalls);
    expect(mocks.volumeSetData).toHaveBeenCalledTimes(volumeSetCalls);
    expect(mocks.candleUpdate).toHaveBeenCalledWith({
      time: 1700000120,
      open: 10,
      high: 12,
      low: 9,
      close: 11,
      color: "#79B58B",
      borderColor: "#79B58B",
      wickColor: "#79B58B",
    }, true);
    expect(wrapper.findAll('[data-testid="run-cbar-rectangle"]')).toHaveLength(2);
    expect(wrapper.get('[data-testid="run-cbar-rectangle"][data-cbar-id="cbar-stable"]').attributes("y")).toBe("187");
    expect(wrapper.find('[data-testid="run-cbar-rectangle"][data-cbar-id="cbar-added"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="run-swing-segment"]').exists()).toBe(false);

    await wrapper.setProps({ structure: { cbarCount: 0, cbars: [], swingCount: 0, swings: [] } });
    await nextTick();
    expect(wrapper.find('[data-testid="run-cbar-rectangle"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="run-swing-segment"]').exists()).toBe(false);
    wrapper.unmount();
  });


  it("coalesces zoom-range changes and reprojects structure on the next animation frame", async () => {
    const structure = {
      cbarCount: 1,
      cbars: [{
        cbarId: "cbar-zoom",
        high: "12",
        low: "9",
        sbarStartId: originBars[1]!.sbarId,
        sbarEndId: originBars[2]!.sbarId,
        spanSbars: 2,
        fractalType: null,
        createdAt: "2026-10-23T00:00:00Z",
      }],
      swingCount: 0,
      swings: [],
    };
    const wrapper = mount(RunChart, {
      props: { origin: origin(), testDataset: testDataset(), runState: runState(), structure },
    });
    await nextTick();

    const rectangle = wrapper.get('[data-testid="run-cbar-rectangle"][data-cbar-id="cbar-zoom"]');
    const initialX = Number(rectangle.attributes("x"));
    expect(mocks.visibleRangeListener).not.toBeNull();

    mocks.coordinateOffset = 100;
    mocks.visibleRangeListener?.();
    const supersededFrame = mocks.animationFrameCallback;

    // A second range event before paint cancels the stale frame and schedules
    // one projection using the latest chart transforms.
    mocks.coordinateOffset = 200;
    mocks.visibleRangeListener?.();
    expect(mocks.cancelAnimationFrame).toHaveBeenCalledWith(1);
    expect(mocks.animationFrameCallback).not.toBeNull();
    expect(mocks.animationFrameCallback).not.toBe(supersededFrame);

    await nextTick();
    expect(Number(wrapper.get('[data-testid="run-cbar-rectangle"][data-cbar-id="cbar-zoom"]').attributes("x"))).toBe(initialX);

    mocks.animationFrameCallback?.(0);
    await nextTick();
    expect(Number(wrapper.get('[data-testid="run-cbar-rectangle"][data-cbar-id="cbar-zoom"]').attributes("x"))).toBe(initialX + 200);

    wrapper.unmount();
    expect(mocks.unsubscribeVisibleRangeChange).toHaveBeenCalled();
  });

  it("emits the selected SBar and authoritative structure object from chart clicks", async () => {
    const structure = {
      cbarCount: 1,
      cbars: [{
        cbarId: "cbar-click",
        high: "12",
        low: "9",
        sbarStartId: originBars[1]!.sbarId,
        sbarEndId: originBars[2]!.sbarId,
        spanSbars: 2,
        fractalType: null,
        createdAt: "2026-10-23T00:00:00Z",
      }],
      swingCount: 1,
      swings: [{
        swingId: "swing-click",
        direction: "Up",
        high: "12",
        low: "9",
        cbarStartId: "cbar-click",
        cbarEndId: "cbar-click",
        sbarStartId: originBars[1]!.sbarId,
        sbarEndId: originBars[2]!.sbarId,
        startOi: null,
        endOi: null,
        volume: "200",
        spanSbars: 2,
        state: "Confirmed",
        createdAt: "2026-10-23T00:00:00Z",
        updatedAt: "2026-10-23T00:00:00Z",
      }],
    };
    const wrapper = mount(RunChart, {
      props: { origin: origin(), testDataset: testDataset(), runState: runState(), structure },
    });
    await nextTick();
    const clickHandler = mocks.subscribeClick.mock.calls[0]?.[0] as ((param: { point?: { x: number; y: number } }) => void);
    expect(clickHandler).toBeTypeOf("function");

    clickHandler({ point: { x: 60, y: 188 } });
    expect(wrapper.emitted("objectSelect")?.at(-1)?.[0]).toEqual({
      kind: "cbar",
      id: "cbar-click",
      checkpointSbarId: originBars[1]!.sbarId,
    });

    clickHandler({ point: { x: 90, y: 100 } });
    expect(wrapper.emitted("objectSelect")?.at(-1)?.[0]).toEqual({
      kind: "sbar",
      id: originBars[2]!.sbarId,
      checkpointSbarId: originBars[1]!.sbarId,
    });

    clickHandler({ point: { x: 90, y: 189.5 } });
    expect(wrapper.emitted("objectSelect")?.at(-1)?.[0]).toEqual({
      kind: "swing",
      id: "swing-click",
      checkpointSbarId: originBars[1]!.sbarId,
    });
    wrapper.unmount();
    expect(mocks.unsubscribeClick).toHaveBeenCalledOnce();
  });

  it("does not display an Origin projection for a Test Dataset from another Origin", async () => {
    const wrapper = mount(RunChart, {
      props: {
        origin: origin(),
        testDataset: testDataset({ originDatasetId: "origin-other" }),
        runState: null,
      },
    });
    await nextTick();

    expect(wrapper.get('[data-testid="run-chart-empty"]').text())
      .toContain("currently loaded Origin");
    expect(mocks.candleSetData).toHaveBeenCalledWith([]);
    expect(mocks.volumeSetData).toHaveBeenCalledWith([]);
    expect(mocks.fitContent).not.toHaveBeenCalled();
    wrapper.unmount();
  });
});
