<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import {
  CandlestickSeries,
  ColorType,
  HistogramSeries,
  createChart,
  type IChartApi,
  type ISeriesApi,
} from "lightweight-charts";
import { mapOriginBarsToChart } from "../origin-chart-data";
import type { OriginDatasetDto, RunStateDto, SBarDto, TestDatasetDto } from "../origin-types";

const props = defineProps<{
  origin: OriginDatasetDto | null;
  testDataset: TestDatasetDto | null;
  runState: RunStateDto | null;
}>();

const chartHost = ref<HTMLDivElement | null>(null);
const chartError = ref("");
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
    props.runState.status !== "ready",
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

function updateChart(): void {
  if (!chart || !candleSeries || !volumeSeries) return;
  try {
    if (projectionMessage.value) {
      candleSeries.setData([]);
      volumeSeries.setData([]);
      chartError.value = "";
      return;
    }
    const projection = mapOriginBarsToChart(bars.value);
    const processedCount = replayProgressApplies.value
      ? Math.min(props.runState?.processedCount ?? 0, bars.value.length)
      : bars.value.length;
    const candles = projection.candles.map((candle, index) => {
      if (!replayProgressApplies.value || index < processedCount) return candle;
      return {
        ...candle,
        color: "#454b53",
        borderColor: "#454b53",
        wickColor: "#454b53",
      };
    });
    const volume = projection.volume.map((bar, index) =>
      replayProgressApplies.value && index >= processedCount
        ? { ...bar, color: "#454b53" }
        : bar,
    );
    candleSeries.setData(candles);
    volumeSeries.setData(volume);
    chartError.value = "";
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
  ] as const,
  updateChart,
);

onBeforeUnmount(() => {
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
          <span class="run-chart-name">LIVE REPLAY</span>
          <span class="tag green">CANDIDATE</span>
        </div>
        <span class="run-chart-description">Backend-confirmed prefix · OHLCV projection only</span>
      </div>
      <div class="run-chart-meta" aria-label="Displayed SBar OHLC">
        <span><small>O</small><strong>{{ displayedBar?.open ?? "—" }}</strong></span>
        <span><small>H</small><strong>{{ displayedBar?.high ?? "—" }}</strong></span>
        <span><small>L</small><strong>{{ displayedBar?.low ?? "—" }}</strong></span>
        <span><small>C</small><strong :class="displayedBar && Number(displayedBar.close) >= Number(displayedBar.open) ? 'run-chart-up' : 'run-chart-down'">{{ displayedBar?.close ?? "—" }}</strong></span>
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
      <div class="run-chart-legend" aria-label="Chart legend">
        <span><i class="run-legend-sbar"></i>SBar</span>
        <span><i class="run-legend-volume"></i>Volume</span>
        <span class="run-chart-structure-gap">STRUCTURE OVERLAY NOT PROJECTED</span>
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
