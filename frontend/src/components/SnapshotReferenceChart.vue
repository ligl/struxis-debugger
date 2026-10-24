<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { projectSnapshotBrightCandles, resolveSnapshotLiveRangeCoordinates, type SnapshotBrightCandleGeometry } from "../snapshot-playback-geometry";
import SBarChartSurface from "./SBarChartSurface.vue";
import SnapshotPlaybackOverlay from "./SnapshotPlaybackOverlay.vue";
import SnapshotLiveRangeMarkers from "./SnapshotLiveRangeMarkers.vue";
import {
  ReplayCrosshairSyncGate,
  ReplayViewportSyncGate,
  isSameLogicalRange,
  translateReplayViewportRange,
} from "../replay-chart-sync";
import type {
  ReplayChartCrosshairSync,
  ReplayChartViewportSync,
  ReplayInspectorStructureDto,
  SBarDto,
} from "../origin-types";

type LogicalRange = { from: number; to: number };
interface ChartSurfacePort {
  getVisibleLogicalRange(): LogicalRange | null;
  applyViewportRange(range: LogicalRange): boolean;
  applyCrosshairPosition(sbarId: string, price: number): boolean;
  clearCrosshairPosition(): void;
  getSbarCoordinate(sbarId: string): number | null;
  getLogicalCoordinate(index: number): number | null;
  getPriceCoordinate(price: number): number | null;
}

const props = defineProps<{
  bars: SBarDto[];
  structure: ReplayInspectorStructureDto | null;
  snapshotId: string;
  syncEnabled: boolean;
  syncRequest?: ReplayChartViewportSync | null;
  crosshairSync?: ReplayChartCrosshairSync | null;
  liveBarCount: number;
  playbackEnabled: boolean;
  playbackOffset: number | null;
  processedCount: number;
}>();

const emit = defineEmits<{
  viewportChange: [sync: Omit<ReplayChartViewportSync, "revision" | "offset">];
  crosshairChange: [sync: Omit<ReplayChartCrosshairSync, "revision">];
}>();

const surface = ref<ChartSurfacePort | null>(null);
const viewportGate = new ReplayViewportSyncGate();
const crosshairGate = new ReplayCrosshairSyncGate();
const brightCandles = ref<SnapshotBrightCandleGeometry[]>([]);
const boundaries = ref<{ start: number; end: number } | null>(null);
const playbackOverlayEnabled = computed(() =>
  props.playbackEnabled && props.playbackOffset !== null && props.playbackOffset !== undefined,
);

function refreshSnapshotGeometry(): void {
  const port = surface.value;
  const offset = props.playbackOffset;
  if (!port || offset === null || offset === undefined || props.liveBarCount <= 0) {
    brightCandles.value = [];
    boundaries.value = null;
    return;
  }

  boundaries.value = resolveSnapshotLiveRangeCoordinates({
    offset,
    liveCount: props.liveBarCount,
    barIds: props.bars.map((bar) => bar.sbarId),
    coordinateForSbarId: (sbarId) => port.getSbarCoordinate(sbarId),
    logicalToCoordinate: (index) => port.getLogicalCoordinate(index),
  });

  if (!props.playbackEnabled) {
    brightCandles.value = [];
    return;
  }
  const visible = port.getVisibleLogicalRange();
  brightCandles.value = projectSnapshotBrightCandles({
    offset,
    liveCount: props.liveBarCount,
    processedCount: props.processedCount,
    bars: props.bars,
    visibleFrom: visible ? visible.from - 1 : Number.NEGATIVE_INFINITY,
    visibleTo: visible ? visible.to + 1 : Number.POSITIVE_INFINITY,
    coordinateForSbarId: (sbarId) => port.getSbarCoordinate(sbarId),
    priceToCoordinate: (price) => port.getPriceCoordinate(price),
  });
}

function handleViewportChange(range: { from: number; to: number }): void {
  if (!props.syncEnabled) return;
  const observation = viewportGate.observeRange(range);
  if (observation !== "publish") return;
  emit("viewportChange", { source: "reference", ...range });
}

function handleCrosshairChange(anchor: { sbarId: string | null; price: number | null }): void {
  if (!props.syncEnabled || crosshairGate.isApplying) return;
  crosshairGate.setPeerPositionActive(false);
  emit("crosshairChange", { source: "reference", ...anchor });
}

