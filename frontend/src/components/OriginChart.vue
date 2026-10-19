<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import {
  CandlestickSeries,
  ColorType,
  HistogramSeries,
  createChart,
  type IChartApi,
  type ISeriesApi,
} from "lightweight-charts";
import { mapOriginBarsToChart } from "../origin-chart-data";
import type { SBarDto } from "../origin-types";

const props = defineProps<{ bars: SBarDto[]; originDatasetId: string }>();
const chartHost = ref<HTMLDivElement | null>(null);
const chartError = ref("");
let chart: IChartApi | null = null;
let candleSeries: ISeriesApi<"Candlestick"> | null = null;
let volumeSeries: ISeriesApi<"Histogram"> | null = null;
let resizeObserver: ResizeObserver | null = null;

function updateChart(): void {
  if (!chart || !candleSeries || !volumeSeries) return;
  try {
    const projection = mapOriginBarsToChart(props.bars);
    candleSeries.setData(projection.candles);
    volumeSeries.setData(projection.volume);
    chartError.value = "";
    chart.timeScale().fitContent();
  } catch (error) {
    candleSeries.setData([]);
    volumeSeries.setData([]);
    chartError.value = error instanceof Error ? error.message : String(error);
  }
}

onMounted(() => {
  if (!chartHost.value) return;
  chart = createChart(chartHost.value, {
    width: chartHost.value.clientWidth,
    height: 420,
    layout: {
      background: { type: ColorType.Solid, color: "#191c20" },
      textColor: "#a0a7b0",
      attributionLogo: false,
    },
    rightPriceScale: {
      borderColor: "#30353b",
      scaleMargins: { top: 0.08, bottom: 0.22 },
    },
    timeScale: {
      borderColor: "#30353b",
      timeVisible: true,
      secondsVisible: false,
      rightOffset: 4,
    },
    crosshair: {
      vertLine: { color: "#858d97", labelBackgroundColor: "#30353b" },
      horzLine: { color: "#858d97", labelBackgroundColor: "#30353b" },
    },
  });
  candleSeries = chart.addSeries(CandlestickSeries, {
    upColor: "#79b58b",
    downColor: "#d98282",
    borderUpColor: "#79b58b",
    borderDownColor: "#d98282",
    wickUpColor: "#79b58b",
    wickDownColor: "#d98282",
    priceLineVisible: false,
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
  resizeObserver = new ResizeObserver((entries) => {
    const entry = entries[0];
    if (!chart || !entry) return;
    chart.applyOptions({
      width: Math.max(1, Math.floor(entry.contentRect.width)),
    });
  });
  resizeObserver.observe(chartHost.value);
  updateChart();
});

watch(() => props.bars, updateChart);

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
  <section class="origin-chart-panel" aria-label="Origin SBar chart" data-testid="origin-chart-panel">
    <div class="origin-chart-heading">
      <div>
        <p class="section-index">AUTHORITATIVE STRUXIS PROJECTION</p>
        <h3>Origin SBar chart</h3>
      </div>
      <span class="chart-bar-count">{{ bars.length.toLocaleString() }} SBARS</span>
    </div>
    <div v-if="chartError" class="error-message chart-error" role="alert" data-testid="origin-chart-error">
      <strong>Chart projection rejected</strong>
      <span>{{ chartError }}</span>
    </div>
    <div v-else-if="bars.length === 0" class="origin-chart-empty">
      No SBar data is available in this Origin projection.
    </div>
    <div
      ref="chartHost"
      class="origin-chart-host"
      data-testid="origin-chart-canvas"
      :data-origin-dataset-id="originDatasetId"
      :aria-label="`Candlestick and volume chart for Origin ${originDatasetId}`"
    ></div>
  </section>
</template>
