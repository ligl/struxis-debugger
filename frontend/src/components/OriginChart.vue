<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import {
  CandlestickSeries,
  ColorType,
  HistogramSeries,
  LineSeries,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type Time,
} from "lightweight-charts";
import { mapOriginBarsToChart } from "../origin-chart-data";
import type { ReplayInspectorStructureDto, SBarDto } from "../origin-types";

const props = defineProps<{
  bars: SBarDto[];
  structure: ReplayInspectorStructureDto | null;
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
let swingSeries: ISeriesApi<"Line"> | null = null;
let resizeObserver: ResizeObserver | null = null;
let fittedOriginDatasetId: string | null = null;
let sbarIdByLogicalIndex: readonly string[] = [];
let timeBySbarId: ReadonlyMap<string, Time> = new Map();
let firstSbarTime: Time | null = null;
let secondSbarTime: Time | null = null;
type CBarRectangle = { id: string; x: number; y: number; width: number; height: number };
const cbarRectangles = ref<CBarRectangle[]>([]);
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

function updateCBarRectangles(): void {
  if (!chart || !candleSeries) {
    cbarRectangles.value = [];
    return;
  }
  const timeScale = chart.timeScale();
  cbarRectangles.value = (props.structure?.cbars ?? []).flatMap((cbar) => {
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
  if (!chart || !candleSeries || !volumeSeries || !swingSeries) return;
  try {
    const projection = mapOriginBarsToChart(props.bars);
    candleSeries.setData(projection.candles);
    volumeSeries.setData(projection.volume);
    const timeById = new Map(
      props.bars.map((bar, index) => [bar.sbarId, projection.candles[index]?.time] as const)
        .filter((entry): entry is readonly [string, Time] => entry[1] !== undefined),
    );
    const structure = props.structure;
    const rawSwingPoints = (structure?.swings ?? []).flatMap((swing) => {
      const startTime = timeById.get(swing.sbarStartId);
      const endTime = timeById.get(swing.sbarEndId);
      const high = Number(swing.high);
      const low = Number(swing.low);
      if (startTime === undefined || endTime === undefined || !Number.isFinite(high) || !Number.isFinite(low)) {
        return [];
      }
      const startsAtLow = swing.direction.toLowerCase() === "up";
      return [
        { time: startTime, value: startsAtLow ? low : high },
        { time: endTime, value: startsAtLow ? high : low },
      ];
    });
    // Adjacent swings may share their pivot SBar. Lightweight Charts requires
    // strictly increasing times, so keep one point for a shared boundary.
    const swingPoints = rawSwingPoints.filter((point, index) =>
      index === 0 || point.time !== rawSwingPoints[index - 1]?.time
    );
    swingSeries.setData(swingPoints);
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
    swingSeries.setData([]);
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
  swingSeries = chart.addSeries(LineSeries, {
    color: "#C6A06B",
    lineWidth: 2,
    priceLineVisible: false,
    lastValueVisible: false,
    crosshairMarkerVisible: false,
    title: "Swing",
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

watch(() => [props.bars, props.structure, props.originDatasetId] as const, updateChart);
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
      <div class="origin-chart-legend" aria-hidden="true">
        <span><i class="legend-dot sbar-dot"></i>SBar</span>
        <span v-if="structure"><i class="legend-dot cbar-dot"></i>CBar</span>
        <span v-if="structure && structure.swingCount > 0"><i class="legend-dot swing-dot"></i>Swing</span>
        <span><i class="legend-dot volume-dot"></i>Volume</span>
      </div>
    </div>
    <div class="origin-chart-foot">
      <span>SBARS <b>{{ bars.length.toLocaleString() }}</b></span>
      <span v-if="latestBar">VOL <b>{{ latestBar.volume }}</b></span>
      <span v-if="latestBar" class="origin-chart-last-id" :title="latestBar.sbarId">LAST ID <code>{{ latestBar.sbarId }}</code></span>
      <span class="origin-chart-selection-status">
        {{ selectionPending ? "SELECT END · MOVE TO PREVIEW" : selectionStartSbarId && selectionEndSbarId ? "INCLUSIVE INTERVAL FIXED" : selectionStartSbarId ? "SELECT END ON CHART" : "CLICK CHART TO SELECT START" }}
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

.origin-structure-overlay rect {
  vector-effect: non-scaling-stroke;
}

.origin-chart-host {
  width: 100%;
  height: 100%;
  min-height: 0;
}

.origin-chart-legend {
  position: absolute;
  z-index: 1;
  top: 7px;
  left: 10px;
  display: flex;
  align-items: center;
  gap: 10px;
  color: #9aa5ac;
  font: 9px ui-monospace, SFMono-Regular, Consolas, monospace;
  pointer-events: none;
}

.origin-chart-legend > span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
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
  background: #C6A06B;
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
