import { describe, it, expect, vi } from "vitest";
import { KeyZoneIndex, KeyZonePrimitive } from "../../src/keyzone-primitives";
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
    primitive.attached({ chart: { timeScale: () => ({ getVisibleLogicalRange: () => ({ from: -4, to: 4 }), logicalToCoordinate: (index: number) => index * 10 }) },
      series: { priceToCoordinate: (price: number) => price * 0.1 }, requestUpdate: vi.fn(),
    } as unknown as Parameters<KeyZonePrimitive["attached"]>[0]);
    const strokeRect = vi.fn();
    const context = { save: vi.fn(), restore: vi.fn(), setLineDash: vi.fn(), strokeRect };
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
      primitive.attached({ chart: { timeScale: () => ({ getVisibleLogicalRange: () => ({ from: 1, to: 2 }), logicalToCoordinate: (index: number) => index * 10 }) },
        series: { priceToCoordinate: (price: number) => price * 10 }, requestUpdate: vi.fn(),
      } as unknown as Parameters<KeyZonePrimitive["attached"]>[0]);
      const context = { save: vi.fn(), restore: vi.fn(), setLineDash, fillRect, strokeRect };
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
    const owner = { chart: { timeScale: () => ({ getVisibleLogicalRange: () => ({ from: -4, to: 4 }), logicalToCoordinate: (index: number) => index * 10 }) },
      series: { priceToCoordinate: (price: number) => price * 10 }, requestUpdate } as unknown as Parameters<KeyZonePrimitive["attached"]>[0];
    primitive.attached(owner);
    function style() {
      const context = { strokeStyle: "", lineWidth: 0, save: vi.fn(), restore: vi.fn(), setLineDash: vi.fn(), strokeRect: vi.fn() };
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
