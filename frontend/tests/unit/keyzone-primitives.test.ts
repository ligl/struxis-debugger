import { describe, it, expect, vi } from "vitest";
import { KeyZoneIndex, KeyZonePrimitive, KeyZoneInteractionIndex } from "../../src/keyzone-primitives";
import { keyzoneFixture, keyzoneBars } from "./keyzone-fixture";

describe("KeyZone short marker index and chart primitive", () => {
  it("keeps a six-SBar marker centered on its source as processing advances or the zone invalidates", () => {
    const registry = keyzoneFixture(), bars = keyzoneBars();
    expect(new KeyZoneIndex(registry, bars, bars[1]!.sbarId).visible(-4, 4)
      .map((item) => [item.start, item.end])).toEqual([[-3, 3]]);
    expect(new KeyZoneIndex(registry, bars, bars[3]!.sbarId).visible(-4, 4)
      .map((item) => [item.start, item.end])).toEqual([[-3, 3]]);
    registry.zones[0]!.state = "Invalidated";
    registry.zones[0]!.invalidatedAt = bars[1]!.sbarId;
    expect(new KeyZoneIndex(registry, bars, bars[3]!.sbarId).visible(-4, 4)
      .map((item) => [item.start, item.end])).toEqual([[-3, 3]]);
  });

  it("uses the accepted checkpoint only to exclude future source anchors", () => {
    const registry = keyzoneFixture(), bars = keyzoneBars();
    registry.zones[0]!.formedAt = bars[2]!.sbarId;
    expect(new KeyZoneIndex(registry, bars, bars[1]!.sbarId).visible(-4, 6)).toEqual([]);
    expect(new KeyZoneIndex(registry, bars, bars[2]!.sbarId).visible(-4, 6)
      .map((item) => [item.start, item.end])).toEqual([[-1, 5]]);
  });

  it("does not relocate missing source anchors to either end of the loaded dataset", () => {
    const registry = keyzoneFixture(), bars = keyzoneBars();
    registry.zones[0]!.formedAt = "1699999999999999999";
    expect(new KeyZoneIndex(registry, bars, bars[3]!.sbarId).visible(-4, 7)).toEqual([]);
    registry.zones[0]!.formedAt = "1700000180000000001";
    expect(new KeyZoneIndex(registry, bars, "1700000240000000000").visible(-4, 7)).toEqual([]);
  });

  it("interpolates only the source anchor between adjacent SBar times", () => {
    const registry = keyzoneFixture(), bars = keyzoneBars();
    registry.zones[0]!.formedAt = "1700000030000000000";
    registry.zones[0]!.invalidatedAt = "1700000150000000000";
    const index = new KeyZoneIndex(registry, bars, bars[3]!.sbarId);
    expect(index.visible(-4, 4).map((item) => [item.start, item.end])).toEqual([[-2.5, 3.5]]);
  });

  it("culls markers by their local footprint rather than their lifecycle duration", () => {
    const bars = keyzoneBars();
    const index = new KeyZoneIndex(keyzoneFixture(), bars, bars[3]!.sbarId);
    expect(index.visible(2, 3).map((item) => item.zone.keyzoneId)).toEqual(["9007199254740993"]);
    expect(index.visible(4, 10)).toEqual([]);
    expect(index.visible(-10, -4)).toEqual([]);
  });

  it("handles absent, empty and not-yet-processed recordings without fabricating geometry", () => {
    const registry = keyzoneFixture(); registry.zones = [];
    const bars = keyzoneBars();
    expect(new KeyZoneIndex(registry, bars, bars[3]!.sbarId).visible(-4, 4)).toEqual([]);
    expect(new KeyZoneIndex(null, bars, bars[3]!.sbarId).visible(-4, 4)).toEqual([]);
    expect(new KeyZoneIndex(keyzoneFixture(), bars, null).visible(-4, 4)).toEqual([]);
    expect(new KeyZoneIndex(keyzoneFixture(), [], bars[3]!.sbarId).visible(-4, 4)).toEqual([]);
  });

  it("preserves price boundaries even when the projected range is narrower than one pixel", () => {
    const primitive = new KeyZonePrimitive();
    primitive.setData(keyzoneFixture(), keyzoneBars(), keyzoneBars()[3]!.sbarId);
    primitive.attached({ chart: { timeScale: () => ({ options: () => ({ barSpacing: 10 }), getVisibleLogicalRange: () => ({ from: -4, to: 4 }), logicalToCoordinate: (index: number) => index * 10 }) },
      series: { priceToCoordinate: (price: number) => price * 0.1 }, requestUpdate: vi.fn(),
    } as unknown as Parameters<KeyZonePrimitive["attached"]>[0]);
    const strokeRect = vi.fn();
    const context = { save: vi.fn(), restore: vi.fn(), setLineDash: vi.fn(), strokeRect, fillText: vi.fn() };
    const target = { useMediaCoordinateSpace: (callback: (scope: { context: typeof context }) => void) => callback({ context }) };
    primitive.renderer()!.draw(target as unknown as Parameters<NonNullable<ReturnType<KeyZonePrimitive["renderer"]>>["draw"]>[0]);
    expect(strokeRect).toHaveBeenCalledWith(-30, expect.closeTo(0.900001, 8), 60, expect.closeTo(0.300001, 8));
    primitive.detached();
  });

  it.each(["Provisional", "Finalized", "Invalidated"] as const)(
    "draws an unfilled dashed %s rectangle without moving its borders to the viewport edges",
    (state) => {
      const primitive = new KeyZonePrimitive(), registry = keyzoneFixture();
      registry.zones[0]!.state = state;
      const setLineDash = vi.fn(), strokeRect = vi.fn(), fillRect = vi.fn();
      primitive.setData(registry, keyzoneBars(), keyzoneBars()[3]!.sbarId);
      primitive.attached({ chart: { timeScale: () => ({ options: () => ({ barSpacing: 10 }), getVisibleLogicalRange: () => ({ from: 1, to: 2 }), logicalToCoordinate: (index: number) => index * 10 }) },
        series: { priceToCoordinate: (price: number) => price * 10 }, requestUpdate: vi.fn(),
      } as unknown as Parameters<KeyZonePrimitive["attached"]>[0]);
      const context = { save: vi.fn(), restore: vi.fn(), setLineDash, fillRect, strokeRect, fillText: vi.fn() };
      const target = { useMediaCoordinateSpace: (callback: (scope: { context: typeof context }) => void) => callback({ context }) };
      primitive.renderer()!.draw(target as unknown as Parameters<NonNullable<ReturnType<KeyZonePrimitive["renderer"]>>["draw"]>[0]);
      expect(strokeRect).toHaveBeenCalledWith(-30, expect.closeTo(90.0001, 6), 60, expect.closeTo(30.0001, 6));
      expect(setLineDash).toHaveBeenCalledWith([5, 3]);
      expect(fillRect).not.toHaveBeenCalled();
      expect(primitive.hitTestZone(15, 90)).toBe("9007199254740993");
      expect(primitive.hitTestZone(15, 105)).toBeNull();
      expect(primitive.hitTestZone(45, 90)).toBeNull();
      primitive.setVisible(false);
      expect(primitive.renderer()).toBeNull();
      expect(primitive.hitTestZone(15, 90)).toBeNull();
      primitive.setVisible(true); primitive.detached();
      expect(primitive.hitTestZone(15, 90)).toBeNull();
    },
  );
});

