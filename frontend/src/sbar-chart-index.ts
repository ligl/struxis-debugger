/**
 * Stable identity/index/time lookup for one projected SBar sequence.
 *
 * The helper does not create chart coordinates or own chart lifecycle; callers
 * provide the projected chart times so identity mapping stays deterministic
 * and testable without Lightweight Charts.
 */
export function createSbarChartIndex<TTime>(
  bars: readonly { sbarId: string }[],
  projectedTimes: readonly (TTime | null | undefined)[],
): {
  sbarIdByLogicalIndex: readonly string[];
  indexBySbarId: ReadonlyMap<string, number>;
  timeBySbarId: ReadonlyMap<string, TTime>;
} {
  const sbarIdByLogicalIndex = bars.map((bar) => bar.sbarId);
  const indexBySbarId = new Map(
    sbarIdByLogicalIndex.map((sbarId, index) => [sbarId, index] as const),
  );
  const timeBySbarId = new Map(
    bars.flatMap((bar, index) => {
      const time = projectedTimes[index];
      return time === null || time === undefined ? [] : [[bar.sbarId, time] as const];
    }),
  );
  return { sbarIdByLogicalIndex, indexBySbarId, timeBySbarId };
}


export interface SbarChartAnchor {
  index: number;
  sbarId: string;
}

/** Resolve a fractional chart logical coordinate to an exact in-range SBar identity. */
export function resolveSbarChartAnchor(
  bars: readonly { sbarId: string }[],
  logical: number | null | undefined,
): SbarChartAnchor | null {
  if (logical === null || logical === undefined || !Number.isFinite(logical)) return null;
  const index = Math.round(logical);
  if (index < 0 || index >= bars.length) return null;
  const sbarId = bars[index]?.sbarId;
  return sbarId ? { index, sbarId } : null;
}
