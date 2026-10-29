import { describe, expect, it, vi } from "vitest";
import { createChartPrimitiveHost } from "../../src/sbar-chart-primitive-host";
import {
  registerCBarPrimitive,
  registerSwingPrimitive,
  syncStructurePrimitiveControllers,
} from "../../src/sbar-chart-structure-primitives";
import type { ISeriesApi, ISeriesPrimitive, Time } from "lightweight-charts";
import { alignStrokeCoordinate } from "../../src/chart-canvas-pixel-alignment";

function createHarness() {
  const times = new Map<Time, number>([
    ["2026-01-01", 10],
    ["2026-01-02", 30],
    ["2026-01-03", 50],
  ]);
  const chart = {
    timeScale: () => ({
      options: () => ({ barSpacing: 10 }),
      getVisibleLogicalRange: () => ({ from: 0, to: 2 }),
      timeToCoordinate: (time: Time) => times.get(time) ?? null,
    }),
  };
  const context = {
    save: vi.fn(),
    restore: vi.fn(),
    strokeRect: vi.fn(),
    setLineDash: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    strokeStyle: "",
    lineWidth: 0,
    lineCap: "butt",
  };
  const target = {
    useMediaCoordinateSpace: (callback: (arg: { context: typeof context; mediaSize: { width: number; height: number } }) => void) => callback({ context, mediaSize: { width: 100, height: 100 } }),
  };
  const attached: ISeriesPrimitive<Time>[] = [];
  const series = {
    priceToCoordinate: (price: number) => 100 - price,
    attachPrimitive: (primitive: ISeriesPrimitive<Time>) => {
      attached.push(primitive);
      primitive.attached?.({
        chart: chart as never,
        series: series as never,
        requestUpdate: vi.fn(),
      } as never);
    },
    detachPrimitive: (primitive: ISeriesPrimitive<Time>) => {
      const index = attached.indexOf(primitive);
      if (index >= 0) attached.splice(index, 1);
      primitive.detached?.();
    },
  } as unknown as ISeriesApi<"Candlestick">;
  const host = createChartPrimitiveHost();
  host.attach();
  const projection = {
    timeBySbarId: new Map<string, Time>([
      ["s1", "2026-01-01"],
      ["s2", "2026-01-02"],
      ["s3", "2026-01-03"],
    ]),
    indexBySbarId: new Map<string, number>([["s1", 0], ["s2", 1], ["s3", 2]]),
  };
  return { host, series, attached, projection, context, target, times };
}

