import { describe, expect, it } from "vitest";
import { nextTick, ref } from "vue";
import { useInspectorSelection } from "../../src/composables/useInspectorSelection";
import type { OriginDatasetDto, SBarDto } from "../../src/origin-types";

const bars: SBarDto[] = [
  { sbarId: "sbar-1", barType: "TEST-1-MINUTE-LAST-EXTERNAL", tsEvent: "1", tsInit: "2", open: "10", high: "12", low: "9", close: "11", volume: "100" },
  { sbarId: "sbar-2", barType: "TEST-1-MINUTE-LAST-EXTERNAL", tsEvent: "3", tsInit: "4", open: "11", high: "13", low: "10", close: "12", volume: "101" },
];

function makeOrigin(id = "origin-1"): OriginDatasetDto {
  return {
    originDatasetId: id,
    sourceCatalog: "/catalog",
    enableStructure: true,
    instrumentId: "TEST.SIM",
    barType: "TEST-1-MINUTE-LAST-EXTERNAL",
    timeframe: "1m",
    sbarSequenceFingerprint: "fingerprint",
    sbarCount: bars.length,
    firstSbarId: bars[0].sbarId,
    lastSbarId: bars[1].sbarId,
    firstTsEvent: "1",
    lastTsEvent: "3",
    bars,
    structure: {
      cbarCount: 1,
      cbars: [{
        cbarId: "cbar-1", high: "12", low: "9", sbarStartId: "sbar-1",
        sbarEndId: "sbar-2", spanSbars: 2, fractalType: null, createdAt: "5",
      }],
      swingCount: 1,

      trendCount: 0,

      trends: [],
      swings: [{
        swingId: "swing-1", direction: "up", high: "13", low: "9",
        cbarStartId: "cbar-1", cbarEndId: "cbar-1", sbarStartId: "sbar-1",
        sbarEndId: "sbar-2", startOi: null, endOi: null, volume: "201",
        spanSbars: 2, state: "stable", createdAt: "5", updatedAt: "6",
      }],
    },
  };
}

describe("useInspectorSelection", () => {
  it("selects and resolves only objects present in the active Origin projection", () => {
    const origin = ref<OriginDatasetDto | null>(makeOrigin());
    const workspace = ref<"dataset" | "replay" | "compare">("dataset");
    const state = useInspectorSelection(origin, workspace);

    state.selectSbar("sbar-2");
    expect(state.selectedInspectorObject.value).toEqual({
      kind: "sbar", id: "sbar-2", originDatasetId: "origin-1",
    });
    expect(state.selectedInspectorSbar.value?.close).toBe("12");

    state.selectStructureObject({ kind: "cbar", id: "cbar-1", originDatasetId: "origin-1" });
    expect(state.selectedInspectorCbar.value?.sbarStartId).toBe("sbar-1");
    expect(state.selectedInspectorSbar.value).toBeNull();

    state.selectStructureObject({ kind: "swing", id: "swing-1", originDatasetId: "origin-1" });
    expect(state.selectedInspectorSwing.value?.direction).toBe("up");
  });

  it("ignores stale or unknown object identities without replacing the current selection", () => {
    const origin = ref<OriginDatasetDto | null>(makeOrigin());
    const state = useInspectorSelection(origin, ref<"dataset" | "replay" | "compare">("dataset"));
    state.selectSbar("sbar-1");
    state.selectSbar("missing");
    state.selectStructureObject({ kind: "cbar", id: "missing", originDatasetId: "origin-1" });
    state.selectStructureObject({ kind: "swing", id: "swing-1", originDatasetId: "another-origin" });

    expect(state.selectedInspectorObject.value?.id).toBe("sbar-1");
  });

  it("clears selection when the Origin identity or workspace changes", async () => {
    const origin = ref<OriginDatasetDto | null>(makeOrigin());
    const workspace = ref<"dataset" | "replay" | "compare">("dataset");
    const state = useInspectorSelection(origin, workspace);

    state.selectSbar("sbar-1");
    origin.value = makeOrigin("origin-2");
    await nextTick();
    expect(state.selectedInspectorObject.value).toBeNull();

    state.selectSbar("sbar-2");
    workspace.value = "replay";
    await nextTick();
    expect(state.selectedInspectorObject.value).toBeNull();
  });

  it("clears selection explicitly", () => {
    const origin = ref<OriginDatasetDto | null>(makeOrigin());
    const state = useInspectorSelection(origin, ref<"dataset" | "replay" | "compare">("dataset"));
    state.selectSbar("sbar-1");
    state.clearSelection();
    expect(state.selectedInspectorObject.value).toBeNull();
  });
});
