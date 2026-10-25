<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { CrosshairMode, type IChartApi, type ISeriesApi, type Time } from "lightweight-charts";
import { createSbarChartRuntime } from "../sbar-chart-runtime";
import type { ChartPrimitiveHost } from "../sbar-chart-primitive-host";
import { registerCBarPrimitive, registerSwingPrimitive, type StructurePrimitiveController } from "../sbar-chart-structure-primitives";
import { observeSbarChartResize } from "../sbar-chart-resize";
import { createAnimationFrameCoalescer } from "../animation-frame-coalescer";
import { projectCBarRectangles, projectSwingSegments } from "../sbar-chart-structure-geometry";
import { mapSBarsToChart } from "../sbar-chart-data";
import { createSbarChartIndex, resolveSbarChartAnchor } from "../sbar-chart-index";
import type { ReplayInspectorStructureDto, SBarDto } from "../origin-types";

const props = withDefaults(defineProps<{
  bars: SBarDto[];
  structure: ReplayInspectorStructureDto | null;
  sequenceId: string;
  headerTitle?: string;
  headerTag?: string;
  emptyMessage?: string;
  showHeader?: boolean;
  showFooter?: boolean;
  panelClass?: string;
  panelLabel?: string;
  chartLabel?: string;
  keyboardActive?: boolean;
}>(), {
  keyboardActive: undefined,
});
const latestBar = computed(() => props.bars[props.bars.length - 1] ?? null);
const emit = defineEmits<{
  chartActivate: [];
  chartClick: [point: { x: number; y: number | null } | null];
  pointerPosition: [point: { x: number; y: number } | null];
  logicalRangeChange: [range: { from: number; to: number }];
  crosshairAnchorChange: [anchor: { sbarId: string | null; price: number | null }];
  projectionFrame: [];
}>();
const chartHost = ref<HTMLDivElement | null>(null);
const structureOverlayWidth = ref(0);
const chartError = ref("");
const layerVisibility = ref({ sbar: true, volume: true, cbar: true, swing: true });
let chart: IChartApi | null = null;
let candleSeries: ISeriesApi<"Candlestick"> | null = null;
let volumeSeries: ISeriesApi<"Histogram"> | null = null;
let primitiveHost: ChartPrimitiveHost | null = null;
let cbarPrimitive: StructurePrimitiveController | null = null;
let swingPrimitive: StructurePrimitiveController | null = null;
let stopObservingResize: (() => void) | null = null;

let crosshairUpdateFrame: number | null = null;
let fittedSequenceId: string | null = null;
let sbarIdByLogicalIndex: readonly string[] = [];
let indexBySbarId: ReadonlyMap<string, number> = new Map();
let timeBySbarId: ReadonlyMap<string, Time> = new Map();
let firstSbarTime: Time | null = null;
let secondSbarTime: Time | null = null;
let pendingViewportRange: { from: number; to: number } | null = null;
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

const swingStyleByState: Record<string, { color: string; dasharray: string }> = {
  Confirmed: { color: "#B49ACD", dasharray: "" },
  Tentative: { color: "#D6A85D", dasharray: "6 3" },
  Extending: { color: "#8FA9C4", dasharray: "2 3" },
};
const unknownSwingStates = new Set<string>();
const firstSbarX = ref<number | null>(null);
const secondSbarX = ref<number | null>(null);
let crosshairLogicalIndex: number | null = null;

function coordinateForSbarId(sbarId: string | null | undefined): number | null {
  if (!chart || !sbarId) return null;
  const time = timeBySbarId.get(sbarId);
  return time === undefined ? null : chart.timeScale().timeToCoordinate(time);
}

function getSbarCoordinate(sbarId: string): number | null {
  const value = coordinateForSbarId(sbarId);
  return value !== null && value !== undefined && Number.isFinite(value) ? value : null;
}

function getLogicalCoordinate(index: number): number | null {
  const value = chart?.timeScale().logicalToCoordinate(index);
  return value !== null && value !== undefined && Number.isFinite(value) ? value : null;
}

