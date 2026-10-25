import { describe, expect, it } from "vitest";
import type { SBarDto } from "../../src/origin-types";
import { projectSnapshotPlaybackSeries } from "../../src/snapshot-playback-series";

function createBar(index: number): SBarDto {
  const ns = String(BigInt(1_700_000_000 + index * 60) * 1_000_000_000n);
  return {
    sbarId: ns,
    barType: "TEST-1-MINUTE-LAST-EXTERNAL",
    tsEvent: ns,
    tsInit: String(BigInt(ns) + 1n),
    open: "10",
    high: "12",
    low: "9",
    close: index % 2 === 0 ? "11" : "9",
    volume: "100",
  };
}

describe("projectSnapshotPlaybackSeries", () => {
  const bars = [createBar(0), createBar(1), createBar(2), createBar(3)];

  it("keeps only the processed Snapshot prefix at native brightness", () => {
    const normal = projectSnapshotPlaybackSeries({
      bars, playbackEnabled: false, offset: 1, liveCount: 3, processedCount: 0,
    });
    const playing = projectSnapshotPlaybackSeries({
      bars, playbackEnabled: true, offset: 1, liveCount: 3, processedCount: 1,
    });

    expect(playing.processedStart).toBe(1);
    expect(playing.processedEndExclusive).toBe(2);
    expect(playing.candles[1]?.color).toBe(normal.candles[1]?.color);
    expect(playing.candles[1]?.wickColor).toBe(normal.candles[1]?.wickColor);
    expect(playing.volume[1]?.color).toBe(normal.volume[1]?.color);
    expect(playing.candles[0]?.color).not.toBe(normal.candles[0]?.color);
    expect(playing.candles[2]?.color).not.toBe(normal.candles[2]?.color);
    expect(playing.volume[3]?.color).not.toBe(normal.volume[3]?.color);
  });

  it("restores all native colors when playback is disabled", () => {
    const normal = projectSnapshotPlaybackSeries({
      bars, playbackEnabled: false, offset: 1, liveCount: 3, processedCount: 2,
    });
    const stopped = projectSnapshotPlaybackSeries({
      bars, playbackEnabled: false, offset: null, liveCount: 0, processedCount: 0,
    });
    expect(stopped.candles).toEqual(normal.candles);
    expect(stopped.volume).toEqual(normal.volume);
  });

  it("clamps processed count to the anchored Live range and Snapshot length", () => {
    const projection = projectSnapshotPlaybackSeries({
      bars, playbackEnabled: true, offset: 3, liveCount: 10, processedCount: 99,
    });
    expect(projection.processedStart).toBe(3);
    expect(projection.processedEndExclusive).toBe(4);
    expect(projection.candles[3]?.color).toBe("#8D555B");
  });
});
