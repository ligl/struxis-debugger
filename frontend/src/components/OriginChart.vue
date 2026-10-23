<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type Time,
} from "lightweight-charts";
import { mapOriginBarsToChart } from "../origin-chart-data";
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
const latestBar = computed(() => props.bars[props.bars.length - 1] ?? null);
const emit = defineEmits<{
  sbarClick: [sbarId: string];
  objectClick: [selection: Extract<OriginObjectSelection, { kind: "cbar" | "swing" }>];
  rangeBoundaryChange: [edge: "start" | "end", sbarId: string];
  selectionError: [message: string];
  cancelRangeSelection: [];
}>();
const chartHost = ref<HTMLDivElement | null>(null);
const chartError = ref("");
const layerVisibility = ref({ sbar: true, volume: true, cbar: true, swing: true });
let chart: IChartApi | null = null;
let candleSeries: ISeriesApi<"Candlestick"> | null = null;
let volumeSeries: ISeriesApi<"Histogram"> | null = null;
let resizeObserver: ResizeObserver | null = null;
let overlayUpdateFrame: number | null = null;
let fittedOriginDatasetId: string | null = null;
let sbarIdByLogicalIndex: readonly string[] = [];
let indexBySbarId: ReadonlyMap<string, number> = new Map();
let timeBySbarId: ReadonlyMap<string, Time> = new Map();
let firstSbarTime: Time | null = null;
let secondSbarTime: Time | null = null;
type CBarRectangle = { id: string; x: number; y: number; width: number; height: number };
type SBarMarker = { id: string; x: number; y: number; width: number; height: number };
type SwingSegment = {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  state: string;
  color: string;
  dasharray: string;
};
const cbarRectangles = ref<CBarRectangle[]>([]);
const swingSegments = ref<SwingSegment[]>([]);
const hoveredObject = ref<OriginObjectSelection | null>(null);
const hoveredSbarMarker = ref<SBarMarker | null>(null);
const selectedSbarMarker = ref<SBarMarker | null>(null);
const swingStyleByState: Record<string, { color: string; dasharray: string }> = {
  Confirmed: { color: "#B49ACD", dasharray: "" },
  Tentative: { color: "#D6A85D", dasharray: "6 3" },
  Extending: { color: "#8FA9C4", dasharray: "2 3" },
};
const unknownSwingStates = new Set<string>();
const firstSbarX = ref<number | null>(null);
const secondSbarX = ref<number | null>(null);
const selectionStartX = ref<number | null>(null);
const selectionEndX = ref<number | null>(null);
const previewX = ref<number | null>(null);
let draggingBoundary: "start" | "end" | null = null;
let crosshairLogicalIndex: number | null = null;
let lastEmittedBoundaryId: string | null = null;

function coordinateForSbarId(sbarId: string | null | undefined): number | null {
  if (!chart || !sbarId) return null;
  const time = timeBySbarId.get(sbarId);
  return time === undefined ? null : chart.timeScale().timeToCoordinate(time);
}

function updateCBarRectangles(): void {
  if (!chart || !candleSeries) {
    cbarRectangles.value = [];
    return;
  }
  const timeScale = chart.timeScale();
  cbarRectangles.value = layerVisibility.value.cbar ? (props.structure?.cbars ?? []).flatMap((cbar) => {
    const startTime = timeBySbarId.get(cbar.sbarStartId);
    const endTime = timeBySbarId.get(cbar.sbarEndId);
    const high = Number(cbar.high);
    const low = Number(cbar.low);
    if (startTime === undefined || endTime === undefined || !Number.isFinite(high) || !Number.isFinite(low)) return [];
    const startX = timeScale.timeToCoordinate(startTime);
    const endX = timeScale.timeToCoordinate(endTime);
    const highY = candleSeries.priceToCoordinate(high);
    const lowY = candleSeries.priceToCoordinate(low);
    if ([startX, endX, highY, lowY].some((value) => value === null || value === undefined || !Number.isFinite(value))) return [];
    const left = Math.min(startX as number, endX as number);
    const right = Math.max(startX as number, endX as number);
    const top = Math.min(highY as number, lowY as number);
    const bottom = Math.max(highY as number, lowY as number);
    return [{ id: cbar.cbarId, x: left, y: top, width: right - left, height: bottom - top }];
  }) : [];
}

function scheduleOverlayUpdate(): void {
  // Lightweight Charts updates its internal canvases during wheel zoom/pan.
  // Read the final public coordinate transforms on the next paint so SVG
  // overlays never lag one interaction frame behind the SBar series.
  if (overlayUpdateFrame !== null) cancelAnimationFrame(overlayUpdateFrame);
  overlayUpdateFrame = requestAnimationFrame(() => {
    overlayUpdateFrame = null;
    updateSbarCoordinates();
  });
}

function updateSbarCoordinates(): void {
  if (!chart) {
    firstSbarX.value = null;
    secondSbarX.value = null;
    selectionStartX.value = null;
    selectionEndX.value = null;
    return;
  }
  const timeScale = chart.timeScale();
  firstSbarX.value = firstSbarTime === null ? null : timeScale.timeToCoordinate(firstSbarTime);
  secondSbarX.value = secondSbarTime === null ? null : timeScale.timeToCoordinate(secondSbarTime);
  selectionStartX.value = coordinateForSbarId(props.selectionStartSbarId);
  selectionEndX.value = coordinateForSbarId(props.selectionEndSbarId);
  updateCBarRectangles();
  updateSwingSegments();
  updateSbarMarkers();
}

