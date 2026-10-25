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
