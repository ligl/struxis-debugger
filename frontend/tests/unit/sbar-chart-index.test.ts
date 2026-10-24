import { describe, expect, it } from "vitest";
import { createSbarChartIndex, resolveSbarChartAnchor } from "../../src/sbar-chart-index";

describe("SBar chart identity index", () => {
  it("builds logical-index, identity-index, and chart-time mappings from one sequence", () => {
    const index = createSbarChartIndex(
      [{ sbarId: "a" }, { sbarId: "b" }, { sbarId: "c" }],
      [100, 200, 300],
    );

    expect(index.sbarIdByLogicalIndex).toEqual(["a", "b", "c"]);
    expect(index.indexBySbarId.get("b")).toBe(1);
    expect(index.timeBySbarId.get("c")).toBe(300);
  });

  it("preserves sequence positions when a projected time is missing", () => {
    const index = createSbarChartIndex(
      [{ sbarId: "a" }, { sbarId: "b" }, { sbarId: "c" }],
      [100, undefined, 300],
    );

    expect(index.sbarIdByLogicalIndex).toEqual(["a", "b", "c"]);
    expect(index.indexBySbarId.get("c")).toBe(2);
    expect(index.timeBySbarId.has("b")).toBe(false);
    expect(index.timeBySbarId.get("c")).toBe(300);
  });

  it("returns empty maps for an empty sequence", () => {
    const index = createSbarChartIndex([], []);
    expect(index.sbarIdByLogicalIndex).toEqual([]);
    expect(index.indexBySbarId.size).toBe(0);
    expect(index.timeBySbarId.size).toBe(0);
  });
});


describe("Shared SBar chart anchor mapping", () => {
  const bars = [{ sbarId: "sbar-a" }, { sbarId: "sbar-b" }, { sbarId: "sbar-c" }];

  it("maps fractional logical coordinates to the nearest exact SBar identity", () => {
    expect(resolveSbarChartAnchor(bars, 1.2)).toEqual({ index: 1, sbarId: "sbar-b" });
    expect(resolveSbarChartAnchor(bars, 1.8)).toEqual({ index: 2, sbarId: "sbar-c" });
  });

  it("rejects non-finite and out-of-sequence coordinates without clamping", () => {
    expect(resolveSbarChartAnchor(bars, Number.NaN)).toBeNull();
    expect(resolveSbarChartAnchor(bars, Number.POSITIVE_INFINITY)).toBeNull();
    expect(resolveSbarChartAnchor(bars, -0.6)).toBeNull();
    expect(resolveSbarChartAnchor(bars, 2.6)).toBeNull();
    expect(resolveSbarChartAnchor([], 0)).toBeNull();
  });
});
