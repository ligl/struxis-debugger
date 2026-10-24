<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
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
  getSbarIdAtCoordinate: (x: number, clampToSequence?: boolean) => string | null;
  hasSbarId: (sbarId: string) => boolean;
};
const surface = ref<SurfacePort | null>(null);
const adapterRoot = ref<HTMLElement | null>(null);
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

function handleProjectionFrame(): void {
  updateSelectionCoordinates();
}

function handlePointerPosition(point: { x: number; y: number } | null): void {
  previewX.value = props.selectionPending && selectionStartX.value !== null ? point?.x ?? null : null;
}

function handleSbarClick(sbarId: string): void {
  emit("sbarClick", sbarId);
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
  const chartHost = adapterRoot.value?.querySelector<HTMLElement>('[data-testid="origin-chart-canvas"]');
  if (!chartHost || !Number.isFinite(clientX) || !surface.value) return null;
  const bounds = chartHost.getBoundingClientRect();
  const currentStart = props.bars.findIndex((bar) => bar.sbarId === props.selectionStartSbarId);
  const currentEnd = props.bars.findIndex((bar) => bar.sbarId === props.selectionEndSbarId);
  if (currentStart < 0 || currentEnd < 0) return null;
  const id = surface.value.getSbarIdAtCoordinate(clientX - bounds.left, true);
  if (!id) return null;
  const index = props.bars.findIndex((bar) => bar.sbarId === id);
  if (index < 0) return null;
  const clamped = draggingBoundary === "start"
    ? Math.min(index, currentEnd)
    : Math.max(index, currentStart);
  return props.bars[clamped]?.sbarId ?? null;
}

function handleBoundaryKey(edge: "start" | "end", event: KeyboardEvent): void {
  if (props.selectionEditable === false || props.selectionPending || !props.selectionStartSbarId || !props.selectionEndSbarId) return;
  const delta = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0;
  if (delta === 0) return;
  event.preventDefault();
  const currentIndex = props.bars.findIndex((bar) => bar.sbarId === (edge === "start" ? props.selectionStartSbarId : props.selectionEndSbarId));
  const otherIndex = props.bars.findIndex((bar) => bar.sbarId === (edge === "start" ? props.selectionEndSbarId : props.selectionStartSbarId));
  if (currentIndex < 0 || otherIndex < 0) return;
  const nextIndex = Math.max(0, Math.min(props.bars.length - 1, currentIndex + delta));
  if (edge === "start" ? nextIndex > otherIndex : nextIndex < otherIndex) return;
  const nextId = props.bars[nextIndex]?.sbarId;
  if (nextId && nextId !== (edge === "start" ? props.selectionStartSbarId : props.selectionEndSbarId)) {
    emit("rangeBoundaryChange", edge, nextId);
  }
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
  () => [props.bars, props.selectionStartSbarId, props.selectionEndSbarId, props.selectionPending] as const,
  updateSelectionCoordinates,
  { deep: false, immediate: true },
);

onBeforeUnmount(stopBoundaryDrag);
</script>

<template>
  <section
    ref="adapterRoot"
    class="origin-chart-adapter"
    @struxis-select-sbar="handleSelectionRequest"
    @contextmenu.prevent.stop="handleContextMenu"
  >
    <SBarChartSurface
      ref="surface"
      :bars="bars"
      :structure="structure"
      :origin-dataset-id="originDatasetId"
      :selected-object="selectedObject"
      :show-header="true"
      :show-footer="true"
      panel-label="Origin SBar chart"
      :chart-label="`Candlestick and volume chart for Origin ${originDatasetId}`"
      @sbar-click="handleSbarClick"
      @object-click="emit('objectClick', $event)"
      @chart-interaction-error="handleChartInteractionError"
      @pointer-position="handlePointerPosition"
      @projection-frame="handleProjectionFrame"
    >
      <template #origin-selection-overlay>
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
            @keydown="handleBoundaryKey('start', $event)"
            tabindex="0"
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
              @keydown="handleBoundaryKey('end', $event)"
              tabindex="0"
            ></div>
          </template>
        </div>
      </template>
    </SBarChartSurface>
    <div class="origin-chart-selection-status" data-testid="origin-chart-selection-status">{{ selectionStatus }}</div>
  </section>
</template>

<style scoped>
.origin-chart-adapter { position: relative; display: contents; }
.origin-selection-overlay { position: absolute; inset: 0; z-index: 3; pointer-events: none; }
.origin-selection-shade { position: absolute; top: 0; bottom: 0; background: rgb(198 160 107 / 10%); border-left: 1px solid rgb(198 160 107 / 42%); border-right: 1px solid rgb(198 160 107 / 42%); pointer-events: none; }
.origin-selection-line { position: absolute; top: 0; bottom: 0; width: 1px; background: #C6A06B; pointer-events: auto; }
.origin-selection-line::before { position: absolute; top: -6px; bottom: -6px; left: -8px; width: 17px; content: ""; background: transparent; cursor: ew-resize; }
.origin-selection-line-start, .origin-selection-line-end, .origin-selection-line-preview { border-left: 1px dashed #C6A06B; background: transparent; }
.origin-selection-line-preview { pointer-events: none; }
.origin-chart-selection-status { display: none; }
</style>