function updateSwingSegments(): void {
  if (!chart || !candleSeries) {
    swingSegments.value = [];
    return;
  }
  const timeScale = chart.timeScale();
  swingSegments.value = layerVisibility.value.swing ? (props.structure?.swings ?? []).flatMap((swing) => {
    const startTime = timeBySbarId.get(swing.sbarStartId);
    const endTime = timeBySbarId.get(swing.sbarEndId);
    const high = Number(swing.high);
    const low = Number(swing.low);
    if (startTime === undefined || endTime === undefined || !Number.isFinite(high) || !Number.isFinite(low)) return [];
    const startX = timeScale.timeToCoordinate(startTime);
    const endX = timeScale.timeToCoordinate(endTime);
    const startsAtLow = swing.direction === "Up";
    const startY = candleSeries.priceToCoordinate(startsAtLow ? low : high);
    const endY = candleSeries.priceToCoordinate(startsAtLow ? high : low);
    if ([startX, endX, startY, endY].some((value) => value === null || value === undefined || !Number.isFinite(value))) return [];
    const style = swingStyleByState[swing.state];
    if (!style) {
      if (!unknownSwingStates.has(swing.state)) {
        unknownSwingStates.add(swing.state);
        console.warn(`Unknown Struxis SwingState received by OriginChart: ${swing.state}`);
      }
    }
    const resolvedStyle = style ?? { color: "#A0A7B0", dasharray: "4 3" };
    return [{
      id: swing.swingId,
      x1: startX as number,
      y1: startY as number,
      x2: endX as number,
      y2: endY as number,
      state: swing.state,
      color: resolvedStyle.color,
      dasharray: resolvedStyle.dasharray,
    }];
  }) : [];
}


function markerForSbar(sbarId: string | null | undefined): SBarMarker | null {
  if (!chart || !candleSeries || !sbarId || !layerVisibility.value.sbar) return null;
  const index = indexBySbarId.get(sbarId);
  const bar = index === undefined ? undefined : props.bars[index];
  const time = timeBySbarId.get(sbarId);
  if (!bar || time === undefined) return null;
  const x = chart.timeScale().timeToCoordinate(time);
  const highY = candleSeries.priceToCoordinate(Number(bar.high));
  const lowY = candleSeries.priceToCoordinate(Number(bar.low));
  if ([x, highY, lowY].some((value) => value === null || value === undefined || !Number.isFinite(value))) return null;

  const adjacentXs = [
    index > 0 ? chart.timeScale().timeToCoordinate(timeBySbarId.get(props.bars[index - 1]!.sbarId)!) : null,
    index + 1 < props.bars.length ? chart.timeScale().timeToCoordinate(timeBySbarId.get(props.bars[index + 1]!.sbarId)!) : null,
  ].filter((value): value is number => value !== null && value !== undefined && Number.isFinite(value));
  const spacing = adjacentXs.length > 0
    ? Math.min(...adjacentXs.map((adjacentX) => Math.abs(adjacentX - (x as number))).filter((distance) => distance > 0))
    : 8;
  const width = Math.max(4, Math.min(12, Number.isFinite(spacing) && spacing > 0 ? spacing * 0.42 : 6));
  const top = Math.min(highY as number, lowY as number);
  const bottom = Math.max(highY as number, lowY as number);
  return { id: sbarId, x: (x as number) - width / 2, y: top, width, height: Math.max(2, bottom - top) };
}

function updateSbarMarkers(): void {
  const selected = props.selectedObject;
  selectedSbarMarker.value = selected?.kind === "sbar" && selected.originDatasetId === props.originDatasetId
    ? markerForSbar(selected.id)
    : null;
  hoveredSbarMarker.value = hoveredObject.value?.kind === "sbar" &&
    hoveredObject.value.originDatasetId === props.originDatasetId
    ? markerForSbar(hoveredObject.value.id)
    : null;
}

function revealSelectedObject(): void {
  const selected = props.selectedObject;
  if (!chart || !selected || selected.originDatasetId !== props.originDatasetId) return;

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

  const indices = anchorIds
    .map((id) => indexBySbarId.get(id))
    .filter((index): index is number => index !== undefined);
  if (indices.length === 0) return;

  const targetLeft = Math.min(...indices);
  const targetRight = Math.max(...indices);
  const visible = chart.timeScale().getVisibleLogicalRange();
  if (!visible) return;

  // Preserve the current zoom. Only pan when the selected object's actual
  // SBar anchor interval is completely outside the visible chart range.
  if (targetRight >= visible.from && targetLeft <= visible.to) return;
  const span = visible.to - visible.from;
  const center = (targetLeft + targetRight) / 2;
  chart.timeScale().setVisibleLogicalRange({
    from: center - span / 2,
    to: center + span / 2,
  });
}

function hitTestSbar(x: number, y: number): OriginObjectSelection | null {
  if (!chart || !candleSeries || !layerVisibility.value.sbar || sbarIdByLogicalIndex.length === 0) return null;
  const logical = chart.timeScale().coordinateToLogical(x);
  if (logical === null || logical === undefined || !Number.isFinite(logical)) return null;
  const index = Math.round(logical);
  const bar = props.bars[index];
  if (!bar) return null;
  const marker = markerForSbar(bar.sbarId);
  if (!marker) return null;
  const centerX = marker.x + marker.width / 2;
  const left = Math.max(3, marker.width / 2 + 1);
  const top = marker.y - 5;
  const bottom = marker.y + marker.height + 5;
  if (Math.abs(x - centerX) > left || y < top || y > bottom) return null;
  return { kind: "sbar", id: bar.sbarId, originDatasetId: props.originDatasetId };
}

