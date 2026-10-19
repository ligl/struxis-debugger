<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
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
import type { SBarDto } from "../origin-types";

const props = defineProps<{ bars: SBarDto[]; originDatasetId: string }>();
const emit = defineEmits<{
  sbarClick: [sbarId: string];
  selectionError: [message: string];
}>();
const chartHost = ref<HTMLDivElement | null>(null);
const chartError = ref("");
let chart: IChartApi | null = null;
let candleSeries: ISeriesApi<"Candlestick"> | null = null;
let volumeSeries: ISeriesApi<"Histogram"> | null = null;
let resizeObserver: ResizeObserver | null = null;
let fittedOriginDatasetId: string | null = null;
let sbarIdByTime: ReadonlyMap<number, string> = new Map();
let firstSbarTime: Time | null = null;
let secondSbarTime: Time | null = null;
const firstSbarX = ref<number | null>(null);
const secondSbarX = ref<number | null>(null);

function updateSbarCoordinates(): void {
  if (!chart) {
    firstSbarX.value = null;
    secondSbarX.value = null;
    return;
  }
  firstSbarX.value = firstSbarTime === null
    ? null
    : chart.timeScale().timeToCoordinate(firstSbarTime);
  secondSbarX.value = secondSbarTime === null
    ? null
    : chart.timeScale().timeToCoordinate(secondSbarTime);
}

function handleChartClick(param: { time?: unknown }): void {
  if (chartError.value || props.bars.length === 0) return;
  if (typeof param.time !== "number") {
    emit("selectionError", "Click directly on an SBar candle to select an exact range boundary.");
    return;
  }
  const sbarId = sbarIdByTime.get(param.time);
  if (sbarId === undefined) {
    emit("selectionError", "The clicked chart time does not map to an Origin SBar. No selection was changed.");
    return;
  }
  emit("sbarClick", sbarId);
}

function updateChart(): void {
  if (!chart || !candleSeries || !volumeSeries) return;
  try {
    const projection = mapOriginBarsToChart(props.bars);
    candleSeries.setData(projection.candles);
    volumeSeries.setData(projection.volume);
    sbarIdByTime = projection.sbarIdByTime;
    firstSbarTime = projection.candles[0]?.time ?? null;
    secondSbarTime = projection.candles[1]?.time ?? null;
    chartError.value = "";
    if (props.bars.length > 0 && fittedOriginDatasetId !== props.originDatasetId) {
      const timeScale = chart.timeScale();
      timeScale.fitContent();
      // Keep the first candle inside the plot instead of placing its center
      // on the clipped left boundary. Four trailing logical slots preserve
      // the chart's existing right-side breathing room for short datasets.
      timeScale.setVisibleLogicalRange({
        from: -0.5,
        to: projection.candles.length + 3.5,
      });
      fittedOriginDatasetId = props.originDatasetId;
    }
    updateSbarCoordinates();
  } catch (error) {
    sbarIdByTime = new Map();
    firstSbarTime = null;
    secondSbarTime = null;
    updateSbarCoordinates();
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
    grid: {
      vertLines: { visible: false },
      horzLines: { visible: false },
    },
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
  chart.subscribeClick(handleChartClick);
  chart.timeScale().subscribeVisibleLogicalRangeChange(updateSbarCoordinates);
  resizeObserver = new ResizeObserver((entries) => {
    const entry = entries[0];
    if (!chart || !entry) return;
    chart.applyOptions({
      width: Math.max(1, Math.floor(entry.contentRect.width)),
    });
    updateSbarCoordinates();
  });
  resizeObserver.observe(chartHost.value);
  updateChart();
});

watch(() => [props.bars, props.originDatasetId] as const, updateChart);

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  resizeObserver = null;
  chart?.unsubscribeClick(handleChartClick);
  chart?.timeScale().unsubscribeVisibleLogicalRangeChange(updateSbarCoordinates);
  chart?.remove();
  chart = null;
  candleSeries = null;
  volumeSeries = null;
  sbarIdByTime = new Map();
  firstSbarTime = null;
  secondSbarTime = null;
  firstSbarX.value = null;
  secondSbarX.value = null;
});
</script>

<template>
  <section
    class="origin-chart-panel"
    aria-label="Origin SBar chart"
    data-testid="origin-chart-panel"
    :data-sbar-count="bars.length"
    :data-first-sbar-id="bars[0]?.sbarId ?? ''"
    :data-second-sbar-id="bars[1]?.sbarId ?? ''"
  >
    <div class="origin-chart-heading">
      <div>
        <p class="section-index">AUTHORITATIVE STRUXIS PROJECTION</p>
        <h3>Origin SBar chart</h3>
      </div>
      <span class="chart-bar-count">{{ bars.length.toLocaleString() }} SBARS</span>
    </div>
    <p class="microcopy chart-selection-hint">Click one candle for the range start, then another candle for the range end. The selected interval includes both endpoints.</p>
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
      :data-first-sbar-x="firstSbarX ?? ''"
      :data-second-sbar-x="secondSbarX ?? ''"
      :aria-label="`Candlestick and volume chart for Origin ${originDatasetId}`"
    ></div>
  </section>
</template>
