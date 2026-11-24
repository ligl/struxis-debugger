import { enableAutoUnmount, mount } from "@vue/test-utils";
import type { ISeriesPrimitive, Time } from "lightweight-charts";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChartSurfacePort } from "../../src/chart-surface-contract";
import ChartSurface from "../../src/components/ChartSurface.vue";
import { createInspectorChartHover } from "../../src/inspector-chart-hover";
import type { ReplayInspectorStructureDto, SBarDto } from "../../src/origin-types";
import { SBarMarkerPrimitive } from "../../src/sbar-marker-primitive";

const { createChart } = vi.hoisted(() => ({ createChart: vi.fn() }));
vi.mock("lightweight-charts", () => ({
  CandlestickSeries: { kind: "candlestick" },
  HistogramSeries: { kind: "histogram" },
  ColorType: { Solid: "solid" },
  CrosshairMode: { Normal: 0 },
  LineStyle: { Solid: 0, Dotted: 1, Dashed: 2 },
  createChart,
}));

enableAutoUnmount(afterEach);
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const firstId = "1700000000000000000";
const secondId = "1700000060000000000";
const firstBar: SBarDto = {
  sbarId: firstId, tsEvent: firstId, tsInit: firstId, barType: "TEST-1-MINUTE-LAST-EXTERNAL",
  open: "10", high: "12", low: "9", close: "11", volume: "1",
};
const secondBar: SBarDto = { ...firstBar, sbarId: secondId, tsEvent: secondId, tsInit: secondId };
const structure: ReplayInspectorStructureDto = {
  cbarCount: 1,
  cbars: [{
    cbarId: firstId, sbarStartId: firstId, sbarEndId: firstId, high: "12", low: "9",
    fractalType: null, spanSbars: 1, createdAt: firstId,
  }],
  swingCount: 0, swings: [], trendCount: 0, trends: [],
};

function mountSurface() {
  vi.stubGlobal("ResizeObserver", class {
    observe() {}
    disconnect() {}
  });
  const primitives: ISeriesPrimitive<Time>[] = [];
  const series = {
    setData: vi.fn(), applyOptions: vi.fn(),
    priceToCoordinate: (price: number) => 110 - price * 5,
    attachPrimitive: (primitive: ISeriesPrimitive<Time>) => { primitives.push(primitive); },
    detachPrimitive: vi.fn(),
  };
  const timeScale = {
    width: () => 300,
    options: () => ({ barSpacing: 10 }),
    getVisibleLogicalRange: vi.fn(() => ({ from: 0, to: 1 })),
    timeToCoordinate: (time: number) => time === 1700000000 ? 10 : 100,
    setVisibleLogicalRange: vi.fn(),
    subscribeVisibleLogicalRangeChange: vi.fn(),
    unsubscribeVisibleLogicalRangeChange: vi.fn(),
  };
  createChart.mockReturnValue({
    addSeries: () => series,
    timeScale: () => timeScale,
    priceScale: () => ({ applyOptions: vi.fn() }),
    applyOptions: vi.fn(),
    subscribeClick: vi.fn(),
    subscribeCrosshairMove: vi.fn(),
    unsubscribeClick: vi.fn(),
    unsubscribeCrosshairMove: vi.fn(),
    setCrosshairPosition: vi.fn(),
    remove: vi.fn(),
    resize: vi.fn(),
  });
  const view = mount(ChartSurface, {
    props: { sequenceId: "reference", bars: [firstBar, secondBar], structure, dataMode: "external" },
    global: { stubs: { DrawingToolbar: true } },
  });
  return { view, port: view.vm as unknown as ChartSurfacePort, primitives, timeScale };
}

describe("Inspector chart hover", () => {
  it("prefers pointer references, restores focus, and ignores a late clear from another ID", () => {
    const publish = vi.fn();
    const hover = createInspectorChartHover(publish);
    const first = Symbol("first");
    const second = Symbol("second");
    const candle = { kind: "sbar", id: firstId } as const;
    const cbar = { kind: "cbar", id: firstId } as const;

    hover.update(first, "focus", candle);
    hover.update(second, "pointer", cbar);
    hover.update(first, "pointer", null);
    expect(publish.mock.calls).toEqual([[candle], [cbar]]);
    hover.update(second, "pointer", null);
    expect(publish).toHaveBeenLastCalledWith(candle);
    hover.clear();
    expect(publish).toHaveBeenLastCalledWith(null);
  });

  it("projects exact visible candle IDs, clears with the layer, and leaves the viewport alone", async () => {
    const marker = vi.spyOn(SBarMarkerPrimitive.prototype, "update");
    const { view, timeScale } = mountSurface();
    await view.setProps({ highlightedId: { kind: "sbar", id: firstId } } as never);
    expect(marker).toHaveBeenLastCalledWith(expect.objectContaining({
      hovered: expect.objectContaining({ id: firstId }),
      selected: null,
    }));
    expect(timeScale.setVisibleLogicalRange).not.toHaveBeenCalled();

    const toggle = view.get('[data-testid="layer-toggle-sbar"]');
    await toggle.trigger("click");
    expect(marker).toHaveBeenLastCalledWith(expect.objectContaining({ hovered: null }));
    await toggle.trigger("click");
    expect(marker).toHaveBeenLastCalledWith(expect.objectContaining({ hovered: expect.objectContaining({ id: firstId }) }));

    timeScale.getVisibleLogicalRange.mockReturnValue({ from: 1, to: 2 });
    await view.setProps({ highlightedId: { kind: "sbar", id: "missing" } } as never);
    expect(marker).toHaveBeenLastCalledWith(expect.objectContaining({ hovered: null }));
    marker.mockClear();
    await view.setProps({ highlightedId: { kind: "sbar", id: firstId } } as never);
    expect(marker).not.toHaveBeenCalled();
    expect(timeScale.setVisibleLogicalRange).not.toHaveBeenCalled();
  });

  it("uses the declared ID kind and clears hover without changing selection", async () => {
    const marker = vi.spyOn(SBarMarkerPrimitive.prototype, "update");
    const { view, port, primitives } = mountSurface();
    const cbar = primitives[0] as unknown as { setInteractionState: (state: unknown) => void };
    const interaction = vi.spyOn(cbar, "setInteractionState");
    port.setStructureInteractionState(null, { kind: "cbar", id: firstId });
    await view.setProps({ highlightedId: { kind: "cbar", id: firstId } } as never);
    expect(interaction).toHaveBeenLastCalledWith(expect.objectContaining({ hoveredId: firstId, selectedId: firstId }));
    expect(marker).not.toHaveBeenCalled();

    await view.setProps({ structure: null } as never);
    expect(interaction).toHaveBeenLastCalledWith(expect.objectContaining({ hoveredId: null, selectedId: firstId }));
    await view.setProps({ structure } as never);
    expect(interaction).toHaveBeenLastCalledWith(expect.objectContaining({ hoveredId: firstId, selectedId: firstId }));
    await view.setProps({ highlightedId: null } as never);
    expect(interaction).toHaveBeenLastCalledWith(expect.objectContaining({ hoveredId: null, selectedId: firstId }));
  });
});
