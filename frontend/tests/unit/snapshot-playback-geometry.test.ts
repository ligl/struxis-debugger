import { describe, expect, it } from "vitest";
import {
  createSnapshotBrightCandleGeometry,
  resolveSnapshotLiveRangeCoordinates,
  resolveSnapshotLiveRangeIndices,
  resolveSnapshotProcessedRangeIndices,
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


describe("Snapshot Live range coordinate projection", () => {
  const barIds = ["s0", "s1", "s2", "s3", "s4"];

  it("projects fixed SBar identities without clamping to the viewport", () => {
    expect(resolveSnapshotLiveRangeCoordinates({
      offset: 1,
      liveCount: 3,
      barIds,
      coordinateForSbarId: (id) => ({ s0: -20, s1: -10, s2: 5, s3: 40, s4: 80 }[id as "s0"]),
      logicalToCoordinate: (index) => index * 10,
    })).toEqual({ start: -10, end: 40 });
  });

  it("falls back to logical coordinates only when the identity coordinate is unavailable", () => {
    expect(resolveSnapshotLiveRangeCoordinates({
      offset: 1,
      liveCount: 2,
      barIds,
      coordinateForSbarId: () => null,
      logicalToCoordinate: (index) => index * 12,
    })).toEqual({ start: 12, end: 24 });
  });

  it("rejects invalid anchors or missing endpoint coordinates", () => {
    expect(resolveSnapshotLiveRangeCoordinates({
      offset: 4,
      liveCount: 2,
      barIds,
      coordinateForSbarId: () => null,
      logicalToCoordinate: (index) => index,
    })).toBeNull();
    expect(resolveSnapshotLiveRangeCoordinates({
      offset: 1,
      liveCount: 2,
      barIds,
      coordinateForSbarId: () => null,
      logicalToCoordinate: (index) => index === 1 ? Number.NaN : index,
    })).toBeNull();
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
