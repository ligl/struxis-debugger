import { describe, expect, it } from "vitest";
import { computed, ref } from "vue";
import { useOriginRangeSelection } from "../../src/composables/useOriginRangeSelection";
import type { OriginDatasetDto, SBarDto, TestDatasetDto } from "../../src/origin-types";

const bars: SBarDto[] = [
  { sbarId: "100", barType: "TEST-1-MINUTE-LAST-EXTERNAL", tsEvent: "100", tsInit: "101", open: "10", high: "12", low: "9", close: "11", volume: "100" },
  { sbarId: "200", barType: "TEST-1-MINUTE-LAST-EXTERNAL", tsEvent: "200", tsInit: "201", open: "11", high: "13", low: "10", close: "12", volume: "101" },
  { sbarId: "300", barType: "TEST-1-MINUTE-LAST-EXTERNAL", tsEvent: "300", tsInit: "301", open: "12", high: "14", low: "11", close: "13", volume: "102" },
];

const origin: OriginDatasetDto = {
  originDatasetId: "origin-1",
  sourceCatalog: "/catalog",
  enableStructure: true,
  instrumentId: "TEST.SIM",
  barType: "TEST-1-MINUTE-LAST-EXTERNAL",
  timeframe: "1m",
  sbarSequenceFingerprint: "origin-fingerprint",
  sbarCount: bars.length,
  firstSbarId: "100",
  lastSbarId: "300",
  firstTsEvent: "100",
  lastTsEvent: "300",
  structure: null,
  bars,
};

const testDataset: TestDatasetDto = {
  testDatasetId: "test-1",
  originDatasetId: "origin-1",
  instrumentId: "TEST.SIM",
  barType: "TEST-1-MINUTE-LAST-EXTERNAL",
  timeframe: "1m",
  startSbarId: "200",
  endSbarId: "300",
  sbarCount: 2,
  sbarSequenceFingerprint: "test-fingerprint",
};

describe("useOriginRangeSelection", () => {
  it("initializes from the current Test Dataset or falls back to Origin bounds without marking ready", () => {
    const originRef = ref<OriginDatasetDto | null>(origin);
    const state = useOriginRangeSelection(originRef, computed(() => true), ref(false));

    state.initializeFromTestDataset(testDataset);
    expect(state.startSbarId.value).toBe("200");
    expect(state.endSbarId.value).toBe("300");
    expect(state.rangeSelectionReady.value).toBe(false);

    state.initializeFromTestDataset(null);
    expect(state.startSbarId.value).toBe("100");
    expect(state.endSbarId.value).toBe("300");
    expect(state.rangeSelectionReady.value).toBe(false);
  });

  it("owns the complete two-click interaction state and normalizes reverse clicks", () => {
    const state = useOriginRangeSelection(ref<OriginDatasetDto | null>(origin), computed(() => true), ref(false));

    state.handleRangeSbarClick("300");
    expect(state.rangeSelectionPendingStart.value).toBe("300");
    expect(state.rangeSelectionReady.value).toBe(false);
    expect(state.startSbarId.value).toBe("300");
    expect(state.endSbarId.value).toBe("");

    state.handleRangeSbarClick("100");
    expect(state.rangeSelectionPendingStart.value).toBeNull();
    expect(state.rangeSelectionReady.value).toBe(true);
    expect(state.startSbarId.value).toBe("100");
    expect(state.endSbarId.value).toBe("300");
    expect(state.selectedRangeCount.value).toBe(3);
    expect(state.rangeSelectionStatus.value).toContain("3 SBars");
  });

  it("updates inclusive count for boundary edits and prevents boundaries from crossing", () => {
    const state = useOriginRangeSelection(ref<OriginDatasetDto | null>(origin), computed(() => true), ref(false));
    state.handleRangeSbarClick("100");
    state.handleRangeSbarClick("200");

    state.handleRangeBoundaryChange("start", "300");
    expect(state.startSbarId.value).toBe("100");
    expect(state.endSbarId.value).toBe("200");

    state.handleRangeBoundaryChange("end", "300");
    expect(state.endSbarId.value).toBe("300");
    expect(state.selectedRangeCount.value).toBe(3);
    expect(state.rangeSelectionStatus.value).toContain("Adjusted inclusive interval");
  });

  it("clears all interaction state when cancelled or the Origin changes", () => {
    const state = useOriginRangeSelection(ref<OriginDatasetDto | null>(origin), computed(() => true), ref(false));
    state.handleRangeSbarClick("100");
    state.cancelOriginRangeSelection();
    expect(state.rangeSelectionPendingStart.value).toBeNull();
    expect(state.rangeSelectionReady.value).toBe(false);
    expect(state.startSbarId.value).toBe("");
    expect(state.endSbarId.value).toBe("");
    expect(state.selectedRangeCount.value).toBe(0);

    state.handleRangeSbarClick("100");
    state.resetForOrigin();
    expect(state.rangeSelectionPendingStart.value).toBeNull();
    expect(state.startSbarId.value).toBe("");
    expect(state.endSbarId.value).toBe("");
  });

  it("does not mutate selection when Run lifecycle or Test Dataset loading blocks mutation", () => {
    const canMutate = ref(false);
    const loading = ref(false);
    const state = useOriginRangeSelection(ref<OriginDatasetDto | null>(origin), computed(() => canMutate.value), loading);
    state.handleRangeSbarClick("100");
    expect(state.startSbarId.value).toBe("");
    canMutate.value = true;
    loading.value = true;
    state.handleRangeSbarClick("200");
    expect(state.startSbarId.value).toBe("");
  });
});