describe("KeyZone hover state", () => {
  function setup() {
    const primitive = new KeyZonePrimitive(), requestUpdate = vi.fn();
    primitive.setData(keyzoneFixture(), keyzoneBars(), keyzoneBars()[3]!.sbarId);
    const owner = { chart: { timeScale: () => ({ options: () => ({ barSpacing: 10 }), getVisibleLogicalRange: () => ({ from: -4, to: 4 }), logicalToCoordinate: (index: number) => index * 10 }) },
      series: { priceToCoordinate: (price: number) => price * 10 }, requestUpdate } as unknown as Parameters<KeyZonePrimitive["attached"]>[0];
    primitive.attached(owner);
    function style() {
      const context = { strokeStyle: "", lineWidth: 0, save: vi.fn(), restore: vi.fn(), setLineDash: vi.fn(), strokeRect: vi.fn(), fillText: vi.fn() };
      primitive.renderer()!.draw({ useMediaCoordinateSpace: (callback: (scope: { context: typeof context }) => void) => callback({ context }) } as unknown as Parameters<NonNullable<ReturnType<KeyZonePrimitive["renderer"]>>["draw"]>[0]);
      return { color: context.strokeStyle, width: context.lineWidth };
    }
    return { primitive, requestUpdate, owner, style };
  }
  it("redraws only when hover identity changes and never rebuilds geometry for pointer movement", () => {
    const { primitive, requestUpdate, style } = setup();
    const project = vi.spyOn(primitive, "updateAllViews");
    const data = vi.spyOn(primitive, "setData");
    for (let i = 0; i < 10; i++) primitive.setHovered(primitive.hitTestZone(15, 90));
    expect(requestUpdate).toHaveBeenCalledTimes(1);
    expect(style()).toEqual({ color: "#e3bd80", width: 1.5 });
    expect(project).not.toHaveBeenCalled();
    expect(data).not.toHaveBeenCalled();
    primitive.setHovered(null);
    expect(requestUpdate).toHaveBeenCalledTimes(2);
    expect(style()).toEqual({ color: "#b49a75", width: 1 });
  });
  it("gives selection priority and preserves it after pointer departure", () => {
    const { primitive, style } = setup();
    primitive.setHovered("9007199254740993");
    primitive.setSelected("9007199254740993");
    expect(style()).toEqual({ color: "#f0cb87", width: 2 });
    primitive.setHovered(null);
    expect(style()).toEqual({ color: "#f0cb87", width: 2 });
    primitive.setSelected(null);
    expect(style()).toEqual({ color: "#b49a75", width: 1 });
  });
  it("does not resurrect hover after hiding, replacing data or reattaching a chart", () => {
    const { primitive, owner, style } = setup();
    primitive.setHovered("9007199254740993");
    primitive.setVisible(false); primitive.setVisible(true);
    expect(style()).toEqual({ color: "#b49a75", width: 1 });
    primitive.setHovered("9007199254740993");
    primitive.setData(keyzoneFixture(), keyzoneBars(), keyzoneBars()[3]!.sbarId);
    expect(style()).toEqual({ color: "#b49a75", width: 1 });
    primitive.setHovered("9007199254740993");
    primitive.detached(); primitive.attached(owner);
    expect(style()).toEqual({ color: "#b49a75", width: 1 });
  });
});

