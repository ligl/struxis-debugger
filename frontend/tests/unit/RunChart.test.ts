import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RunChart from "../../src/components/RunChart.vue";
import type { OriginDatasetDto, RunStateDto, SBarDto, TestDatasetDto } from "../../src/origin-types";

const mocks = vi.hoisted(() => ({
  createChart: vi.fn(),
  candleSetData: vi.fn(),
  volumeSetData: vi.fn(),
  chartRemove: vi.fn(),
  fitContent: vi.fn(),
  setVisibleLogicalRange: vi.fn(),
  applyChartOptions: vi.fn(),
  applyPriceScaleOptions: vi.fn(),
  observe: vi.fn(),
  disconnect: vi.fn(),
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
      .mockReturnValueOnce({ setData: mocks.candleSetData, priceToCoordinate: (price: number) => 200 - price, applyOptions: vi.fn() })
      .mockReturnValueOnce({ setData: mocks.volumeSetData, applyOptions: vi.fn() }),
    priceScale: vi.fn(() => ({ applyOptions: mocks.applyPriceScaleOptions })),
    timeScale: vi.fn(() => ({
      fitContent: mocks.fitContent,
      setVisibleLogicalRange: mocks.setVisibleLogicalRange,
      timeToCoordinate: (time: number) => time - 1700000000,
      subscribeVisibleLogicalRangeChange: vi.fn(),
      unsubscribeVisibleLogicalRangeChange: vi.fn(),
    })),
    applyOptions: mocks.applyChartOptions,
    remove: mocks.chartRemove,
  });
}

describe("RunChart", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it("dims future input bars and reports only backend-confirmed cursor progress", async () => {
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
    expect(wrapper.get(".run-chart-foot").text()).toContain("1 / 2 PROCESSED");
    expect(wrapper.get(".run-chart-cursor").text()).toContain(originBars[1]!.sbarId);
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
      props: { origin: origin(), testDataset: testDataset(), runState: runState(), structure },
    });
    await nextTick();

    expect(wrapper.find('[data-testid="run-cbar-rectangle"][data-cbar-id="cbar-1"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="run-swing-segment"][data-swing-id="swing-1"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="run-layer-toggle-cbar"]').attributes("aria-pressed")).toBe("true");

    await wrapper.get('[data-testid="run-layer-toggle-cbar"]').trigger("click");
    await nextTick();
    expect(wrapper.find('[data-testid="run-cbar-rectangle"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="run-layer-toggle-cbar"]').attributes("aria-pressed")).toBe("false");

    await wrapper.get('[data-testid="run-chart-fit"]').trigger("click");
    expect(mocks.fitContent).toHaveBeenCalledTimes(2);
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
});
