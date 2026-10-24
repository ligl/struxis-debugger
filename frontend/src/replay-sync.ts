export interface ReplaySyncSequenceDescriptor {
  snapshotId: string;
  barType: string;
  sbarIds: string[];
}

function timeframeKey(barType: string | null | undefined): string | null {
  if (!barType) return null;
  const match = /-(\d+)-(SECOND|MINUTE|HOUR|DAY|WEEK|MONTH|YEAR)-/i.exec(barType);
  return match ? match[1] + ":" + match[2]!.toUpperCase() : null;
}

/**
 * Resolve the single Snapshot logical-index offset for a validated Live /
 * Snapshot sequence pair. This is pure coordination logic; chart components
 * must not independently infer compatibility or translate offsets.
 */
export function resolveReplaySyncOffset(
  liveBarType: string | null,
  liveSbarIds: readonly string[],
  reference: ReplaySyncSequenceDescriptor | null,
): number | null {
  if (!reference || liveSbarIds.length === 0 || reference.sbarIds.length === 0) return null;
  const liveTimeframe = timeframeKey(liveBarType);
  const referenceTimeframe = timeframeKey(reference.barType);
  if (!liveTimeframe || liveTimeframe !== referenceTimeframe) return null;

  const indexById = new Map<string, number>();
  for (let index = 0; index < reference.sbarIds.length; index += 1) {
    const id = reference.sbarIds[index]!;
    if (indexById.has(id)) return null;
    indexById.set(id, index);
  }
  const first = indexById.get(liveSbarIds[0]!);
  if (first === undefined) return null;
  for (let index = 0; index < liveSbarIds.length; index += 1) {
    if (indexById.get(liveSbarIds[index]!) !== first + index) return null;
  }
  return first;
}