describe("selected KeyZone observed interaction ranges", () => {
  function episodes() {
    const bars = keyzoneBars(), registry = keyzoneFixture(), zoneId = registry.zones[0]!.keyzoneId;
    Object.assign(bars[1]!, { low: "7", high: "15" });
    Object.assign(bars[2]!, { low: "6", high: "18" });
    Object.assign(bars[3]!, { low: "5", high: "14" });
    const base = registry.interactions[0]!;
    registry.interactions = [
      { ...base, interactionId: "10", state: "Ended", startedAt: bars[0]!.tsEvent, lastProcessedAt: bars[1]!.tsEvent, endedAt: bars[1]!.tsEvent },
      { ...base, interactionId: "20", state: "Active", startedAt: bars[2]!.tsEvent, lastProcessedAt: bars[3]!.tsEvent },
      { ...base, interactionId: "30", observationId: "2", observer: { instrumentId: registry.instrumentId, timeframe: "5m" }, observerTimeframe: "5m" },
    ];
    registry.observations.push({ ...registry.observations[0]!, observationId: "2", requestId: "other-period", observer: { instrumentId: registry.instrumentId, timeframe: "5m" } });
    return { bars, registry, zoneId };
  }
  it("separates each episode using its observed candle extrema and explicit observer StateKey", () => {
    const { bars, registry, zoneId } = episodes();
    const index = new KeyZoneInteractionIndex(registry, bars, bars[3]!.tsEvent, zoneId, registry.observations[0]!.observer);
    expect(index.visible(0, 4)).toEqual([
      { interactionId: "10", observationId: "1", sequence: 1, state: "Ended", start: 0, end: 1, low: 7, high: 15 },
      { interactionId: "20", observationId: "1", sequence: 2, state: "Active", start: 2, end: 3, low: 5, high: 18 },
    ]);
    expect(index.visible(-1, 1).map((item) => item.interactionId)).toEqual(["10"]);
    expect(index.visible(2, 4).map((item) => item.interactionId)).toEqual(["20"]);
    expect(index.visible(5, 8)).toEqual([]);
  });
  it("never reads interaction history without a selected KeyZone", () => {
    const { bars, registry } = episodes();
    Object.defineProperty(registry, "interactions", { get: () => { throw new Error("unselected history must not be read"); } });
    expect(new KeyZoneInteractionIndex(registry, bars, bars[3]!.tsEvent, null).visible(0, 4)).toEqual([]);
  });
  it("caps Active observations at the accepted cursor and uses no fabricated missing anchors", () => {
    const { bars, registry, zoneId } = episodes();
    const ranges = new KeyZoneInteractionIndex(registry, bars, bars[2]!.tsEvent, zoneId, registry.observations[0]!.observer).visible(0, 4);
    expect(ranges[1]).toEqual({ interactionId: "20", observationId: "1", sequence: 2, state: "Active", start: 2, end: 2, low: 6, high: 18 });
    expect(new KeyZoneInteractionIndex(registry, bars.slice(1), bars[3]!.tsEvent, zoneId, registry.observations[0]!.observer).visible(0, 4)
      .map((item) => item.interactionId)).toEqual(["20"]);
    registry.interactions[1]!.lastProcessedAt = null;
    expect(new KeyZoneInteractionIndex(registry, bars, bars[3]!.tsEvent, zoneId, registry.observations[0]!.observer).visible(0, 4)
      .map((item) => item.interactionId)).toEqual(["10"]);
  });
  it("keeps terminal ranges fixed and extends only an updated Active episode", () => {
    const { bars, registry, zoneId } = episodes();
    const more = [...bars, { ...bars[3]!, sbarId: "1700000240000000000", tsEvent: "1700000240000000000", tsInit: "1700000240000000000", high: "25", low: "4" }];
    registry.interactions[1]!.lastProcessedAt = more[4]!.tsEvent;
    expect(new KeyZoneInteractionIndex(registry, more, more[4]!.tsEvent, zoneId, registry.observations[0]!.observer).visible(0, 5)).toEqual([
      { interactionId: "10", observationId: "1", sequence: 1, state: "Ended", start: 0, end: 1, low: 7, high: 15 },
      { interactionId: "20", observationId: "1", sequence: 2, state: "Active", start: 2, end: 4, low: 4, high: 25 },
    ]);
    registry.interactions[1]!.state = "Invalidated";
    registry.interactions[1]!.invalidatedAt = "1700000300000000000";
    expect(new KeyZoneInteractionIndex(registry, more, more[4]!.tsEvent, zoneId, registry.observations[0]!.observer).visible(2, 5)[0]?.end).toBe(4);
  });
  it("draws unfilled labeled episode boxes before the source marker and clears them with selection", () => {
    const { bars, registry, zoneId } = episodes(), primitive = new KeyZonePrimitive();
    let priceReads = 0;
    for (const bar of bars) for (const field of ["low", "high"] as const) {
      const value = bar[field]; Object.defineProperty(bar, field, { get: () => { priceReads++; return value; } });
    }
    primitive.setData(registry, bars, bars[3]!.tsEvent, registry.observations[0]!.observer);
    primitive.attached({ chart: { timeScale: () => ({ options: () => ({ barSpacing: 10 }), getVisibleLogicalRange: () => ({ from: -4, to: 5 }), logicalToCoordinate: (index: number) => 100 + index * 10 }) },
      series: { priceToCoordinate: (price: number) => 200 - price * 10 }, requestUpdate: vi.fn(),
    } as unknown as Parameters<KeyZonePrimitive["attached"]>[0]);
    const strokeRect = vi.fn(), fillRect = vi.fn(), fillText = vi.fn();
    const context = { strokeStyle: "", save: vi.fn(), restore: vi.fn(), setLineDash: vi.fn(), strokeRect, fillRect, fillText };
    const draw = () => primitive.renderer()!.draw({ useMediaCoordinateSpace: (callback: (scope: { context: typeof context }) => void) => callback({ context }) } as unknown as Parameters<NonNullable<ReturnType<KeyZonePrimitive["renderer"]>>["draw"]>[0]);
    draw(); expect(fillText).not.toHaveBeenCalled(); expect(priceReads).toBe(0);
    primitive.setSelected(zoneId); draw();
    expect(priceReads).toBe(8);
    expect(strokeRect).toHaveBeenCalledWith(96.5, 50, 17, 80);
    expect(strokeRect).toHaveBeenCalledWith(116.5, 20, 17, 130);
    expect(fillText.mock.calls.map((call) => call[0])).toEqual(["O1 · I1 Ended", "O1 · I2 Active"]);
    expect(fillRect).not.toHaveBeenCalled();
    primitive.setHovered(zoneId); primitive.updateAllViews(); primitive.setSelected(zoneId); draw();
    expect(priceReads).toBe(8);
    fillText.mockClear(); primitive.setSelected(null); draw();
    expect(fillText).not.toHaveBeenCalled();
    expect(priceReads).toBe(8);
  });
});


