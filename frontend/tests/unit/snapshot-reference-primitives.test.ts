import { describe, expect, it, vi } from "vitest";
import type { Time } from "lightweight-charts";
import type { SBarDto } from "../../src/origin-types";
import { alignStrokeCoordinate } from "../../src/chart-canvas-pixel-alignment";
import { SnapshotRangeMarkerPrimitive } from "../../src/snapshot-reference-primitives";

function createBar(index: number): SBarDto {
  const seconds = 1_700_000_000 + index * 60;
  const ns = String(BigInt(seconds) * 1_000_000_000n);
  return {
    sbarId: ns,
    barType: "TEST-1-MINUTE-LAST-EXTERNAL",
    tsEvent: ns,
    tsInit: String(BigInt(ns) + 1n),
    open: "10",
    high: "12",
    low: "9",
    close: index === 0 ? "11" : "9",
    volume: "100",
  };
}

describe("SnapshotRangeMarkerPrimitive", () => {
  it("anchors range markers to stable SBar identities and reprojects them after viewport changes", () => {
    const coordinates = new Map<number, number>([
      [1_700_000_000, 100],
      [1_700_000_060, 200],
      [1_700_000_120, 300],
    ]);
    const context = {
      save: vi.fn(), restore: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(),
      lineTo: vi.fn(), stroke: vi.fn(), setLineDash: vi.fn(),
      strokeStyle: "", lineWidth: 1, lineCap: "butt", lineJoin: "miter",
    };
    const target = {
      useMediaCoordinateSpace: (callback: (arg: { context: typeof context; mediaSize: { width: number; height: number } }) => void) =>
        callback({ context, mediaSize: { width: 700, height: 360 } }),
    };
    const chart = {
      timeScale: () => ({
        getVisibleLogicalRange: () => ({ from: 0, to: 2 }),
        timeToCoordinate: (time: Time) => coordinates.get(Number(time)) ?? null,
      }),
    };
    const markers = new SnapshotRangeMarkerPrimitive();
    markers.attached({ chart: chart as never, requestUpdate: vi.fn() } as never);
    markers.update({ bars: [createBar(0), createBar(1), createBar(2)], enabled: true, offset: 0, liveCount: 2, showArrows: true });
    markers.paneViews()[0]!.renderer()!.draw(target as never);
    const alignedStart = alignStrokeCoordinate(100, 0.9, 1);
    const alignedEnd = alignStrokeCoordinate(200, 0.9, 1);
    expect(context.moveTo).toHaveBeenCalledWith(alignedStart, 0);
    expect(context.lineTo).toHaveBeenCalledWith(alignedStart, 360);
    expect(context.moveTo).toHaveBeenCalledWith(alignedEnd, 0);
    expect(context.lineTo).toHaveBeenCalledWith(alignedEnd, 360);

    context.moveTo.mockClear();
    context.lineTo.mockClear();
    coordinates.set(1_700_000_000, 125);
    coordinates.set(1_700_000_060, 245);
    markers.updateAllViews();
    markers.paneViews()[0]!.renderer()!.draw(target as never);
    const reprojectedStart = alignStrokeCoordinate(125, 0.9, 1);
    const reprojectedEnd = alignStrokeCoordinate(245, 0.9, 1);
    expect(context.moveTo).toHaveBeenCalledWith(reprojectedStart, 0);
    expect(context.lineTo).toHaveBeenCalledWith(reprojectedStart, 360);
    expect(context.moveTo).toHaveBeenCalledWith(reprojectedEnd, 0);
    expect(context.lineTo).toHaveBeenCalledWith(reprojectedEnd, 360);
    markers.dispose();
  });

  it("declares background z-order so range guides render behind native candles", () => {
    const markers = new SnapshotRangeMarkerPrimitive();
    expect(markers.zOrder()).toBe("bottom");
    markers.dispose();
  });
});
