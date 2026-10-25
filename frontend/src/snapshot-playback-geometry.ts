export interface SnapshotLiveRangeIndices {
  start: number;
  end: number;
}

/**
 * Resolve the fixed Snapshot indices representing the Live sequence.
 * Viewport coordinates never participate in anchor identity.
 */
export function resolveSnapshotLiveRangeIndices(
  offset: number | null | undefined,
  liveCount: number,
  snapshotCount: number,
): SnapshotLiveRangeIndices | null {
  if (
    offset === null ||
    offset === undefined ||
    !Number.isInteger(offset) ||
    !Number.isInteger(liveCount) ||
    !Number.isInteger(snapshotCount) ||
    liveCount <= 0 ||
    snapshotCount <= 0
  ) return null;

  const start = offset;
  const end = offset + liveCount - 1;
  if (start < 0 || end < start || end >= snapshotCount) return null;
  return { start, end };
}


export interface SnapshotLiveRangeCoordinates {
  start: number;
  end: number;
}

/**
 * Project fixed Snapshot anchors to chart coordinates.
 * The caller supplies chart-library coordinate lookups; this helper preserves
 * domain-index identity and never clamps anchors to the current viewport.
 */
export function resolveSnapshotLiveRangeCoordinates(input: {
  offset: number | null | undefined;
  liveCount: number;
  barIds: readonly string[];
  coordinateForSbarId: (sbarId: string) => number | null | undefined;
  logicalToCoordinate: (index: number) => number | null | undefined;
}): SnapshotLiveRangeCoordinates | null {
  const anchors = resolveSnapshotLiveRangeIndices(
    input.offset,
    input.liveCount,
    input.barIds.length,
  );
  if (!anchors) return null;

  const project = (index: number): number | null => {
    const sbarId = input.barIds[index];
    const byIdentity = sbarId ? input.coordinateForSbarId(sbarId) : null;
    if (byIdentity !== null && byIdentity !== undefined && Number.isFinite(byIdentity)) {
      return byIdentity;
    }
    const byLogical = input.logicalToCoordinate(index);
    return byLogical !== null && byLogical !== undefined && Number.isFinite(byLogical)
      ? byLogical
      : null;
  };

  const start = project(anchors.start);
  const end = project(anchors.end);
  return start === null || end === null ? null : { start, end };
}

export interface SnapshotBrightCandleGeometry {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Build the visible SVG cutout rectangle for one processed Snapshot candle. */
export function createSnapshotBrightCandleGeometry(input: {
  id: string;
  x: number;
  highY: number;
  lowY: number;
  adjacentXs: readonly number[];
}): SnapshotBrightCandleGeometry | null {
  const { id, x, highY, lowY, adjacentXs } = input;
  if (!id || ![x, highY, lowY].every(Number.isFinite)) return null;

  const distances = adjacentXs
    .filter(Number.isFinite)
    .map((adjacentX) => Math.abs(adjacentX - x))
    .filter((distance) => distance > 0);
  const spacing = distances.length > 0 ? Math.min(...distances) : 8;
  const width = Math.max(2, Math.min(12, spacing * 0.8));
  const top = Math.min(highY, lowY);
  const bottom = Math.max(highY, lowY);
  return {
    id,
    x: x - width / 2,
    y: top,
    width,
    height: Math.max(1, bottom - top),
  };
}


export interface SnapshotBrightCandleProjectionInput {
  offset: number | null | undefined;
  liveCount: number;
  processedCount: number;
  bars: readonly { sbarId: string; high: number | string; low: number | string }[];
  visibleFrom: number;
  visibleTo: number;
  coordinateForSbarId: (sbarId: string) => number | null | undefined;
  priceToCoordinate: (price: number) => number | null | undefined;
}

/**
 * Project the processed Live prefix into Snapshot candle cutouts.
 * The caller provides chart-library transforms; this function owns index
 * validation, visible-range filtering, and the geometry projection sequence.
 */
export function projectSnapshotBrightCandles(
  input: SnapshotBrightCandleProjectionInput,
): SnapshotBrightCandleGeometry[] {
  const processedRange = resolveSnapshotProcessedRangeIndices({
    offset: input.offset,
    liveCount: input.liveCount,
    processedCount: input.processedCount,
    snapshotCount: input.bars.length,
  });
  if (!processedRange) return [];

  const overlays: SnapshotBrightCandleGeometry[] = [];
  for (let index = processedRange.start; index < processedRange.endExclusive; index += 1) {
    if (index < input.visibleFrom || index > input.visibleTo) continue;
    const bar = input.bars[index];
    if (!bar) continue;
    const x = input.coordinateForSbarId(bar.sbarId);
    const high = Number(bar.high);
    const low = Number(bar.low);
    if (!Number.isFinite(high) || !Number.isFinite(low)) continue;
    const highY = input.priceToCoordinate(high);
    const lowY = input.priceToCoordinate(low);
    if ([x, highY, lowY].some((value) => value === null || value === undefined || !Number.isFinite(value))) continue;

    const adjacentXs = [
      index > 0 ? input.coordinateForSbarId(input.bars[index - 1]!.sbarId) : null,
      index + 1 < input.bars.length ? input.coordinateForSbarId(input.bars[index + 1]!.sbarId) : null,
    ].filter((value): value is number => value !== null && value !== undefined && Number.isFinite(value));
    const geometry = createSnapshotBrightCandleGeometry({
      id: bar.sbarId,
      x: x as number,
      highY: highY as number,
      lowY: lowY as number,
      adjacentXs,
    });
    if (geometry) overlays.push(geometry);
  }
  return overlays;
}