function getPriceCoordinate(price: number): number | null {
  const value = candleSeries?.priceToCoordinate(price);
  return value !== null && value !== undefined && Number.isFinite(value) ? value : null;
}

function getSbarIdAtCoordinate(x: number, clampToSequence = false): string | null {
  if (!chart || !Number.isFinite(x) || sbarIdByLogicalIndex.length === 0) return null;
  const logical = chart.timeScale().coordinateToLogical(x);
  if (logical === null || logical === undefined || !Number.isFinite(logical)) return null;
  const index = Math.round(logical);
  if (!clampToSequence && (index < 0 || index >= sbarIdByLogicalIndex.length)) return null;
  return sbarIdByLogicalIndex[Math.max(0, Math.min(sbarIdByLogicalIndex.length - 1, index))] ?? null;
}

function getSbarIdAtClientX(clientX: number, clampToSequence = false): string | null {
  const left = chartHost.value?.getBoundingClientRect().left;
  if (left === undefined || !Number.isFinite(clientX) || !Number.isFinite(left)) return null;
  return getSbarIdAtCoordinate(clientX - left, clampToSequence);
}

function hasSbarId(sbarId: string): boolean {
  return sbarIdByLogicalIndex.includes(sbarId);
}

function updateCBarRectangles(): void {
  if (!chart || !candleSeries) {
    cbarRectangles.value = [];
    return;
  }
  const timeScale = chart.timeScale();
  cbarRectangles.value = layerVisibility.value.cbar
    ? projectCBarRectangles({
      cbars: props.structure?.cbars ?? [],
      indexBySbarId,
      visibleRange: timeScale.getVisibleLogicalRange(),
      coordinateForSbarId: (sbarId) => {
        const time = timeBySbarId.get(sbarId);
        return time === undefined ? null : timeScale.timeToCoordinate(time);
      },
      priceToCoordinate: (price) => candleSeries!.priceToCoordinate(price),
    })
    : [];
  cbarPrimitive?.setVisible(layerVisibility.value.cbar);
}

const scheduleOverlayUpdate = createAnimationFrameCoalescer(() => {
  updateSbarCoordinates();
  emit("projectionFrame");
  const latest = pendingViewportRange;
  pendingViewportRange = null;
  if (latest && chart) {
    emit("logicalRangeChange", { from: latest.from, to: latest.to });
  }
});

function updateSbarCoordinates(): void {
  if (!chart) {
    firstSbarX.value = null;
    secondSbarX.value = null;
    return;
  }
  const timeScale = chart.timeScale();
  // Clip the SVG overlay to the plot area so it cannot cover the right price scale.
  structureOverlayWidth.value = typeof timeScale.width === "function"
    ? timeScale.width()
    : chartHost.value?.clientWidth ?? 0;
  firstSbarX.value = firstSbarTime === null ? null : timeScale.timeToCoordinate(firstSbarTime);
  secondSbarX.value = secondSbarTime === null ? null : timeScale.timeToCoordinate(secondSbarTime);
  updateCBarRectangles();
  updateSwingSegments();
}

function updateSwingSegments(): void {
  if (!chart || !candleSeries) {
    swingSegments.value = [];
    return;
  }
  const timeScale = chart.timeScale();
  swingSegments.value = layerVisibility.value.swing
    ? projectSwingSegments({
      swings: props.structure?.swings ?? [],
      indexBySbarId,
      visibleRange: timeScale.getVisibleLogicalRange(),
      coordinateForSbarId: (sbarId) => {
        const time = timeBySbarId.get(sbarId);
        return time === undefined ? null : timeScale.timeToCoordinate(time);
      },
      priceToCoordinate: (price) => candleSeries!.priceToCoordinate(price),
    }).map((segment) => {
      const style = swingStyleByState[segment.state];
      if (!style && !unknownSwingStates.has(segment.state)) {
        unknownSwingStates.add(segment.state);
        console.warn(`Unknown Struxis SwingState received by SBarChartSurface: ${segment.state}`);
      }
      const resolvedStyle = style ?? { color: "#A0A7B0", dasharray: "4 3" };
      return { ...segment, color: resolvedStyle.color, dasharray: resolvedStyle.dasharray };
    })
    : [];
  swingPrimitive?.setVisible(layerVisibility.value.swing);
}


