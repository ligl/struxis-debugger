import { enableAutoUnmount, mount, type VueWrapper } from "@vue/test-utils";
import { defineComponent, nextTick, ref } from "vue";
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
  getVisibleLogicalRange: vi.fn(() => ({ from: -0.5, to: 5.5 })),
  setCrosshairPosition: vi.fn(),
  clearCrosshairPosition: vi.fn(),
  coordinateToPrice: vi.fn(),
  applyChartOptions: vi.fn(),
  applyPriceScaleOptions: vi.fn(),
  coordinateToLogical: vi.fn(),
  subscribeClick: vi.fn(),
  clickListener: null as ((param: { point?: { x: number; y: number } | undefined }) => void) | null,
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
      .mockReturnValueOnce({ setData: mocks.candleSetData, update: mocks.candleUpdate, priceToCoordinate: (price: number) => 200 - price, coordinateToPrice: (y: number) => 200 - y, applyOptions: vi.fn(), attachPrimitive: vi.fn(), detachPrimitive: vi.fn() })
      .mockReturnValueOnce({ setData: mocks.volumeSetData, update: mocks.volumeUpdate, applyOptions: vi.fn() }),
    priceScale: vi.fn(() => ({ applyOptions: mocks.applyPriceScaleOptions })),
    timeScale: vi.fn(() => ({
      width: () => 700,
      fitContent: mocks.fitContent,
      setVisibleLogicalRange: mocks.setVisibleLogicalRange,
      getVisibleLogicalRange: mocks.getVisibleLogicalRange,
      timeToCoordinate: (time: number) => time - 1700000000 + mocks.coordinateOffset,
      coordinateToLogical: mocks.coordinateToLogical,
      subscribeVisibleLogicalRangeChange: (listener: () => void) => { mocks.visibleRangeListener = listener; mocks.subscribeVisibleRangeChange(); },
      unsubscribeVisibleLogicalRangeChange: mocks.unsubscribeVisibleRangeChange,
    })),
    subscribeClick: (listener: (param: { point?: { x: number; y: number } | undefined }) => void) => {
      mocks.clickListener = listener;
      mocks.subscribeClick(listener);
    },
    unsubscribeClick: mocks.unsubscribeClick,
    setCrosshairPosition: mocks.setCrosshairPosition,
    clearCrosshairPosition: mocks.clearCrosshairPosition,
    subscribeCrosshairMove: (listener: (param: { point?: { x: number; y: number } | undefined }) => void) => {
      mocks.crosshairMoveListener = listener;
      mocks.subscribeCrosshairMove();
    },
    unsubscribeCrosshairMove: mocks.unsubscribeCrosshairMove,
    applyOptions: mocks.applyChartOptions,
    remove: mocks.chartRemove,
  });
}

enableAutoUnmount(afterEach);

