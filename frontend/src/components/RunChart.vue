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
import type { OriginDatasetDto, ReplayChartSelection, ReplayInspectorStructureDto, RunStateDto, SBarDto, TestDatasetDto } from "../origin-types";

const props = defineProps<{
  origin: OriginDatasetDto | null;
  testDataset: TestDatasetDto | null;
  runState: RunStateDto | null;
  structure?: ReplayInspectorStructureDto | null;
  selectedObject?: ReplayChartSelection | null;
  targetSbarId?: string | null;
}>();
const emit = defineEmits<{
  objectSelect: [selection: ReplayChartSelection];
  targetSelect: [sbarId: string];
  targetCancel: [];
}>();

const chartHost = ref<HTMLDivElement | null>(null);
const chartError = ref("");
const layerVisibility = ref({ sbar: true, volume: true, cbar: true, swing: true });
type CBarRectangle = { id: string; x: number; y: number; width: number; height: number };
type SwingSegment = { id: string; x1: number; y1: number; x2: number; y2: number; color: string; dasharray: string; state: string };
type SBarSelectionMarker = { id: string; x: number; y: number; width: number; height: number };
const selectedSbarMarker = ref<SBarSelectionMarker | null>(null);
const targetSbarX = ref<number | null>(null);
const hoveredSbarMarker = ref<SBarSelectionMarker | null>(null);
const hoveredObject = ref<ReplayChartSelection | null>(null);
const cbarRectangles = ref<CBarRectangle[]>([]);
const swingSegments = ref<SwingSegment[]>([]);
let timeBySbarId: ReadonlyMap<string, Time> = new Map();
let cachedProjection: ReturnType<typeof mapOriginBarsToChart> | null = null;
const swingStyleByState: Record<string, { color: string; dasharray: string }> = {
  Confirmed: { color: "#B49ACD", dasharray: "" },
  Tentative: { color: "#D6A85D", dasharray: "6 3" },
  Extending: { color: "#8FA9C4", dasharray: "2 3" },
};
const bars = computed<SBarDto[]>(() => {
  const origin = props.origin;
  const test = props.testDataset;
  if (!origin || !test || origin.originDatasetId !== test.originDatasetId) return [];
  const start = origin.bars.findIndex((bar) => bar.sbarId === test.startSbarId);
  const end = origin.bars.findIndex((bar) => bar.sbarId === test.endSbarId);
  if (start < 0 || end < start) return [];
  const selected = origin.bars.slice(start, end + 1);
  return selected.length === test.sbarCount ? selected : [];
});
const projectionMessage = computed(() => {
  if (!props.testDataset) return "Create a Test Dataset to view its fixed input sequence.";
  if (!props.origin || props.origin.originDatasetId !== props.testDataset.originDatasetId) {
    return "The Origin required by this Test Dataset is not the currently loaded Origin.";
  }
  if (bars.value.length !== props.testDataset.sbarCount) {
    return "The Test Dataset boundaries could not be resolved against the current validated Origin sequence.";
  }
  return "";
});
const replayProgressApplies = computed(() =>
  Boolean(
    props.runState &&
    props.testDataset &&
    props.runState.testDatasetId === props.testDataset.testDatasetId &&
    props.runState.status !== "disposed",
  ),
);
const displayedBar = computed(() => {
  if (!replayProgressApplies.value) return bars.value[bars.value.length - 1] ?? null;
  const processedCount = Math.min(props.runState?.processedCount ?? 0, bars.value.length);
  return processedCount > 0 ? bars.value[processedCount - 1] : null;
});

let chart: IChartApi | null = null;
let candleSeries: ISeriesApi<"Candlestick"> | null = null;
let volumeSeries: ISeriesApi<"Histogram"> | null = null;
let resizeObserver: ResizeObserver | null = null;
let overlayUpdateFrame: number | null = null;
let fittedTestDatasetId: string | null = null;
let lastProcessedCount: number | null = null;
let lastRunId: string | null = null;
let lastProgressApplies: boolean | null = null;
let visibleRangeListener: (() => void) | null = null;
let chartClickListener: ((param: { point?: { x: number; y: number } | undefined }) => void) | null = null;
let chartMoveListener: ((param: { point?: { x: number; y: number } | undefined }) => void) | null = null;
let crosshairLogicalIndex: number | null = null;

function isInteractiveKeyboardTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return target.closest(
    "input, textarea, select, button, a[href], summary, [contenteditable]:not([contenteditable='false']), [role='button'], [role='link'], [role='menuitem'], [role='slider'], [role='textbox'], [role='combobox'], [tabindex]:not([tabindex='-1'])",
  ) !== null;
}

function barAtLogicalIndex(logical: number): SBarDto | null {
  if (!Number.isFinite(logical)) return null;
  return bars.value[Math.round(logical)] ?? null;
}