function updateHoveredObject(point: { x: number; y: number } | undefined): void {
  const nextObject = !point || !Number.isFinite(point.x) || !Number.isFinite(point.y) || chartError.value
    ? null
    : hitTestStructureObject(point.x, point.y) ?? hitTestSbar(point.x, point.y);
  const currentObject = hoveredObject.value;
  if (
    currentObject?.kind === nextObject?.kind &&
    currentObject?.id === nextObject?.id &&
    currentObject?.originDatasetId === nextObject?.originDatasetId
  ) return;

  // Only update reactive overlays when the pointer crosses an object boundary.
  // This avoids re-rendering the SVG layer on every crosshair movement.
  hoveredObject.value = nextObject;
  updateSbarMarkers();
}

function selectSbarById(sbarId: string): void {
  if (chartError.value || props.bars.length === 0) return;
  if (!sbarIdByLogicalIndex.includes(sbarId)) {
    emit("selectionError", "The selected SBar is not part of the current Origin chart.");
    return;
  }

  // This is the shared selection path for pointer input and programmatic
  // component commands. The parent still owns the range state and validates
  // the exact ID against the authoritative Origin sequence.
  if (!props.selectionStartSbarId) {
    selectionStartX.value = coordinateForSbarId(sbarId);
  }
  emit("sbarClick", sbarId);
}

function handleChartContextMenu(): void {
  // Right-click cancels the current in-progress or completed range selection.
  // The parent owns the authoritative selection state and clears it atomically.
  emit("cancelRangeSelection");
}

function handleSbarSelectionRequest(event: Event): void {
  const detail = (event as CustomEvent<{ sbarId?: unknown }>).detail;
  if (typeof detail?.sbarId !== "string" || detail.sbarId.length === 0) {
    emit("selectionError", "A programmatic Origin selection requires an exact SBar ID.");
    return;
  }
  selectSbarById(detail.sbarId);
}

function distanceToSegment(
  x: number,
  y: number,
  segment: SwingSegment,
): number {
  const dx = segment.x2 - segment.x1;
  const dy = segment.y2 - segment.y1;
  const lengthSquared = dx * dx + dy * dy;
  const projection = lengthSquared === 0
    ? 0
    : Math.max(0, Math.min(1, ((x - segment.x1) * dx + (y - segment.y1) * dy) / lengthSquared));
  return Math.hypot(x - (segment.x1 + projection * dx), y - (segment.y1 + projection * dy));
}

function distanceToRectangleBorder(
  x: number,
  y: number,
  rectangle: CBarRectangle,
): number {
  const left = Math.min(rectangle.x, rectangle.x + rectangle.width);
  const right = Math.max(rectangle.x, rectangle.x + rectangle.width);
  const top = Math.min(rectangle.y, rectangle.y + rectangle.height);
  const bottom = Math.max(rectangle.y, rectangle.y + rectangle.height);
  const outsideX = x < left ? left - x : x > right ? x - right : 0;
  const outsideY = y < top ? top - y : y > bottom ? y - bottom : 0;
  if (outsideX > 0 || outsideY > 0) return Math.hypot(outsideX, outsideY);
  return Math.min(x - left, right - x, y - top, bottom - y);
}

function hitTestStructureObject(x: number, y: number): Extract<OriginObjectSelection, { kind: "cbar" | "swing" }> | null {
  const tolerance = 6;
  type Candidate = { kind: "cbar" | "swing"; id: string; distance: number; priority: number };
  const chooseCloser = (best: Candidate | null, candidate: Candidate): Candidate | null => {
    if (candidate.distance > tolerance) return best;
    if (
      !best ||
      candidate.distance < best.distance ||
      (candidate.distance === best.distance && candidate.priority < best.priority) ||
      (candidate.distance === best.distance && candidate.priority === best.priority && candidate.id.localeCompare(best.id) < 0)
    ) return candidate;
    return best;
  };

  let best: Candidate | null = null;
  for (const segment of swingSegments.value) {
    best = chooseCloser(best, {
      kind: "swing",
      id: segment.id,
      distance: distanceToSegment(x, y, segment),
      priority: 0,
    });
  }
  for (const rectangle of cbarRectangles.value) {
    best = chooseCloser(best, {
      kind: "cbar",
      id: rectangle.id,
      distance: distanceToRectangleBorder(x, y, rectangle),
      priority: 1,
    });
  }

  return best ? { kind: best.kind, id: best.id, originDatasetId: props.originDatasetId } : null;
}
function handleChartClick(param: { point?: { x: number; y: number } | undefined }): void {
  if (chartError.value || props.bars.length === 0) return;
  const pointX = param.point?.x;
  if (typeof pointX !== "number" || !Number.isFinite(pointX)) {
    emit("selectionError", "The click did not resolve to a horizontal position inside the chart plot.");
    return;
  }

  const pointY = param.point?.y;
  if (typeof pointY === "number" && Number.isFinite(pointY)) {
    const selectedStructureObject = hitTestStructureObject(pointX, pointY);
    if (selectedStructureObject) {
      emit("objectClick", selectedStructureObject);
      return;
    }
  }

  // A miss on structure geometry falls back to the existing SBar time-axis
  // selection. It never picks the nearest structure object.
  const logical = chart?.timeScale().coordinateToLogical(pointX);
  if (logical === null || logical === undefined || !Number.isFinite(logical)) {
    emit("selectionError", "The clicked horizontal position does not map to the Origin time axis.");
    return;
  }
  const index = Math.round(logical);
  if (index < 0 || index >= sbarIdByLogicalIndex.length) {
    emit("selectionError", "The clicked horizontal position is outside the loaded Origin SBar sequence.");
    return;
  }
  const sbarId = sbarIdByLogicalIndex[index];
  if (sbarId === undefined) {
    emit("selectionError", "The clicked horizontal position does not map to an Origin SBar.");
    return;
  }

  selectSbarById(sbarId);
}