describe("explicit observation chart ranges", () => {
  it("matches the declared StateKey and never borrows another timeframe", () => {
    const registry = keyzoneFixture(), bars = keyzoneBars(), zone = registry.zones[0]!.keyzoneId;
    expect(new KeyZoneInteractionIndex(registry, bars, bars[3]!.tsEvent, zone).visible(0, 4)).toEqual([]);
    expect(new KeyZoneInteractionIndex(registry, bars, bars[3]!.tsEvent, zone, { instrumentId: registry.instrumentId, timeframe: "5m" }).visible(0, 4)).toEqual([]);
    expect(new KeyZoneInteractionIndex(registry, bars, bars[3]!.tsEvent, zone, { instrumentId: registry.instrumentId, timeframe: "1m" }).visible(0, 4).map((i) => [i.observationId, i.sequence])).toEqual([["1", 1]]);
  });
  it("finds nested and overlapping episodes from independent tasks", () => {
    const registry = keyzoneFixture(), bars = keyzoneBars(), zone = registry.zones[0]!.keyzoneId;
    const task = registry.observations[0]!, episode = registry.interactions[0]!;
    registry.observations.push({ ...task, observationId: "2", consumerId: "strategy-b", requestId: "request-b" }, { ...task, observationId: "3", consumerId: "strategy-c", requestId: "request-c" });
    registry.interactions = [
      { ...episode, interactionId: "1", observationId: "1", startedAt: bars[0]!.tsEvent, lastProcessedAt: bars[3]!.tsEvent },
      { ...episode, interactionId: "2", observationId: "2", startedAt: bars[1]!.tsEvent, lastProcessedAt: bars[1]!.tsEvent },
      { ...episode, interactionId: "3", observationId: "3", startedAt: bars[2]!.tsEvent, lastProcessedAt: bars[2]!.tsEvent },
    ];
    const index = new KeyZoneInteractionIndex(registry, bars, bars[3]!.tsEvent, zone, task.observer);
    expect(index.visible(2.6, 3).map((i) => i.interactionId)).toEqual(["1"]);
    expect(index.visible(0.6, 1.4).map((i) => i.interactionId)).toEqual(["1", "2"]);
    expect(index.visible(1.6, 2.4).map((i) => [i.observationId, i.sequence])).toEqual([["1", 1], ["3", 1]]);
  });
  it("keeps an interrupted episode at its last actual observation", () => {
    const registry = keyzoneFixture(), bars = keyzoneBars(), zone = registry.zones[0]!.keyzoneId;
    registry.interactions[0] = { ...registry.interactions[0]!, state: "Interrupted", lastProcessedAt: bars[1]!.tsEvent, interruptedAt: bars[3]!.tsEvent, interruptionReason: "Deadline" };
    const index = new KeyZoneInteractionIndex(registry, bars, bars[3]!.tsEvent, zone, registry.observations[0]!.observer);
    expect(index.visible(0, 4).map((i) => [i.state, i.end])).toEqual([["Interrupted", 1]]);
  });
});

