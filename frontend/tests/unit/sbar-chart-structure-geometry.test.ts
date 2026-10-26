import { describe, expect, it, vi } from "vitest";
import { projectCBarRectangles, projectSwingSegments, projectStructureOverlayGeometry, type CBarGeometryInput, type SwingGeometryInput } from "../../src/sbar-chart-structure-geometry";

function cbar(overrides: Partial<CBarGeometryInput> = {}): CBarGeometryInput {
  return {
    cbarId: "cbar-1",
    sbarStartId: "sbar-1",
    sbarEndId: "sbar-3",
    high: "15",
    low: "8",
    ...overrides,
  };
}

describe("projectCBarRectangles", () => {
  it("projects anchor and price coordinates into normalized rectangle geometry", () => {
    const result = projectCBarRectangles({
      cbars: [cbar()],
      coordinateForSbarId: (id) => ({ "sbar-1": 80, "sbar-3": 20 })[id as "sbar-1" | "sbar-3"] ?? null,
      priceToCoordinate: (price) => price === 15 ? 10 : price === 8 ? 50 : null,
      sbarBodyWidth: 8,
    });

    expect(result).toEqual([{ id: "cbar-1", x: 16, y: 10, width: 68, height: 40 }]);
  });

  it("uses the first SBar body left edge and last SBar body right edge regardless of anchor order", () => {
    const result = projectCBarRectangles({
      cbars: [cbar()],
      coordinateForSbarId: (id) => id === "sbar-1" ? 20 : 80,
      priceToCoordinate: (price) => price === 15 ? 10 : 50,
      sbarBodyWidth: 10,
    });

    expect(result).toEqual([{ id: "cbar-1", x: 15, y: 10, width: 70, height: 40 }]);
  });

  it("omits geometry when either SBar anchor is missing", () => {
    const result = projectCBarRectangles({
      cbars: [cbar()],
      coordinateForSbarId: (id) => id === "sbar-1" ? 12 : null,
      priceToCoordinate: (price) => price,
    });

    expect(result).toEqual([]);
  });

  it("omits invalid prices and non-finite chart coordinates", () => {
    const invalidPrice = projectCBarRectangles({
      cbars: [cbar({ high: "NaN" })],
      coordinateForSbarId: () => 1,
      priceToCoordinate: () => 2,
    });
    const invalidCoordinate = projectCBarRectangles({
      cbars: [cbar()],
      coordinateForSbarId: () => Number.POSITIVE_INFINITY,
      priceToCoordinate: () => 2,
    });

    expect(invalidPrice).toEqual([]);
    expect(invalidCoordinate).toEqual([]);
  });

  it("culls rectangles outside the visible logical range with the default overscan", () => {
    const cbars = [
      cbar({ cbarId: "visible", sbarStartId: "sbar-2", sbarEndId: "sbar-3" }),
      cbar({ cbarId: "outside", sbarStartId: "sbar-20", sbarEndId: "sbar-21" }),
    ];
    const coordinateForSbarId = vi.fn((id: string) => id.endsWith("20") || id.endsWith("21") ? 200 : 20);
    const result = projectCBarRectangles({
      cbars,
      indexBySbarId: new Map([
        ["sbar-2", 2], ["sbar-3", 3], ["sbar-20", 20], ["sbar-21", 21],
      ]),
      visibleRange: { from: 2, to: 4 },
      coordinateForSbarId,
      priceToCoordinate: (price) => price,
    });

    expect(result.map((rectangle) => rectangle.id)).toEqual(["visible"]);
    expect(coordinateForSbarId).not.toHaveBeenCalledWith("sbar-20");
    expect(coordinateForSbarId).not.toHaveBeenCalledWith("sbar-21");
  });

  it("does not require a viewport index when no visible range is supplied", () => {
    const result = projectCBarRectangles({
      cbars: [cbar()],
      coordinateForSbarId: (id) => id === "sbar-1" ? 10 : 30,
      priceToCoordinate: (price) => price,
    });

    expect(result).toHaveLength(1);
  });
});

function swing(overrides: Partial<SwingGeometryInput> = {}): SwingGeometryInput {
  return {
    swingId: "swing-1",
    sbarStartId: "sbar-1",
    sbarEndId: "sbar-3",
    high: "15",
    low: "8",
    direction: "Up",
    state: "Confirmed",
    ...overrides,
  };
}