function resolveBoundaryDragSbar(clientX: number): string | null {
  if (!chartHost.value || !Number.isFinite(clientX) || sbarIdByLogicalIndex.length === 0) return null;
  const bounds = chartHost.value.getBoundingClientRect();
  const logical = chart?.timeScale().coordinateToLogical(clientX - bounds.left);
  if (logical === null || logical === undefined || !Number.isFinite(logical)) return null;

  let index = Math.round(logical);
  const currentStart = sbarIdByLogicalIndex.indexOf(props.selectionStartSbarId ?? "");
  const currentEnd = sbarIdByLogicalIndex.indexOf(props.selectionEndSbarId ?? "");
  if (currentStart < 0 || currentEnd < 0) return null;

  // Keep a valid inclusive interval throughout the drag. The handles cannot
  // cross; moving either edge is clamped to the other edge's SBar.
  index = Math.max(0, Math.min(sbarIdByLogicalIndex.length - 1, index));
  index = draggingBoundary === "start"
    ? Math.min(index, currentEnd)
    : Math.max(index, currentStart);
  return sbarIdByLogicalIndex[index] ?? null;
}

function handleBoundaryKey(edge: "start" | "end", event: KeyboardEvent): void {
  if (props.selectionEditable === false || props.selectionPending || !props.selectionStartSbarId || !props.selectionEndSbarId) return;
  const delta = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0;
  if (delta === 0) return;
  event.preventDefault();
  const currentId = edge === "start" ? props.selectionStartSbarId : props.selectionEndSbarId;
  const currentIndex = sbarIdByLogicalIndex.indexOf(currentId);
  if (currentIndex < 0) return;
  const otherIndex = sbarIdByLogicalIndex.indexOf(
    edge === "start" ? props.selectionEndSbarId : props.selectionStartSbarId,
  );
  const nextIndex = Math.max(0, Math.min(sbarIdByLogicalIndex.length - 1, currentIndex + delta));
  if (edge === "start" ? nextIndex > otherIndex : nextIndex < otherIndex) return;
  const nextId = sbarIdByLogicalIndex[nextIndex];
  if (nextId && nextId !== currentId) emit("rangeBoundaryChange", edge, nextId);
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

function handleChartMove(param: { point?: { x: number; y: number } | undefined }): void {
  const x = param.point?.x;
  if (typeof x === "number" && chart) {
    const logical = chart.timeScale().coordinateToLogical(x);
    if (logical !== null && logical !== undefined && Number.isFinite(logical)) {
      const index = Math.round(logical);
      if (index >= 0 && index < props.bars.length) crosshairLogicalIndex = index;
    }
  }
  updateHoveredObject(param.point);
  if (!props.selectionPending || selectionStartX.value === null) {
    previewX.value = null;
    return;
  }
  const pointX = param.point?.x;
  previewX.value = typeof pointX === "number" && Number.isFinite(pointX) ? pointX : null;
}

function isInteractiveKeyboardTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return target.closest(
    "input, textarea, select, button, a[href], summary, [contenteditable]:not([contenteditable='false']), [role='button'], [role='link'], [role='menuitem'], [role='slider'], [role='textbox'], [role='combobox'], [tabindex]:not([tabindex='-1'])",
  ) !== null;
}

function moveCrosshairTo(index: number, alignToBoundary = false): boolean {
  if (!chart || !candleSeries || props.bars.length === 0) return false;
  const nextIndex = Math.max(0, Math.min(props.bars.length - 1, index));
  const bar = props.bars[nextIndex];
  if (!bar) return false;
  const time = timeBySbarId.get(bar.sbarId);
  if (time === undefined) return false;
  crosshairLogicalIndex = nextIndex;

  const timeScale = chart.timeScale();
  const range = timeScale.getVisibleLogicalRange();
  if (range && Number.isFinite(range.from) && Number.isFinite(range.to)) {
    const width = range.to - range.from;
    if (width > 0) {
      const lastIndex = props.bars.length - 1;
      let from = range.from;
      let to = range.to;
      if (alignToBoundary && width < props.bars.length) {
        from = nextIndex === 0 ? -0.5 : lastIndex + 0.5 - width;
        to = from + width;
      } else {
        const margin = Math.min(2, width * 0.08);
        if (nextIndex < from + margin) {
          from = nextIndex - margin;
          to = from + width;
        } else if (nextIndex > to - margin) {
          to = nextIndex + margin;
          from = to - width;
        }
        if (width < props.bars.length) {
          from = Math.max(-0.5, Math.min(from, props.bars.length - 0.5 - width));
          to = from + width;
        } else {
          from = Math.min(from, -0.5);
          to = from + width;
        }
      }
      if (Math.abs(from - range.from) > 0.001 || Math.abs(to - range.to) > 0.001) {
        timeScale.setVisibleLogicalRange({ from, to });
      }
    }
  }

  const selectedIndex = nextIndex;
  const applySelectedCrosshair = () => {
    if (!chart || !candleSeries || crosshairLogicalIndex !== selectedIndex) return;
    chart.setCrosshairPosition?.(Number(bar.close), time, candleSeries);
  };
  applySelectedCrosshair();
  requestAnimationFrame(applySelectedCrosshair);
  return true;
}

function moveCrosshairBy(delta: number): boolean {
  const currentIndex = crosshairLogicalIndex ?? 0;
  const targetIndex = currentIndex + delta;
  if (targetIndex < 0 || targetIndex >= props.bars.length) return false;
  return moveCrosshairTo(targetIndex);
}

