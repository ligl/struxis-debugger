import { computed, ref, watch, type Ref } from "vue";
import type {
  OriginDatasetDto,
  OriginObjectSelection,
  ReplayInspectorCBarDto,
  ReplayInspectorSwingDto,
  ReplayInspectorTrendDto,
  SBarDto,
} from "../origin-types";

export type InspectorWorkspaceMode = "dataset" | "replay" | "compare";

export function useInspectorSelection(
  origin: Ref<OriginDatasetDto | null>,
  workspaceMode: Ref<InspectorWorkspaceMode>,
) {
  const selectedInspectorObject = ref<OriginObjectSelection | null>(null);

  const selectedInspectorSbar = computed<SBarDto | null>(() => {
    const selection = selectedInspectorObject.value;
    if (selection?.kind !== "sbar") return null;
    return origin.value?.bars.find((bar) => bar.sbarId === selection.id) ?? null;
  });

  const selectedInspectorCbar = computed<ReplayInspectorCBarDto | null>(() => {
    const selection = selectedInspectorObject.value;
    if (selection?.kind !== "cbar") return null;
    return origin.value?.structure?.cbars.find((cbar) => cbar.cbarId === selection.id) ?? null;
  });

  const selectedInspectorSwing = computed<ReplayInspectorSwingDto | null>(() => {
    const selection = selectedInspectorObject.value;
    if (selection?.kind !== "swing") return null;
    return origin.value?.structure?.swings.find((swing) => swing.swingId === selection.id) ?? null;
  });

  const selectedInspectorTrend = computed<ReplayInspectorTrendDto | null>(() => {
    const selection = selectedInspectorObject.value;
    if (selection?.kind !== "trend") return null;
    return origin.value?.structure?.trends.find((trend) => trend.trendId === selection.id) ?? null;
  });

  const selectedInspectorKeyzone = computed(() => {
    const selection = selectedInspectorObject.value;
    return selection?.kind === "keyzone"
      ? origin.value?.keyzones?.zones.find((zone) => zone.keyzoneId === selection.id) ?? null
      : null;
  });

  function clearSelection(): void {
    selectedInspectorObject.value = null;
  }

  function selectSbar(sbarId: string): void {
    const currentOrigin = origin.value;
    if (!currentOrigin || !currentOrigin.bars.some((bar) => bar.sbarId === sbarId)) return;
    selectedInspectorObject.value = {
      kind: "sbar",
      id: sbarId,
      originDatasetId: currentOrigin.originDatasetId,
    };
  }

  function selectStructureObject(
    selection: Extract<OriginObjectSelection, { kind: "cbar" | "swing" | "trend" | "keyzone" }>,
  ): void {
    const currentOrigin = origin.value;
    if (!currentOrigin || selection.originDatasetId !== currentOrigin.originDatasetId) return;

    const exists = selection.kind === "keyzone"
      ? currentOrigin.keyzones?.zones.some((zone) => zone.keyzoneId === selection.id)
      : selection.kind === "cbar"
      ? currentOrigin.structure?.cbars.some((cbar) => cbar.cbarId === selection.id)
      : selection.kind === "swing"
        ? currentOrigin.structure?.swings.some((swing) => swing.swingId === selection.id)
        : currentOrigin.structure?.trends.some((trend) => trend.trendId === selection.id);
    if (!exists) return;

    selectedInspectorObject.value = selection;
  }

  // Selection belongs to the active Origin projection and Dataset workspace.
  watch(() => origin.value?.originDatasetId, clearSelection);
  watch(workspaceMode, clearSelection);

  return {
    selectedInspectorObject,
    selectedInspectorSbar,
    selectedInspectorCbar,
    selectedInspectorSwing,
    selectedInspectorTrend,
    selectedInspectorKeyzone,
    selectSbar,
    selectStructureObject,
    clearSelection,
  };
}