describe("projectSwingSegments", () => {
  it("projects directional endpoints and preserves state without choosing visual style", () => {
    const result = projectSwingSegments({
      swings: [swing()],
      coordinateForSbarId: (id) => id === "sbar-1" ? 10 : 30,
      priceToCoordinate: (price) => price === 8 ? 50 : 10,
    });

    expect(result).toEqual([{
      id: "swing-1",
      x1: 10,
      y1: 50,
      x2: 30,
      y2: 10,
      state: "Confirmed",
    }]);
    expect(result[0]).not.toHaveProperty("color");
    expect(result[0]).not.toHaveProperty("dasharray");
  });

  it("reverses endpoint prices for non-Up direction", () => {
    const result = projectSwingSegments({
      swings: [swing({ direction: "Down" })],
      coordinateForSbarId: (id) => id === "sbar-1" ? 10 : 30,
      priceToCoordinate: (price) => price === 15 ? 10 : 50,
    });

    expect(result[0]).toMatchObject({ y1: 10, y2: 50 });
  });

  it("omits missing anchors, invalid prices, and non-finite coordinates", () => {
    const missingAnchor = projectSwingSegments({
      swings: [swing()],
      coordinateForSbarId: (id) => id === "sbar-1" ? 10 : null,
      priceToCoordinate: (price) => price,
    });
    const invalidPrice = projectSwingSegments({
      swings: [swing({ low: "invalid" })],
      coordinateForSbarId: () => 10,
      priceToCoordinate: (price) => price,
    });
    const invalidCoordinate = projectSwingSegments({
      swings: [swing()],
      coordinateForSbarId: () => Number.NaN,
      priceToCoordinate: (price) => price,
    });

    expect(missingAnchor).toEqual([]);
    expect(invalidPrice).toEqual([]);
    expect(invalidCoordinate).toEqual([]);
  });

  it("culls swings outside the visible logical range with overscan", () => {
    const result = projectSwingSegments({
      swings: [
        swing({ swingId: "visible", sbarStartId: "sbar-2", sbarEndId: "sbar-3" }),
        swing({ swingId: "outside", sbarStartId: "sbar-20", sbarEndId: "sbar-21" }),
      ],
      indexBySbarId: new Map([
        ["sbar-2", 2], ["sbar-3", 3], ["sbar-20", 20], ["sbar-21", 21],
      ]),
      visibleRange: { from: 2, to: 4 },
      coordinateForSbarId: (id) => id.endsWith("20") || id.endsWith("21") ? 200 : 20,
      priceToCoordinate: (price) => price,
    });

    expect(result.map((segment) => segment.id)).toEqual(["visible"]);
  });
});


describe("projectStructureOverlayGeometry", () => {
  it("projects CBar and Swing through one entry point and applies caller-owned Swing style", () => {
    const result = projectStructureOverlayGeometry({
      cbars: [cbar()],
      swings: [swing()],
      indexBySbarId: new Map([["sbar-1", 0], ["sbar-3", 2]]),
      visibleRange: null,
      coordinateForSbarId: (id) => id === "sbar-1" ? 10 : 30,
      priceToCoordinate: (price) => price === 15 ? 10 : 50,
      cbarVisible: true,
      swingVisible: true,
      resolveSwingStyle: (state) => state === "Confirmed"
        ? { color: "#8A739F", dasharray: "" }
        : { color: "#A0A7B0", dasharray: "4 3" },
    });

    expect(result.cbarRectangles).toEqual([
      { id: "cbar-1", x: 10, y: 10, width: 20, height: 40 },
    ]);
    expect(result.swingSegments).toEqual([
      { id: "swing-1", x1: 10, y1: 50, x2: 30, y2: 10, state: "Confirmed", color: "#8A739F", dasharray: "" },
    ]);
  });

  it("keeps visibility gating consistent for both structure layers", () => {
    const result = projectStructureOverlayGeometry({
      cbars: [cbar()],
      swings: [swing()],
      indexBySbarId: new Map([["sbar-1", 0], ["sbar-3", 2]]),
      visibleRange: null,
      coordinateForSbarId: () => 10,
      priceToCoordinate: () => 20,
      cbarVisible: false,
      swingVisible: false,
      resolveSwingStyle: () => ({ color: "#A0A7B0", dasharray: "4 3" }),
    });

    expect(result).toEqual({ cbarRectangles: [], swingSegments: [] });
  });
});