function zoomTimeScale(direction: "in" | "out"): boolean {
  if (!chart || props.bars.length === 0) return false;
  const timeScale = chart.timeScale();
  const range = timeScale.getVisibleLogicalRange();
  if (!range || !Number.isFinite(range.from) || !Number.isFinite(range.to)) return false;
  const width = range.to - range.from;
  const maximumWidth = props.bars.length + 8;
  if (width <= 0) return false;
  if ((direction === "in" && width <= 2) || (direction === "out" && width >= maximumWidth)) return false;
  const nextWidth = direction === "in"
    ? Math.max(2, width * 0.8)
    : Math.min(maximumWidth, width * 1.25);
  if (Math.abs(nextWidth - width) < 0.01) return false;
  const anchor = crosshairLogicalIndex !== null &&
    crosshairLogicalIndex >= range.from && crosshairLogicalIndex <= range.to
    ? crosshairLogicalIndex
    : (range.from + range.to) / 2;
  const anchorRatio = (anchor - range.from) / width;
  const from = anchor - nextWidth * anchorRatio;
  timeScale.setVisibleLogicalRange({ from, to: from + nextWidth });
  return true;
}

function handleChartKeyboard(event: KeyboardEvent): void {
  const isArrowKey = event.key === "ArrowUp" || event.key === "ArrowDown" ||
    event.key === "ArrowLeft" || event.key === "ArrowRight";
  const isFitShortcut = event.ctrlKey && !event.altKey && !event.metaKey &&
    !event.shiftKey && event.key === "0";
  const isBoundaryNavigation = event.ctrlKey && !event.altKey && !event.metaKey &&
    !event.shiftKey && (event.key === "ArrowLeft" || event.key === "ArrowRight");
  if (
    (event.repeat && !isArrowKey) ||
    event.altKey || event.metaKey || (event.ctrlKey && !isBoundaryNavigation && !isFitShortcut) ||
    (event.shiftKey && !isBoundaryNavigation) ||
    isInteractiveKeyboardTarget(event.target) ||
    isInteractiveKeyboardTarget(document.activeElement) ||
    chartError.value || props.bars.length === 0
  ) return;

  let handled = false;
  if (isFitShortcut) handled = fitContentShortcut();
  else if (isBoundaryNavigation) {
    handled = moveCrosshairTo(event.key === "ArrowLeft" ? 0 : props.bars.length - 1, true);
  } else if (event.key === "ArrowUp") handled = zoomTimeScale("in");
  else if (event.key === "ArrowDown") handled = zoomTimeScale("out");
  else if (event.key === "ArrowLeft") handled = moveCrosshairBy(-1);
  else if (event.key === "ArrowRight") handled = moveCrosshairBy(1);

  if (handled) event.preventDefault();
}

function toggleLayer(layer: keyof typeof layerVisibility.value): void {
  layerVisibility.value[layer] = !layerVisibility.value[layer];

  if (layer === "sbar") {
    candleSeries?.applyOptions({ visible: layerVisibility.value.sbar });
    return;
  }
  if (layer === "volume") {
    volumeSeries?.applyOptions({ visible: layerVisibility.value.volume });
    return;
  }

  // Structure overlays are projections of authoritative DTOs. Recompute their
  // screen coordinates on both hide and restore; never mutate domain data.
  updateSbarCoordinates();
}

function fitContent(): void {
  if (!chart || props.bars.length === 0) return;
  chart.timeScale().fitContent();
  updateSbarCoordinates();
}

function fitContentShortcut(): boolean {
  if (!chart || props.bars.length === 0) return false;
  fitContent();
  updateSbarCoordinates();
  updateStructureOverlays();
  return true;
}

function updateChart(): void {
  if (!chart || !candleSeries || !volumeSeries) return;
  try {
    const projection = mapOriginBarsToChart(props.bars);
    candleSeries.setData(projection.candles);
    volumeSeries.setData(projection.volume);
    sbarIdByLogicalIndex = props.bars.map((bar) => bar.sbarId);
    indexBySbarId = new Map(sbarIdByLogicalIndex.map((sbarId, index) => [sbarId, index] as const));
    timeBySbarId = new Map(
      props.bars.flatMap((bar, index) => {
        const time = projection.candles[index]?.time;
        return time === undefined ? [] : [[bar.sbarId, time] as const];
      }),
    );
    firstSbarTime = projection.candles[0]?.time ?? null;
    secondSbarTime = projection.candles[1]?.time ?? null;
    chartError.value = "";
    if (props.bars.length > 0 && fittedOriginDatasetId !== props.originDatasetId) {
      const timeScale = chart.timeScale();
      timeScale.fitContent();
      // Keep the established fixed logical padding. Selection correctness
      // is handled by the chart time-axis mapping, not by data-size heuristics.
      timeScale.setVisibleLogicalRange({
        from: -0.5,
        to: projection.candles.length + 3.5,
      });
      fittedOriginDatasetId = props.originDatasetId;
    }
    updateSbarCoordinates();
  } catch (error) {
    sbarIdByLogicalIndex = [];
    indexBySbarId = new Map();
    timeBySbarId = new Map();
    firstSbarTime = null;
    secondSbarTime = null;
    updateSbarCoordinates();
    candleSeries.setData([]);
    volumeSeries.setData([]);
    cbarRectangles.value = [];
    swingSegments.value = [];
    chartError.value = error instanceof Error ? error.message : String(error);
  }
}

