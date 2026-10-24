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