function moveCrosshairTo(index: number, alignToBoundary = false): boolean {
  if (!chart || !candleSeries || bars.value.length === 0) return false;
  const nextIndex = Math.max(0, Math.min(bars.value.length - 1, index));
  const bar = bars.value[nextIndex];
  if (!bar) return false;
  const time = timeBySbarId.get(bar.sbarId);
  if (time === undefined) return false;
  crosshairLogicalIndex = nextIndex;

  // Keep the selected candle inside the viewport without scrolling the
  // logical range beyond the Test Dataset's first/last candle. A simple
  // edge shift can push the range past index 0 or the final index, making
  // Ctrl+Left / Ctrl+Right appear to land outside the dataset.
  const timeScale = chart.timeScale();
  const range = timeScale.getVisibleLogicalRange?.();
  if (range && Number.isFinite(range.from) && Number.isFinite(range.to)) {
    const width = range.to - range.from;
    if (width > 0) {
      const lastIndex = bars.value.length - 1;
      let from = range.from;
      let to = range.to;

      if (alignToBoundary && width < bars.value.length) {
        // Ctrl+Left / Ctrl+Right are absolute navigation commands. Align the
        // viewport to the requested dataset edge instead of applying the
        // ordinary arrow-key margin heuristic, which can leave the target
        // candle visually at or beyond the edge after range clamping.
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

        // Keep the viewport within the dataset candle-center bounds when it
        // is narrower than the sequence. Wider viewports retain their zoom.
        if (width < bars.value.length) {
          from = Math.max(-0.5, Math.min(from, bars.value.length - 0.5 - width));
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

  // Apply crosshair after viewport adjustment so its pixel position is
  // computed against the final time scale.
  chart.setCrosshairPosition?.(Number(bar.close), time, candleSeries);
  return true;
}

function moveCrosshairBy(delta: number): boolean {
  const currentIndex = crosshairLogicalIndex ??
    (props.runState?.cursorSbarId
      ? bars.value.findIndex((bar) => bar.sbarId === props.runState?.cursorSbarId)
      : 0);
  const targetIndex = currentIndex + delta;

  // Dataset navigation is bounded, not cyclic. At either edge, leave the
  // crosshair and viewport untouched instead of clamping and re-applying the
  // same candle (or accidentally reinitializing from Replay progress).
  if (targetIndex < 0 || targetIndex >= bars.value.length) return false;
  return moveCrosshairTo(targetIndex);
}

function zoomTimeScale(direction: "in" | "out"): boolean {
  if (!chart || bars.value.length === 0) return false;
  const timeScale = chart.timeScale();
  const range = timeScale.getVisibleLogicalRange?.();
  if (!range || !Number.isFinite(range.from) || !Number.isFinite(range.to)) return false;
  const width = range.to - range.from;
  const maximumWidth = bars.value.length + 8;
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
  const isBoundaryNavigation = event.ctrlKey && !event.altKey && !event.metaKey &&
    !event.shiftKey && (event.key === "ArrowLeft" || event.key === "ArrowRight");
  if (
    (event.repeat && !isArrowKey) ||
    event.altKey || event.metaKey || (event.ctrlKey && !isBoundaryNavigation) ||
    (event.shiftKey && !isBoundaryNavigation) ||
    isInteractiveKeyboardTarget(event.target) ||
    isInteractiveKeyboardTarget(document.activeElement) ||
    chartError.value || projectionMessage.value || bars.value.length === 0
  ) return;

  let handled = false;
  if (isBoundaryNavigation) {
    handled = moveCrosshairTo(event.key === "ArrowLeft" ? 0 : bars.value.length - 1, true);
  } else if (event.key === "ArrowUp") handled = zoomTimeScale("in");
  else if (event.key === "ArrowDown") handled = zoomTimeScale("out");
  else if (event.key === "ArrowLeft") handled = moveCrosshairBy(-1);
  else if (event.key === "ArrowRight") handled = moveCrosshairBy(1);
  else if (event.key.toLowerCase() === "t") {
    const bar = crosshairLogicalIndex === null ? null : barAtLogicalIndex(crosshairLogicalIndex);
    if (bar) {
      emit("targetSelect", bar.sbarId);
      handled = true;
    }
  }

  if (handled) event.preventDefault();
}

function toggleLayer(layer: keyof typeof layerVisibility.value): void {
  layerVisibility.value[layer] = !layerVisibility.value[layer];
  if (layer === "sbar" && candleSeries) {
    candleSeries.applyOptions?.({ visible: layerVisibility.value.sbar });
  }
  if (layer === "volume" && volumeSeries) {
    volumeSeries.applyOptions?.({ visible: layerVisibility.value.volume });
  }
  updateStructureOverlays();
}

function fitContent(): void {
  chart?.timeScale().fitContent();
}

function updateStructureOverlays(): void {
  if (!chart || !candleSeries || typeof chart.timeScale().timeToCoordinate !== "function" || typeof candleSeries.priceToCoordinate !== "function") {
    selectedSbarMarker.value = null;
    hoveredSbarMarker.value = null;
    cbarRectangles.value = [];
    swingSegments.value = [];
    targetSbarX.value = null;
    return;
  }
  const timeScale = chart.timeScale();
  const structure = props.structure;
  const selected = props.selectedObject;
  if (layerVisibility.value.sbar && selected?.kind === "sbar" && ((selected.checkpointSbarId === null && !props.runState) || selected.checkpointSbarId === props.runState?.cursorSbarId)) {
    const selectedTime = timeBySbarId.get(selected.id);
    const selectedBar = bars.value.find((bar) => bar.sbarId === selected.id);
    const selectedX = selectedTime === undefined ? null : timeScale.timeToCoordinate(selectedTime);
    const selectedHigh = selectedBar ? candleSeries.priceToCoordinate(Number(selectedBar.high)) : null;
    const selectedLow = selectedBar ? candleSeries.priceToCoordinate(Number(selectedBar.low)) : null;
    if (selectedBar && selectedX !== null && selectedX !== undefined && selectedHigh !== null && selectedHigh !== undefined && selectedLow !== null && selectedLow !== undefined) {
      selectedSbarMarker.value = { id: selected.id, x: selectedX - 6, y: Math.min(selectedHigh, selectedLow), width: 12, height: Math.max(4, Math.abs(selectedLow - selectedHigh)) };
    } else selectedSbarMarker.value = null;
  } else selectedSbarMarker.value = null;
  cbarRectangles.value = layerVisibility.value.cbar ? (structure?.cbars ?? []).flatMap((cbar) => {
    const start = timeBySbarId.get(cbar.sbarStartId);
    const end = timeBySbarId.get(cbar.sbarEndId);
    const high = Number(cbar.high);
    const low = Number(cbar.low);
    if (start === undefined || end === undefined || !Number.isFinite(high) || !Number.isFinite(low)) return [];
    const x1 = timeScale.timeToCoordinate(start);
    const x2 = timeScale.timeToCoordinate(end);
    const y1 = candleSeries?.priceToCoordinate(high);
    const y2 = candleSeries?.priceToCoordinate(low);
    if ([x1, x2, y1, y2].some((v) => v === null || v === undefined || !Number.isFinite(v))) return [];
    return [{ id: cbar.cbarId, x: Math.min(x1 as number, x2 as number), y: Math.min(y1 as number, y2 as number), width: Math.abs((x2 as number) - (x1 as number)), height: Math.abs((y2 as number) - (y1 as number)) }];
  }) : [];
  swingSegments.value = layerVisibility.value.swing ? (structure?.swings ?? []).flatMap((swing) => {
    const start = timeBySbarId.get(swing.sbarStartId);
    const end = timeBySbarId.get(swing.sbarEndId);
    const high = Number(swing.high);
    const low = Number(swing.low);
    if (start === undefined || end === undefined || !Number.isFinite(high) || !Number.isFinite(low)) return [];
    const x1 = timeScale.timeToCoordinate(start);
    const x2 = timeScale.timeToCoordinate(end);
    const startsAtLow = swing.direction === "Up";
    const y1 = candleSeries?.priceToCoordinate(startsAtLow ? low : high);
    const y2 = candleSeries?.priceToCoordinate(startsAtLow ? high : low);
    if ([x1, x2, y1, y2].some((v) => v === null || v === undefined || !Number.isFinite(v))) return [];
    const style = swingStyleByState[swing.state] ?? { color: "#A0A7B0", dasharray: "4 3" };
    return [{ id: swing.swingId, x1: x1 as number, y1: y1 as number, x2: x2 as number, y2: y2 as number, color: style.color, dasharray: style.dasharray, state: swing.state }];
  }) : [];
  const targetTime = props.targetSbarId ? timeBySbarId.get(props.targetSbarId) : undefined;
  const targetX = targetTime === undefined ? null : timeScale.timeToCoordinate(targetTime);
  targetSbarX.value = targetX !== null && targetX !== undefined && Number.isFinite(targetX)
    ? targetX
    : null;
  updateHoverMarker();
}

function markerForSbar(sbarId: string | null | undefined): SBarSelectionMarker | null {
  if (!chart || !candleSeries || !sbarId || !layerVisibility.value.sbar) return null;
  const index = bars.value.findIndex((bar) => bar.sbarId === sbarId);
  const bar = index >= 0 ? bars.value[index] : undefined;
  const time = timeBySbarId.get(sbarId);
  if (!bar || time === undefined) return null;
  const x = chart.timeScale().timeToCoordinate(time);
  const highY = candleSeries.priceToCoordinate(Number(bar.high));
  const lowY = candleSeries.priceToCoordinate(Number(bar.low));
  if ([x, highY, lowY].some((value) => value === null || value === undefined || !Number.isFinite(value))) return null;
  const adjacentXs = [
    index > 0 ? chart.timeScale().timeToCoordinate(timeBySbarId.get(bars.value[index - 1]!.sbarId)!) : null,
    index + 1 < bars.value.length ? chart.timeScale().timeToCoordinate(timeBySbarId.get(bars.value[index + 1]!.sbarId)!) : null,
  ].filter((value): value is number => value !== null && value !== undefined && Number.isFinite(value));
  const spacing = adjacentXs.length
    ? Math.min(...adjacentXs.map((adjacentX) => Math.abs(adjacentX - (x as number))).filter((distance) => distance > 0))
    : 8;
  const width = Math.max(4, Math.min(12, Number.isFinite(spacing) && spacing > 0 ? spacing * 0.42 : 6));
  const top = Math.min(highY as number, lowY as number);
  const bottom = Math.max(highY as number, lowY as number);
  return { id: sbarId, x: (x as number) - width / 2, y: top, width, height: Math.max(2, bottom - top) };
}

function updateHoverMarker(): void {
  hoveredSbarMarker.value = hoveredObject.value?.kind === "sbar"
    ? markerForSbar(hoveredObject.value.id)
    : null;
}

function scheduleOverlayUpdate(): void {
  // Coalesce rapid wheel-zoom / pan range events to one projection per frame.
  // Lightweight Charts updates its canvas first; sample the public coordinate
  // transforms on the next animation frame so SVG overlays follow that viewport.
  if (overlayUpdateFrame !== null) cancelAnimationFrame(overlayUpdateFrame);
  overlayUpdateFrame = requestAnimationFrame(() => {
    overlayUpdateFrame = null;
    updateStructureOverlays();
  });
}

function distanceToSegment(x: number, y: number, segment: SwingSegment): number {
  const dx = segment.x2 - segment.x1;
  const dy = segment.y2 - segment.y1;
  const lengthSquared = dx * dx + dy * dy;
  const projection = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((x - segment.x1) * dx + (y - segment.y1) * dy) / lengthSquared));
  return Math.hypot(x - (segment.x1 + projection * dx), y - (segment.y1 + projection * dy));
}

function distanceToRectangleBorder(x: number, y: number, rectangle: CBarRectangle): number {
  const left = rectangle.x;
  const right = rectangle.x + rectangle.width;
  const top = rectangle.y;
  const bottom = rectangle.y + rectangle.height;
  const outsideX = x < left ? left - x : x > right ? x - right : 0;
  const outsideY = y < top ? top - y : y > bottom ? y - bottom : 0;
  if (outsideX > 0 || outsideY > 0) return Math.hypot(outsideX, outsideY);
  return Math.min(x - left, right - x, y - top, bottom - y);
}

function hitTestStructureObject(x: number, y: number): { kind: "swing" | "cbar"; id: string } | null {
  if (!props.runState?.cursorSbarId) return null;
  const candidates: Array<{ kind: "swing" | "cbar"; id: string; distance: number; priority: number }> = [];
  if (layerVisibility.value.swing) {
    for (const segment of swingSegments.value) candidates.push({ kind: "swing", id: segment.id, distance: distanceToSegment(x, y, segment), priority: 0 });
  }
  if (layerVisibility.value.cbar) {
    for (const rectangle of cbarRectangles.value) candidates.push({ kind: "cbar", id: rectangle.id, distance: distanceToRectangleBorder(x, y, rectangle), priority: 1 });
  }
  candidates.sort((a, b) => a.distance - b.distance || a.priority - b.priority || a.id.localeCompare(b.id));
  const best = candidates[0];
  return best && best.distance <= 6 ? { kind: best.kind, id: best.id } : null;
}

function hitTestSbar(x: number, y: number): string | null {
  if (!chart || !candleSeries || !layerVisibility.value.sbar || bars.value.length === 0) return null;
  const logical = chart.timeScale().coordinateToLogical?.(x);
  if (logical === null || logical === undefined || !Number.isFinite(logical)) return null;
  const index = Math.round(logical);
  const bar = bars.value[index];
  if (!bar) return null;
  const marker = markerForSbar(bar.sbarId);
  if (!marker) return null;
  const centerX = marker.x + marker.width / 2;
  if (Math.abs(x - centerX) > Math.max(3, marker.width / 2 + 1) ||
      y < marker.y - 5 || y > marker.y + marker.height + 5) return null;
  return bar.sbarId;
}

function updateHoveredObject(point: { x: number; y: number } | undefined): void {
  const checkpointSbarId = props.runState?.cursorSbarId ?? null;
  let next: ReplayChartSelection | null = null;
  if (point && Number.isFinite(point.x) && Number.isFinite(point.y) && !chartError.value) {
    const structureHit = hitTestStructureObject(point.x, point.y);
    if (structureHit && checkpointSbarId) next = { ...structureHit, checkpointSbarId };
    else {
      const sbarId = hitTestSbar(point.x, point.y);
      if (sbarId) next = { kind: "sbar", id: sbarId, checkpointSbarId };
    }
  }
  const current = hoveredObject.value;
  if (current?.kind === next?.kind && current?.id === next?.id && current?.checkpointSbarId === next?.checkpointSbarId) return;
  hoveredObject.value = next;
  updateHoverMarker();
}

function handleChartMove(param: { point?: { x: number; y: number } | undefined }): void {
  const x = param.point?.x;
  // A leave event clears hover, but retains the last logical crosshair anchor
  // so T still targets the position the user was inspecting.
  if (typeof x === "number") {
    const logical = chart?.timeScale().coordinateToLogical?.(x);
    // Only adopt a real candle under the pointer. When the pointer/crosshair
    // is outside the Test Dataset, retain the last valid navigation anchor;
    // clearing it makes the next keypress fall back to the backend cursor and
    // can appear to jump back to the beginning after boundary navigation.
    if (
      logical !== null && logical !== undefined && Number.isFinite(logical) &&
      Math.round(logical) >= 0 && Math.round(logical) < bars.value.length
    ) {
      crosshairLogicalIndex = Math.round(logical);
    }
  }
  updateHoveredObject(param.point);
}

function handleChartClick(param: { point?: { x: number; y: number } | undefined }): void {
  const x = param.point?.x;
  const y = param.point?.y;
  if (!chart || chartError.value || typeof x !== "number" || typeof y !== "number" || !Number.isFinite(x) || !Number.isFinite(y)) return;
  const structureHit = hitTestStructureObject(x, y);
  const checkpointSbarId = props.runState?.cursorSbarId;
  if (structureHit && checkpointSbarId) {
    emit("objectSelect", { ...structureHit, checkpointSbarId });
    return;
  }
  const logical = chart.timeScale().coordinateToLogical?.(x);
  if (logical === null || logical === undefined || !Number.isFinite(logical)) return;
  const index = Math.round(logical);
  const bar = bars.value[index];
  if (!bar) return;
  emit("objectSelect", { kind: "sbar", id: bar.sbarId, checkpointSbarId: checkpointSbarId ?? null });
}

function handleChartDoubleClick(event: MouseEvent): void {
  // Restart targeting is a chart-area gesture, not an OHLC hit test. Resolve
  // the same horizontal coordinate used by the crosshair against the Test
  // Dataset's logical SBar sequence; Y position and visible layer state do
  // not affect which SBar is targeted.
  const target = event.target;
  if (
    !chart ||
    chartError.value ||
    !(target instanceof Element) ||
    target.closest(".run-chart-legend, button, .run-chart-heading")
  ) return;
  const hostLeft = chartHost.value?.getBoundingClientRect().left ?? 0;
  const x = event.clientX - hostLeft;
  if (!Number.isFinite(x)) return;
  const logical = chart.timeScale().coordinateToLogical?.(x);
  if (logical === null || logical === undefined || !Number.isFinite(logical)) return;
  const bar = barAtLogicalIndex(logical);
  if (!bar) return;
  emit("targetSelect", bar.sbarId);
}

function handleContextMenu(event: MouseEvent): void {
  if (!props.targetSbarId) return;
  event.preventDefault();
  event.stopPropagation();
  emit("targetCancel");
}

function updateChart(): void {
  if (!chart || !candleSeries || !volumeSeries) return;
  try {
    if (projectionMessage.value) {
      candleSeries.setData([]);
      volumeSeries.setData([]);
      timeBySbarId = new Map();
      cachedProjection = null;
      lastProcessedCount = null;
      lastRunId = props.runState?.runId ?? null;
      lastProgressApplies = replayProgressApplies.value;
      selectedSbarMarker.value = null;
      cbarRectangles.value = [];
      swingSegments.value = [];
      targetSbarX.value = null;
      chartError.value = "";
      return;
    }
    const projection = mapOriginBarsToChart(bars.value);
    cachedProjection = projection;
    const processedCount = replayProgressApplies.value
      ? Math.min(props.runState?.processedCount ?? 0, bars.value.length)
      : bars.value.length;
    timeBySbarId = new Map(bars.value.map((bar, index) => [bar.sbarId, projection.candles[index]!.time]));
    const candles = projection.candles.map((candle, index) => {
      const base = layerVisibility.value.sbar ? candle : { ...candle, color: "rgba(0,0,0,0)", borderColor: "rgba(0,0,0,0)", wickColor: "rgba(0,0,0,0)" };
      if (!replayProgressApplies.value || index < processedCount) return base;
      return {
        ...base,
        color: layerVisibility.value.sbar ? "#454b53" : "rgba(0,0,0,0)",
        borderColor: layerVisibility.value.sbar ? "#454b53" : "rgba(0,0,0,0)",
        wickColor: layerVisibility.value.sbar ? "#454b53" : "rgba(0,0,0,0)",
      };
    });
    const volume = projection.volume.map((bar, index) =>
      !layerVisibility.value.volume
        ? { ...bar, color: "rgba(0,0,0,0)" }
        : replayProgressApplies.value && index >= processedCount
          ? { ...bar, color: "#454b53" }
          : bar,
    );
    candleSeries.setData(candles);
    volumeSeries.setData(volume);
    lastProcessedCount = processedCount;
    lastRunId = props.runState?.runId ?? null;
    lastProgressApplies = replayProgressApplies.value;
    chartError.value = "";
    updateStructureOverlays();
    if (props.testDataset && fittedTestDatasetId !== props.testDataset.testDatasetId) {
      chart.timeScale().fitContent();
      chart.timeScale().setVisibleLogicalRange({
        from: -0.5,
        to: projection.candles.length + 3.5,
      });
      fittedTestDatasetId = props.testDataset.testDatasetId;
    }
  } catch (error) {
    candleSeries.setData([]);
    volumeSeries.setData([]);
    cachedProjection = null;
    lastProcessedCount = null;
    lastRunId = props.runState?.runId ?? null;
    lastProgressApplies = replayProgressApplies.value;
    selectedSbarMarker.value = null;
    cbarRectangles.value = [];
    swingSegments.value = [];
    targetSbarX.value = null;
    chartError.value = error instanceof Error ? error.message : String(error);
  }
}

function updateProgressSeries(): void {
  if (!chart || !candleSeries || !volumeSeries || projectionMessage.value) return;
  const processedCount = replayProgressApplies.value
    ? Math.min(props.runState?.processedCount ?? 0, bars.value.length)
    : bars.value.length;
  const runId = props.runState?.runId ?? null;

  // Run identity and progress mode changes are reset boundaries, not a one-bar
  // transition. The dataset watcher normally handles these first; this guard
  // also makes the progress path safe if Vue batches multiple prop changes.
  if (
    lastProcessedCount === null ||
    lastRunId !== runId ||
    lastProgressApplies !== replayProgressApplies.value
  ) {
    updateChart();
    return;
  }
  if (processedCount === lastProcessedCount) return;

  if (
    replayProgressApplies.value &&
    processedCount === lastProcessedCount + 1 &&
    processedCount > 0
  ) {
    const index = processedCount - 1;
    const projection = cachedProjection;
    if (!projection) {
      updateChart();
      return;
    }
    const candle = projection.candles[index];
    const volume = projection.volume[index];
    if (!candle || !volume) {
      updateChart();
      return;
    }
    const candleUpdate = layerVisibility.value.sbar
      ? candle
      : { ...candle, color: "rgba(0,0,0,0)", borderColor: "rgba(0,0,0,0)", wickColor: "rgba(0,0,0,0)" };
    const volumeUpdate = layerVisibility.value.volume
      ? volume
      : { ...volume, color: "rgba(0,0,0,0)" };

    // lightweight-charts v5 supports historical updates. Future candles are
    // already present as dimmed points, so promote only the newly confirmed
    // SBar and volume bar instead of replacing the complete historical series.
    candleSeries.update(candleUpdate, true);
    volumeSeries.update(volumeUpdate, true);
    lastProcessedCount = processedCount;
    updateStructureOverlays();
    return;
  }

  // Unexpected jumps/backtracking are uncommon (e.g. a restored Run state).
  // Rebuild from the authoritative input projection rather than infer a delta.
  updateChart();
}

onMounted(() => {
  document.addEventListener("keydown", handleChartKeyboard);
  if (!chartHost.value) return;
  chart = createChart(chartHost.value, {
    width: Math.max(1, chartHost.value.clientWidth),
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
    // The last input candle may still be in the future during replay; the
    // cursor strip, not the final input price label, reports confirmed progress.
    lastValueVisible: false,
  });
  volumeSeries = chart.addSeries(HistogramSeries, {
    priceScaleId: "",
    priceFormat: { type: "volume" },
    lastValueVisible: false,
    priceLineVisible: false,
  });
  chart.priceScale("").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
  const timeScale = chart.timeScale();
  if (typeof chart.subscribeClick === "function") {
    chartClickListener = handleChartClick;
    chart.subscribeClick(chartClickListener);
  }
  if (typeof chart.subscribeCrosshairMove === "function") {
    chartMoveListener = handleChartMove;
    chart.subscribeCrosshairMove(chartMoveListener);
  }
  if (typeof timeScale.subscribeVisibleLogicalRangeChange === "function") {
    timeScale.subscribeVisibleLogicalRangeChange(scheduleOverlayUpdate);
    visibleRangeListener = () => timeScale.unsubscribeVisibleLogicalRangeChange?.(scheduleOverlayUpdate);
  }
  resizeObserver = new ResizeObserver((entries) => {
    const entry = entries[0];
    if (!chart || !entry) return;
    chart.applyOptions({
      width: Math.max(1, Math.floor(entry.contentRect.width)),
      height: Math.max(1, Math.floor(entry.contentRect.height)),
    });
    scheduleOverlayUpdate();
  });
  resizeObserver.observe(chartHost.value);
  updateChart();
});

watch(
  [
    () => bars.value,
    () => props.testDataset?.testDatasetId,
    () => props.origin?.originDatasetId,
    () => props.runState?.testDatasetId,
    () => props.runState?.runId,
    () => replayProgressApplies.value,
  ],
  () => {
    updateChart();
    updateHoveredObject(undefined);
  },
);

watch(
  () => props.runState?.processedCount,
  () => updateProgressSeries(),
);

watch(() => props.structure, () => {
  updateStructureOverlays();
  updateHoveredObject(undefined);
});
watch(() => props.selectedObject, updateStructureOverlays);
watch(() => props.targetSbarId, updateStructureOverlays);
watch(() => props.runState?.cursorSbarId, () => updateHoveredObject(undefined));
watch(() => [layerVisibility.value.sbar, layerVisibility.value.cbar, layerVisibility.value.swing] as const, () => updateHoveredObject(undefined));

onBeforeUnmount(() => {
  document.removeEventListener("keydown", handleChartKeyboard);
  crosshairLogicalIndex = null;
  visibleRangeListener?.();
  visibleRangeListener = null;
  if (chart && chartClickListener) chart.unsubscribeClick?.(chartClickListener);
  if (chart && chartMoveListener) chart.unsubscribeCrosshairMove?.(chartMoveListener);
  chartClickListener = null;
  chartMoveListener = null;
  hoveredObject.value = null;
  hoveredSbarMarker.value = null;
  resizeObserver?.disconnect();
  resizeObserver = null;
  if (overlayUpdateFrame !== null) {
    cancelAnimationFrame(overlayUpdateFrame);
    overlayUpdateFrame = null;
  }
  chart?.remove();
  chart = null;
  candleSeries = null;
  volumeSeries = null;
});
</script>

<template>
  <section class="run-chart-panel" aria-label="Live Replay SBar chart" data-testid="run-chart-panel"
    :data-test-dataset-id="testDataset?.testDatasetId ?? ''" :data-sbar-count="bars.length">
    <header class="run-chart-heading">
      <div class="run-chart-title">
        <div class="run-chart-title-line">
          <span class="run-chart-name">LIVE REPLAY · {{ testDataset?.barType ?? origin?.barType ?? "NO TEST" }}</span>
          <span class="tag green">LIVE</span>
        </div>
      </div>
      <div class="chart-heading-actions">
        <span class="chart-bar-count">{{ bars.length.toLocaleString() }} SBARS</span>
        <button class="chart-tool-button" type="button" :disabled="bars.length === 0" data-testid="run-chart-fit" @click="fitContent">FIT</button>
      </div>
    </header>

    <div class="run-chart-stage" @contextmenu="handleContextMenu" @dblclick="handleChartDoubleClick">
      <p v-if="projectionMessage" class="run-chart-message" data-testid="run-chart-empty">{{ projectionMessage }}</p>
      <p v-else-if="replayProgressApplies && !displayedBar" class="run-chart-message" data-testid="run-chart-awaiting-checkpoint">
        Waiting for the first backend-confirmed checkpoint. Future input SBars are dimmed.
      </p>
      <div v-if="chartError" class="error-message chart-error" role="alert" data-testid="run-chart-error">
        <strong>Chart projection rejected</strong><span>{{ chartError }}</span>
      </div>
      <div ref="chartHost" class="run-chart-host" data-testid="run-chart-canvas"
        :aria-label="`Candlestick and volume chart for Test Dataset ${testDataset?.testDatasetId ?? 'not selected'}`"></div>
      <svg class="run-structure-overlay" data-testid="run-structure-overlay" aria-hidden="true">
        <g v-if="targetSbarId && targetSbarX !== null" data-testid="restart-to-sbar-target" :data-target-sbar-id="targetSbarId">
          <line :x1="targetSbarX" y1="0" :x2="targetSbarX" y2="100%" stroke="#C6A06B" stroke-width="1.25" stroke-dasharray="5 4" />
          <text :x="targetSbarX + 5" y="13" fill="#C6A06B" font-size="9" font-weight="600" letter-spacing="1">TARGET</text>
          <circle :cx="targetSbarX" cy="98%" r="3" fill="#C6A06B" />
        </g>
        <rect v-if="hoveredSbarMarker" :x="hoveredSbarMarker.x" :y="hoveredSbarMarker.y" :width="hoveredSbarMarker.width" :height="hoveredSbarMarker.height" fill="rgb(195 203 209 / 8%)" stroke="rgb(195 203 209 / 48%)" stroke-width="1" data-testid="run-hover-sbar" :data-sbar-id="hoveredSbarMarker.id" />
        <rect v-if="selectedSbarMarker" :x="selectedSbarMarker.x" :y="selectedSbarMarker.y" :width="selectedSbarMarker.width" :height="selectedSbarMarker.height" fill="none" stroke="#D6A85D" stroke-width="1.5" data-testid="run-selected-sbar" :data-sbar-id="selectedSbarMarker.id" />
        <line v-for="segment in swingSegments" :key="segment.id" :x1="segment.x1" :y1="segment.y1" :x2="segment.x2" :y2="segment.y2" :stroke="selectedObject?.kind === 'swing' && selectedObject.id === segment.id && selectedObject.checkpointSbarId === runState?.cursorSbarId ? '#D6A85D' : segment.color" :stroke-width="selectedObject?.kind === 'swing' && selectedObject.id === segment.id && selectedObject.checkpointSbarId === runState?.cursorSbarId ? 2.25 : 1.25" :stroke-dasharray="segment.dasharray || undefined" stroke-linecap="round" data-testid="run-swing-segment" :data-swing-id="segment.id" :data-swing-state="segment.state" />
        <line v-for="segment in swingSegments.filter((item) => hoveredObject?.kind === 'swing' && hoveredObject.id === item.id && hoveredObject.checkpointSbarId === runState?.cursorSbarId && !(selectedObject?.kind === 'swing' && selectedObject.id === item.id && selectedObject.checkpointSbarId === runState?.cursorSbarId))" :key="`hover-${segment.id}`" :x1="segment.x1" :y1="segment.y1" :x2="segment.x2" :y2="segment.y2" stroke="#C3CBD1" stroke-width="2" stroke-linecap="round" data-testid="run-hover-swing" :data-swing-id="segment.id" />
        <rect v-for="rectangle in cbarRectangles" :key="rectangle.id" :x="rectangle.x" :y="rectangle.y" :width="rectangle.width" :height="rectangle.height" fill="none" :stroke="selectedObject?.kind === 'cbar' && selectedObject.id === rectangle.id && selectedObject.checkpointSbarId === runState?.cursorSbarId ? '#D6A85D' : '#A0A7B0'" :stroke-width="selectedObject?.kind === 'cbar' && selectedObject.id === rectangle.id && selectedObject.checkpointSbarId === runState?.cursorSbarId ? 2 : 1" data-testid="run-cbar-rectangle" :data-cbar-id="rectangle.id" />
        <rect v-for="rectangle in cbarRectangles.filter((item) => hoveredObject?.kind === 'cbar' && hoveredObject.id === item.id && hoveredObject.checkpointSbarId === runState?.cursorSbarId && !(selectedObject?.kind === 'cbar' && selectedObject.id === item.id && selectedObject.checkpointSbarId === runState?.cursorSbarId))" :key="`hover-${rectangle.id}`" :x="rectangle.x" :y="rectangle.y" :width="rectangle.width" :height="rectangle.height" fill="none" stroke="#C3CBD1" stroke-width="1.75" data-testid="run-hover-cbar" :data-cbar-id="rectangle.id" />
      </svg>
      <div v-if="hoveredObject" class="origin-object-hover-label" data-testid="run-object-hover-label" aria-live="off">{{ hoveredObject.kind.toUpperCase() }} · {{ hoveredObject.id }}</div>
      <div class="run-chart-legend" role="group" aria-label="Chart layer visibility">
        <button type="button" class="origin-chart-legend-item" :class="{ active: layerVisibility.sbar }" :aria-pressed="layerVisibility.sbar" data-testid="run-layer-toggle-sbar" @click="toggleLayer('sbar')"><i class="legend-dot sbar-dot"></i>SBar</button>
        <button type="button" class="origin-chart-legend-item" :class="{ active: layerVisibility.cbar }" :aria-pressed="layerVisibility.cbar" :disabled="!structure || structure.cbars.length === 0" data-testid="run-layer-toggle-cbar" @click="toggleLayer('cbar')"><i class="legend-dot cbar-dot"></i>CBar</button>
        <button type="button" class="origin-chart-legend-item" :class="{ active: layerVisibility.swing }" :aria-pressed="layerVisibility.swing" :disabled="!structure || structure.swings.length === 0" data-testid="run-layer-toggle-swing" @click="toggleLayer('swing')"><i class="legend-dot swing-dot"></i>Swing</button>
        <button type="button" class="origin-chart-legend-item" :class="{ active: layerVisibility.volume }" :aria-pressed="layerVisibility.volume" data-testid="run-layer-toggle-volume" @click="toggleLayer('volume')"><i class="legend-dot volume-dot"></i>Volume</button>
      </div>
    </div>

  </section>
</template>