describe("CBar and Swing Series Primitives", () => {
  it("aligns stroke centerlines so their outer edges land on physical-pixel boundaries", () => {
    // A one-CSS-pixel stroke at DPR 1 needs half-pixel centerlines.
    expect(alignStrokeCoordinate(80, 1, 1)).toBe(80.5);
    expect(alignStrokeCoordinate(80.5, 1, 1)).toBe(80.5);

    // At DPR 2, a one-CSS-pixel stroke is two physical pixels wide and aligns
    // to integer CSS coordinates.
    expect(alignStrokeCoordinate(80.1, 1, 2)).toBe(80);
    expect(alignStrokeCoordinate(80.4, 1, 2)).toBe(80.5);

    // Keep the alignment tied to the active stroke width for hover/selection.
    expect(alignStrokeCoordinate(80, 2, 1)).toBe(80);
    expect(alignStrokeCoordinate(80, 1.75, 1)).toBe(79.875);
  });

  it("draws CBar rectangles from the current chart coordinates and clears replaced snapshots", () => {
    const h = createHarness();
    const controller = registerCBarPrimitive(h.host, h.series);
    controller.setData([{
      cbarId: "cbar-1",
      sbarStartId: "s1",
      sbarEndId: "s2",
      high: "20",
      low: "10",
    }], h.projection);

    const primitive = h.attached[0]!;
    const view = primitive.paneViews?.()[0];
    const renderer = view?.renderer();
    expect(renderer).not.toBeNull();
    renderer!.draw(h.target as never);
    expect(h.context.strokeRect).toHaveBeenCalledWith(6.5, 80.5, 27, 10);

    const rectangleStyles: Array<{ color: string; width: number }> = [];
    h.context.strokeRect.mockImplementation(() => {
      rectangleStyles.push({ color: h.context.strokeStyle, width: h.context.lineWidth });
    });
    controller.setPlaybackState({ enabled: true, offset: 0, processedCount: 1, liveCount: 3 });
    rectangleStyles.length = 0;
    renderer!.draw(h.target as never);
    expect(rectangleStyles).toContainEqual({ color: "#42484e", width: 1 });
    controller.setPlaybackState({ enabled: true, offset: 0, processedCount: 2, liveCount: 3 });
    rectangleStyles.length = 0;
    renderer!.draw(h.target as never);
    expect(rectangleStyles).toContainEqual({ color: "#858D97", width: 1 });

    controller.setInteractionState({ hoveredId: "cbar-1", selectedId: null });
    renderer!.draw(h.target as never);
    expect(rectangleStyles).toContainEqual({ color: "#C3CBD1", width: 1.75 });
    rectangleStyles.length = 0;
    controller.setInteractionState({ hoveredId: null, additionalHoveredIds: ["cbar-1"], selectedId: null });
    renderer!.draw(h.target as never);
    expect(rectangleStyles).toContainEqual({ color: "#C3CBD1", width: 1.75 });
    rectangleStyles.length = 0;
    controller.setInteractionState({ hoveredId: "cbar-1", selectedId: "cbar-1" });
    renderer!.draw(h.target as never);
    expect(rectangleStyles).toContainEqual({ color: "#D99A45", width: 2 });
    rectangleStyles.length = 0;
    controller.setInteractionState({ hoveredId: null, selectedId: null, additionalSelectedIds: ["cbar-1"] });
    renderer!.draw(h.target as never);
    expect(rectangleStyles).toContainEqual({ color: "#D99A45", width: 2 });

    // Replacing the authoritative snapshot with a revised object of the same
    // stable ID must reproject its new anchors/prices, not append or retain old geometry.
    h.context.strokeRect.mockClear();
    h.times.set("2026-01-02", 40);
    controller.setData([{
      cbarId: "cbar-1",
      sbarStartId: "s1",
      sbarEndId: "s2",
      high: "30",
      low: "10",
    }], h.projection);
    primitive.updateAllViews?.();
    view?.renderer()?.draw(h.target as never);
    expect(h.context.strokeRect).toHaveBeenCalledWith(7, 70, 37, 20);

    controller.setData([], h.projection);
    primitive.updateAllViews?.();
    expect(view?.renderer()).toBeNull();
    h.host.dispose();
    expect(h.attached).toHaveLength(0);
  });

  it("draws Swing segments with direction and state styling, and honors visibility", () => {
    const h = createHarness();
    const controller = registerSwingPrimitive(h.host, h.series);
    controller.setData([{
      swingId: "swing-1",
      sbarStartId: "s1",
      sbarEndId: "s3",
      high: "30",
      low: "10",
      direction: "Up",
      state: "Tentative",
    }], h.projection);

    const primitive = h.attached[0]!;
    const view = primitive.paneViews?.()[0];
    const renderer = view?.renderer();
    expect(renderer).not.toBeNull();
    renderer!.draw(h.target as never);
    expect(h.context.moveTo).toHaveBeenCalledWith(10, 90);
    expect(h.context.lineTo).toHaveBeenCalledWith(50, 70);
    expect(h.context.strokeStyle).toBe("#D6A85D");
    expect(h.context.setLineDash).toHaveBeenCalledWith([6, 3]);

    controller.setPlaybackState({ enabled: true, offset: 0, processedCount: 1, liveCount: 3 });
    view?.renderer()?.draw(h.target as never);
    expect(h.context.strokeStyle).toBe("#645336");
    controller.setPlaybackState({ enabled: true, offset: 0, processedCount: 3, liveCount: 3 });
    view?.renderer()?.draw(h.target as never);
    expect(h.context.strokeStyle).toBe("#D6A85D");

    // Confirmed Swing uses the normative default Swing token and a solid stroke.
    controller.setData([{
      swingId: "swing-1",
      sbarStartId: "s1",
      sbarEndId: "s3",
      high: "30",
      low: "10",
      direction: "Up",
      state: "Confirmed",
    }], h.projection);
    view?.renderer()?.draw(h.target as never);
    expect(h.context.strokeStyle).toBe("#C6A06B");
    expect(h.context.setLineDash).toHaveBeenCalledWith([]);

    const segmentStyles: Array<{ color: string; width: number }> = [];
    h.context.stroke.mockImplementation(() => {
      segmentStyles.push({ color: h.context.strokeStyle, width: h.context.lineWidth });
    });
    controller.setInteractionState({ hoveredId: "swing-1", selectedId: null });
    view?.renderer()?.draw(h.target as never);
    expect(segmentStyles).toContainEqual({ color: "#C3CBD1", width: 2 });
    segmentStyles.length = 0;
    controller.setInteractionState({ hoveredId: "swing-1", selectedId: "swing-1" });
    view?.renderer()?.draw(h.target as never);
    expect(segmentStyles).toContainEqual({ color: "#D99A45", width: 2.5 });

    // Extending's arrowhead must retain the same hover / selection emphasis
    // as the dashed segment instead of reverting to its pale state color.
    controller.setData([{
      swingId: "swing-1",
      sbarStartId: "s1",
      sbarEndId: "s3",
      high: "30",
      low: "10",
      direction: "Up",
      state: "Extending",
    }], h.projection);
    segmentStyles.length = 0;
    controller.setInteractionState({ hoveredId: "swing-1", selectedId: null });
    view?.renderer()?.draw(h.target as never);
    expect(segmentStyles.length).toBeGreaterThan(0);
    expect(segmentStyles.every((style) => style.color === "#C3CBD1" && style.width === 2)).toBe(true);
    segmentStyles.length = 0;
    controller.setInteractionState({ hoveredId: null, selectedId: "swing-1" });
    view?.renderer()?.draw(h.target as never);
    expect(segmentStyles.length).toBeGreaterThan(0);
    expect(segmentStyles.every((style) => style.color === "#D99A45" && style.width === 2.5)).toBe(true);

    controller.setVisible(false);
    expect(view?.renderer()).toBeNull();
    controller.setVisible(true);
    expect(view?.renderer()).not.toBeNull();
    h.host.dispose();
  });
});