onMounted(() => {
  document.addEventListener("keydown", handleChartKeyboard);
  if (!chartHost.value) return;
  chart = createChart(chartHost.value, {
    width: chartHost.value.clientWidth,
    height: Math.max(1, chartHost.value.clientHeight),
    grid: {
      vertLines: { visible: false },
      horzLines: { visible: false },
    },
    layout: {
      background: { type: ColorType.Solid, color: "#121619" },
      textColor: "#a8b2b9",
      attributionLogo: false,
    },
    rightPriceScale: {
      borderColor: "#30383f",
      scaleMargins: { top: 0.08, bottom: 0.22 },
    },
    timeScale: {
      borderColor: "#30383f",
      timeVisible: true,
      secondsVisible: false,
      rightOffset: 4,
    },
    crosshair: {
      // Keep the horizontal guide at the actual pointer Y, not magnetized to candle close.
      mode: CrosshairMode.Normal,
      vertLine: { color: "#89949d", labelBackgroundColor: "#30383f" },
      horzLine: { color: "#89949d", labelBackgroundColor: "#30383f" },
    },
  });
  candleSeries = chart.addSeries(CandlestickSeries, {
    upColor: "#79B58B",
    downColor: "#D98282",
    borderUpColor: "#79B58B",
    borderDownColor: "#D98282",
    wickUpColor: "#79B58B",
    wickDownColor: "#D98282",
    priceLineVisible: false,
    lastValueVisible: true,
  });
  volumeSeries = chart.addSeries(HistogramSeries, {
    priceScaleId: "",
    priceFormat: { type: "volume" },
    lastValueVisible: false,
    priceLineVisible: false,
  });
  chart.priceScale("").applyOptions({
    scaleMargins: { top: 0.82, bottom: 0 },
  });
  chart.subscribeClick(handleChartClick);
  chart.subscribeCrosshairMove(handleChartMove);
  chart.timeScale().subscribeVisibleLogicalRangeChange(scheduleOverlayUpdate);
  resizeObserver = new ResizeObserver((entries) => {
    const entry = entries[0];
    if (!chart || !entry) return;
    chart.applyOptions({
      width: Math.max(1, Math.floor(entry.contentRect.width)),
      height: Math.max(1, Math.floor(entry.contentRect.height)),
    });
    updateSbarCoordinates();
  });
  resizeObserver.observe(chartHost.value);
  updateChart();
});

watch(() => [props.bars, props.structure, props.originDatasetId] as const, () => {
  updateChart();
  updateHoveredObject(undefined);
});
watch(() => props.selectedObject, () => {
  updateSbarMarkers();
  revealSelectedObject();
}, { deep: true });
watch(() => layerVisibility.value.sbar, () => {
  if (!layerVisibility.value.sbar && hoveredObject.value?.kind === "sbar") hoveredObject.value = null;
  updateSbarMarkers();
});
watch(
  () => [props.selectionStartSbarId, props.selectionEndSbarId, props.selectionPending] as const,
  () => {
    updateSbarCoordinates();
    if (!props.selectionPending) previewX.value = null;
  },
);

onBeforeUnmount(() => {
  document.removeEventListener("keydown", handleChartKeyboard);
  crosshairLogicalIndex = null;
  stopBoundaryDrag();
  resizeObserver?.disconnect();
  resizeObserver = null;
  chart?.unsubscribeClick(handleChartClick);
  chart?.unsubscribeCrosshairMove(handleChartMove);
  chart?.timeScale().unsubscribeVisibleLogicalRangeChange(scheduleOverlayUpdate);
  if (overlayUpdateFrame !== null) {
    cancelAnimationFrame(overlayUpdateFrame);
    overlayUpdateFrame = null;
  }
  chart?.remove();
  chart = null;
  candleSeries = null;
  volumeSeries = null;
  cbarRectangles.value = [];
  swingSegments.value = [];
  hoveredObject.value = null;
  hoveredSbarMarker.value = null;
  selectedSbarMarker.value = null;
  sbarIdByLogicalIndex = [];
  indexBySbarId = new Map();
  timeBySbarId = new Map();
  firstSbarTime = null;
  secondSbarTime = null;
  firstSbarX.value = null;
  secondSbarX.value = null;
  selectionStartX.value = null;
  selectionEndX.value = null;
  previewX.value = null;
});
</script>

