<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import {
  CandlestickSeries,
  ColorType,
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
let timeBySbarId: ReadonlyMap<string, Time> = new Map();
let firstSbarTime: Time | null = null;
let secondSbarTime: Time | null = null;
type CBarRectangle = { id: string; x: number; y: number; width: number; height: number };
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
  const candidates = [
    ...swingSegments.value.map((segment) => ({
      kind: "swing" as const,
      id: segment.id,
      distance: distanceToSegment(x, y, segment),
      priority: 0,
    })),
    ...cbarRectangles.value.map((rectangle) => ({
      kind: "cbar" as const,
      id: rectangle.id,
      distance: distanceToRectangleBorder(x, y, rectangle),
      priority: 1,
    })),
  ].filter((candidate) => candidate.distance <= tolerance);

  candidates.sort((a, b) =>
    a.distance - b.distance ||
    a.priority - b.priority ||
    a.id.localeCompare(b.id),
  );
  const candidate = candidates[0];
  return candidate ? { kind: candidate.kind, id: candidate.id, originDatasetId: props.originDatasetId } : null;
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
  if (!props.selectionPending || selectionStartX.value === null) {
    previewX.value = null;
    return;
  }
  const pointX = param.point?.x;
  previewX.value = typeof pointX === "number" && Number.isFinite(pointX) ? pointX : null;
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

function updateChart(): void {
  if (!chart || !candleSeries || !volumeSeries) return;
  try {
    const projection = mapOriginBarsToChart(props.bars);
    candleSeries.setData(projection.candles);
    volumeSeries.setData(projection.volume);
    sbarIdByLogicalIndex = props.bars.map((bar) => bar.sbarId);
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

watch(() => [props.bars, props.structure, props.originDatasetId] as const, updateChart);
watch(
  () => [props.selectionStartSbarId, props.selectionEndSbarId, props.selectionPending] as const,
  () => {
    updateSbarCoordinates();
    if (!props.selectionPending) previewX.value = null;
  },
);

onBeforeUnmount(() => {
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
  sbarIdByLogicalIndex = [];
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
    @contextmenu.prevent="handleChartContextMenu"
    :data-sbar-count="bars.length"
    :data-first-sbar-id="bars[0]?.sbarId ?? ''"
    :data-second-sbar-id="bars[1]?.sbarId ?? ''"
  >
    <div class="origin-chart-heading">
      <div class="chart-title-block">
        <h3>ORIGIN · {{ latestBar?.barType ?? originDatasetId }}</h3>
        <span class="tag green">CATALOG SOURCE</span>
        <span class="chart-desc">K-line + Struxis structure + volume</span>
      </div>
      <div class="chart-heading-actions">
        <div v-if="latestBar" class="chart-meta" aria-label="Latest SBar OHLC">
          <span>O <b>{{ latestBar.open }}</b></span>
          <span>H <b>{{ latestBar.high }}</b></span>
          <span>L <b>{{ latestBar.low }}</b></span>
          <span>C <b>{{ latestBar.close }}</b></span>
        </div>
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
      <svg class="origin-structure-overlay" data-testid="origin-structure-overlay" aria-hidden="true">
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
      </svg>
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
  border-radius: 4px;
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
