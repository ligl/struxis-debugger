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
import type { OriginDatasetDto, SBarDto, TestDatasetDto } from "../origin-types";

const props = defineProps<{
  origin: OriginDatasetDto | null;
  testDataset: TestDatasetDto | null;
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
const latestBar = computed(() => bars.value[bars.value.length - 1] ?? null);

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
    candleSeries.setData(projection.candles);
    volumeSeries.setData(projection.volume);
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
      background: { type: ColorType.Solid, color: "#131722" },
      textColor: "#b2b5be",
      attributionLogo: false,
    },
    rightPriceScale: {
      borderColor: "#2a2e39",
      scaleMargins: { top: 0.08, bottom: 0.22 },
    },
    timeScale: {
      borderColor: "#30353b",
      timeVisible: true,
      secondsVisible: false,
      rightOffset: 4,
    },
    crosshair: {
      vertLine: { color: "#758696", labelBackgroundColor: "#2a2e39" },
      horzLine: { color: "#758696", labelBackgroundColor: "#2a2e39" },
    },
  });
  candleSeries = chart.addSeries(CandlestickSeries, {
    upColor: "#26a69a",
    downColor: "#ef5350",
    borderUpColor: "#26a69a",
    borderDownColor: "#ef5350",
    wickUpColor: "#26a69a",
    wickDownColor: "#ef5350",
    priceLineVisible: true,
    lastValueVisible: true,
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

watch(() => [bars.value, props.testDataset?.testDatasetId, props.origin?.originDatasetId] as const, updateChart);

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
  <section class="run-chart-panel" aria-label="Test Dataset SBar chart" data-testid="run-chart-panel"
    :data-test-dataset-id="testDataset?.testDatasetId ?? ''" :data-sbar-count="bars.length">
    <div class="origin-chart-heading">
      <div class="chart-title-block">
        <p class="section-index">FIXED TEST INPUT</p>
        <h3>Test Dataset SBar chart</h3>
        <span class="chart-instrument">{{ testDataset?.barType ?? origin?.barType ?? "No Test Dataset" }}</span>
      </div>
      <span class="chart-bar-count">{{ bars.length.toLocaleString() }} SBARS</span>
    </div>
    <div v-if="latestBar" class="chart-data-strip" aria-label="Latest Test SBar OHLCV">
      <span><small>O</small><strong>{{ latestBar.open }}</strong></span>
      <span><small>H</small><strong>{{ latestBar.high }}</strong></span>
      <span><small>L</small><strong>{{ latestBar.low }}</strong></span>
      <span><small>C</small><strong>{{ latestBar.close }}</strong></span>
      <span><small>VOL</small><strong>{{ latestBar.volume }}</strong></span>
      <span class="chart-latest-id"><small>LAST SBAR ID</small><strong>{{ latestBar.sbarId }}</strong></span>
    </div>
    <p v-if="projectionMessage" class="microcopy chart-selection-hint" data-testid="run-chart-empty">{{ projectionMessage }}</p>
    <div v-if="chartError" class="error-message chart-error" role="alert" data-testid="run-chart-error">
      <strong>Chart projection rejected</strong><span>{{ chartError }}</span>
    </div>
    <div ref="chartHost" class="run-chart-host" data-testid="run-chart-canvas"
      :aria-label="`Candlestick and volume chart for Test Dataset ${testDataset?.testDatasetId ?? 'not selected'}`"></div>
  </section>
</template>