function syncStructurePrimitives(): void {
  const projection = { timeBySbarId, indexBySbarId };
  cbarPrimitive?.setData(props.structure?.cbars ?? [], projection);
  swingPrimitive?.setData(props.structure?.swings ?? [], projection);
  cbarPrimitive?.setVisible(layerVisibility.value.cbar);
  swingPrimitive?.setVisible(layerVisibility.value.swing);
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

function revealSbarRange(anchorIds: string[]): boolean {
  if (!chart || anchorIds.length === 0) return false;
  const indices = anchorIds
    .map((id) => indexBySbarId.get(id))
    .filter((index): index is number => index !== undefined);
  if (indices.length === 0) return false;

  const targetLeft = Math.min(...indices);
  const targetRight = Math.max(...indices);
  const visible = chart.timeScale().getVisibleLogicalRange();
  if (!visible) return false;
  // Preserve zoom; pan only when the complete anchor interval is off-screen.
  if (targetRight >= visible.from && targetLeft <= visible.to) return true;
  const span = visible.to - visible.from;
  const center = (targetLeft + targetRight) / 2;
  chart.timeScale().setVisibleLogicalRange({ from: center - span / 2, to: center + span / 2 });
  return true;
}

function handleChartClick(param: { point?: { x: number; y: number } | undefined }): void {
  if (chartError.value || props.bars.length === 0) return;
  const point = param.point;
  emit("chartClick", point && Number.isFinite(point.x)
    ? { x: point.x, y: Number.isFinite(point.y) ? point.y : null }
    : null);
}

function publishCrosshair(param: { point?: { x: number; y: number } | undefined }): void {
  const point = param.point;
  if (!point || !chart || !candleSeries || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    emit("crosshairAnchorChange", { sbarId: null, price: null });
    return;
  }
  const logical = chart.timeScale().coordinateToLogical(point.x);
  const anchor = resolveSbarChartAnchor(props.bars, logical);
  const bar = anchor ? props.bars[anchor.index] : undefined;
  const price = candleSeries.coordinateToPrice(point.y);
  emit("crosshairAnchorChange", {
    sbarId: bar?.sbarId ?? null,
    price: price !== null && price !== undefined && Number.isFinite(price) ? price : null,
  });
}

function handleChartMove(param: { point?: { x: number; y: number } | undefined }): void {
  publishCrosshair(param);
  const x = param.point?.x;
  if (typeof x === "number" && chart) {
    const logical = chart.timeScale().coordinateToLogical(x);
    const anchor = resolveSbarChartAnchor(props.bars, logical);
    if (anchor) crosshairLogicalIndex = anchor.index;
  }
  const point = param.point && Number.isFinite(param.point.x) && Number.isFinite(param.point.y)
    ? { x: param.point.x, y: param.point.y }
    : null;
  emit("pointerPosition", point);
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
  // Keyboard navigation is a local Crosshair change even when the chart API
  // does not emit subscribeCrosshairMove for setCrosshairPosition.
  emit("crosshairAnchorChange", { sbarId: bar.sbarId, price: Number(bar.close) });
  applySelectedCrosshair();
  if (crosshairUpdateFrame !== null) cancelAnimationFrame(crosshairUpdateFrame);
  crosshairUpdateFrame = requestAnimationFrame(() => {
    crosshairUpdateFrame = null;
    applySelectedCrosshair();
  });
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
  // ReplayWorkspace owns keyboard routing when a chart is embedded in Replay.
  // Standalone Dataset surfaces retain their local hover/focus activation behavior.
  if (props.keyboardActive === false) return;
  if (
    props.keyboardActive === undefined &&
    (!chartHost.value || (!chartHost.value.matches(":hover") && !chartHost.value.contains(document.activeElement)))
  ) return;

  const key = ({ h: "ArrowLeft", j: "ArrowDown", k: "ArrowUp", l: "ArrowRight" } as const)[
    event.key as "h" | "j" | "k" | "l"
  ] ?? event.key;
  const isArrowKey = key === "ArrowUp" || key === "ArrowDown" ||
    key === "ArrowLeft" || key === "ArrowRight";
  const isFitShortcut = event.ctrlKey && !event.altKey && !event.metaKey &&
    !event.shiftKey && key === "0";
  const isBoundaryNavigation = event.ctrlKey && !event.altKey && !event.metaKey &&
    !event.shiftKey && (key === "ArrowLeft" || key === "ArrowRight");
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
    handled = moveCrosshairTo(key === "ArrowLeft" ? 0 : props.bars.length - 1, true);
  } else if (key === "ArrowUp") handled = zoomTimeScale("in");
  else if (key === "ArrowDown") handled = zoomTimeScale("out");
  else if (key === "ArrowLeft") handled = moveCrosshairBy(-1);
  else if (key === "ArrowRight") handled = moveCrosshairBy(1);

  if (handled) event.preventDefault();
}