function applyViewportRequest(request: ReplayChartViewportSync | null | undefined): void {
  if (!props.syncEnabled || !request || request.source === "reference" || !surface.value) return;
  const target = translateReplayViewportRange(request, "live-to-reference");
  if (!target) return;
  const current = surface.value.getVisibleLogicalRange();
  if (current && isSameLogicalRange(current, target)) return;

  viewportGate.expectPeerRange(target);
  const revision = viewportGate.beginSuppression();
  if (!surface.value.applyViewportRange(target)) {
    viewportGate.clear();
    return;
  }
  // The expected-range check remains active beyond this microtask to catch
  // Lightweight Charts' potentially asynchronous visible-range callback.
  queueMicrotask(() => viewportGate.endSuppression(revision));
}

function applyCrosshairRequest(sync: ReplayChartCrosshairSync | null | undefined): void {
  if (!props.syncEnabled || !sync) {
    if (crosshairGate.hasPeerPosition) {
      crosshairGate.setPeerPositionActive(false);
      crosshairGate.beginApply();
      surface.value?.clearCrosshairPosition();
    }
    return;
  }
  if (sync.source === "reference") return;

  const validBar = sync.sbarId !== null && props.bars.some((bar) => bar.sbarId === sync.sbarId);
  if (!validBar || sync.price === null || !Number.isFinite(sync.price)) {
    if (crosshairGate.hasPeerPosition) {
      crosshairGate.setPeerPositionActive(false);
      crosshairGate.beginApply();
      surface.value?.clearCrosshairPosition();
    }
    return;
  }

  const replacingPeerPosition = crosshairGate.hasPeerPosition;
  crosshairGate.setPeerPositionActive(true);
  crosshairGate.beginApply();
  if (!surface.value?.applyCrosshairPosition(sync.sbarId!, sync.price)) {
    crosshairGate.setPeerPositionActive(false);
    if (replacingPeerPosition) surface.value?.clearCrosshairPosition();
  }
}

function invalidatePeerState(): void {
  viewportGate.clear();
  const hadPeerPosition = crosshairGate.hasPeerPosition;
  crosshairGate.clear();
  // Eligibility loss may remove only a position installed by the peer. Never
  // clear a user's local Crosshair as a side effect of synchronization state.
  if (hadPeerPosition) surface.value?.clearCrosshairPosition();
}

watch(
  () => [props.snapshotId, props.bars, props.liveBarCount, props.playbackEnabled, props.playbackOffset, props.processedCount] as const,
  refreshSnapshotGeometry,
  { deep: true },
);

watch(() => props.syncRequest, (request) => {
  applyViewportRequest(request);
}, { deep: true });

watch(() => props.crosshairSync, (sync) => {
  applyCrosshairRequest(sync);
}, { deep: true });

watch(() => props.syncEnabled, (enabled) => {
  if (!enabled) {
    invalidatePeerState();
    return;
  }
  applyViewportRequest(props.syncRequest);
  applyCrosshairRequest(props.crosshairSync);
});

watch(() => [props.snapshotId, props.bars.map((bar) => bar.sbarId).join("\\u0000")] as const, () => {
  // Sequence transitions invalidate peer commands immediately. The workspace
  // coordinator must publish fresh commands for the new qualified sequence.
  invalidatePeerState();
});

onMounted(() => {
  // The Surface's chart and SBar index are ready only after mount.
  refreshSnapshotGeometry();
  applyViewportRequest(props.syncRequest);
  applyCrosshairRequest(props.crosshairSync);
});
</script>

<template>
  <SBarChartSurface
    ref="surface"
    :bars="bars"
    :structure="structure"
    :origin-dataset-id="snapshotId"
    :show-header="false"
    :show-footer="false"
    panel-class="snapshot-reference-chart"
    panel-label="Snapshot Reference chart"
    :chart-label="`Candlestick and volume chart for Snapshot ${snapshotId}`"
    @logical-range-change="handleViewportChange"
    @projection-frame="refreshSnapshotGeometry"
    @crosshair-anchor-change="handleCrosshairChange"
  >
    <template #snapshot-overlays="{ cbarRectangles, swingSegments }">
      <SnapshotPlaybackOverlay
        :enabled="playbackOverlayEnabled"
        :bright-candles="brightCandles"
        :cbar-rectangles="cbarRectangles"
        :swing-segments="swingSegments"
      />
      <SnapshotLiveRangeMarkers :boundaries="boundaries" />
    </template>
  </SBarChartSurface>
</template>
