<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
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

function handleViewportChange(change: Omit<ReplayChartViewportSync, "revision" | "offset">): void {
  if (!props.syncEnabled) return;
  const observation = viewportGate.observeRange({ from: change.from, to: change.to });
  if (observation !== "publish") return;
  emit("viewportChange", change);
}

function handleCrosshairChange(change: Omit<ReplayChartCrosshairSync, "revision">): void {
  if (!props.syncEnabled || crosshairGate.isApplying) return;
  crosshairGate.setPeerPositionActive(false);
  emit("crosshairChange", change);
}

function applyViewportRequest(request: ReplayChartViewportSync | null | undefined): void {
  if (!props.syncEnabled || !request || request.source === "reference" || !surface.value) return;
  const target = translateReplayViewportRange(request, "live-to-reference");
  if (!target) return;
  const current = surface.value.getVisibleLogicalRange();
  if (current && isSameLogicalRange(current, target)) return;

  viewportGate.expectPeerRange(target);
  const revision = viewportGate.beginSuppression();
  surface.value.applyViewportRange(target);
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
    crosshairGate.setPeerPositionActive(false);
    crosshairGate.beginApply();
    surface.value?.clearCrosshairPosition();
    return;
  }

  crosshairGate.setPeerPositionActive(true);
  crosshairGate.beginApply();
  if (!surface.value?.applyCrosshairPosition(sync.sbarId!, sync.price)) {
    crosshairGate.setPeerPositionActive(false);
    surface.value?.clearCrosshairPosition();
  }
}

function invalidatePeerState(): void {
  viewportGate.clear();
  crosshairGate.clear();
  surface.value?.clearCrosshairPosition();
}

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
  // Snapshot identity / sequence changes invalidate peer commands and echo
  // guards, but never disable the chart's local pan, zoom or Crosshair.
  invalidatePeerState();
  if (props.syncEnabled) {
    applyViewportRequest(props.syncRequest);
    applyCrosshairRequest(props.crosshairSync);
  }
});

onMounted(() => {
  // The Surface's chart and SBar index are ready only after mount.
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
    :selection-editable="false"
    display-context="snapshot-reference"
    :snapshot-live-bar-count="liveBarCount"
    :snapshot-playback-enabled="playbackEnabled"
    :snapshot-playback-offset="playbackOffset"
    :snapshot-processed-count="processedCount"
    @viewport-change="handleViewportChange"
    @crosshair-change="handleCrosshairChange"
  >
    <template #snapshot-overlays="{ enabled, brightCandles, cbarRectangles, swingSegments, boundaries }">
      <SnapshotPlaybackOverlay
        :enabled="enabled"
        :bright-candles="brightCandles"
        :cbar-rectangles="cbarRectangles"
        :swing-segments="swingSegments"
      />
      <SnapshotLiveRangeMarkers :boundaries="boundaries" />
    </template>
  </SBarChartSurface>
</template>
