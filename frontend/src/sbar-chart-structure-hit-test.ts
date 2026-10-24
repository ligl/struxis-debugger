import type { CBarRectangleGeometry, SwingSegmentGeometry } from "./sbar-chart-structure-geometry";

export type StructureObjectHit =
  | { kind: "swing"; id: string; distance: number }
  | { kind: "cbar"; id: string; distance: number };

export interface StructureHitTestOptions {
  x: number;
  y: number;
  swings: readonly SwingSegmentGeometry[];
  cbars: readonly CBarRectangleGeometry[];
  swingVisible: boolean;
  cbarVisible: boolean;
  tolerance?: number;
}

function finitePoint(x: number, y: number): boolean {
  return Number.isFinite(x) && Number.isFinite(y);
}

function distanceToSegment(x: number, y: number, segment: SwingSegmentGeometry): number {
  const dx = segment.x2 - segment.x1;
  const dy = segment.y2 - segment.y1;
  const lengthSquared = dx * dx + dy * dy;
  const projection = lengthSquared === 0
    ? 0
    : Math.max(0, Math.min(1, ((x - segment.x1) * dx + (y - segment.y1) * dy) / lengthSquared));
  return Math.hypot(x - (segment.x1 + projection * dx), y - (segment.y1 + projection * dy));
}

function distanceToRectangleBorder(x: number, y: number, rectangle: CBarRectangleGeometry): number {
  const left = rectangle.x;
  const right = rectangle.x + rectangle.width;
  const top = rectangle.y;
  const bottom = rectangle.y + rectangle.height;
  const outsideX = x < left ? left - x : x > right ? x - right : 0;
  const outsideY = y < top ? top - y : y > bottom ? y - bottom : 0;
  if (outsideX > 0 || outsideY > 0) return Math.hypot(outsideX, outsideY);
  return Math.min(x - left, right - x, y - top, bottom - y);
}

/**
 * Resolve a pointer against the currently projected, visible structure geometry.
 * This adapter returns stable domain IDs only; it owns no chart, DOM, Vue, or
 * checkpoint state. Ties preserve the existing Swing-before-CBar priority.
 */
export function hitTestStructureObject(options: StructureHitTestOptions): StructureObjectHit | null {
  const { x, y, swings, cbars, swingVisible, cbarVisible, tolerance = 6 } = options;
  if (!finitePoint(x, y) || !Number.isFinite(tolerance) || tolerance < 0) return null;

  const candidates: StructureObjectHit[] = [];
  if (swingVisible) {
    for (const segment of swings) {
      candidates.push({ kind: "swing", id: segment.id, distance: distanceToSegment(x, y, segment) });
    }
  }
  if (cbarVisible) {
    for (const rectangle of cbars) {
      candidates.push({ kind: "cbar", id: rectangle.id, distance: distanceToRectangleBorder(x, y, rectangle) });
    }
  }

  candidates.sort((a, b) =>
    a.distance - b.distance ||
    (a.kind === b.kind ? 0 : a.kind === "swing" ? -1 : 1) ||
    a.id.localeCompare(b.id),
  );
  const best = candidates[0];
  return best && best.distance <= tolerance ? best : null;
}
