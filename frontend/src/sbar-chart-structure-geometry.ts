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


/** Mirrors Lightweight Charts 5.x candlestick body-width calculation. */
export function candlestickBodyWidth(barSpacing: number, pixelRatio: number): number {
  if (!Number.isFinite(barSpacing) || barSpacing <= 0 || !Number.isFinite(pixelRatio) || pixelRatio <= 0) return Number.NaN;
  const specialCaseFrom = 2.5;
  const specialCaseTo = 4;
  let width: number;
  if (barSpacing >= specialCaseFrom && barSpacing <= specialCaseTo) {
    width = Math.floor(3 * pixelRatio);
  } else {
    const coefficient = 1 - (0.2 * Math.atan(Math.max(specialCaseTo, barSpacing) - specialCaseTo)) / (Math.PI * 0.5);
    const optimal = Math.min(Math.floor(barSpacing * coefficient * pixelRatio), Math.floor(barSpacing * pixelRatio));
    width = Math.max(Math.floor(pixelRatio), optimal);
  }
  if (width >= 2) {
    const wickWidth = Math.floor(pixelRatio);
    if (wickWidth % 2 !== width % 2) width--;
  }
  return width / pixelRatio;
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

    // CBar boundaries are anchored to the first and last SBar center
    // coordinates. Do not expand by candle-body width: that changes the
    // authoritative structural interval and makes hit-testing too broad.
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

export interface SwingGeometryInput {
  swingId: string;
  sbarStartId: string;
  sbarEndId: string;
  high: string;
  low: string;
  direction: string;
  state: string;
}

export interface SwingSegmentGeometry {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  state: string;
}

export interface ProjectSwingSegmentsOptions {
  swings: readonly SwingGeometryInput[];
  coordinateForSbarId: (sbarId: string) => number | null | undefined;
  priceToCoordinate: (price: number) => number | null | undefined;
  indexBySbarId?: ReadonlyMap<string, number>;
  visibleRange?: LogicalViewportRange | null;
  viewportOverscan?: number;
}

/**
 * Projects Swing endpoints to screen coordinates without deciding visual style.
 * Callers own state-to-style mapping and any diagnostics for unknown states.
 */
export function projectSwingSegments(
  options: ProjectSwingSegmentsOptions,
): SwingSegmentGeometry[] {
  const {
    swings,
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

  return swings.flatMap((swing) => {
    if (visibleRange && indexBySbarId) {
      const startIndex = indexBySbarId.get(swing.sbarStartId);
      const endIndex = indexBySbarId.get(swing.sbarEndId);
      if (
        startIndex === undefined ||
        endIndex === undefined ||
        Math.max(startIndex, endIndex) < from ||
        Math.min(startIndex, endIndex) > to
      ) return [];
    }

    const high = Number(swing.high);
    const low = Number(swing.low);
    if (!Number.isFinite(high) || !Number.isFinite(low)) return [];

    const x1 = coordinateForSbarId(swing.sbarStartId);
    const x2 = coordinateForSbarId(swing.sbarEndId);
    const startsAtLow = swing.direction === "Up";
    const y1 = priceToCoordinate(startsAtLow ? low : high);
    const y2 = priceToCoordinate(startsAtLow ? high : low);
    if (
      !isFiniteCoordinate(x1) ||
      !isFiniteCoordinate(x2) ||
      !isFiniteCoordinate(y1) ||
      !isFiniteCoordinate(y2)
    ) return [];

    return [{
      id: swing.swingId,
      x1,
      y1,
      x2,
      y2,
      state: swing.state,
    }];
  });
}


export interface ProjectStructureOverlayOptions {
  cbars: readonly CBarGeometryInput[];
  swings: readonly SwingGeometryInput[];
  indexBySbarId: ReadonlyMap<string, number>;
  visibleRange: LogicalViewportRange | null;
  coordinateForSbarId: (sbarId: string) => number | null | undefined;
  priceToCoordinate: (price: number) => number | null | undefined;
  cbarVisible: boolean;
  swingVisible: boolean;
  resolveSwingStyle: (state: string) => { color: string; dasharray: string };
}

export interface StructureOverlayGeometry {
  cbarRectangles: CBarRectangleGeometry[];
  swingSegments: Array<SwingSegmentGeometry & { color: string; dasharray: string }>;
}

/**
 * The shared projection entry point for all chart adapters.
 *
 * Callers supply chart-local coordinate functions and presentation policy;
 * this function owns the consistent CBar / Swing projection and visibility
 * gating. It deliberately has no chart instance, DTO state, or interaction
 * semantics, so each chart can safely retain its own runtime.
 */
export function projectStructureOverlayGeometry(
  options: ProjectStructureOverlayOptions,
): StructureOverlayGeometry {
  const {
    cbars,
    swings,
    indexBySbarId,
    visibleRange,
    coordinateForSbarId,
    priceToCoordinate,
    cbarVisible,
    swingVisible,
    resolveSwingStyle,
  } = options;

  return {
    cbarRectangles: cbarVisible
      ? projectCBarRectangles({
        cbars,
        indexBySbarId,
        visibleRange,
        coordinateForSbarId,
        priceToCoordinate,
      })
      : [],
    swingSegments: swingVisible
      ? projectSwingSegments({
        swings,
        indexBySbarId,
        visibleRange,
        coordinateForSbarId,
        priceToCoordinate,
      }).map((segment) => ({
        ...segment,
        ...resolveSwingStyle(segment.state),
      }))
      : [],
  };
}
