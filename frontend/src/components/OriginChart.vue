<script setup lang="ts">
import SBarChartSurface from "./SBarChartSurface.vue";
import type { OriginObjectSelection, ReplayInspectorStructureDto, SBarDto } from "../origin-types";

defineProps<{
  bars: SBarDto[];
  structure: ReplayInspectorStructureDto | null;
  originDatasetId: string;
  selectedObject?: OriginObjectSelection | null;
  selectionStartSbarId?: string | null;
  selectionEndSbarId?: string | null;
  selectionPending?: boolean;
  selectionEditable?: boolean;
}>();

const emit = defineEmits<{
  sbarClick: [sbarId: string];
  objectClick: [selection: Extract<OriginObjectSelection, { kind: "cbar" | "swing" }>];
  rangeBoundaryChange: [edge: "start" | "end", sbarId: string];
  selectionError: [message: string];
  cancelRangeSelection: [];
}>();

function handleRangeBoundaryChange(edge: "start" | "end", sbarId: string): void {
  emit("rangeBoundaryChange", edge, sbarId);
}
</script>

<template>
  <SBarChartSurface
    :bars="bars"
    :structure="structure"
    :origin-dataset-id="originDatasetId"
    :selected-object="selectedObject"
    :selection-start-sbar-id="selectionStartSbarId"
    :selection-end-sbar-id="selectionEndSbarId"
    :selection-pending="selectionPending"
    :selection-editable="selectionEditable"
    display-context="origin"
    @sbar-click="emit('sbarClick', $event)"
    @object-click="emit('objectClick', $event)"
    @range-boundary-change="handleRangeBoundaryChange"
    @selection-error="emit('selectionError', $event)"
    @cancel-range-selection="emit('cancelRangeSelection')"
  />
</template>