describe("syncStructurePrimitiveControllers", () => {
  it("replaces complete snapshots and applies visibility plus interaction state in one pass", () => {
    const cbar = {
      setData: vi.fn(),
      setVisible: vi.fn(),
      setInteractionState: vi.fn(),
      setPlaybackState: vi.fn(),
    };
    const swing = {
      setData: vi.fn(),
      setVisible: vi.fn(),
      setInteractionState: vi.fn(),
      setPlaybackState: vi.fn(),
    };
    const cbars = [{ cbarId: "c1", sbarStartId: "s1", sbarEndId: "s2", high: "12", low: "8" }];
    const swings = [{
      swingId: "sw1",
      sbarStartId: "s1",
      sbarEndId: "s2",
      high: "12",
      low: "8",
      direction: "Up",
      state: "Confirmed",
    }];
    const projection = {
      timeBySbarId: new Map<string, Time>(),
      indexBySbarId: new Map<string, number>(),
    };

    syncStructurePrimitiveControllers({
      cbar: cbar as never,
      swing: swing as never,
      trend: { setData: vi.fn(), setVisible: vi.fn(), setInteractionState: vi.fn(), setPlaybackState: vi.fn() } as never,
      cbars,
      swings,
      trends: [],
      projection,
      cbarVisible: false,
      swingVisible: true,
      trendVisible: false,
      interaction: {
        hovered: { kind: "swing", id: "sw1" },
        hoveredCbarIds: ["c1", "c2"],
        selected: { kind: "cbar", id: "c1" },
        selectedCbarIds: ["c2"],
        selectedColor: "#D6A85D",
        cbarSelectedWidth: 2,
        swingSelectedWidth: 2.25,
      },
    });

    expect(cbar.setData).toHaveBeenCalledWith(cbars, projection);
    expect(swing.setData).toHaveBeenCalledWith(swings, projection);
    expect(cbar.setVisible).toHaveBeenCalledWith(false);
    expect(swing.setVisible).toHaveBeenCalledWith(true);
    expect(cbar.setPlaybackState).toHaveBeenCalledWith({ enabled: false, offset: null, processedCount: 0, liveCount: 0 });
    expect(swing.setPlaybackState).toHaveBeenCalledWith({ enabled: false, offset: null, processedCount: 0, liveCount: 0 });
    expect(cbar.setInteractionState).toHaveBeenCalledWith({
      hoveredId: null,
      additionalHoveredIds: ["c1", "c2"],
      selectedId: "c1",
      additionalSelectedIds: ["c2"],
      selectedColor: "#D6A85D",
      selectedWidth: 2,
    });
    expect(swing.setInteractionState).toHaveBeenCalledWith({
      hoveredId: "sw1",
      selectedId: null,
      selectedColor: "#D6A85D",
      selectedWidth: 2.25,
    });

    // A subsequent snapshot can remove every object. It must be applied even
    // when callers reuse the same projection map.
    syncStructurePrimitiveControllers({
      cbar: cbar as never,
      swing: swing as never,
      trend: null,
      cbars: [],
      swings: [],
      trends: [],
      projection,
      cbarVisible: false,
      swingVisible: false,
      trendVisible: false,
    });
    expect(cbar.setData).toHaveBeenLastCalledWith([], projection);
    expect(swing.setData).toHaveBeenLastCalledWith([], projection);
  });
});