<template>
  <section
    class="origin-chart-panel"
    aria-label="Origin SBar chart"
    data-testid="origin-chart-panel"
    @struxis-select-sbar="handleSbarSelectionRequest"
    @contextmenu.prevent.stop="handleChartContextMenu"
    :data-sbar-count="bars.length"
    :data-first-sbar-id="bars[0]?.sbarId ?? ''"
    :data-second-sbar-id="bars[1]?.sbarId ?? ''"
    :data-last-sbar-id="bars[bars.length - 1]?.sbarId ?? ''"
  >
    <div class="origin-chart-heading">
      <div class="chart-title-block">
        <h3>ORIGIN · {{ latestBar?.barType ?? originDatasetId }}</h3>
        <span class="tag green">CATALOG SOURCE</span>
        <span class="chart-desc">K-line + Struxis structure + volume</span>
      </div>
      <div class="chart-heading-actions">
        <span class="chart-bar-count">{{ bars.length.toLocaleString() }} SBARS</span>
        <button class="chart-tool-button" type="button" :disabled="bars.length === 0" @click="fitContent">FIT</button>
      </div>
    </div>
    <div v-if="chartError" class="error-message chart-error" role="alert" data-testid="origin-chart-error">
      <strong>Chart projection rejected</strong>
      <span>{{ chartError }}</span>
    </div>
    <div v-else-if="bars.length === 0" class="origin-chart-empty">
      No SBar data is available in this Origin projection.
    </div>
    <div class="origin-chart-viewport" data-testid="origin-chart-viewport">
      <div
        ref="chartHost"
        class="origin-chart-host"
        data-testid="origin-chart-canvas"
        :data-origin-dataset-id="originDatasetId"
        :data-first-sbar-x="firstSbarX ?? ''"
        :data-second-sbar-x="secondSbarX ?? ''"
        :data-selection-start-x="selectionStartX ?? ''"
        :data-selection-end-x="selectionEndX ?? ''"
        :data-selection-preview-x="previewX ?? ''"
        :aria-label="`Candlestick and volume chart for Origin ${originDatasetId}`"
      ></div>
      <svg
        class="origin-structure-overlay"
        data-testid="origin-structure-overlay"
        :data-structure-counts="JSON.stringify({ cbars: props.structure?.cbars.length ?? 0, swings: props.structure?.swings.length ?? 0 })"
        aria-hidden="true"
      >
        <rect
          v-if="hoveredSbarMarker"
          class="origin-object-hover-sbar"
          :x="hoveredSbarMarker.x"
          :y="hoveredSbarMarker.y"
          :width="hoveredSbarMarker.width"
          :height="hoveredSbarMarker.height"
          data-testid="origin-hover-sbar"
          :data-sbar-id="hoveredSbarMarker.id"
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
        />
        <line
          v-for="segment in swingSegments"
          :key="segment.id"
          :x1="segment.x1"
          :y1="segment.y1"
          :x2="segment.x2"
          :y2="segment.y2"
          :stroke="segment.color"
          stroke-width="1.25"
          :stroke-dasharray="segment.dasharray || undefined"
          stroke-linecap="round"
          data-testid="swing-state-segment"
          :data-swing-id="segment.id"
          :data-swing-state="segment.state"
        />
        <line
          v-for="segment in swingSegments.filter((item) => hoveredObject?.kind === 'swing' && hoveredObject.id === item.id)"
          :key="`hover-${segment.id}`"
          :x1="segment.x1"
          :y1="segment.y1"
          :x2="segment.x2"
          :y2="segment.y2"
          stroke="#C3CBD1"
          stroke-width="2"
          stroke-linecap="round"
          data-testid="origin-hover-swing"
          :data-swing-id="segment.id"
        />
        <line
          v-for="segment in swingSegments.filter((item) => props.selectedObject?.kind === 'swing' && props.selectedObject.id === item.id && props.selectedObject.originDatasetId === originDatasetId)"
          :key="`selected-${segment.id}`"
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
          v-for="rectangle in cbarRectangles"
          :key="rectangle.id"
          :x="rectangle.x"
          :y="rectangle.y"
          :width="rectangle.width"
          :height="rectangle.height"
          fill="none"
          stroke="#A0A7B0"
          stroke-width="1"
          data-testid="cbar-range-rectangle"
          :data-cbar-id="rectangle.id"
        />
        <rect
          v-for="rectangle in cbarRectangles.filter((item) => hoveredObject?.kind === 'cbar' && hoveredObject.id === item.id)"
          :key="`hover-${rectangle.id}`"
          :x="rectangle.x"
          :y="rectangle.y"
          :width="rectangle.width"
          :height="rectangle.height"
          fill="none"
          stroke="#C3CBD1"
          stroke-width="1.75"
          data-testid="origin-hover-cbar"
          :data-cbar-id="rectangle.id"
        />
        <rect
          v-for="rectangle in cbarRectangles.filter((item) => props.selectedObject?.kind === 'cbar' && props.selectedObject.id === item.id && props.selectedObject.originDatasetId === originDatasetId)"
          :key="`selected-${rectangle.id}`"
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
      </svg>
      <div
        v-if="hoveredObject"
        class="origin-object-hover-label"
        data-testid="origin-object-hover-label"
        aria-live="off"
      >{{ hoveredObject.kind.toUpperCase() }} · {{ hoveredObject.id }}</div>
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
      <div class="origin-chart-legend" role="group" aria-label="Chart layer visibility">
        <button type="button" class="origin-chart-legend-item" :class="{ active: layerVisibility.sbar }" :aria-pressed="layerVisibility.sbar" data-testid="layer-toggle-sbar" @click="toggleLayer('sbar')"><i class="legend-dot sbar-dot"></i>SBar</button>
        <button type="button" class="origin-chart-legend-item" :class="{ active: layerVisibility.cbar }" :aria-pressed="layerVisibility.cbar" :disabled="!structure || structure.cbars.length === 0" data-testid="layer-toggle-cbar" @click="toggleLayer('cbar')"><i class="legend-dot cbar-dot"></i>CBar</button>
        <button type="button" class="origin-chart-legend-item" :class="{ active: layerVisibility.swing }" :aria-pressed="layerVisibility.swing" :disabled="!structure || structure.swings.length === 0" data-testid="layer-toggle-swing" @click="toggleLayer('swing')"><i class="legend-dot swing-dot"></i>Swing</button>
        <button type="button" class="origin-chart-legend-item" :class="{ active: layerVisibility.volume }" :aria-pressed="layerVisibility.volume" data-testid="layer-toggle-volume" @click="toggleLayer('volume')"><i class="legend-dot volume-dot"></i>Volume</button>
      </div>
    </div>
    <div class="origin-chart-foot">
      <span>SBARS <b>{{ bars.length.toLocaleString() }}</b></span>
      <span v-if="latestBar">VOL <b>{{ latestBar.volume }}</b></span>
      <span v-if="latestBar" class="origin-chart-last-id" :title="latestBar.sbarId">LAST ID <code>{{ latestBar.sbarId }}</code></span>
      <span class="origin-chart-selection-status">
        {{ selectionPending ? "SELECT END · MOVE TO PREVIEW" : selectionStartSbarId && selectionEndSbarId ? (selectionEditable !== false ? "DRAG EDGES · ADJUST INTERVAL" : "INCLUSIVE INTERVAL FIXED") : selectionStartSbarId ? "SELECT END ON CHART" : "CLICK CHART TO SELECT START" }}
      </span>
    </div>
  </section>
