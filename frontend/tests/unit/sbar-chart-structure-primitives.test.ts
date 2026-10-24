import { describe, expect, it, vi } from "vitest";
import { createChartPrimitiveHost } from "../../src/sbar-chart-primitive-host";
import {
  registerCBarPrimitive,
  registerSwingPrimitive,
} from "../../src/sbar-chart-structure-primitives";
import type { ISeriesApi, ISeriesPrimitive, Time } from "lightweight-charts";

function createHarness() {
  const times = new Map<Time, number>([
    ["2026-01-01", 10],
    ["2026-01-02", 30],
    ["2026-01-03", 50],
  ]);
  const chart = {
    timeScale: () => ({
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
    useMediaCoordinateSpace: (callback: (arg: { context: typeof context }) => void) => callback({ context }),
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
    expect(h.context.strokeRect).toHaveBeenCalledWith(10, 80, 20, 10);

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
    expect(h.context.strokeRect).toHaveBeenCalledWith(10, 70, 30, 20);

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

    controller.setVisible(false);
    expect(view?.renderer()).toBeNull();
    controller.setVisible(true);
    expect(view?.renderer()).not.toBeNull();
    h.host.dispose();
  });
});