function toggleLayer(layer: keyof typeof layerVisibility.value): void {
  layerVisibility.value[layer] = !layerVisibility.value[layer];

  if (layer === "sbar") {
    candleSeries?.applyOptions({ visible: layerVisibility.value.sbar });
  } else if (layer === "volume") {
    volumeSeries?.applyOptions({ visible: layerVisibility.value.volume });
  } else {
    // Structure overlays are projections of authoritative DTOs. Recompute
    // their screen coordinates on both hide and restore; never mutate domain data.
    updateSbarCoordinates();
  }
  emit("projectionFrame");
}

function handleVisibleRangeChange(): void {
  scheduleOverlayUpdate();
  if (!chart || props.bars.length === 0) return;
  const range = chart.timeScale().getVisibleLogicalRange();
  if (!range || !Number.isFinite(range.from) || !Number.isFinite(range.to)) return;
  // Report the raw range; SnapshotReferenceChart owns sync qualification,
  // peer-echo suppression and cross-chart publication.
  pendingViewportRange = { from: range.from, to: range.to };
  scheduleOverlayUpdate();
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


function applyCrosshairOptions(): void {
  if (!chart) return;
  // Crosshair rendering is always local to this chart. Sync eligibility only
  // controls whether pointer positions are published to the peer chart.
  const visible = true;
  chart.applyOptions({
    crosshair: {
      mode: CrosshairMode.Normal,
      vertLine: {
        visible,
        color: "#89949d",
        labelBackgroundColor: "#30383f",
      },
      horzLine: {
        visible,
        color: "#89949d",
        labelBackgroundColor: "#30383f",
      },
    },
  });
}

function updateChart(): void {
  if (!chart || !candleSeries || !volumeSeries) return;
  try {
    const projection = mapSBarsToChart(props.bars);
    candleSeries.setData(projection.candles);
    volumeSeries.setData(projection.volume);
    const sbarIndex = createSbarChartIndex(props.bars, projection.candles.map((candle) => candle.time));
    sbarIdByLogicalIndex = sbarIndex.sbarIdByLogicalIndex;
    indexBySbarId = sbarIndex.indexBySbarId;
    timeBySbarId = sbarIndex.timeBySbarId;
    syncStructurePrimitives();
    firstSbarTime = projection.candles[0]?.time ?? null;
    secondSbarTime = projection.candles[1]?.time ?? null;
    chartError.value = "";
    if (props.bars.length > 0 && fittedSequenceId !== props.sequenceId) {
      const timeScale = chart.timeScale();
      timeScale.fitContent();
      // Keep the established fixed logical padding. Selection correctness
      // is handled by the chart time-axis mapping, not by data-size heuristics.
      timeScale.setVisibleLogicalRange({
        from: -0.5,
        to: projection.candles.length + 3.5,
      });
      fittedSequenceId = props.sequenceId;
    }
    updateSbarCoordinates();
  } catch (error) {
    sbarIdByLogicalIndex = [];
    indexBySbarId = new Map();
    timeBySbarId = new Map();
    firstSbarTime = null;
    secondSbarTime = null;
    syncStructurePrimitives();
    updateSbarCoordinates();
    candleSeries.setData([]);
    volumeSeries.setData([]);
    cbarRectangles.value = [];
    swingSegments.value = [];
    chartError.value = error instanceof Error ? error.message : String(error);
  }
}

function getVisibleLogicalRange(): { from: number; to: number } | null {
  const range = chart?.timeScale().getVisibleLogicalRange();
  return range && Number.isFinite(range.from) && Number.isFinite(range.to)
    ? { from: range.from, to: range.to }
    : null;
}

function applyViewportRange(range: { from: number; to: number }): boolean {
  if (!chart || !Number.isFinite(range.from) || !Number.isFinite(range.to) || range.to <= range.from) return false;
  chart.timeScale().setVisibleLogicalRange(range);
  return true;
}

function applyCrosshairPosition(sbarId: string, price: number): boolean {
  if (!chart || !candleSeries || !Number.isFinite(price)) return false;
  const time = timeBySbarId.get(sbarId);
  if (time === undefined) return false;
  chart.setCrosshairPosition?.(price, time, candleSeries);
  return true;
}

function clearCrosshairPosition(): void {
  chart?.clearCrosshairPosition?.();
}

function getStructureGeometry() {
  return { cbarRectangles: cbarRectangles.value, swingSegments: swingSegments.value };
}

defineExpose({ getVisibleLogicalRange, applyViewportRange, applyCrosshairPosition, clearCrosshairPosition, getSbarCoordinate, getLogicalCoordinate, getPriceCoordinate, getSbarIdAtCoordinate, getSbarIdAtClientX, hasSbarId, getSbarMarker: markerForSbar, revealSbarRange, getStructureGeometry });

onMounted(() => {
  document.addEventListener("keydown", handleChartKeyboard);
  if (!chartHost.value) return;
  const runtime = createSbarChartRuntime(chartHost.value, {
    width: chartHost.value.clientWidth,
    height: Math.max(1, chartHost.value.clientHeight),
    candleLastValueVisible: true,
  });
  chart = runtime.chart;
  candleSeries = runtime.candleSeries;
  volumeSeries = runtime.volumeSeries;
  primitiveHost = runtime.primitiveHost;
  cbarPrimitive = registerCBarPrimitive(runtime.primitiveHost, runtime.candleSeries);
  swingPrimitive = registerSwingPrimitive(runtime.primitiveHost, runtime.candleSeries);
  chart.subscribeClick(handleChartClick);
  chart.subscribeCrosshairMove(handleChartMove);
  chart.timeScale().subscribeVisibleLogicalRangeChange(handleVisibleRangeChange);
  stopObservingResize = observeSbarChartResize(chartHost.value, chart, () => {
    updateSbarCoordinates();
    emit("projectionFrame");
  });
  updateChart();
  applyCrosshairOptions();
});

watch(() => [props.bars, props.sequenceId] as const, () => {
  updateChart();
});
watch(() => props.structure, () => {
  // A Snapshot checkpoint replaces the authoritative structure snapshot without
  // rebuilding immutable candle/volume series.
  syncStructurePrimitives();
  updateSbarCoordinates();
}, { deep: true });

onBeforeUnmount(() => {
  document.removeEventListener("keydown", handleChartKeyboard);
  crosshairLogicalIndex = null;
  stopObservingResize?.();
  stopObservingResize = null;
  chart?.unsubscribeClick(handleChartClick);
  chart?.unsubscribeCrosshairMove(handleChartMove);
  chart?.timeScale().unsubscribeVisibleLogicalRangeChange(handleVisibleRangeChange);
  scheduleOverlayUpdate.cancel();
  if (crosshairUpdateFrame !== null) {
    cancelAnimationFrame(crosshairUpdateFrame);
    crosshairUpdateFrame = null;
  }
  pendingViewportRange = null;
  primitiveHost?.dispose();
  primitiveHost = null;
  cbarPrimitive = null;
  swingPrimitive = null;
  chart?.remove();
  chart = null;
  candleSeries = null;
  volumeSeries = null;
  cbarRectangles.value = [];
  swingSegments.value = [];
  sbarIdByLogicalIndex = [];
  indexBySbarId = new Map();
  timeBySbarId = new Map();
  firstSbarTime = null;
  secondSbarTime = null;
  firstSbarX.value = null;
  secondSbarX.value = null;
});
</script>

<template>
  <section
    class="origin-chart-panel"
    :class="panelClass"
    :aria-label="panelLabel ?? 'SBar chart'"
    data-testid="origin-chart-panel"
    @focusin="emit('chartActivate')"
    :data-sbar-count="bars.length"
    :data-first-sbar-id="bars[0]?.sbarId ?? ''"
    :data-second-sbar-id="bars[1]?.sbarId ?? ''"
    :data-last-sbar-id="bars[bars.length - 1]?.sbarId ?? ''"
  >
    <div v-if="showHeader !== false" class="origin-chart-heading">
      <div class="chart-title-block">
        <h3>{{ headerTitle ?? latestBar?.barType ?? "SBAR" }}</h3>
        <span class="tag green">{{ headerTag ?? "SBar SERIES" }}</span>
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
      {{ emptyMessage ?? 'No SBar data is available.' }}
    </div>
    <div class="origin-chart-viewport" data-testid="origin-chart-viewport">
      <div
        ref="chartHost"
        class="origin-chart-host"
        data-testid="origin-chart-canvas"
        :data-sequence-id="sequenceId"
        :data-first-sbar-x="firstSbarX ?? ''"
        :data-second-sbar-x="secondSbarX ?? ''"
        :aria-label="chartLabel"
        @pointerenter="emit('chartActivate')"
      ></div>
      <svg
        class="origin-structure-overlay"
        :style="{ width: `${structureOverlayWidth}px` }"
        data-testid="origin-structure-overlay"
        :data-structure-counts="JSON.stringify({ cbars: props.structure?.cbars.length ?? 0, swings: props.structure?.swings.length ?? 0 })"
        aria-hidden="true"
      >
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
          visibility="hidden"
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
          visibility="hidden"
          stroke="#A0A7B0"
          stroke-width="1"
          data-testid="cbar-range-rectangle"
          :data-cbar-id="rectangle.id"
        />
        <slot name="chart-structure-overlays" :cbar-rectangles="cbarRectangles" :swing-segments="swingSegments" />

      </svg>
      <slot name="chart-interaction-overlay" />
      <div class="origin-chart-legend" role="group" aria-label="Chart layer visibility">
        <button type="button" class="origin-chart-legend-item" :class="{ active: layerVisibility.sbar }" :aria-pressed="layerVisibility.sbar" data-testid="layer-toggle-sbar" @click="toggleLayer('sbar')"><i class="legend-dot sbar-dot"></i>SBar</button>
        <button type="button" class="origin-chart-legend-item" :class="{ active: layerVisibility.cbar }" :aria-pressed="layerVisibility.cbar" :disabled="!structure || structure.cbars.length === 0" data-testid="layer-toggle-cbar" @click="toggleLayer('cbar')"><i class="legend-dot cbar-dot"></i>CBar</button>
        <button type="button" class="origin-chart-legend-item" :class="{ active: layerVisibility.swing }" :aria-pressed="layerVisibility.swing" :disabled="!structure || structure.swings.length === 0" data-testid="layer-toggle-swing" @click="toggleLayer('swing')"><i class="legend-dot swing-dot"></i>Swing</button>
        <button type="button" class="origin-chart-legend-item" :class="{ active: layerVisibility.volume }" :aria-pressed="layerVisibility.volume" data-testid="layer-toggle-volume" @click="toggleLayer('volume')"><i class="legend-dot volume-dot"></i>Volume</button>
      </div>
    </div>
    <div v-if="showFooter !== false" class="origin-chart-foot">
      <span>SBARS <b>{{ bars.length.toLocaleString() }}</b></span>
      <span v-if="latestBar">VOL <b>{{ latestBar.volume }}</b></span>
      <span v-if="latestBar" class="origin-chart-last-id" :title="latestBar.sbarId">LAST ID <code>{{ latestBar.sbarId }}</code></span>
      <slot name="footer-trailing" />
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
  background: #191e22;
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