</template>

<style scoped>
.origin-chart-panel {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex: 1 1 auto;
  flex-direction: column;
  margin: 0;
  overflow: hidden;
  border: 1px solid #30383f;
  border-radius: 0;
  background: #121619;
}

.origin-chart-heading {
  display: flex;
  height: 29px;
  min-height: 29px;
  flex: 0 0 29px;
  align-items: center;
  gap: 9px;
  padding: 0 10px;
  overflow: hidden;
  border-bottom: 1px solid #252c32;
  background: #191e22;
}

.chart-title-block {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 9px;
  overflow: hidden;
  white-space: nowrap;
}

.chart-title-block h3 {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  color: #e3e8eb;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: .07em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chart-title-block .tag {
  flex: 0 0 auto;
  font-size: 8px;
}

.chart-desc {
  overflow: hidden;
  color: #89949d;
  font-size: 9px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chart-heading-actions {
  display: flex;
  min-width: 0;
  flex: 0 0 auto;
  align-items: center;
  gap: 10px;
  margin-left: auto;
}

.chart-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #a5b0b7;
  font: 9px ui-monospace, SFMono-Regular, Consolas, monospace;
  white-space: nowrap;
}

.chart-meta b {
  color: #d6dfe3;
  font-weight: 500;
}

.chart-bar-count {
  color: #a5b0b7;
  font: 9px ui-monospace, SFMono-Regular, Consolas, monospace;
  white-space: nowrap;
}

.chart-tool-button {
  min-width: 34px;
  min-height: 22px;
  padding: 0 6px;
  border: 1px solid #30383f;
  border-radius: 3px;
  background: #20262c;
  color: #c4cdd2;
  font: 8px ui-monospace, SFMono-Regular, Consolas, monospace;
}

.origin-chart-viewport {
  position: relative;
  flex: 1 1 0;
  width: 100%;
  height: 0;
  min-height: 0;
  overflow: hidden;
}

.origin-structure-overlay {
  position: absolute;
  z-index: 1;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  pointer-events: none;
}

.origin-structure-overlay rect,
.origin-structure-overlay line {
  vector-effect: non-scaling-stroke;
}

.origin-chart-host {
  width: 100%;
  height: 100%;
  min-height: 0;
}

.origin-object-hover-label {
  position: absolute;
  z-index: 3;
  top: 7px;
  right: 10px;
  max-width: 42%;
  overflow: hidden;
  padding: 3px 5px;
  border: 1px solid #394149;
  border-radius: 2px;
  background: rgb(18 22 25 / 92%);
  color: #b9c2c8;
  font: 9px ui-monospace, SFMono-Regular, Consolas, monospace;
  text-overflow: ellipsis;
  white-space: nowrap;
  pointer-events: none;
}

.origin-structure-overlay .origin-object-hover-sbar {
  fill: rgb(195 203 209 / 8%);
  stroke: rgb(195 203 209 / 48%);
  stroke-width: 1;
}

.origin-structure-overlay .origin-object-selected-sbar {
  fill: rgb(217 154 69 / 10%);
  stroke: #D99A45;
  stroke-width: 1.25;
}

.origin-chart-legend {
  position: absolute;
  z-index: 2;
  top: 7px;
  left: 10px;
  display: flex;
  align-items: center;
  gap: 10px;
  color: #9aa5ac;
  font: 9px ui-monospace, SFMono-Regular, Consolas, monospace;
}

.origin-chart-legend-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 1px 2px;
  border: 1px solid transparent;
  border-radius: 2px;
  background: transparent;
  color: #69757d;
  font: inherit;
  cursor: pointer;
}

.origin-chart-legend-item.active {
  color: #c4cdd2;
}

.origin-chart-legend-item:hover:not(:disabled) {
  border-color: #39434b;
  background: #1a2025;
}

.origin-chart-legend-item:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.legend-dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 1px;
}

.sbar-dot {
  background: #75c6a1;
}

.cbar-dot {
  background: #A0A7B0;
}

.swing-dot {
  background: #B49ACD;
}

.volume-dot {
  background: #c4a16b;
}

.origin-chart-foot {
  display: flex;
  height: 18px;
  min-height: 18px;
  flex: 0 0 18px;
  align-items: center;
  gap: 12px;
  padding: 0 9px;
  overflow: hidden;
  border-top: 1px solid #252c32;
  color: #89949d;
  font: 8px ui-monospace, SFMono-Regular, Consolas, monospace;
  white-space: nowrap;
}

.origin-chart-foot b {
  color: #d6dfe3;
  font-weight: 500;
}

.origin-chart-last-id {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 4px;
  overflow: hidden;
}

.origin-chart-last-id code {
  min-width: 0;
  overflow: hidden;
  color: #a5b0b7;
  text-overflow: ellipsis;
}

.origin-chart-selection-status {
  min-width: 0;
  margin-left: auto;
  overflow: hidden;
  color: #a5b0b7;
  text-overflow: ellipsis;
}

.origin-chart-empty {
  display: grid;
  min-height: 0;
  flex: 1 1 auto;
  place-items: center;
  padding: 12px;
  color: #89949d;
  font-size: 10px;
}

.chart-error {
  flex: 0 0 auto;
  margin: 6px;
  padding: 7px 9px;
  font-size: 9px;
}

@media (max-width: 1180px) {
  .chart-desc {
    display: none;
  }

  .chart-meta {
    gap: 6px;
  }

  .origin-chart-foot {
    gap: 8px;
  }
}

@media (max-width: 760px) {
  .chart-meta {
    display: none;
  }

  .origin-chart-last-id {
    display: none;
  }
}
</style>
