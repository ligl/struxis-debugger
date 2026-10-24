/**
 * Pure CBar screen-geometry projection shared by chart adapters.
 *
 * Callers own chart lifecycle, coordinate APIs, visibility toggles, selection,
 * and rendering. This module only maps authoritative CBar anchors and prices
 * to finite rectangle geometry.
 */
export interface CBarGeometryInput {
  cbarId: string;
  sbarStartId: string;
  sbarEndId: string;
  high: string;
  low: string;
}

export interface CBarRectangleGeometry {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LogicalViewportRange {
  from: number;
  to: number;
}

export interface ProjectCBarRectanglesOptions {
  cbars: readonly CBarGeometryInput[];
  coordinateForSbarId: (sbarId: string) => number | null | undefined;
  priceToCoordinate: (price: number) => number | null | undefined;
  /** Optional logical index map/range enables viewport culling for large sequences. */
  indexBySbarId?: ReadonlyMap<string, number>;
  visibleRange?: LogicalViewportRange | null;
  viewportOverscan?: number;
}

function isFiniteCoordinate(value: number | null | undefined): value is number {
  return value !== null && value !== undefined && Number.isFinite(value);
}

/**
 * Projects CBar ranges into rectangles. Missing anchors, invalid prices, and
 * unavailable chart coordinates are omitted rather than approximated.
 */
export function projectCBarRectangles(
  options: ProjectCBarRectanglesOptions,
): CBarRectangleGeometry[] {
  const {
    cbars,
    coordinateForSbarId,
    priceToCoordinate,
    indexBySbarId,
    visibleRange,
    viewportOverscan = 2,
  } = options;
  const from = visibleRange && Number.isFinite(visibleRange.from)
    ? visibleRange.from - viewportOverscan
    : Number.NEGATIVE_INFINITY;
  const to = visibleRange && Number.isFinite(visibleRange.to)
    ? visibleRange.to + viewportOverscan
    : Number.POSITIVE_INFINITY;

  return cbars.flatMap((cbar) => {
    if (visibleRange && indexBySbarId) {
      const startIndex = indexBySbarId.get(cbar.sbarStartId);
      const endIndex = indexBySbarId.get(cbar.sbarEndId);
      if (
        startIndex === undefined ||
        endIndex === undefined ||
        Math.max(startIndex, endIndex) < from ||
        Math.min(startIndex, endIndex) > to
      ) return [];
    }

    const high = Number(cbar.high);
    const low = Number(cbar.low);
    if (!Number.isFinite(high) || !Number.isFinite(low)) return [];

    const startX = coordinateForSbarId(cbar.sbarStartId);
    const endX = coordinateForSbarId(cbar.sbarEndId);
    const highY = priceToCoordinate(high);
    const lowY = priceToCoordinate(low);
    if (
      !isFiniteCoordinate(startX) ||
      !isFiniteCoordinate(endX) ||
      !isFiniteCoordinate(highY) ||
      !isFiniteCoordinate(lowY)
    ) return [];

    const left = Math.min(startX, endX);
    const right = Math.max(startX, endX);
    const top = Math.min(highY, lowY);
    const bottom = Math.max(highY, lowY);
    return [{
      id: cbar.cbarId,
      x: left,
      y: top,
      width: right - left,
      height: bottom - top,
    }];
  });
}
