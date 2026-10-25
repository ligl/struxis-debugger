<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { SnapshotRangeMarkerPrimitive, type SnapshotRangeMarkerState } from "../snapshot-reference-primitives";
import { projectSnapshotPlaybackSeries, type SnapshotPlaybackSeriesProjection } from "../snapshot-playback-series";
import { hitTestStructureObject } from "../sbar-chart-structure-hit-test";
import type { ReplayChartSelection } from "../origin-types";
import type { ChartSurfacePort } from "../chart-surface-contract";
import ChartSurface from "./ChartSurface.vue";
import {
  ReplayCrosshairSyncGate,
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
const props = defineProps<{
  bars: SBarDto[];
  structure: ReplayInspectorStructureDto | null;
  snapshotId: string;
  syncEnabled: boolean;
  keyboardActive?: boolean;
  syncOwner?: "live" | "snapshot";
  syncRequest?: ReplayChartViewportSync | null;
  crosshairSync?: ReplayChartCrosshairSync | null;
  liveBarCount: number;
  playbackEnabled: boolean;
  playbackOffset: number | null;
  processedCount: number;
}>();

const emit = defineEmits<{
  activate: [];
  viewportChange: [sync: Omit<ReplayChartViewportSync, "revision" | "offset">];
  crosshairChange: [sync: Omit<ReplayChartCrosshairSync, "revision">];
  objectSelect: [selection: ReplayChartSelection];
}>();

const surface = ref<ChartSurfacePort | null>(null);
const crosshairGate = new ReplayCrosshairSyncGate();
const snapshotRangeMarkerPrimitive = new SnapshotRangeMarkerPrimitive();
const snapshotVolumeMarkerPrimitive = new SnapshotRangeMarkerPrimitive();
let unregisterSnapshotMarkerPrimitive: (() => void) | null = null;
let unregisterSnapshotVolumeMarkerPrimitive: (() => void) | null = null;
const nativePlaybackStylingEnabled = computed(() =>
  props.syncEnabled
  && props.playbackEnabled
  && props.playbackOffset !== null
  && props.playbackOffset !== undefined,
);

function currentRangeMarkerState(showArrows: boolean): SnapshotRangeMarkerState {
  return {
    bars: props.bars,
    enabled: props.syncEnabled && props.playbackOffset !== null && props.playbackOffset !== undefined && props.liveBarCount > 0,
    offset: props.playbackOffset,
    liveCount: props.liveBarCount,
    showArrows,
  };
}

function refreshSnapshotGeometry(): void {
  snapshotRangeMarkerPrimitive.update(currentRangeMarkerState(true));
  snapshotVolumeMarkerPrimitive.update(currentRangeMarkerState(false));
}

interface AppliedPlaybackStyleState {
  snapshotId: string;
  bars: SBarDto[];
  playbackEnabled: boolean;
  offset: number | null;
  liveCount: number;
  processedCount: number;
}

let appliedPlaybackStyleState: AppliedPlaybackStyleState | null = null;
let baseSeriesProjection: SnapshotPlaybackSeriesProjection | null = null;
let baseSeriesBars: SBarDto[] | null = null;

function applyPlaybackSeriesStyles(): void {
  const port = surface.value;
  if (!port) return;

  const nextState: AppliedPlaybackStyleState = {
    snapshotId: props.snapshotId,
    bars: props.bars,
    playbackEnabled: nativePlaybackStylingEnabled.value,
    offset: props.playbackOffset,
    liveCount: props.liveBarCount,
    processedCount: Number.isFinite(props.processedCount) ? Math.max(0, Math.floor(props.processedCount)) : 0,
  };
  const previous = appliedPlaybackStyleState;
  if (
    previous
    && previous.snapshotId === nextState.snapshotId
    && previous.bars === nextState.bars
    && previous.playbackEnabled === nextState.playbackEnabled
    && previous.offset === nextState.offset
    && previous.liveCount === nextState.liveCount
    && previous.processedCount === nextState.processedCount
  ) return;

  // The Surface already loaded original DTO colors when playback is initially
  // inactive. Do not redundantly call setData on mount or while stopped.
  if (!nextState.playbackEnabled && (!previous || !previous.playbackEnabled)) {
    appliedPlaybackStyleState = nextState;
    return;
  }

  if (baseSeriesBars !== props.bars || !baseSeriesProjection) {
    baseSeriesProjection = projectSnapshotPlaybackSeries({
      bars: props.bars, playbackEnabled: false, offset: null, liveCount: 0, processedCount: 0,
    });
    baseSeriesBars = props.bars;
  }

  if (!nextState.playbackEnabled && previous?.playbackEnabled) {
    if (port.replaceSeriesData(baseSeriesProjection.candles, baseSeriesProjection.volume)) {
      appliedPlaybackStyleState = nextState;
    }
    return;
  }

  const samePlaybackSequence = previous !== null
    && previous.snapshotId === nextState.snapshotId
    && previous.bars === nextState.bars
    && previous.playbackEnabled
    && nextState.playbackEnabled
    && previous.offset === nextState.offset
    && previous.liveCount === nextState.liveCount;

  // A strict one-SBar advance restores only the newly processed candle and
  // volume bar from cached source data. It avoids full projection and setData.
  if (
    samePlaybackSequence
    && nextState.processedCount === previous.processedCount + 1
    && nextState.offset !== null
  ) {
    const index = nextState.offset + previous.processedCount;
    const candle = baseSeriesProjection.candles[index];
    const volume = baseSeriesProjection.volume[index];
    if (candle && volume && port.updateSeriesData(candle, volume, true)) {
      appliedPlaybackStyleState = nextState;
      return;
    }
  }

  const projection = projectSnapshotPlaybackSeries({
    bars: props.bars,
    playbackEnabled: nextState.playbackEnabled,
    offset: nextState.offset,
    liveCount: nextState.liveCount,
    processedCount: nextState.processedCount,
  });
  if (port.replaceSeriesData(projection.candles, projection.volume)) {
    appliedPlaybackStyleState = nextState;
  }
}

function handleProjectionFrame(): void {
  refreshSnapshotGeometry();
}

function handleViewportChange(range: { from: number; to: number }): void {
  if (!props.syncEnabled || (props.syncOwner !== undefined && props.syncOwner !== "snapshot")) return;
  emit("viewportChange", { source: "reference", ...range });
}

function handleCrosshairChange(anchor: { sbarId: string | null; price: number | null }): void {
  if (!props.syncEnabled || crosshairGate.isApplying) return;
  crosshairGate.setPeerPositionActive(false);
  emit("crosshairChange", { source: "reference", ...anchor });
}

function handleChartClick(point: { x: number; y: number | null } | null): void {
  const port = surface.value;
  if (!point || point.y === null || !port || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
  const anchorSbarId = port.getSbarIdAtCoordinate(point.x);
  if (!anchorSbarId) return;
  const geometry = port.getStructureGeometry();
  const structureHit = hitTestStructureObject({
    x: point.x,
    y: point.y,
    swings: geometry.swingSegments,
    cbars: geometry.cbarRectangles,
    swingVisible: true,
    cbarVisible: true,
  });
  if (structureHit) {
    emit("objectSelect", { kind: structureHit.kind, id: structureHit.id, checkpointSbarId: anchorSbarId });
    return;
  }
  const marker = port.getSbarMarker(anchorSbarId);
  if (!marker) return;
  const centerX = marker.x + marker.width / 2;
  if (
    Math.abs(point.x - centerX) > Math.max(3, marker.width / 2 + 1) ||
    point.y < marker.y - 5 ||
    point.y > marker.y + marker.height + 5
  ) return;
  emit("objectSelect", { kind: "sbar", id: anchorSbarId, checkpointSbarId: anchorSbarId });
}

function applyViewportRequest(request: ReplayChartViewportSync | null | undefined): void {
  if (!props.syncEnabled || !request || request.source === "reference" || !surface.value) return;
  const target = translateReplayViewportRange(request, "live-to-reference");
  if (!target) return;
  const current = surface.value.getVisibleLogicalRange();
  if (current && isSameLogicalRange(current, target)) return;

  surface.value.applyViewportRange(target);
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
  const hadPeerPosition = crosshairGate.hasPeerPosition;
  crosshairGate.clear();
  // Eligibility loss may remove only a position installed by the peer. Never
  // clear a user's local Crosshair as a side effect of synchronization state.
  // Guard the chart callback generated by this programmatic clear so it cannot
  // escape as a new local observation while the old sequence is being invalidated.
  if (hadPeerPosition) {
    crosshairGate.beginApply();
    surface.value?.clearCrosshairPosition();
  }
}

watch(
  () => [props.snapshotId, props.bars, props.liveBarCount, props.syncEnabled, props.playbackEnabled, props.playbackOffset, props.processedCount] as const,
  refreshSnapshotGeometry,
  { deep: true },
);

watch(
  () => [props.snapshotId, props.bars, props.syncEnabled, props.playbackEnabled, props.playbackOffset, props.liveBarCount, props.processedCount] as const,
  applyPlaybackSeriesStyles,
  { deep: true, flush: "post" },
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
  // The child Surface has initialized its chart and Primitive host by this point.
  unregisterSnapshotMarkerPrimitive = surface.value?.registerPrimitive(
    "snapshot-reference:" + props.snapshotId + ":background-range-markers",
    snapshotRangeMarkerPrimitive,
    { target: "candles", dispose: () => snapshotRangeMarkerPrimitive.dispose() },
  ) ?? null;
  unregisterSnapshotVolumeMarkerPrimitive = surface.value?.registerPrimitive(
    "snapshot-reference:" + props.snapshotId + ":volume-background-range-markers",
    snapshotVolumeMarkerPrimitive,
    { target: "volume", dispose: () => snapshotVolumeMarkerPrimitive.dispose() },
  ) ?? null;
  refreshSnapshotGeometry();
  applyPlaybackSeriesStyles();
  applyViewportRequest(props.syncRequest);
  applyCrosshairRequest(props.crosshairSync);
});
onBeforeUnmount(() => {
  unregisterSnapshotMarkerPrimitive?.();
  unregisterSnapshotMarkerPrimitive = null;
  unregisterSnapshotVolumeMarkerPrimitive?.();
  unregisterSnapshotVolumeMarkerPrimitive = null;
  appliedPlaybackStyleState = null;
  baseSeriesProjection = null;
  baseSeriesBars = null;
  snapshotRangeMarkerPrimitive.dispose();
  snapshotVolumeMarkerPrimitive.dispose();
});

</script>

<template>
  <ChartSurface
    ref="surface"
    :bars="bars"
    :structure="structure"
    :sequence-id="snapshotId"
    :show-header="false"
    :show-footer="false"
    :show-legend="true"
    panel-class="snapshot-reference-chart"
    panel-label="Snapshot Reference chart"
    :chart-label="`Candlestick and volume chart for Snapshot ${snapshotId}`"
    :keyboard-active="keyboardActive"
    @chart-activate="emit('activate')"
    @logical-range-change="handleViewportChange"
    @projection-frame="handleProjectionFrame"
    @layout-ready="emit('layoutReady')"
    @crosshair-anchor-change="handleCrosshairChange"
    @chart-click="handleChartClick"
  >
  </ChartSurface>
</template>

<style scoped>
/* The Snapshot panel already supplies its outer frame. */
:deep(.snapshot-reference-chart) {
  border: 0;
}
</style>
