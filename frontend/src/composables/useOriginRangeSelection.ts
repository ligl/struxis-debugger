import { ref, type ComputedRef, type Ref } from "vue";
import type { OriginDatasetDto, TestDatasetDto } from "../origin-types";
import { resolveOriginRangeClick } from "../origin-range-selection";
import { formatDomainTimestamp } from "../timestamp-format";

/** Formats a stable SBar identity as the Origin's authoritative event time for user-facing feedback. */
function displaySbarTime(origin: OriginDatasetDto, sbarId: string): string {
  const bar = origin.bars.find((item) => item.sbarId === sbarId);
  return bar ? formatDomainTimestamp(bar.tsEvent, origin.timeframe) : sbarId;
}

/** Owns the full interactive state for selecting and editing an inclusive Origin SBar interval. */
export function useOriginRangeSelection(origin: Ref<OriginDatasetDto | null>, canMutate: ComputedRef<boolean>, testLoading: Ref<boolean>) {
  const startSbarId = ref("");
  const endSbarId = ref("");
  const rangeSelectionPendingStart = ref<string | null>(null);
  const rangeSelectionReady = ref(false);
  const selectedRangeCount = ref(0);
  const rangeSelectionStatus = ref("Click anywhere in the chart plot to select the start time of your Test interval.");

  function resetForOrigin(): void {
    rangeSelectionPendingStart.value = null;
    rangeSelectionReady.value = false;
    startSbarId.value = "";
    endSbarId.value = "";
    selectedRangeCount.value = 0;
    rangeSelectionStatus.value = "Click anywhere in the chart plot to select the start time of your Test interval.";
  }

  function initializeFromTestDataset(dataset: TestDatasetDto | null): void {
    const currentOrigin = origin.value;
    rangeSelectionPendingStart.value = null;
    rangeSelectionReady.value = false;
    selectedRangeCount.value = 0;
    if (!currentOrigin) {
      startSbarId.value = "";
      endSbarId.value = "";
      return;
    }
    startSbarId.value = dataset?.startSbarId ?? currentOrigin.firstSbarId;
    endSbarId.value = dataset?.endSbarId ?? currentOrigin.lastSbarId;
    rangeSelectionStatus.value = "Click anywhere in the chart plot to select the start time of your Test interval.";
  }

  function handleRangeSbarClick(sbarId: string): void {
    const currentOrigin = origin.value;
    if (!currentOrigin || !canMutate.value || testLoading.value) return;
    const result = resolveOriginRangeClick(currentOrigin.bars, rangeSelectionPendingStart.value, sbarId);
    if (result.kind === "invalid") {
      rangeSelectionStatus.value = result.message;
      return;
    }
    if (result.kind === "start") {
      rangeSelectionPendingStart.value = result.sbarId;
      startSbarId.value = result.sbarId;
      endSbarId.value = "";
      rangeSelectionReady.value = false;
      selectedRangeCount.value = 0;
      rangeSelectionStatus.value = `Start time selected: ${displaySbarTime(currentOrigin, result.sbarId)}. Move the pointer to preview the range, then click to fix the inclusive end boundary.`;
      return;
    }
    startSbarId.value = result.startSbarId;
    endSbarId.value = result.endSbarId;
    rangeSelectionPendingStart.value = null;
    rangeSelectionReady.value = true;
    selectedRangeCount.value = result.count;
    rangeSelectionStatus.value = `Selected inclusive interval: ${result.count} SBars (${displaySbarTime(currentOrigin, result.startSbarId)} – ${displaySbarTime(currentOrigin, result.endSbarId)}).`;
  }

  function handleRangeBoundaryChange(edge: "start" | "end", sbarId: string): void {
    const currentOrigin = origin.value;
    if (!currentOrigin || !canMutate.value || testLoading.value || !rangeSelectionReady.value) return;
    const bars = currentOrigin.bars;
    const nextIndex = bars.findIndex((bar) => bar.sbarId === sbarId);
    const currentStartIndex = bars.findIndex((bar) => bar.sbarId === startSbarId.value);
    const currentEndIndex = bars.findIndex((bar) => bar.sbarId === endSbarId.value);
    if (nextIndex < 0 || currentStartIndex < 0 || currentEndIndex < 0) {
      rangeSelectionStatus.value = "The dragged boundary is not part of the current Origin. The interval was not changed.";
      return;
    }
    if (edge === "start") {
      if (nextIndex > currentEndIndex) return;
      startSbarId.value = sbarId;
    } else {
      if (nextIndex < currentStartIndex) return;
      endSbarId.value = sbarId;
    }
    const startIndex = edge === "start" ? nextIndex : currentStartIndex;
    const endIndex = edge === "end" ? nextIndex : currentEndIndex;
    selectedRangeCount.value = endIndex - startIndex + 1;
    rangeSelectionPendingStart.value = null;
    rangeSelectionReady.value = true;
    rangeSelectionStatus.value = `Adjusted inclusive interval: ${selectedRangeCount.value} SBars (${displaySbarTime(currentOrigin, startSbarId.value)} – ${displaySbarTime(currentOrigin, endSbarId.value)}).`;
  }

  function handleRangeSelectionError(message: string): void { rangeSelectionStatus.value = message; }

  function cancelOriginRangeSelection(): void {
    rangeSelectionPendingStart.value = null;
    rangeSelectionReady.value = false;
    startSbarId.value = "";
    endSbarId.value = "";
    selectedRangeCount.value = 0;
    rangeSelectionStatus.value = "Range selection cancelled. Click the chart to choose a new start SBar.";
  }

  return { startSbarId, endSbarId, rangeSelectionPendingStart, rangeSelectionReady, selectedRangeCount, rangeSelectionStatus, resetForOrigin, initializeFromTestDataset, handleRangeSbarClick, handleRangeBoundaryChange, handleRangeSelectionError, cancelOriginRangeSelection };
}
