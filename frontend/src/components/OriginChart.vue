<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import ChartSurface from "./ChartSurface.vue";
import type { OriginObjectSelection, ReplayInspectorStructureDto, SBarDto } from "../origin-types";
import type { ChartSurfacePort, ChartSurfaceSBarMarker } from "../chart-surface-contract";
import { hitTestStructureObject as resolveStructureHit } from "../sbar-chart-structure-hit-test";
import { SBarMarkerPrimitive } from "../sbar-marker-primitive";

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

const surface = ref<ChartSurfacePort | null>(null);
const selectedSbarMarker = ref<ChartSurfaceSBarMarker | null>(null);
const hoveredObject = ref<OriginObjectSelection | null>(null);
const hoveredSbarMarker = ref<ChartSurfaceSBarMarker | null>(null);
const selectionStartX = ref<number | null>(null);
const selectionEndX = ref<number | null>(null);
const previewX = ref<number | null>(null);
let draggingBoundary: "start" | "end" | null = null;
let lastEmittedBoundaryId: string | null = null;
const sbarMarkerPrimitive = new SBarMarkerPrimitive();
let unregisterSbarMarkerPrimitive: (() => void) | null = null;

function syncSbarMarkerPrimitive(): void {
  sbarMarkerPrimitive.update({
    hovered: hoveredSbarMarker.value,
    selected: selectedSbarMarker.value,
    selectedFill: "rgba(217, 154, 69, 0.10)",
    selectedStroke: "#D99A45",
    selectedWidth: 1.25,
  });
}

const selectionStatus = computed(() => {
  if (props.selectionPending) return "SELECT END · MOVE TO PREVIEW";
  if (props.selectionStartSbarId && props.selectionEndSbarId) {
    return props.selectionEditable !== false ? "DRAG EDGES · ADJUST INTERVAL" : "INCLUSIVE INTERVAL FIXED";
  }
  return props.selectionStartSbarId ? "SELECT END ON CHART" : "CLICK CHART TO SELECT START";
});

function syncStructureInteractionState(): void {
  const hovered = hoveredObject.value && (hoveredObject.value.kind === "cbar" || hoveredObject.value.kind === "swing")
    ? { kind: hoveredObject.value.kind, id: hoveredObject.value.id }
    : null;
  const selected = props.selectedObject &&
    (props.selectedObject.kind === "cbar" || props.selectedObject.kind === "swing") &&
    props.selectedObject.originDatasetId === props.originDatasetId
    ? { kind: props.selectedObject.kind, id: props.selectedObject.id }
    : null;
  surface.value?.setStructureInteractionState(hovered, selected);
}

function updateSelectionCoordinates(): void {
  selectionStartX.value = surface.value?.getSbarCoordinate(props.selectionStartSbarId ?? "") ?? null;
  selectionEndX.value = surface.value?.getSbarCoordinate(props.selectionEndSbarId ?? "") ?? null;
  if (!props.selectionPending) previewX.value = null;
}

function updateSelectedObjectProjection(reveal = false): void {
  const selected = props.selectedObject;
  if (!selected || selected.originDatasetId !== props.originDatasetId) {
    selectedSbarMarker.value = null;
    syncStructureInteractionState();
    return;
  }
  selectedSbarMarker.value = selected.kind === "sbar"
    ? surface.value?.getSbarMarker(selected.id) ?? null
    : null;
  syncStructureInteractionState();
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

  const hovered = hoveredObject.value;
  if (!hovered) {
    hoveredSbarMarker.value = null;
    return;
  }
  if (hovered.kind === "sbar") {
    const marker = surface.value?.getSbarRangeHighlight(hovered.id) ?? null;
    hoveredSbarMarker.value = marker;
    if (!marker) hoveredObject.value = null;
    return;
  }

  hoveredSbarMarker.value = null;
  const geometry = surface.value?.getStructureGeometry();
  const stillProjected = hovered.kind === "cbar"
    ? geometry?.cbarRectangles.some((item) => item.id === hovered.id)
    : geometry?.swingSegments.some((item) => item.id === hovered.id);
  if (!stillProjected) hoveredObject.value = null;
  syncStructureInteractionState();
}

function handlePointerPosition(point: { x: number; y: number } | null): void {
  previewX.value = props.selectionPending && selectionStartX.value !== null ? point?.x ?? null : null;
  updateHoveredObject(point);
}

function hitTestStructureObject(x: number, y: number): Extract<OriginObjectSelection, { kind: "cbar" | "swing" }> | null {
  const geometry = surface.value?.getStructureGeometry();
  if (!geometry) return null;

  // The Surface publishes only currently projected geometry. The shared hit
  // tester owns deterministic distance ranking and Swing-before-CBar tie breaks.
  const hit = resolveStructureHit({
    x,
    y,
    swings: geometry.swingSegments,
    cbars: geometry.cbarRectangles,
    swingVisible: true,
    cbarVisible: true,
  });
  return hit ? { kind: hit.kind, id: hit.id, originDatasetId: props.originDatasetId } : null;
}

