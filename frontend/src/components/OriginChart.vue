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
import type { SBarDto } from "../origin-types";

const props = defineProps<{
  bars: SBarDto[];
  originDatasetId: string;
  selectionStartSbarId?: string | null;
  selectionEndSbarId?: string | null;
  selectionPending?: boolean;
}>();
const latestBar = computed(() => props.bars[props.bars.length - 1] ?? null);
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
let sbarIdByLogicalIndex: readonly string[] = [];
let timeBySbarId: ReadonlyMap<string, Time> = new Map();
let firstSbarTime: Time | null = null;
let secondSbarTime: Time | null = null;
const firstSbarX = ref<number | null>(null);
const secondSbarX = ref<number | null>(null);
const selectionStartX = ref<number | null>(null);
const selectionEndX = ref<number | null>(null);
const previewX = ref<number | null>(null);

function coordinateForSbarId(sbarId: string | null | undefined): number | null {
  if (!chart || !sbarId) return null;
  const time = timeBySbarId.get(sbarId);
  return time === undefined ? null : chart.timeScale().timeToCoordinate(time);
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

function handleSbarSelectionRequest(event: Event): void {
  const detail = (event as CustomEvent<{ sbarId?: unknown }>).detail;
  if (typeof detail?.sbarId !== "string" || detail.sbarId.length === 0) {
    emit("selectionError", "A programmatic Origin selection requires an exact SBar ID.");
    return;
  }
  selectSbarById(detail.sbarId);
}

function handleChartClick(param: { point?: { x: number; y: number } | undefined }): void {
  if (chartError.value || props.bars.length === 0) return;
  const pointX = param.point?.x;
  if (typeof pointX !== "number" || !Number.isFinite(pointX)) {
    emit("selectionError", "The click did not resolve to a horizontal position inside the chart plot.");
    return;
  }

  // Selection is based only on the horizontal time-axis coordinate. The
  // pointer's y coordinate and candle geometry are intentionally irrelevant.
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

function handleChartMove(param: { point?: { x: number; y: number } | undefined }): void {
  if (!props.selectionPending || selectionStartX.value === null) {
    previewX.value = null;
    return;
  }
  const pointX = param.point?.x;
  previewX.value = typeof pointX === "number" && Number.isFinite(pointX) ? pointX : null;
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
    upColor: "#75c6a1",
    downColor: "#e17e79",
    borderUpColor: "#75c6a1",
    borderDownColor: "#e17e79",
    wickUpColor: "#75c6a1",
    wickDownColor: "#e17e79",
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
  chart.timeScale().subscribeVisibleLogicalRangeChange(updateSbarCoordinates);
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

watch(() => [props.bars, props.originDatasetId] as const, updateChart);
watch(
  () => [props.selectionStartSbarId, props.selectionEndSbarId, props.selectionPending] as const,
  () => {
    updateSbarCoordinates();
    if (!props.selectionPending) previewX.value = null;
  },
);

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  resizeObserver = null;
  chart?.unsubscribeClick(handleChartClick);
  chart?.unsubscribeCrosshairMove(handleChartMove);
  chart?.timeScale().unsubscribeVisibleLogicalRangeChange(updateSbarCoordinates);
  chart?.remove();
  chart = null;
  candleSeries = null;
  volumeSeries = null;
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
    :data-sbar-count="bars.length"
    :data-first-sbar-id="bars[0]?.sbarId ?? ''"
    :data-second-sbar-id="bars[1]?.sbarId ?? ''"
  >
    <div class="origin-chart-heading">
      <div class="chart-title-block">
        <p class="section-index">AUTHORITATIVE STRUXIS PROJECTION</p>
        <h3>Origin SBar chart</h3>
        <span class="chart-instrument">{{ latestBar?.barType ?? originDatasetId }}</span>
      </div>
      <div class="chart-heading-actions">
        <span class="chart-bar-count">{{ bars.length.toLocaleString() }} SBARS</span>
        <button class="chart-tool-button" type="button" :disabled="bars.length === 0" @click="fitContent">FIT</button>
      </div>
    </div>
    <div v-if="latestBar" class="chart-data-strip" aria-label="Latest SBar OHLCV">
      <span><small>O</small><strong>{{ latestBar.open }}</strong></span>
      <span><small>H</small><strong>{{ latestBar.high }}</strong></span>
      <span><small>L</small><strong>{{ latestBar.low }}</strong></span>
      <span><small>C</small><strong>{{ latestBar.close }}</strong></span>
      <span><small>VOL</small><strong>{{ latestBar.volume }}</strong></span>
      <span class="chart-latest-id"><small>LAST SBAR ID</small><strong>{{ latestBar.sbarId }}</strong></span>
    </div>
    <p class="microcopy chart-selection-hint">Click anywhere in the chart plot to set the start; move to preview the shaded interval, then click again to fix the inclusive end. Selection uses horizontal time position only.</p>
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
          :style="{ left: `${selectionStartX}px` }"
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
            :style="{ left: `${selectionEndX}px` }"
          ></div>
        </template>
      </div>
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
  border-color: #30383f;
  border-radius: 0;
  background: #121619;
}

.origin-chart-heading {
  min-height: 30px;
  flex: 0 0 auto;
  align-items: center;
  gap: 8px;
  padding: 4px 9px;
  border-bottom-color: #252c32;
  background: #191e23;
}

.chart-title-block {
  display: flex;
  min-width: 0;
  align-items: baseline;
  gap: 7px;
}

.chart-title-block .section-index {
  margin: 0;
  font-size: 7px;
  letter-spacing: .045em;
  white-space: nowrap;
}

.chart-title-block h3 {
  margin: 0;
  font-size: 9px;
  font-weight: 650;
  letter-spacing: .045em;
  text-transform: uppercase;
  white-space: nowrap;
}

.chart-instrument {
  min-width: 0;
  overflow: hidden;
  font-size: 8px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chart-heading-actions {
  gap: 7px;
}

.chart-bar-count {
  font-size: 8px;
}

.chart-tool-button {
  min-width: 36px;
  padding: 3px 6px;
  font-size: 8px;
}

.chart-data-strip {
  flex: 0 0 auto;
  flex-wrap: nowrap;
  gap: 7px 12px;
  padding: 4px 9px;
  border-bottom-color: #252c32;
  background: #15191d;
}

.chart-data-strip > span {
  gap: 4px;
  font-size: 8px;
  white-space: nowrap;
}

.chart-data-strip small {
  font-size: 7px;
}

.chart-data-strip .chart-latest-id {
  flex: 1 1 100px;
  overflow: hidden;
}

.chart-data-strip .chart-latest-id strong {
  overflow: hidden;
  text-overflow: ellipsis;
}

.chart-selection-hint {
  flex: 0 0 auto;
  margin: 0;
  padding: 3px 9px;
  border-bottom: 1px solid #252c32;
  color: #89949d;
  font-size: 8px;
  line-height: 1.35;
}

.origin-chart-viewport {
  flex: 1 1 0;
  height: 0;
  min-height: 0;
}

.origin-chart-host {
  height: 100%;
  min-height: 0;
}

.origin-chart-empty {
  flex: 1 1 auto;
  min-height: 0;
  font-size: 10px;
}

.chart-error {
  flex: 0 0 auto;
  margin: 6px;
  padding: 7px 9px;
  font-size: 9px;
}

@media (max-width: 1180px) {
  .chart-title-block .section-index {
    display: none;
  }

  .chart-data-strip {
    overflow-x: auto;
  }
}
</style>
