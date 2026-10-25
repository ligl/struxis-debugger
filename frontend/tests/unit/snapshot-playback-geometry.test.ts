import { describe, expect, it } from "vitest";
import {
  resolveSnapshotLiveRangeCoordinates,
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
