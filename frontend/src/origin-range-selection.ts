import type { SBarDto } from "./origin-types";

export type OriginRangeClickResult =
  | { kind: "start"; sbarId: string }
  | { kind: "complete"; startSbarId: string; endSbarId: string; count: number }
  | { kind: "invalid"; message: string };

/**
 * Resolves one exact SBar click into the next two-click range-selection state.
 * The returned IDs are copied from the authoritative Origin projection; chart
 * indices and display timestamps never cross the domain boundary.
 */
export function resolveOriginRangeClick(
  bars: readonly SBarDto[],
  pendingStartSbarId: string | null,
  clickedSbarId: string,
): OriginRangeClickResult {
  const clickedIndex = bars.findIndex((bar) => bar.sbarId === clickedSbarId);
  if (clickedIndex < 0) {
    return {
      kind: "invalid",
      message: "The selected SBar is not part of the current Origin. No selection was changed.",
    };
  }

  if (pendingStartSbarId === null) {
    return { kind: "start", sbarId: clickedSbarId };
  }

  const pendingIndex = bars.findIndex((bar) => bar.sbarId === pendingStartSbarId);
  if (pendingIndex < 0) {
    return {
      kind: "invalid",
      message: "The pending start SBar is no longer part of this Origin. Select the range again.",
    };
  }

  const firstIndex = Math.min(pendingIndex, clickedIndex);
  const lastIndex = Math.max(pendingIndex, clickedIndex);
  const firstBar = bars[firstIndex];
  const lastBar = bars[lastIndex];
  if (!firstBar || !lastBar) {
    return {
      kind: "invalid",
      message: "The selected range could not be resolved against the current Origin.",
    };
  }

  return {
    kind: "complete",
    startSbarId: firstBar.sbarId,
    endSbarId: lastBar.sbarId,
    count: lastIndex - firstIndex + 1,
  };
}
