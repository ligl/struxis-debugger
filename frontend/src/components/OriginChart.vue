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

type CBarRectangle = { id: string; x: number; y: number; width: number; height: number };
type SwingSegment = { id: string; x1: number; y1: number; x2: number; y2: number; state: string; color: string; dasharray: string };
type SBarMarker = { id: string; x: number; y: number; width: number; height: number };
type SurfacePort = {
  getSbarCoordinate: (sbarId: string) => number | null;
  getSbarIdAtCoordinate: (x: number, clampToSequence?: boolean) => string | null;
  getSbarIdAtClientX: (clientX: number, clampToSequence?: boolean) => string | null;
  hasSbarId: (sbarId: string) => boolean;
  getSbarMarker: (sbarId: string) => SBarMarker | null;
  getStructureGeometry: () => { cbarRectangles: CBarRectangle[]; swingSegments: SwingSegment[] };
  revealSbarRange: (anchorIds: string[]) => boolean;
};
const surface = ref<SurfacePort | null>(null);
const selectedSbarMarker = ref<SBarMarker | null>(null);
const hoveredObject = ref<OriginObjectSelection | null>(null);
const hoveredSbarMarker = ref<SBarMarker | null>(null);
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
  hoveredSbarMarker.value = hoveredObject.value?.kind === "sbar"
    ? surface.value?.getSbarMarker(hoveredObject.value.id) ?? null
    : null;
}

function handlePointerPosition(point: { x: number; y: number } | null): void {
  previewX.value = props.selectionPending && selectionStartX.value !== null ? point?.x ?? null : null;
  updateHoveredObject(point);
}

function hitTestStructureObject(x: number, y: number): Extract<OriginObjectSelection, { kind: "cbar" | "swing" }> | null {
  const geometry = surface.value?.getStructureGeometry();
  if (!geometry) return null;
  const tolerance = 6;
  type Candidate = { kind: "cbar" | "swing"; id: string; distance: number; priority: number };
  const chooseCloser = (best: Candidate | null, candidate: Candidate): Candidate | null => {
    if (candidate.distance > tolerance) return best;
    if (!best || candidate.distance < best.distance ||
      (candidate.distance === best.distance && candidate.priority < best.priority) ||
      (candidate.distance === best.distance && candidate.priority === best.priority && candidate.id.localeCompare(best.id) < 0)) return candidate;
    return best;
  };
  let best: Candidate | null = null;
  for (const segment of geometry.swingSegments) {
    const dx = segment.x2 - segment.x1;
    const dy = segment.y2 - segment.y1;
    const lengthSquared = dx * dx + dy * dy;
    const projection = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((x - segment.x1) * dx + (y - segment.y1) * dy) / lengthSquared));
    best = chooseCloser(best, { kind: "swing", id: segment.id, distance: Math.hypot(x - (segment.x1 + projection * dx), y - (segment.y1 + projection * dy)), priority: 0 });
  }
  for (const rectangle of geometry.cbarRectangles) {
    const left = Math.min(rectangle.x, rectangle.x + rectangle.width);
    const right = Math.max(rectangle.x, rectangle.x + rectangle.width);
    const top = Math.min(rectangle.y, rectangle.y + rectangle.height);
    const bottom = Math.max(rectangle.y, rectangle.y + rectangle.height);
    const outsideX = x < left ? left - x : x > right ? x - right : 0;
    const outsideY = y < top ? top - y : y > bottom ? y - bottom : 0;
    const distance = outsideX > 0 || outsideY > 0 ? Math.hypot(outsideX, outsideY) : Math.min(x - left, right - x, y - top, bottom - y);
    best = chooseCloser(best, { kind: "cbar", id: rectangle.id, distance, priority: 1 });
  }
  return best ? { kind: best.kind, id: best.id, originDatasetId: props.originDatasetId } : null;
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
  hoveredSbarMarker.value = nextObject?.kind === "sbar" ? surface.value?.getSbarMarker(nextObject.id) ?? null : null;
}

function handleChartClick(point: { x: number; y: number } | null): void {
  if (!point) {
    emit("selectionError", "The click did not resolve to a chart coordinate.");
    return;
  }
  const selectedStructureObject = hitTestStructureObject(point.x, point.y);
  if (selectedStructureObject) {
    emit("objectClick", selectedStructureObject);
    return;
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
}, { deep: false });

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
      @chart-click="handleChartClick"
      @pointer-position="handlePointerPosition"
      @projection-frame="handleProjectionFrame"
    >
      <template #chart-structure-overlays="{ cbarRectangles, swingSegments }">
        <rect
          v-if="hoveredSbarMarker"
          class="origin-object-hover-sbar"
          :x="hoveredSbarMarker.x"
          :y="hoveredSbarMarker.y"
          :width="hoveredSbarMarker.width"
          :height="hoveredSbarMarker.height"
          data-testid="origin-hover-sbar"
          :data-sbar-id="hoveredSbarMarker.id"
          fill="rgb(195 203 209 / 8%)"
          stroke="rgb(195 203 209 / 48%)"
          stroke-width="1"
        />
        <line
          v-for="segment in swingSegments.filter((item) => hoveredObject?.kind === 'swing' && hoveredObject.id === item.id)"
          :key="`hover-${segment.id}`"
          :x1="segment.x1" :y1="segment.y1" :x2="segment.x2" :y2="segment.y2"
          stroke="#C3CBD1" stroke-width="2" stroke-linecap="round"
          data-testid="origin-hover-swing" :data-swing-id="segment.id"
        />
        <rect
          v-for="rectangle in cbarRectangles.filter((item) => hoveredObject?.kind === 'cbar' && hoveredObject.id === item.id)"
          :key="`hover-${rectangle.id}`"
          :x="rectangle.x" :y="rectangle.y" :width="rectangle.width" :height="rectangle.height"
          fill="none" stroke="#C3CBD1" stroke-width="1.75"
          data-testid="origin-hover-cbar" :data-cbar-id="rectangle.id"
        />
        <rect
          v-if="selectedSbarMarker"
          class="origin-object-selected-sbar"
          :x="selectedSbarMarker.x"
          :y="selectedSbarMarker.y"
          :width="selectedSbarMarker.width"
          :height="selectedSbarMarker.height"
          data-testid="origin-selected-sbar"
          :data-sbar-id="selectedSbarMarker.id"
          fill="rgb(217 154 69 / 10%)"
          stroke="#D99A45"
          stroke-width="1.25"
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
    </SBarChartSurface>
  </section>
</template>

<style scoped>
.origin-chart-adapter { position: relative; display: contents; }
.origin-selection-line::before { position: absolute; top: -6px; bottom: -6px; left: -8px; width: 17px; content: ""; background: transparent; cursor: ew-resize; }
.origin-object-hover-label { position: absolute; z-index: 4; top: 7px; right: 10px; max-width: 42%; overflow: hidden; padding: 3px 5px; border: 1px solid #394149; border-radius: 2px; background: rgb(18 22 25 / 92%); color: #b9c2c8; font: 9px ui-monospace, SFMono-Regular, Consolas, monospace; text-overflow: ellipsis; white-space: nowrap; pointer-events: none; }
.origin-chart-selection-status { min-width: 0; margin-left: auto; overflow: hidden; color: #a5b0b7; font: 8px ui-monospace, SFMono-Regular, Consolas, monospace; text-overflow: ellipsis; white-space: nowrap; }
</style>
