import { describe, expect, it, vi } from "vitest";
import { projectCBarRectangles, type CBarGeometryInput } from "../../src/sbar-chart-structure-geometry";

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
    });

    expect(result).toEqual([{ id: "cbar-1", x: 20, y: 10, width: 60, height: 40 }]);
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