describe("FixedPriceRange price-only markers", () => {
  function setup() {
    const registry = keyzoneFixture();
    registry.observations = [];
    registry.interactions = [];
    Object.assign(registry.zones[0]!, { originKind: "FixedPriceRange", originId: null,
      formedAt: "1800000000000000000", lower: "9", upper: "12" });
    let paneWidth = 700;
    let range: { from: number; to: number } | null = { from: -4, to: 4 };
    const primitive = new KeyZonePrimitive();
    const requestUpdate = vi.fn();
    primitive.setData(registry, keyzoneBars(), keyzoneBars()[2]!.sbarId);
    primitive.attached({ chart: { timeScale: () => ({ width: () => paneWidth, options: () => ({ barSpacing: 10 }),
      getVisibleLogicalRange: () => range, logicalToCoordinate: (index: number) => index * 10 }) },
      series: { priceToCoordinate: (price: number) => 200 - price * 10 }, requestUpdate,
    } as unknown as Parameters<KeyZonePrimitive["attached"]>[0]);
    function draw() {
      const fills: Array<{ color: string; alpha: number }> = [];
      const context = { strokeStyle: "", fillStyle: "", lineWidth: 0, globalAlpha: 1,
        save: vi.fn(), restore: vi.fn(), setLineDash: vi.fn(), strokeRect: vi.fn(), fillText: vi.fn(),
        beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(),
        fillRect: vi.fn((_x: number, _y: number, _width: number, _height: number) => {
          fills.push({ color: context.fillStyle, alpha: context.globalAlpha });
        }) };
      primitive.renderer()?.draw({ useMediaCoordinateSpace: (callback: (scope: { context: typeof context }) => void) => callback({ context }) } as unknown as Parameters<NonNullable<ReturnType<KeyZonePrimitive["renderer"]>>["draw"]>[0]);
      return { context, fills };
    }
    return { primitive, registry, draw, requestUpdate, resize: (width: number) => { paneWidth = width; primitive.updateAllViews(); },
      pan: (next: typeof range) => { range = next; primitive.updateAllViews(); } };
  }

  it("draws two 24px price lines at the right edge despite a future formedAt", () => {
    const { primitive, draw, registry } = setup();
    const { context } = draw();
    expect(context.moveTo.mock.calls).toEqual([[676, 80], [676, 110]]);
    expect(context.lineTo.mock.calls).toEqual([[700, 80], [700, 110]]);
    expect(context.setLineDash).toHaveBeenCalledWith([5, 3]);
    expect(context.strokeRect).not.toHaveBeenCalled();
    expect(context.fillRect).not.toHaveBeenCalled();
    expect(context.strokeStyle).toBe("#756650");
    expect(context.lineWidth).toBe(0.75);
    expect(new KeyZoneIndex(registry, keyzoneBars(), "1800000000000000000").visible(-4, 4)).toEqual([]);
    primitive.setData(registry, keyzoneBars(), null);
    expect(draw().context.moveTo.mock.calls).toEqual([[676, 80], [676, 110]]);
  });

  it("expands both hovered lines across the pane and fills only their price band at 10% opacity", () => {
    const { primitive, draw, registry, requestUpdate } = setup();
    const id = registry.zones[0]!.keyzoneId;
    expect(primitive.hitTestZone(688, 80)).toBe(id);
    primitive.setHovered(id);
    const { context, fills } = draw();
    expect(context.moveTo.mock.calls).toEqual([[0, 80], [0, 110]]);
    expect(context.lineTo.mock.calls).toEqual([[700, 80], [700, 110]]);
    expect(context.fillRect).toHaveBeenCalledExactlyOnceWith(0, 80, 700, 30);
    expect(fills).toEqual([{ color: "#8c785b", alpha: 0.1 }]);
    expect(context.lineWidth).toBe(1);
    expect(primitive.hitTestZone(20, 110)).toBe(id);
    expect(primitive.hitTestZone(20, 95)).toBeNull();
    const requests = requestUpdate.mock.calls.length;
    primitive.setHovered(id);
    expect(requestUpdate).toHaveBeenCalledTimes(requests);
    primitive.setHovered(null);
    expect(draw().context.fillRect).not.toHaveBeenCalled();
    expect(draw().context.moveTo.mock.calls).toEqual([[676, 80], [676, 110]]);
    expect(primitive.hitTestZone(20, 80)).toBeNull();
  });

  it("keeps selected lines and the translucent band expanded until selection is cleared", () => {
    const { primitive, registry, draw } = setup();
    const id = registry.zones[0]!.keyzoneId;
    primitive.setSelected(id);
    primitive.setHovered(id);
    expect(draw().fills).toEqual([{ color: "#9e8661", alpha: 0.1 }]);
    primitive.setHovered(null);
    const { context } = draw();
    expect(context.strokeStyle).toBe("#9e8661");
    expect(context.lineWidth).toBe(1);
    expect(context.fillRect).toHaveBeenCalledExactlyOnceWith(0, 80, 700, 30);
    expect(context.moveTo.mock.calls).toEqual([[0, 80], [0, 110]]);
    expect(context.lineTo.mock.calls).toEqual([[700, 80], [700, 110]]);
    expect(primitive.hitTestZone(20, 80)).toBe(id);
    expect(primitive.hitTestZone(20, 95)).toBeNull();
    primitive.setData(registry, keyzoneBars(), keyzoneBars()[3]!.sbarId);
    expect(draw().fills).toEqual([{ color: "#9e8661", alpha: 0.1 }]);
    primitive.setVisible(false);
    primitive.setVisible(true);
    expect(draw().context.moveTo.mock.calls).toEqual([[0, 80], [0, 110]]);
    primitive.setSelected(null);
    expect(draw().context.moveTo.mock.calls).toEqual([[676, 80], [676, 110]]);
    expect(draw().context.fillRect).not.toHaveBeenCalled();
    expect(primitive.hitTestZone(20, 80)).toBeNull();
  });

  it("keeps screen-sized lines at the right edge on pan and resize, including narrow panes", () => {
    const { primitive, draw, resize, pan } = setup();
    pan({ from: 100, to: 150 });
    expect(draw().context.moveTo.mock.calls).toEqual([[676, 80], [676, 110]]);
    resize(1000);
    expect(draw().context.moveTo.mock.calls).toEqual([[976, 80], [976, 110]]);
    expect(draw().context.lineTo.mock.calls).toEqual([[1000, 80], [1000, 110]]);
    expect(primitive.hitTestZone(688, 80)).toBeNull();
    resize(20);
    expect(draw().context.moveTo.mock.calls).toEqual([[0, 80], [0, 110]]);
    expect(draw().context.lineTo.mock.calls).toEqual([[20, 80], [20, 110]]);
    pan(null);
    expect(draw().context.lineTo.mock.calls).toEqual([[20, 80], [20, 110]]);
  });

  it("uses line-only hit targets and removes stale geometry on detach, hiding and checkpoint replacement", () => {
    const { primitive, registry, draw } = setup();
    const id = registry.zones[0]!.keyzoneId;
    expect(primitive.hitTestZone(644, 95)).toBeNull();
    expect(primitive.hitTestZone(688, 110)).toBe(id);
    primitive.setHovered(id);
    primitive.setVisible(false);
    expect(primitive.renderer()).toBeNull();
    expect(primitive.hitTestZone(688, 80)).toBeNull();
    primitive.setVisible(true);
    expect(draw().context.fillRect).not.toHaveBeenCalled();
    primitive.setHovered(id);
    primitive.setData(null, [], null);
    expect(primitive.hitTestZone(688, 80)).toBeNull();
    expect(draw().context.stroke).not.toHaveBeenCalled();
    primitive.setData(registry, keyzoneBars(), keyzoneBars()[3]!.sbarId);
    primitive.detached();
    expect(primitive.hitTestZone(688, 80)).toBeNull();
  });
});
