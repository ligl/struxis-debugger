import { describe, expect, it } from "vitest";
import {
  createSnapshotBrightCandleGeometry,
  projectSnapshotBrightCandles,
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


describe("Snapshot processed Live prefix indices", () => {
  it("maps the processed prefix onto the fixed Snapshot overlap", () => {
    expect(resolveSnapshotProcessedRangeIndices({
      offset: 4, liveCount: 3, processedCount: 2, snapshotCount: 10,
    })).toEqual({ start: 4, endExclusive: 6 });
  });

  it("clamps progress to the Live sequence and supports an empty prefix", () => {
    expect(resolveSnapshotProcessedRangeIndices({
      offset: 2, liveCount: 3, processedCount: 99, snapshotCount: 10,
    })).toEqual({ start: 2, endExclusive: 5 });
    expect(resolveSnapshotProcessedRangeIndices({
      offset: 2, liveCount: 3, processedCount: -4, snapshotCount: 10,
    })).toEqual({ start: 2, endExclusive: 2 });
  });

  it("rejects invalid overlap and non-finite progress", () => {
    expect(resolveSnapshotProcessedRangeIndices({
      offset: 8, liveCount: 3, processedCount: 1, snapshotCount: 10,
    })).toBeNull();
    expect(resolveSnapshotProcessedRangeIndices({
      offset: 2, liveCount: 3, processedCount: Number.NaN, snapshotCount: 10,
    })).toBeNull();
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


describe("Snapshot processed candle projection", () => {
  const bars = [
    { sbarId: "s0", high: 12, low: 8 },
    { sbarId: "s1", high: 15, low: 10 },
    { sbarId: "s2", high: 18, low: 13 },
    { sbarId: "s3", high: 20, low: 16 },
  ];
  const xById: Record<string, number> = { s0: 0, s1: 10, s2: 20, s3: 30 };

  it("projects only the processed Live prefix within the visible range", () => {
    expect(projectSnapshotBrightCandles({
      offset: 1,
      liveCount: 3,
      processedCount: 2,
      bars,
      visibleFrom: 1,
      visibleTo: 2,
      coordinateForSbarId: (id) => xById[id],
      priceToCoordinate: (price) => price * -2,
    }).map(({ id }) => id)).toEqual(["s1", "s2"]);
  });

  it("returns no geometry for an invalid overlap or unmappable coordinates", () => {
    const input = {
      offset: 3,
      liveCount: 2,
      processedCount: 2,
      bars,
      visibleFrom: -Infinity,
      visibleTo: Infinity,
      coordinateForSbarId: (id: string) => xById[id],
      priceToCoordinate: (price: number) => price,
    };
    expect(projectSnapshotBrightCandles(input)).toEqual([]);
    expect(projectSnapshotBrightCandles({
      ...input,
      offset: 0,
      liveCount: 2,
      coordinateForSbarId: () => null,
    })).toEqual([]);
  });
});
