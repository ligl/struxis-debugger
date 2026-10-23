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
}>();
const emit = defineEmits<{ objectSelect: [selection: ReplayChartSelection] }>();

const chartHost = ref<HTMLDivElement | null>(null);
const chartError = ref("");
const layerVisibility = ref({ sbar: true, volume: true, cbar: true, swing: true });
type CBarRectangle = { id: string; x: number; y: number; width: number; height: number };
type SwingSegment = { id: string; x1: number; y1: number; x2: number; y2: number; color: string; dasharray: string; state: string };
type SBarSelectionMarker = { id: string; x: number; y: number; width: number; height: number };
const selectedSbarMarker = ref<SBarSelectionMarker | null>(null);
const cbarRectangles = ref<CBarRectangle[]>([]);
const swingSegments = ref<SwingSegment[]>([]);
let timeBySbarId: ReadonlyMap<string, Time> = new Map();
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
const chartCountLabel = computed(() => replayProgressApplies.value
  ? `${Math.min(props.runState?.processedCount ?? 0, bars.value.length).toLocaleString()} / ${bars.value.length.toLocaleString()} PROCESSED`
  : `${bars.value.length.toLocaleString()} SBARS`,
);

let chart: IChartApi | null = null;
let candleSeries: ISeriesApi<"Candlestick"> | null = null;
let volumeSeries: ISeriesApi<"Histogram"> | null = null;
let resizeObserver: ResizeObserver | null = null;
let fittedTestDatasetId: string | null = null;
let visibleRangeListener: (() => void) | null = null;
let chartClickListener: ((param: { point?: { x: number; y: number } | undefined }) => void) | null = null;

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
    cbarRectangles.value = [];
    swingSegments.value = [];
    return;
  }
  const timeScale = chart.timeScale();
  const structure = props.structure;
  const selected = props.selectedObject;
  if (selected?.kind === "sbar" && selected.checkpointSbarId === props.runState?.cursorSbarId) {
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

function handleChartClick(param: { point?: { x: number; y: number } | undefined }): void {
  const x = param.point?.x;
  const y = param.point?.y;
  if (!chart || chartError.value || typeof x !== "number" || typeof y !== "number" || !Number.isFinite(x) || !Number.isFinite(y)) return;
  const tolerance = 6;
  const candidates: Array<{ kind: "swing" | "cbar"; id: string; distance: number; priority: number }> = [];
  for (const segment of swingSegments.value) candidates.push({ kind: "swing", id: segment.id, distance: distanceToSegment(x, y, segment), priority: 0 });
  for (const rectangle of cbarRectangles.value) candidates.push({ kind: "cbar", id: rectangle.id, distance: distanceToRectangleBorder(x, y, rectangle), priority: 1 });
  candidates.sort((a, b) => a.distance - b.distance || a.priority - b.priority || a.id.localeCompare(b.id));
  const structureHit = candidates[0];
  const checkpointSbarId = props.runState?.cursorSbarId;
  if (structureHit && structureHit.distance <= tolerance && checkpointSbarId) {
    emit("objectSelect", { kind: structureHit.kind, id: structureHit.id, checkpointSbarId });
    return;
  }
  const logical = chart.timeScale().coordinateToLogical?.(x);
  if (logical === null || logical === undefined || !Number.isFinite(logical)) return;
  const index = Math.round(logical);
  const bar = bars.value[index];
  if (!bar || !checkpointSbarId) return;
  emit("objectSelect", { kind: "sbar", id: bar.sbarId, checkpointSbarId });
}

function updateChart(): void {
  if (!chart || !candleSeries || !volumeSeries) return;
  try {
    if (projectionMessage.value) {
      candleSeries.setData([]);
      volumeSeries.setData([]);
      selectedSbarMarker.value = null;
      cbarRectangles.value = [];
      swingSegments.value = [];
      chartError.value = "";
      return;
    }
    const projection = mapOriginBarsToChart(bars.value);
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
    selectedSbarMarker.value = null;
    cbarRectangles.value = [];
    swingSegments.value = [];
    chartError.value = error instanceof Error ? error.message : String(error);
  }
}

onMounted(() => {
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
  if (typeof timeScale.subscribeVisibleLogicalRangeChange === "function") {
    const refreshOverlays = () => updateStructureOverlays();
    timeScale.subscribeVisibleLogicalRangeChange(refreshOverlays);
    visibleRangeListener = () => timeScale.unsubscribeVisibleLogicalRangeChange?.(refreshOverlays);
  }
  resizeObserver = new ResizeObserver((entries) => {
    const entry = entries[0];
    if (!chart || !entry) return;
    chart.applyOptions({
      width: Math.max(1, Math.floor(entry.contentRect.width)),
      height: Math.max(1, Math.floor(entry.contentRect.height)),
    });
    updateStructureOverlays();
  });
  resizeObserver.observe(chartHost.value);
  updateChart();
});

watch(
  () => [
    bars.value,
    props.testDataset?.testDatasetId,
    props.origin?.originDatasetId,
    props.runState?.testDatasetId,
    props.runState?.status,
    props.runState?.processedCount,
    props.structure,
  ] as const,
  updateChart,
);

watch(() => props.selectedObject, updateStructureOverlays);

onBeforeUnmount(() => {
  visibleRangeListener?.();
  visibleRangeListener = null;
  if (chart && chartClickListener) chart.unsubscribeClick?.(chartClickListener);
  chartClickListener = null;
  resizeObserver?.disconnect();
  resizeObserver = null;
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
        <span class="run-chart-description">Test SBar sequence · backend-confirmed progress · authoritative checkpoint structure</span>
      </div>
      <div class="chart-heading-actions">
        <span class="chart-bar-count">{{ bars.length.toLocaleString() }} SBARS</span>
        <button class="chart-tool-button" type="button" :disabled="bars.length === 0" data-testid="run-chart-fit" @click="fitContent">FIT</button>
      </div>
      <div class="run-chart-meta" aria-label="Displayed SBar OHLC">
        <span><small>O</small><strong>{{ displayedBar?.open ?? "—" }}</strong></span>
        <span><small>H</small><strong>{{ displayedBar?.high ?? "—" }}</strong></span>
        <span><small>L</small><strong>{{ displayedBar?.low ?? "—" }}</strong></span>
        <span><small>C</small><strong :class="displayedBar ? (Number(displayedBar.close) >= Number(displayedBar.open) ? 'run-chart-up' : 'run-chart-down') : ''">{{ displayedBar?.close ?? "—" }}</strong></span>
      </div>
    </header>

    <div class="run-chart-stage">
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
        <rect v-if="selectedSbarMarker" :x="selectedSbarMarker.x" :y="selectedSbarMarker.y" :width="selectedSbarMarker.width" :height="selectedSbarMarker.height" fill="none" stroke="#D6A85D" stroke-width="1.5" data-testid="run-selected-sbar" :data-sbar-id="selectedSbarMarker.id" />
        <line v-for="segment in swingSegments" :key="segment.id" :x1="segment.x1" :y1="segment.y1" :x2="segment.x2" :y2="segment.y2" :stroke="selectedObject?.kind === 'swing' && selectedObject.id === segment.id && selectedObject.checkpointSbarId === runState?.cursorSbarId ? '#D6A85D' : segment.color" :stroke-width="selectedObject?.kind === 'swing' && selectedObject.id === segment.id && selectedObject.checkpointSbarId === runState?.cursorSbarId ? 2.25 : 1.25" :stroke-dasharray="segment.dasharray || undefined" stroke-linecap="round" data-testid="run-swing-segment" :data-swing-id="segment.id" :data-swing-state="segment.state" />
        <rect v-for="rectangle in cbarRectangles" :key="rectangle.id" :x="rectangle.x" :y="rectangle.y" :width="rectangle.width" :height="rectangle.height" fill="none" :stroke="selectedObject?.kind === 'cbar' && selectedObject.id === rectangle.id && selectedObject.checkpointSbarId === runState?.cursorSbarId ? '#D6A85D' : '#A0A7B0'" :stroke-width="selectedObject?.kind === 'cbar' && selectedObject.id === rectangle.id && selectedObject.checkpointSbarId === runState?.cursorSbarId ? 2 : 1" data-testid="run-cbar-rectangle" :data-cbar-id="rectangle.id" />
      </svg>
      <div class="run-chart-legend" role="group" aria-label="Chart layer visibility">
        <button type="button" class="origin-chart-legend-item" :class="{ active: layerVisibility.sbar }" :aria-pressed="layerVisibility.sbar" data-testid="run-layer-toggle-sbar" @click="toggleLayer('sbar')"><i class="legend-dot sbar-dot"></i>SBar</button>
        <button type="button" class="origin-chart-legend-item" :class="{ active: layerVisibility.cbar }" :aria-pressed="layerVisibility.cbar" :disabled="!structure || structure.cbars.length === 0" data-testid="run-layer-toggle-cbar" @click="toggleLayer('cbar')"><i class="legend-dot cbar-dot"></i>CBar</button>
        <button type="button" class="origin-chart-legend-item" :class="{ active: layerVisibility.swing }" :aria-pressed="layerVisibility.swing" :disabled="!structure || structure.swings.length === 0" data-testid="run-layer-toggle-swing" @click="toggleLayer('swing')"><i class="legend-dot swing-dot"></i>Swing</button>
        <button type="button" class="origin-chart-legend-item" :class="{ active: layerVisibility.volume }" :aria-pressed="layerVisibility.volume" data-testid="run-layer-toggle-volume" @click="toggleLayer('volume')"><i class="legend-dot volume-dot"></i>Volume</button>
      </div>
    </div>

    <footer class="run-chart-foot">
      <span>{{ testDataset?.timeframe ?? origin?.timeframe ?? "—" }}</span>
      <span>VISIBLE <b>{{ chartCountLabel }}</b></span>
      <span>STATE <b :class="`run-status-${runState?.status ?? 'none'}`">{{ runState?.status?.toUpperCase() ?? "NO RUN" }}</b></span>
      <span class="run-chart-cursor"><span>{{ replayProgressApplies ? "CURSOR SBAR ID" : "LAST SBAR ID" }}</span><b>{{ displayedBar?.sbarId ?? "—" }}</b></span>
    </footer>
  </section>
</template>
