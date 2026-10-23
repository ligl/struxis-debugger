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
import type { OriginDatasetDto, ReplayInspectorStructureDto, RunStateDto, SBarDto, TestDatasetDto } from "../origin-types";

const props = defineProps<{
  origin: OriginDatasetDto | null;
  testDataset: TestDatasetDto | null;
  runState: RunStateDto | null;
  structure?: ReplayInspectorStructureDto | null;
}>();

const chartHost = ref<HTMLDivElement | null>(null);
const chartError = ref("");
const layerVisibility = ref({ sbar: true, volume: true, cbar: true, swing: true });
type CBarRectangle = { id: string; x: number; y: number; width: number; height: number };
type SwingSegment = { id: string; x1: number; y1: number; x2: number; y2: number; color: string; dasharray: string; state: string };
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
    cbarRectangles.value = [];
    swingSegments.value = [];
    return;
  }
  const timeScale = chart.timeScale();
  const structure = props.structure;
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

function updateChart(): void {
  if (!chart || !candleSeries || !volumeSeries) return;
  try {
    if (projectionMessage.value) {
      candleSeries.setData([]);
      volumeSeries.setData([]);
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
      vertLine: { color: "#89949d", labelBackgroundColor: "#30383f" },
      horzLine: { color: "#89949d", labelBackgroundColor: "#30383f" },
    },
  });
  candleSeries = chart.addSeries(CandlestickSeries, {
    upColor: "#75c6a1",
    downColor: "#e17e79",
    borderUpColor: "#75c6a1",
    borderDownColor: "#e17e79",
    wickUpColor: "#75c6a1",
    wickDownColor: "#e17e79",
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

onBeforeUnmount(() => {
  visibleRangeListener?.();
  visibleRangeListener = null;
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
        <line v-for="segment in swingSegments" :key="segment.id" :x1="segment.x1" :y1="segment.y1" :x2="segment.x2" :y2="segment.y2" :stroke="segment.color" stroke-width="1.25" :stroke-dasharray="segment.dasharray || undefined" stroke-linecap="round" data-testid="run-swing-segment" :data-swing-id="segment.id" :data-swing-state="segment.state" />
        <rect v-for="rectangle in cbarRectangles" :key="rectangle.id" :x="rectangle.x" :y="rectangle.y" :width="rectangle.width" :height="rectangle.height" fill="none" stroke="#A0A7B0" stroke-width="1" data-testid="run-cbar-rectangle" :data-cbar-id="rectangle.id" />
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
