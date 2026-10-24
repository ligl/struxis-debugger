import { describe, expect, it } from "vitest";
import {
  createSnapshotBrightCandleGeometry,
  resolveSnapshotLiveRangeIndices,
} from "../../src/snapshot-playback-geometry";

describe("Snapshot Live range anchor indices", () => {
  it("resolves fixed first and last Snapshot indices from Offset and Live count", () => {
    expect(resolveSnapshotLiveRangeIndices(4, 3, 10)).toEqual({ start: 4, end: 6 });
  });

  it("rejects invalid offsets, counts, and ranges outside Snapshot coverage", () => {
    expect(resolveSnapshotLiveRangeIndices(null, 3, 10)).toBeNull();
    expect(resolveSnapshotLiveRangeIndices(1.5, 3, 10)).toBeNull();
    expect(resolveSnapshotLiveRangeIndices(-1, 3, 10)).toBeNull();
    expect(resolveSnapshotLiveRangeIndices(8, 3, 10)).toBeNull();
    expect(resolveSnapshotLiveRangeIndices(0, 0, 10)).toBeNull();
    expect(resolveSnapshotLiveRangeIndices(0, 2, 0)).toBeNull();
  });
});

describe("Snapshot bright candle geometry", () => {
  it("uses adjacent candle spacing and normalizes the candle rectangle", () => {
    expect(createSnapshotBrightCandleGeometry({
      id: "sbar-b",
      x: 20,
      highY: 30,
      lowY: 10,
      adjacentXs: [10, 35],
    })).toEqual({ id: "sbar-b", x: 16, y: 10, width: 8, height: 20 });
  });

  it("uses bounded fallback dimensions when adjacent spacing is unavailable", () => {
    expect(createSnapshotBrightCandleGeometry({
      id: "sbar-a",
      x: 5,
      highY: 8,
      lowY: 8,
      adjacentXs: [],
    })).toEqual({ id: "sbar-a", x: 1.8, y: 8, width: 6.4, height: 1 });
  });

  it("rejects invalid geometry rather than rendering a malformed cutout", () => {
    expect(createSnapshotBrightCandleGeometry({
      id: "sbar-a",
      x: Number.NaN,
      highY: 1,
      lowY: 2,
      adjacentXs: [3],
    })).toBeNull();
  });
});
