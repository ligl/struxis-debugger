import type { ReplayChartViewportSync } from "./origin-types";

export interface LogicalViewportRange {
  from: number;
  to: number;
}

export type ReplayViewportDirection = "live-to-reference" | "reference-to-live";

/**
 * The Replay coordinate contract is SnapshotIndex = LiveIndex + Offset.
 * Both chart implementations must use this single transform to prevent
 * asymmetric rounding, sign, or range-validation behavior.
 */
export function translateReplayViewportRange(
  request: Pick<ReplayChartViewportSync, "from" | "to" | "offset">,
  direction: ReplayViewportDirection,
): LogicalViewportRange | null {
  if (
    !Number.isFinite(request.from) ||
    !Number.isFinite(request.to) ||
    !Number.isFinite(request.offset) ||
    request.to <= request.from
  ) return null;

  const sign = direction === "live-to-reference" ? 1 : -1;
  const from = request.from + sign * request.offset;
  const to = request.to + sign * request.offset;
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return null;
  return { from, to };
}

/** Compare fractional Lightweight Charts ranges with the established tolerance. */
export function isSameLogicalRange(
  actual: LogicalViewportRange,
  expected: LogicalViewportRange,
  tolerance = 0.01,
): boolean {
  return Number.isFinite(actual.from)
    && Number.isFinite(actual.to)
    && Number.isFinite(expected.from)
    && Number.isFinite(expected.to)
    && Number.isFinite(tolerance)
    && tolerance >= 0
    && Math.abs(actual.from - expected.from) < tolerance
    && Math.abs(actual.to - expected.to) < tolerance;
}
