import { describe, expect, it } from "vitest";
import { hitTestStructureObject } from "../../src/sbar-chart-structure-hit-test";
import type { CBarRectangleGeometry, SwingSegmentGeometry } from "../../src/sbar-chart-structure-geometry";

const swings: SwingSegmentGeometry[] = [
  { id: "swing-2", x1: 10, y1: 10, x2: 90, y2: 90, state: "Confirmed" },
  { id: "swing-1", x1: 10, y1: 90, x2: 90, y2: 10, state: "Confirmed" },
];
const cbars: CBarRectangleGeometry[] = [
  { id: "cbar-1", x: 20, y: 20, width: 60, height: 60 },
];

describe("structure hit-test adapter", () => {
  it("returns stable Swing identity for the nearest line segment", () => {
    expect(hitTestStructureObject({
      x: 20,
      y: 20,
      swings,
      cbars: [],
      swingVisible: true,
      cbarVisible: false,
    })).toMatchObject({ kind: "swing", id: "swing-2", distance: 0 });
  });

  it("preserves Swing priority for equal-distance Swing and CBar hits", () => {
    const hit = hitTestStructureObject({
      x: 20,
      y: 20,
      swings: [{ id: "swing-a", x1: 20, y1: 20, x2: 80, y2: 80, state: "Confirmed" }],
      cbars,
      swingVisible: true,
      cbarVisible: true,
    });
    expect(hit).toMatchObject({ kind: "swing", id: "swing-a" });
  });

  it("resolves Trend range borders by stable Trend identity and respects layer visibility", () => {
    const trends = [{ id: "trend-7", x: 20, y: 20, width: 60, height: 60 }];
    expect(hitTestStructureObject({
      x: 20,
      y: 50,
      swings: [],
      cbars: [],
      trends,
      swingVisible: false,
      cbarVisible: false,
      trendVisible: true,
    })).toMatchObject({ kind: "trend", id: "trend-7", distance: 0 });

    expect(hitTestStructureObject({
      x: 20,
      y: 50,
      swings: [],
      cbars: [],
      trends,
      swingVisible: false,
      cbarVisible: false,
      trendVisible: false,
    })).toBeNull();
  });

  it("respects visibility and the existing six-pixel tolerance", () => {
    expect(hitTestStructureObject({
      x: 20,
      y: 20,
      swings,
      cbars,
      swingVisible: false,
      cbarVisible: false,
    })).toBeNull();

    expect(hitTestStructureObject({
      x: 50,
      y: 50,
      swings: [],
      cbars: [{ id: "cbar-far", x: 0, y: 0, width: 10, height: 10 }],
      swingVisible: false,
      cbarVisible: true,
    })).toBeNull();
  });

  it("rejects non-finite pointer coordinates and resolves deterministic ties by stable ID", () => {
    expect(hitTestStructureObject({
      x: Number.NaN,
      y: 0,
      swings,
      cbars,
      swingVisible: true,
      cbarVisible: true,
    })).toBeNull();

    const hit = hitTestStructureObject({
      x: 50,
      y: 5,
      swings: [
        { id: "swing-b", x1: 0, y1: 0, x2: 100, y2: 0, state: "Confirmed" },
        { id: "swing-a", x1: 0, y1: 10, x2: 100, y2: 10, state: "Confirmed" },
      ],
      cbars: [],
      swingVisible: true,
      cbarVisible: false,
    });
    expect(hit?.id).toBe("swing-a");
  });
});
