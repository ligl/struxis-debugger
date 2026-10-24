<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import SBarChartSurface from "./SBarChartSurface.vue";
import type { OriginObjectSelection, ReplayInspectorStructureDto, SBarDto } from "../origin-types";

const props = defineProps<{
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

type SurfacePort = {
  getSbarCoordinate: (sbarId: string) => number | null;
  getSbarIdAtClientX: (clientX: number, clampToSequence?: boolean) => string | null;
  hasSbarId: (sbarId: string) => boolean;
  getSbarMarker: (sbarId: string) => { id: string; x: number; y: number; width: number; height: number } | null;
  revealSbarRange: (anchorIds: string[]) => boolean;
};
const surface = ref<SurfacePort | null>(null);
const selectedSbarMarker = ref<{ id: string; x: number; y: number; width: number; height: number } | null>(null);
const selectionStartX = ref<number | null>(null);
const selectionEndX = ref<number | null>(null);
const previewX = ref<number | null>(null);
let draggingBoundary: "start" | "end" | null = null;
let lastEmittedBoundaryId: string | null = null;

const selectionStatus = computed(() => {
  if (props.selectionPending) return "SELECT END · MOVE TO PREVIEW";
  if (props.selectionStartSbarId && props.selectionEndSbarId) {
    return props.selectionEditable !== false ? "DRAG EDGES · ADJUST INTERVAL" : "INCLUSIVE INTERVAL FIXED";
  }
  return props.selectionStartSbarId ? "SELECT END ON CHART" : "CLICK CHART TO SELECT START";
});

function updateSelectionCoordinates(): void {
  selectionStartX.value = surface.value?.getSbarCoordinate(props.selectionStartSbarId ?? "") ?? null;
  selectionEndX.value = surface.value?.getSbarCoordinate(props.selectionEndSbarId ?? "") ?? null;
  if (!props.selectionPending) previewX.value = null;
}

function updateSelectedObjectProjection(reveal = false): void {
  const selected = props.selectedObject;
  if (!selected || selected.originDatasetId !== props.originDatasetId) {
    selectedSbarMarker.value = null;
    return;
  }
  selectedSbarMarker.value = selected.kind === "sbar"
    ? surface.value?.getSbarMarker(selected.id) ?? null
    : null;
  if (!reveal || !surface.value) return;

  let anchorIds: string[];
  if (selected.kind === "sbar") {
    anchorIds = [selected.id];
  } else if (selected.kind === "cbar") {
    const cbar = props.structure?.cbars.find((item) => item.cbarId === selected.id);
    if (!cbar) return;
    anchorIds = [cbar.sbarStartId, cbar.sbarEndId];
  } else {
    const swing = props.structure?.swings.find((item) => item.swingId === selected.id);
    if (!swing) return;
    anchorIds = [swing.sbarStartId, swing.sbarEndId];
  }
  surface.value.revealSbarRange(anchorIds);
}

function handleProjectionFrame(): void {
  updateSelectionCoordinates();
  updateSelectedObjectProjection();
}

function handlePointerPosition(point: { x: number; y: number } | null): void {
  previewX.value = props.selectionPending && selectionStartX.value !== null ? point?.x ?? null : null;
}

function handleChartInteractionError(message: string): void {
  emit("selectionError", message);
}

function handleSelectionRequest(event: Event): void {
  const detail = (event as CustomEvent<{ sbarId?: unknown }>).detail;
  if (typeof detail?.sbarId !== "string" || detail.sbarId.length === 0) {
    emit("selectionError", "A programmatic Origin selection requires an exact SBar ID.");
    return;
  }
  if (!surface.value?.hasSbarId(detail.sbarId)) {
    emit("selectionError", "The selected SBar is not part of the current Origin chart.");
    return;
  }
  emit("sbarClick", detail.sbarId);
}

function handleContextMenu(): void {
  emit("cancelRangeSelection");
}

function resolveBoundaryDragSbar(clientX: number): string | null {
  if (!Number.isFinite(clientX) || !surface.value) return null;
  const currentStart = props.bars.findIndex((bar) => bar.sbarId === props.selectionStartSbarId);
  const currentEnd = props.bars.findIndex((bar) => bar.sbarId === props.selectionEndSbarId);
  if (currentStart < 0 || currentEnd < 0) return null;
  const id = surface.value.getSbarIdAtClientX(clientX, true);
  if (!id) return null;
  const index = props.bars.findIndex((bar) => bar.sbarId === id);
  if (index < 0) return null;
  const clamped = draggingBoundary === "start"
    ? Math.min(index, currentEnd)
    : Math.max(index, currentStart);
  return props.bars[clamped]?.sbarId ?? null;
}

function startBoundaryDrag(edge: "start" | "end", event: PointerEvent): void {
  if (event.button !== 0 || props.selectionEditable === false || props.selectionPending || !props.selectionStartSbarId || !props.selectionEndSbarId) return;
  draggingBoundary = edge;
  lastEmittedBoundaryId = edge === "start" ? props.selectionStartSbarId : props.selectionEndSbarId;
  event.preventDefault();
  window.addEventListener("pointermove", handleBoundaryPointerMove);
  window.addEventListener("pointerup", stopBoundaryDrag);
  window.addEventListener("pointercancel", stopBoundaryDrag);
}

function handleBoundaryPointerMove(event: PointerEvent): void {
  if (!draggingBoundary) return;
  const sbarId = resolveBoundaryDragSbar(event.clientX);
  if (!sbarId || sbarId === lastEmittedBoundaryId) return;
  lastEmittedBoundaryId = sbarId;
  emit("rangeBoundaryChange", draggingBoundary, sbarId);
}

function stopBoundaryDrag(): void {
  draggingBoundary = null;
  lastEmittedBoundaryId = null;
  window.removeEventListener("pointermove", handleBoundaryPointerMove);
  window.removeEventListener("pointerup", stopBoundaryDrag);
  window.removeEventListener("pointercancel", stopBoundaryDrag);
}

watch(
  () => [props.bars, props.originDatasetId, props.selectionStartSbarId, props.selectionEndSbarId, props.selectionPending] as const,
  updateSelectionCoordinates,
  { deep: false, immediate: true, flush: "post" },
);

watch(() => props.selectedObject, () => updateSelectedObjectProjection(true), { deep: true, flush: "post" });

onMounted(() => {
  updateSelectionCoordinates();
  updateSelectedObjectProjection();
});
onBeforeUnmount(stopBoundaryDrag);
</script>

<template>
  <section
    class="origin-chart-adapter"
    @struxis-select-sbar="handleSelectionRequest"
    @contextmenu.prevent.stop="handleContextMenu"
  >
    <SBarChartSurface
      ref="surface"
      :bars="bars"
      :structure="structure"
      :origin-dataset-id="originDatasetId"
      :show-header="true"
      :show-footer="true"
      panel-label="Origin SBar chart"
      :chart-label="`Candlestick and volume chart for Origin ${originDatasetId}`"
      @sbar-click="emit('sbarClick', $event)"
      @object-click="emit('objectClick', $event)"
      @chart-interaction-error="handleChartInteractionError"
      @pointer-position="handlePointerPosition"
      @projection-frame="handleProjectionFrame"
    >
      <template #chart-structure-overlays="{ cbarRectangles, swingSegments }">
        <rect
          v-if="selectedSbarMarker"
          class="origin-object-selected-sbar"
          :x="selectedSbarMarker.x"
          :y="selectedSbarMarker.y"
          :width="selectedSbarMarker.width"
          :height="selectedSbarMarker.height"
          data-testid="origin-selected-sbar"
          :data-sbar-id="selectedSbarMarker.id"
        />
        <line
          v-for="segment in swingSegments.filter((item) => props.selectedObject?.kind === 'swing' && props.selectedObject.id === item.id && props.selectedObject.originDatasetId === originDatasetId)"
          :key="segment.id"
          :x1="segment.x1"
          :y1="segment.y1"
          :x2="segment.x2"
          :y2="segment.y2"
          stroke="#D99A45"
          stroke-width="2.5"
          stroke-linecap="round"
          data-testid="origin-selected-swing"
          :data-swing-id="segment.id"
        />
        <rect
          v-for="rectangle in cbarRectangles.filter((item) => props.selectedObject?.kind === 'cbar' && props.selectedObject.id === item.id && props.selectedObject.originDatasetId === originDatasetId)"
          :key="rectangle.id"
          :x="rectangle.x"
          :y="rectangle.y"
          :width="rectangle.width"
          :height="rectangle.height"
          fill="none"
          stroke="#D99A45"
          stroke-width="2"
          data-testid="origin-selected-cbar"
          :data-cbar-id="rectangle.id"
        />
      </template>
      <template #footer-trailing>
        <span class="origin-chart-selection-status" data-testid="origin-chart-selection-status">{{ selectionStatus }}</span>
      </template>
      <template #chart-interaction-overlay>
        <div class="origin-selection-overlay" data-testid="origin-selection-overlay" aria-hidden="true">
          <div
            v-if="selectionPending && selectionStartX !== null && previewX !== null"
            class="origin-selection-shade"
            data-testid="origin-selection-preview"
            :style="{ left: `${Math.min(selectionStartX, previewX)}px`, width: `${Math.abs(previewX - selectionStartX)}px` }"
          ></div>
          <div
            v-if="selectionStartX !== null"
            class="origin-selection-line origin-selection-line-start"
            data-testid="origin-selection-start-line"
            :style="{ left: `${selectionStartX}px`, pointerEvents: selectionEditable !== false && !selectionPending && selectionEndX !== null ? 'auto' : 'none', cursor: selectionEditable !== false && !selectionPending && selectionEndX !== null ? 'ew-resize' : 'default' }"
            @pointerdown.stop="startBoundaryDrag('start', $event)"
          ></div>
          <div
            v-if="selectionPending && selectionStartX !== null && previewX !== null"
            class="origin-selection-line origin-selection-line-preview"
            data-testid="origin-selection-preview-line"
            :style="{ left: `${previewX}px` }"
          ></div>
          <template v-else-if="selectionEndX !== null">
            <div
              class="origin-selection-shade"
              data-testid="origin-selection-completed"
              :style="{ left: `${Math.min(selectionStartX ?? selectionEndX, selectionEndX)}px`, width: `${Math.abs(selectionEndX - (selectionStartX ?? selectionEndX))}px` }"
            ></div>
            <div
              class="origin-selection-line origin-selection-line-end"
              data-testid="origin-selection-end-line"
              :style="{ left: `${selectionEndX}px`, pointerEvents: selectionEditable !== false ? 'auto' : 'none', cursor: selectionEditable !== false ? 'ew-resize' : 'default' }"
              @pointerdown.stop="startBoundaryDrag('end', $event)"
            ></div>
          </template>
        </div>
      </template>
    </SBarChartSurface>
  </section>
</template>

<style scoped>
.origin-chart-adapter { position: relative; display: contents; }
.origin-selection-line::before { position: absolute; top: -6px; bottom: -6px; left: -8px; width: 17px; content: ""; background: transparent; cursor: ew-resize; }
.origin-chart-selection-status { min-width: 0; margin-left: auto; overflow: hidden; color: #a5b0b7; font: 8px ui-monospace, SFMono-Regular, Consolas, monospace; text-overflow: ellipsis; white-space: nowrap; }
</style>
