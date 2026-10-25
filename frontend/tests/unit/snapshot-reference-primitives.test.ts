import { describe, expect, it, vi } from "vitest";
import type { ISeriesApi, Time } from "lightweight-charts";
import type { SBarDto } from "../../src/origin-types";
import {
  SnapshotReferencePrimitive,
  SnapshotVolumePrimitive,
  type SnapshotPrimitiveState,
} from "../../src/snapshot-reference-primitives";

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

function createHarness() {
  const coordinates = new Map<number, number>([
    [1_700_000_000, 100],
    [1_700_000_060, 200],
    [1_700_000_120, 300],
  ]);
  const context = {
    save: vi.fn(),
    restore: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    setLineDash: vi.fn(),
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    lineCap: "butt",
    lineJoin: "miter",
  };
  const target = {
    useMediaCoordinateSpace: (callback: (arg: {
      context: typeof context;
      mediaSize: { width: number; height: number };
    }) => void) => callback({ context, mediaSize: { width: 700, height: 360 } }),
  };
  const chart = {
    timeScale: () => ({
      getVisibleLogicalRange: () => ({ from: 0, to: 2 }),
      timeToCoordinate: (time: Time) => coordinates.get(Number(time)) ?? null,
    }),
  };
  const series = {
    priceToCoordinate: (price: number) => 200 - price * 10,
  } as unknown as ISeriesApi<"Candlestick">;
  const primitive = new SnapshotReferencePrimitive();
  primitive.attached({
    chart: chart as never,
    series,
    requestUpdate: vi.fn(),
  } as never);
  const state: SnapshotPrimitiveState = {
    bars: [createBar(0), createBar(1), createBar(2)],
    structure: null,
    enabled: true,
    playbackEnabled: false,
    offset: 0,
    liveCount: 2,
    processedCount: 0,
  };
  return { primitive, state, context, target, coordinates, chart };
}

describe("SnapshotReferencePrimitive", () => {
  it("anchors range markers to stable SBar identities and reprojects them after viewport changes", () => {
    const h = createHarness();
    h.primitive.update(h.state);
    const renderer = h.primitive.paneViews()[0]!.renderer();
    expect(renderer).not.toBeNull();

    renderer!.draw(h.target as never);
    expect(h.context.moveTo).toHaveBeenCalledWith(100, 0);
    expect(h.context.lineTo).toHaveBeenCalledWith(100, 360);
    expect(h.context.moveTo).toHaveBeenCalledWith(200, 0);
    expect(h.context.lineTo).toHaveBeenCalledWith(200, 360);

    h.context.moveTo.mockClear();
    h.context.lineTo.mockClear();
    h.coordinates.set(1_700_000_000, 125);
    h.coordinates.set(1_700_000_060, 245);
    h.primitive.updateAllViews();
    h.primitive.paneViews()[0]!.renderer()!.draw(h.target as never);
    expect(h.context.moveTo).toHaveBeenCalledWith(125, 0);
    expect(h.context.lineTo).toHaveBeenCalledWith(125, 360);
    expect(h.context.moveTo).toHaveBeenCalledWith(245, 0);
    expect(h.context.lineTo).toHaveBeenCalledWith(245, 360);
    h.primitive.dispose();
  });

  it("dims the plot during playback and repaints the processed candle prefix", () => {
    const h = createHarness();
    h.primitive.update({
      ...h.state,
      playbackEnabled: true,
      processedCount: 1,
    });
    h.primitive.paneViews()[0]!.renderer()!.draw(h.target as never);

    expect(h.context.fillRect).toHaveBeenCalledWith(0, 0, 700, 360);
    // The processed candle is repainted after the dim layer: wick path + body.
    expect(h.context.moveTo).toHaveBeenCalledWith(100, 80);
    expect(h.context.lineTo).toHaveBeenCalledWith(100, 110);
    expect(h.context.fillRect).toHaveBeenCalledWith(0, 0, 700, 360);
    expect(h.context.fillRect).toHaveBeenCalledWith(94, 90, 12, 10);
    h.primitive.dispose();
  });

  it("clears projected overlays when synchronization becomes ineligible", () => {
    const h = createHarness();
    h.primitive.update(h.state);
    h.primitive.update({ ...h.state, enabled: false });
    expect(h.primitive.paneViews()[0]!.renderer()).not.toBeNull();
    h.context.moveTo.mockClear();
    h.context.lineTo.mockClear();
    h.primitive.paneViews()[0]!.renderer()!.draw(h.target as never);
    expect(h.context.moveTo).not.toHaveBeenCalled();
    expect(h.context.lineTo).not.toHaveBeenCalled();
    h.primitive.detached();
    h.primitive.dispose();
  });

  it("dims the independent Volume pane and continues the fixed range guides", () => {
    const h = createHarness();
    const volume = new SnapshotVolumePrimitive();
    volume.attached({ chart: h.chart as never, requestUpdate: vi.fn() } as never);
    volume.update({
      bars: h.state.bars,
      enabled: true,
      playbackEnabled: true,
      offset: 0,
      liveCount: 2,
    });
    volume.paneViews()[0]!.renderer()!.draw(h.target as never);

    expect(h.context.fillRect).toHaveBeenCalledWith(0, 0, 700, 360);
    expect(h.context.moveTo).toHaveBeenCalledWith(100, 0);
    expect(h.context.lineTo).toHaveBeenCalledWith(100, 360);
    expect(h.context.moveTo).toHaveBeenCalledWith(200, 0);
    expect(h.context.lineTo).toHaveBeenCalledWith(200, 360);
    volume.dispose();
  });

});
