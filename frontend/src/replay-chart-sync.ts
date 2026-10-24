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


export type ReplayViewportRangeObservation = "echo" | "suppressed" | "publish";

/** Per-chart gate for peer-range echoes and transient suppression windows. */
export class ReplayViewportSyncGate {
  private expectedRange: LogicalViewportRange | null = null;
  private suppressionRevision = 0;
  private suppressed = false;

  expectPeerRange(range: LogicalViewportRange): void {
    this.expectedRange = { from: range.from, to: range.to };
  }

  beginSuppression(): number {
    this.suppressionRevision += 1;
    this.suppressed = true;
    return this.suppressionRevision;
  }

  endSuppression(revision: number): void {
    if (revision === this.suppressionRevision) this.suppressed = false;
  }

  observeRange(range: LogicalViewportRange): ReplayViewportRangeObservation {
    if (this.expectedRange) {
      const expected = this.expectedRange;
      this.expectedRange = null;
      if (isSameLogicalRange(range, expected)) return "echo";
    }
    return this.suppressed ? "suppressed" : "publish";
  }

  clear(): void {
    this.expectedRange = null;
    this.suppressed = false;
    this.suppressionRevision += 1;
  }
}


/** Owns transient Crosshair-sync state; chart APIs remain with each chart. */
export class ReplayCrosshairSyncGate {
  private applyRevision = 0;
  private applying = false;
  private peerPositionActive = false;
  get isApplying(): boolean { return this.applying; }
  get hasPeerPosition(): boolean { return this.peerPositionActive; }
  setPeerPositionActive(active: boolean): void { this.peerPositionActive = active; }
  beginApply(): void {
    this.applyRevision += 1;
    const revision = this.applyRevision;
    this.applying = true;
    queueMicrotask(() => {
      if (revision === this.applyRevision) this.applying = false;
    });
  }
  clear(): void {
    this.applyRevision += 1;
    this.applying = false;
    this.peerPositionActive = false;
  }
}

export interface ReplayCrosshairAnchor {
  index: number;
  sbarId: string;
}

/** Resolve a chart's fractional logical coordinate to an exact SBar identity. */
export function resolveReplayCrosshairAnchor(
  bars: readonly { sbarId: string }[],
  logical: number | null | undefined,
): ReplayCrosshairAnchor | null {
  if (logical === null || logical === undefined || !Number.isFinite(logical)) return null;
  const index = Math.round(logical);
  if (index < 0 || index >= bars.length) return null;
  const sbarId = bars[index]?.sbarId;
  return sbarId ? { index, sbarId } : null;
}