function hitTestSbar(x: number, y: number): OriginObjectSelection | null {
  const sbarId = surface.value?.getSbarIdAtCoordinate(x);
  if (!sbarId) return null;
  const marker = surface.value?.getSbarMarker(sbarId);
  if (!marker) return null;
  const centerX = marker.x + marker.width / 2;
  if (Math.abs(x - centerX) > Math.max(3, marker.width / 2 + 1) || y < marker.y - 5 || y > marker.y + marker.height + 5) return null;
  return { kind: "sbar", id: sbarId, originDatasetId: props.originDatasetId };
}

function updateHoveredObject(point: { x: number; y: number } | null): void {
  const nextObject = !point || !Number.isFinite(point.x) || !Number.isFinite(point.y)
    ? null
    : hitTestStructureObject(point.x, point.y) ?? hitTestSbar(point.x, point.y);
  const current = hoveredObject.value;
  if (current?.kind === nextObject?.kind && current?.id === nextObject?.id && current?.originDatasetId === nextObject?.originDatasetId) return;
  hoveredObject.value = nextObject;
  hoveredSbarMarker.value = nextObject?.kind === "sbar" ? surface.value?.getSbarRangeHighlight(nextObject.id) ?? null : null;
  syncStructureInteractionState();
}

function handleChartClick(point: { x: number; y: number | null } | null): void {
  if (!point) {
    emit("selectionError", "The click did not resolve to a chart coordinate.");
    return;
  }
  if (typeof point.y === "number" && Number.isFinite(point.y)) {
    const selectedStructureObject = hitTestStructureObject(point.x, point.y);
    if (selectedStructureObject) {
      emit("objectClick", selectedStructureObject);
      return;
    }
  }
  const sbarId = surface.value?.getSbarIdAtCoordinate(point.x);
  if (!sbarId || !surface.value?.hasSbarId(sbarId)) {
    emit("selectionError", "The clicked horizontal position does not map to an SBar in the current sequence.");
    return;
  }
  emit("sbarClick", sbarId);
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
watch(() => [props.bars, props.originDatasetId, props.structure] as const, () => {
  hoveredObject.value = null;
  hoveredSbarMarker.value = null;
  syncStructureInteractionState();
}, { deep: false });

onMounted(() => {
  unregisterSbarMarkerPrimitive = surface.value?.registerPrimitive("origin-sbar-markers", sbarMarkerPrimitive) ?? null;
  syncSbarMarkerPrimitive();
  updateSelectionCoordinates();
  updateSelectedObjectProjection();
});
onBeforeUnmount(() => {
  stopBoundaryDrag();
  unregisterSbarMarkerPrimitive?.();
  unregisterSbarMarkerPrimitive = null;
  sbarMarkerPrimitive.dispose();
});

watch([hoveredSbarMarker, selectedSbarMarker], syncSbarMarkerPrimitive, { deep: true });
</script>

<template>
  <section
    class="origin-chart-adapter"
    @struxis-select-sbar="handleSelectionRequest"
    @contextmenu.prevent.stop="handleContextMenu"
  >
    <ChartSurface
      ref="surface"
      :bars="bars"
      :structure="structure"
      :sequence-id="originDatasetId"
      :show-header="true"
      :show-footer="true"
      :show-legend="true"
      :header-title="`ORIGIN · ${bars[bars.length - 1]?.barType ?? originDatasetId}`"
      header-tag="CATALOG SOURCE"
      empty-message="No SBar data is available in this Origin projection."
      panel-label="Origin SBar chart"
      :chart-label="`Candlestick and volume chart for Origin ${originDatasetId}`"
      @chart-click="handleChartClick"
      @pointer-position="handlePointerPosition"
      @projection-frame="handleProjectionFrame"
    >
      <template #footer-trailing>
        <span class="origin-chart-selection-status" data-testid="origin-chart-selection-status">{{ selectionStatus }}</span>
      </template>
      <template #chart-interaction-overlay>
        <div v-if="hoveredObject" class="origin-object-hover-label" data-testid="origin-object-hover-label" aria-live="off">{{ hoveredObject.kind.toUpperCase() }} · {{ hoveredObject.id }}</div>
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
    </ChartSurface>
  </section>
</template>

<style scoped>
.origin-chart-adapter { position: relative; display: contents; }
.origin-selection-line::before { position: absolute; top: -6px; bottom: -6px; left: -8px; width: 17px; content: ""; background: transparent; cursor: ew-resize; }
.origin-object-hover-label { position: absolute; z-index: 4; top: 7px; right: 10px; max-width: 42%; overflow: hidden; padding: 3px 5px; border: 1px solid #394149; border-radius: 2px; background: rgb(18 22 25 / 92%); color: #b9c2c8; font: 9px ui-monospace, SFMono-Regular, Consolas, monospace; text-overflow: ellipsis; white-space: nowrap; pointer-events: none; }
.origin-chart-selection-status { min-width: 0; margin-left: auto; overflow: hidden; color: #a5b0b7; font: 8px ui-monospace, SFMono-Regular, Consolas, monospace; text-overflow: ellipsis; white-space: nowrap; }
</style>