describe("RunChart", () => {
  it("removes internal time and price axis borders", () => {
    mount(RunChart, {
      props: {
        origin: origin(),
        testDataset: testDataset(),
        runState: runState(),
      },
    });

    const chartOptions = mocks.createChart.mock.calls[0]?.[1] as {
      timeScale?: { borderColor?: string };
      rightPriceScale?: { borderColor?: string };
    };
    expect(chartOptions.timeScale?.borderColor).toBe("#121619");
    expect(chartOptions.rightPriceScale?.borderColor).toBe("#121619");
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    const nativeMatches = HTMLElement.prototype.matches;
    vi.spyOn(HTMLElement.prototype, "matches").mockImplementation(function (this: HTMLElement, selector: string) {
      // Keyboard tests model the pointer remaining over the Live chart.
      return selector === ":hover" ? true : nativeMatches.call(this, selector);
    });
    // clearAllMocks preserves mock implementations/return values. Reset the
    // viewport to its default fitted range so one test cannot leak a narrow
    // logical range into later keyboard tests.
    mocks.getVisibleLogicalRange.mockReturnValue({ from: -0.5, to: 5.5 });
    mocks.visibleRangeListener = null;
    mocks.crosshairMoveListener = null;
    mocks.clickListener = null;
    mocks.animationFrameCallback = null;
    mocks.coordinateOffset = 0;
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { mocks.animationFrameCallback = callback; return 1; });
    vi.stubGlobal("cancelAnimationFrame", mocks.cancelAnimationFrame);
    mocks.coordinateToLogical.mockImplementation((x: number) => x < 90 ? 0 : 1);
    installResizeObserverMock();
    installChartMock();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

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
    expect(wrapper.get('[data-testid="run-structure-overlay"]').attributes("style")).toContain("width: 700px");
    expect(mocks.fitContent).toHaveBeenCalledOnce();
    expect(mocks.setVisibleLogicalRange).toHaveBeenCalledWith({ from: -0.5, to: 5.5 });
    wrapper.unmount();
  });

  it("ignores keyboard navigation when the pointer and focus belong to another chart", async () => {
    const wrapper = mount(RunChart, {
      props: { origin: origin(), testDataset: testDataset(), runState: null },
    });
    await nextTick();
    const chartHost = wrapper.get('[data-testid="run-chart-canvas"]').element;
    vi.spyOn(chartHost, "matches").mockReturnValue(false);
    mocks.setVisibleLogicalRange.mockClear();
    mocks.setCrosshairPosition.mockClear();

    const event = new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true, cancelable: true });
    document.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(mocks.setVisibleLogicalRange).not.toHaveBeenCalled();
    expect(mocks.setCrosshairPosition).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("maps Vim h/j/k/l keys to the existing Replay chart navigation commands", async () => {
    const wrapper = mount(RunChart, {
      props: { origin: origin(), testDataset: testDataset(), runState: null },
    });
    await nextTick();

    const dispatchKey = (key: string) => {
      const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
      document.dispatchEvent(event);
      return event;
    };

    // l moves the crosshair one SBar to the right, just like ArrowRight.
    const right = dispatchKey("l");
    expect(right.defaultPrevented).toBe(true);
    expect(mocks.setCrosshairPosition).toHaveBeenCalledWith(11, 1700000120, expect.anything());

    // k/j preserve the existing zoom-in / zoom-out behavior of ArrowUp/ArrowDown.
    mocks.setVisibleLogicalRange.mockClear();
    const zoomIn = dispatchKey("k");
    expect(zoomIn.defaultPrevented).toBe(true);
    expect(mocks.setVisibleLogicalRange).toHaveBeenCalledOnce();

    mocks.setVisibleLogicalRange.mockClear();
    const zoomOut = dispatchKey("j");
    expect(zoomOut.defaultPrevented).toBe(true);
    expect(mocks.setVisibleLogicalRange).toHaveBeenCalledOnce();

    // h maps to ArrowLeft and is bounded at the first Test SBar.
    const left = dispatchKey("h");
    expect(left.defaultPrevented).toBe(true);
    wrapper.unmount();
  });

  it("sets Restart to SBar from the crosshair X on double-click anywhere in the chart area", async () => {
    const wrapper = mount(RunChart, {
      props: { origin: origin(), testDataset: testDataset(), runState: null, targetSbarId: null },
    }) as VueWrapper<any>;
    await nextTick();

    const stage = wrapper.get(".run-chart-stage");

    // A normal single click keeps its existing Inspector/object-selection role
    // and must not set a Restart target.
    mocks.clickListener?.({ point: { x: 60, y: 150 } });
    await nextTick();
    expect(wrapper.emitted("objectSelect")?.[0]?.[0]).toMatchObject({
      kind: "sbar",
      id: originBars[1]!.sbarId,
      checkpointSbarId: null,
    });
    expect(wrapper.emitted("targetSelect")).toBeUndefined();

    // Double-clicking at a different Y coordinate still resolves by the
    // crosshair's vertical X coordinate, mapping Test Dataset logical index 1.
    stage.element.dispatchEvent(new MouseEvent("dblclick", {
      bubbles: true,
      cancelable: true,
      clientX: 100,
      clientY: 20,
    }));
    await nextTick();
    expect(wrapper.emitted("targetSelect")?.[0]).toEqual([originBars[2]!.sbarId]);

    // The existing right-click cancellation remains target-only.
    await wrapper.setProps({ targetSbarId: originBars[2]!.sbarId });
    const contextEvent = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
    stage.element.dispatchEvent(contextEvent);
    expect(contextEvent.defaultPrevented).toBe(true);
    expect(wrapper.emitted("targetCancel")).toHaveLength(1);

    // T toggles the pending target off, matching right-click cancellation,
    // and does not depend on a currently valid crosshair position.
    const targetToggleEvent = new KeyboardEvent("keydown", {
      key: "t",
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(targetToggleEvent);
    expect(targetToggleEvent.defaultPrevented).toBe(true);
    expect(wrapper.emitted("targetCancel")).toHaveLength(2);
    expect(wrapper.emitted("targetSelect")).toHaveLength(1);
    wrapper.unmount();
  });

  it("does not set a Restart target when a double-click maps outside the Test Dataset", async () => {
    const wrapper = mount(RunChart, {
      props: { origin: origin(), testDataset: testDataset(), runState: null },
    });
    await nextTick();
    mocks.coordinateToLogical.mockReturnValue(5);
    wrapper.get(".run-chart-stage").element.dispatchEvent(new MouseEvent("dblclick", {
      bubbles: true,
      cancelable: true,
      clientX: 200,
      clientY: 200,
    }));
    expect(wrapper.emitted("targetSelect")).toBeUndefined();
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

  it("projects a Snapshot crosshair onto the matching Live SBar", async () => {
    mount(RunChart, {
      props: {
        origin: origin(),
        testDataset: testDataset(),
        runState: null,
        syncEnabled: true,
        crosshairSync: {
          revision: 1,
          source: "reference",
          sbarId: originBars[1]!.sbarId,
          price: 10.5,
        },
      },
    });
    await nextTick();

    expect(mocks.setCrosshairPosition).toHaveBeenCalledWith(
      10.5,
      1700000060,
      expect.anything(),
    );
  });

  it("publishes the hovered SBar identity and price for eligible crosshair synchronization", async () => {
    const wrapper = mount(RunChart, {
      props: { origin: origin(), testDataset: testDataset(), runState: null, syncEnabled: true },
    });
    await nextTick();

    mocks.coordinateToLogical.mockReturnValue(0);
    mocks.crosshairMoveListener?.({ point: { x: 60, y: 190 } });
    await nextTick();
    expect(wrapper.emitted("crosshairChange")?.at(-1)?.[0]).toEqual({
      source: "live",
      sbarId: originBars[1]!.sbarId,
      price: 10,
    });

    mocks.crosshairMoveListener?.({ point: undefined });
    await nextTick();
    expect(wrapper.emitted("crosshairChange")?.at(-1)?.[0]).toEqual({
      source: "live",
      sbarId: null,
      price: null,
    });
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
    }) as VueWrapper<any>;
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


  it("cancels the pending selected-crosshair frame when the chart unmounts", async () => {
    const wrapper = mount(RunChart, {
      props: { origin: origin(), testDataset: testDataset(), runState: runState() },
    });
    await nextTick();

    const event = new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true });
    document.dispatchEvent(event);
    expect(mocks.setCrosshairPosition).toHaveBeenCalled();
    expect(mocks.animationFrameCallback).not.toBeNull();

    wrapper.unmount();

    expect(mocks.cancelAnimationFrame).toHaveBeenCalledWith(1);
    expect(mocks.chartRemove).toHaveBeenCalled();
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

    // A second range event reuses the pending frame. The callback samples the
    // latest chart transforms instead of cancelling/restarting and risking starvation.
    mocks.coordinateOffset = 200;
    mocks.visibleRangeListener?.();
    expect(mocks.cancelAnimationFrame).not.toHaveBeenCalled();
    expect(mocks.animationFrameCallback).toBe(supersededFrame);

    await nextTick();
    expect(Number(wrapper.get('[data-testid="run-cbar-rectangle"][data-cbar-id="cbar-zoom"]').attributes("x"))).toBe(initialX);

    mocks.animationFrameCallback?.(0);
    await nextTick();
    expect(Number(wrapper.get('[data-testid="run-cbar-rectangle"][data-cbar-id="cbar-zoom"]').attributes("x"))).toBe(initialX + 200);

    wrapper.unmount();
    expect(mocks.unsubscribeVisibleRangeChange).toHaveBeenCalled();
  });

  it("preserves a locally moved Crosshair when a peer clear arrives", async () => {
    const wrapper = mount(RunChart, {
      props: {
        origin: origin(),
        testDataset: testDataset(),
        runState: runState(),
        syncEnabled: true,
        crosshairSync: {
          revision: 1,
          source: "reference",
          sbarId: originBars[1]!.sbarId,
          price: 10.5,
        },
      },
    });
    await nextTick();
    expect(mocks.setCrosshairPosition).toHaveBeenCalled();

    // Local pointer movement takes ownership away from the peer-installed position.
    mocks.crosshairMoveListener?.({ point: { x: 60, y: 100 } });
    mocks.clearCrosshairPosition.mockClear();
    await wrapper.setProps({
      crosshairSync: {
        revision: 2,
        source: "reference",
        sbarId: null,
        price: null,
      },
    } as never);
    await nextTick();

    expect(mocks.clearCrosshairPosition).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("does not publish a queued viewport from the previous Replay identity", async () => {
    const liveTestDataset = ref(testDataset());
    const liveRunState = ref(runState());
    const Host = defineComponent({
      components: { RunChart },
      setup() {
        return {
          origin: origin(),
          testDataset: liveTestDataset,
          runState: liveRunState,
        };
      },
      template: '<RunChart :origin="origin" :test-dataset="testDataset" :run-state="runState" :sync-enabled="true" />',
    });
    const host = mount(Host);
    const wrapper = host.getComponent(RunChart);
    await nextTick();

    mocks.getVisibleLogicalRange.mockReturnValue({ from: 1.25, to: 4.25 });
    mocks.visibleRangeListener?.();
    mocks.getVisibleLogicalRange.mockReturnValue({ from: 6.5, to: 9.75 });
    liveTestDataset.value = testDataset({ testDatasetId: "test-2" });
    liveRunState.value = runState({ testDatasetId: "test-2", runId: "run-2" });
    await nextTick();

    mocks.animationFrameCallback?.(0);
    await nextTick();
    const published = wrapper.emitted("viewportChange")?.map(([value]) => value);
    expect(published).not.toContainEqual({ source: "live", from: 1.25, to: 4.25 });
    expect(published).toContainEqual({ source: "live", from: 6.5, to: 9.75 });
    host.unmount();
  });

  it("suppresses the applied Snapshot viewport echo but publishes the next local Live range", async () => {
    const wrapper = mount(RunChart, {
      props: {
        origin: origin(),
        testDataset: testDataset(),
        runState: runState(),
        syncEnabled: true,
        syncOffset: 10,
        syncRequest: {
          revision: 1,
          source: "reference",
          from: 10.25,
          to: 14.75,
          offset: 10,
        },
      },
    });
    await nextTick();

    expect(mocks.setVisibleLogicalRange).toHaveBeenLastCalledWith({ from: 0.25, to: 4.75 });

    // Lightweight Charts reports the peer-applied range back through the same
    // listener. It must be consumed as an echo, not sent back to the workspace.
    mocks.getVisibleLogicalRange.mockReturnValue({ from: 0.25, to: 4.75 });
    mocks.visibleRangeListener?.();
    mocks.animationFrameCallback?.(0);
    await nextTick();
    expect(wrapper.emitted("viewportChange")).toBeUndefined();

    // A subsequent real Live gesture must still publish normally.
    mocks.getVisibleLogicalRange.mockReturnValue({ from: 1.5, to: 5.25 });
    mocks.visibleRangeListener?.();
    mocks.animationFrameCallback?.(0);
    await nextTick();
    expect(wrapper.emitted("viewportChange")).toEqual([[
      { source: "live", from: 1.5, to: 5.25 },
    ]]);
    wrapper.unmount();
  });

  it("coalesces Live viewport sync to the latest range in the pending render frame", async () => {
    const wrapper = mount(RunChart, {
      props: {
        origin: origin(),
        testDataset: testDataset(),
        runState: runState(),
        syncEnabled: true,
      },
    });
    await nextTick();

    mocks.getVisibleLogicalRange.mockReturnValue({ from: 1.25, to: 4.25 });
    mocks.visibleRangeListener?.();
    mocks.getVisibleLogicalRange.mockReturnValue({ from: 2.5, to: 5.75 });
    mocks.visibleRangeListener?.();

    // The one pending frame publishes the latest raw fractional range only.
    mocks.animationFrameCallback?.(0);
    await nextTick();
    expect(wrapper.emitted("viewportChange")).toEqual([[
      { source: "live", from: 2.5, to: 5.75 },
    ]]);

    wrapper.unmount();
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

  it("moves the crosshair with left/right arrows and uses it as the Restart target with T", async () => {
    const wrapper = mount(RunChart, {
      props: { origin: origin(), testDataset: testDataset(), runState: runState() },
    });
    await nextTick();

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }));
    expect(mocks.setCrosshairPosition).toHaveBeenCalledWith(
      11,
      1700000120,
      expect.anything(),
    );

    const targetEvent = new KeyboardEvent("keydown", { key: "t", bubbles: true, cancelable: true });
    document.dispatchEvent(targetEvent);
    expect(targetEvent.defaultPrevented).toBe(true);
    expect(wrapper.emitted("targetSelect")?.at(-1)?.[0]).toBe(originBars[2]!.sbarId);
    wrapper.unmount();
  });

  it("repeats held horizontal arrows and scrolls the selected candle into view", async () => {
    const wrapper = mount(RunChart, {
      props: {
        origin: origin(),
        testDataset: testDataset(),
        runState: runState({ cursorSbarId: originBars[2]!.sbarId }),
      },
    });
    await nextTick();

    // The crosshair starts on the second (last) Test Dataset SBar. Holding
    // Left emits repeated keydown events, which must continue moving it.
    mocks.getVisibleLogicalRange.mockReturnValue({ from: 1, to: 4 });
    mocks.setVisibleLogicalRange.mockClear();
    const event = new KeyboardEvent("keydown", {
      key: "ArrowLeft",
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(event, "repeat", { value: true });
    document.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(mocks.setCrosshairPosition).toHaveBeenCalledWith(
      11,
      1700000060,
      expect.anything(),
    );
    expect(mocks.setVisibleLogicalRange).toHaveBeenCalledOnce();
    const range = mocks.setVisibleLogicalRange.mock.calls[0]![0] as { from: number; to: number };
    expect(range.from).toBeLessThan(1);
    expect(range.to).toBeLessThan(4);
    mocks.getVisibleLogicalRange.mockReturnValue({ from: -0.5, to: 5.5 });
    wrapper.unmount();
  });

  it("Ctrl+Left and Ctrl+Right locate the first and last Test Dataset candles", async () => {
    const wrapper = mount(RunChart, {
      props: { origin: origin(), testDataset: testDataset(), runState: runState() },
    });
    await nextTick();

    mocks.setCrosshairPosition.mockClear();
    mocks.setVisibleLogicalRange.mockClear();

    const startEvent = new KeyboardEvent("keydown", {
      key: "ArrowLeft",
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(startEvent);
    expect(startEvent.defaultPrevented).toBe(true);
    expect(mocks.setCrosshairPosition).toHaveBeenCalledWith(
      11,
      1700000060,
      expect.anything(),
    );

    mocks.setCrosshairPosition.mockClear();
    const endEvent = new KeyboardEvent("keydown", {
      key: "ArrowRight",
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(endEvent);
    expect(endEvent.defaultPrevented).toBe(true);
    expect(mocks.setCrosshairPosition).toHaveBeenCalledWith(
      11,
      1700000120,
      expect.anything(),
    );

    // An out-of-dataset pointer coordinate must not erase the keyboard
    // navigation anchor and fall back to the backend cursor (the first bar).
    mocks.crosshairMoveListener?.({ point: { x: 999, y: 50 } });
    mocks.setCrosshairPosition.mockClear();
    const beyondEndEvent = new KeyboardEvent("keydown", {
      key: "ArrowRight", bubbles: true, cancelable: true,
    });
    document.dispatchEvent(beyondEndEvent);
    expect(beyondEndEvent.defaultPrevented).toBe(false);
    expect(mocks.setCrosshairPosition).not.toHaveBeenCalled();

    wrapper.unmount();
  });

  it("keeps Ctrl boundary navigation inside the dataset when only part of it is visible", async () => {
    const wrapper = mount(RunChart, {
      props: { origin: origin(), testDataset: testDataset(), runState: runState() },
    });
    await nextTick();

    // Simulate a narrow viewport that does not show the full Test Dataset.
    mocks.getVisibleLogicalRange.mockReturnValue({ from: 0.5, to: 1.5 });
    mocks.setVisibleLogicalRange.mockClear();

    const startEvent = new KeyboardEvent("keydown", {
      key: "ArrowLeft", ctrlKey: true, bubbles: true, cancelable: true,
    });
    document.dispatchEvent(startEvent);
    const startRange = mocks.setVisibleLogicalRange.mock.calls.at(-1)?.[0] as { from: number; to: number };
    expect(startRange.from).toBeGreaterThanOrEqual(-0.5);
    expect(startRange.from).toBeLessThanOrEqual(0);
    expect(startRange.to).toBeGreaterThan(0);
    expect(mocks.setCrosshairPosition).toHaveBeenLastCalledWith(11, 1700000060, expect.anything());

    // Put the viewport at the first-candle boundary so Ctrl+Right must
    // scroll it to reveal the final candle.
    mocks.getVisibleLogicalRange.mockReturnValue({ from: -0.5, to: 0.5 });
    mocks.setVisibleLogicalRange.mockClear();
    const endEvent = new KeyboardEvent("keydown", {
      key: "ArrowRight", ctrlKey: true, bubbles: true, cancelable: true,
    });
    document.dispatchEvent(endEvent);
    const endRange = mocks.setVisibleLogicalRange.mock.calls.at(-1)?.[0] as { from: number; to: number };
    expect(endRange.from).toBeLessThan(1);
    expect(endRange.to).toBeGreaterThanOrEqual(1);
    expect(endRange.to).toBeLessThanOrEqual(1.5);
    expect(mocks.setCrosshairPosition).toHaveBeenLastCalledWith(11, 1700000120, expect.anything());

    wrapper.unmount();
  });

  it("zooms the visible logical range with up/down arrows", async () => {
    const wrapper = mount(RunChart, {
      props: { origin: origin(), testDataset: testDataset(), runState: runState() },
    });
    await nextTick();
    mocks.setVisibleLogicalRange.mockClear();

    const zoomInEvent = new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true, cancelable: true });
    document.dispatchEvent(zoomInEvent);
    expect(zoomInEvent.defaultPrevented).toBe(true);
    expect(mocks.setVisibleLogicalRange).toHaveBeenCalledOnce();
    const zoomedIn = mocks.setVisibleLogicalRange.mock.calls[0]![0] as { from: number; to: number };
    expect(zoomedIn.to - zoomedIn.from).toBeLessThan(6);

    const zoomOutEvent = new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true });
    document.dispatchEvent(zoomOutEvent);
    expect(zoomOutEvent.defaultPrevented).toBe(true);
    expect(mocks.setVisibleLogicalRange).toHaveBeenCalledTimes(2);
    expect(mocks.setVisibleLogicalRange.mock.calls[1]![0].to - mocks.setVisibleLogicalRange.mock.calls[1]![0].from)
      .toBeGreaterThan(zoomedIn.to - zoomedIn.from);
    wrapper.unmount();
  });

  it("renders a stable default empty state when no Test Dataset is selected", async () => {
    const wrapper = mount(RunChart, {
      props: {
        origin: origin(),
        testDataset: null,
        runState: null,
      },
    });
    await nextTick();

    expect(wrapper.get('[data-testid="run-chart-empty"]').text()).toContain("LIVE REPLAY DATA NOT LOADED");
    expect(wrapper.get('[data-testid="run-chart-empty"]').text()).toContain("Create a Test Dataset");
    expect(wrapper.get('[aria-label="Replay data workflow"]').text()).toContain("LOAD ORIGIN");
    expect(wrapper.get('[data-testid="run-chart-canvas"]').classes()).toContain("is-empty");
    expect(wrapper.find('[data-testid="run-structure-overlay"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="run-layer-toggle-sbar"]').exists()).toBe(false);
    expect(mocks.candleSetData).toHaveBeenCalledWith([]);
    expect(mocks.volumeSetData).toHaveBeenCalledWith([]);
    expect(mocks.fitContent).not.toHaveBeenCalled();
    wrapper.unmount();
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

  it("culls Live CBar and Swing overlays outside the visible logical range", async () => {
    const extendedBars = Array.from({ length: 8 }, (_, index) => {
      const ts = (1700000000000000000n + BigInt(index) * 60000000000n).toString();
      return bar(ts, ts);
    });
    const extendedOrigin: OriginDatasetDto = {
      ...origin(),
      bars: extendedBars,
      sbarCount: extendedBars.length,
      firstSbarId: extendedBars[0]!.sbarId,
      lastSbarId: extendedBars[extendedBars.length - 1]!.sbarId,
      firstTsEvent: extendedBars[0]!.tsEvent,
      lastTsEvent: extendedBars[extendedBars.length - 1]!.tsEvent,
    };
    mocks.getVisibleLogicalRange.mockReturnValue({ from: 0, to: 1 });
    const wrapper = mount(RunChart, {
      props: {
        origin: extendedOrigin,
        testDataset: testDataset({
          startSbarId: extendedBars[0]!.sbarId,
          endSbarId: extendedBars[7]!.sbarId,
          sbarCount: extendedBars.length,
        }),
        runState: null,
        structure: {
          cbarCount: 2,
          cbars: [
            { cbarId: "cbar-visible", sbarStartId: extendedBars[1]!.sbarId, sbarEndId: extendedBars[2]!.sbarId, high: "12", low: "9", spanSbars: 2, fractalType: null, createdAt: "2026-10-25 12:00:00" },
            { cbarId: "cbar-offscreen", sbarStartId: extendedBars[5]!.sbarId, sbarEndId: extendedBars[6]!.sbarId, high: "12", low: "9", spanSbars: 2, fractalType: null, createdAt: "2026-10-25 12:00:00" },
          ],
          swingCount: 2,
          swings: [
            { swingId: "swing-visible", direction: "Up", high: "12", low: "9", cbarStartId: "cbar-visible", cbarEndId: "cbar-visible", sbarStartId: extendedBars[1]!.sbarId, sbarEndId: extendedBars[2]!.sbarId, startOi: null, endOi: null, volume: "100", spanSbars: 2, state: "Confirmed", createdAt: "2026-10-25 12:00:00", updatedAt: "2026-10-25 12:00:00" },
            { swingId: "swing-offscreen", direction: "Up", high: "12", low: "9", cbarStartId: "cbar-offscreen", cbarEndId: "cbar-offscreen", sbarStartId: extendedBars[5]!.sbarId, sbarEndId: extendedBars[6]!.sbarId, startOi: null, endOi: null, volume: "100", spanSbars: 2, state: "Confirmed", createdAt: "2026-10-25 12:00:00", updatedAt: "2026-10-25 12:00:00" },
          ],
        },
      },
    });
    await nextTick();

    expect(wrapper.findAll('[data-testid="run-cbar-rectangle"]').map((node) => node.attributes("data-cbar-id")))
      .toEqual(["cbar-visible"]);
    expect(wrapper.findAll('[data-testid="run-swing-segment"]').map((node) => node.attributes("data-swing-id")))
      .toEqual(["swing-visible"]);
    wrapper.unmount();
  });

});
