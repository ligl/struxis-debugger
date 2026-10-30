<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { SnapshotRangeMarkerPrimitive, type SnapshotRangeMarkerState } from "../snapshot-reference-primitives";
import { SBarMarkerPrimitive } from "../sbar-marker-primitive";
import { projectSnapshotPlaybackSeries, type SnapshotPlaybackSeriesProjection } from "../snapshot-playback-series";
import { hitTestStructureObject } from "../sbar-chart-structure-hit-test";
import type { ReplayChartSelection } from "../origin-types";
import type { ChartSurfacePort, ChartSurfaceSBarMarker } from "../chart-surface-contract";
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
const hoveredObject = ref<ReplayChartSelection | null>(null);
const selectedObject = ref<ReplayChartSelection | null>(null);
const hoveredSbarMarker = ref<ChartSurfaceSBarMarker | null>(null);
const selectedSbarMarker = ref<ChartSurfaceSBarMarker | null>(null);
const crosshairGate = new ReplayCrosshairSyncGate();
const snapshotRangeMarkerPrimitive = new SnapshotRangeMarkerPrimitive();
const snapshotVolumeMarkerPrimitive = new SnapshotRangeMarkerPrimitive();
const snapshotSbarMarkerPrimitive = new SBarMarkerPrimitive();
let unregisterSnapshotMarkerPrimitive: (() => void) | null = null;
let unregisterSnapshotVolumeMarkerPrimitive: (() => void) | null = null;
let unregisterSnapshotSbarMarkerPrimitive: (() => void) | null = null;
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

function syncStructurePlaybackBrightness(): void {
  surface.value?.setStructurePlaybackState({
    enabled: nativePlaybackStylingEnabled.value,
    offset: props.playbackOffset,
    processedCount: props.processedCount,
    liveCount: props.liveBarCount,
  });
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

function syncStructureInteractionState(): void {
  const geometry = surface.value?.getStructureGeometry();
  const hoveredValue = hoveredObject.value;
  const hovered = hoveredValue && (hoveredValue.kind === "cbar" || hoveredValue.kind === "swing" || hoveredValue.kind === "trend")
    && (hoveredValue.kind === "cbar"
      ? geometry?.cbarRectangles.some((item) => item.id === hoveredValue.id)
      : hoveredValue.kind === "swing"
        ? geometry?.swingSegments.some((item) => item.id === hoveredValue.id)
        : geometry?.trendSegments.some((item) => item.id === hoveredValue.id))
    ? { kind: hoveredValue.kind, id: hoveredValue.id }
    : null;
  const selectedValue = selectedObject.value;
  const selected = selectedValue && (selectedValue.kind === "cbar" || selectedValue.kind === "swing" || selectedValue.kind === "trend")
    && (selectedValue.kind === "cbar"
      ? geometry?.cbarRectangles.some((item) => item.id === selectedValue.id)
      : selectedValue.kind === "swing"
        ? geometry?.swingSegments.some((item) => item.id === selectedValue.id)
        : geometry?.trendSegments.some((item) => item.id === selectedValue.id))
    ? { kind: selectedValue.kind, id: selectedValue.id }
    : null;
  const hoveredSwing = hovered?.kind === "swing"
    ? props.structure?.swings.find((item) => item.swingId === hovered.id)
    : null;
  const hoveredTrend = hovered?.kind === "trend"
    ? props.structure?.trends.find((item) => item.trendId === hovered.id)
    : null;
  const hoveredTrendStart = hoveredTrend
    ? props.structure?.swings.find((item) => item.swingId === hoveredTrend.swingStartId)
    : null;
  const hoveredTrendEnd = hoveredTrend
    ? props.structure?.swings.find((item) => item.swingId === hoveredTrend.swingEndId)
    : null;
  const hoveredCbarIds = hoveredSwing
    ? [...new Set([hoveredSwing.cbarStartId, hoveredSwing.cbarEndId])]
      .filter((id) => geometry?.cbarRectangles.some((item) => item.id === id))
    : hoveredTrendStart && hoveredTrendEnd
      ? [...new Set([hoveredTrendStart.cbarStartId, hoveredTrendEnd.cbarEndId])]
        .filter((id) => geometry?.cbarRectangles.some((item) => item.id === id))
      : [];
  const selectedSwing = selected?.kind === "swing"
    ? props.structure?.swings.find((item) => item.swingId === selected.id)
    : null;
  const selectedTrend = selected?.kind === "trend"
    ? props.structure?.trends.find((item) => item.trendId === selected.id)
    : null;
  const selectedTrendStart = selectedTrend
    ? props.structure?.swings.find((item) => item.swingId === selectedTrend.swingStartId)
    : null;
  const selectedTrendEnd = selectedTrend
    ? props.structure?.swings.find((item) => item.swingId === selectedTrend.swingEndId)
    : null;
  const selectedCbarIds = selectedSwing
    ? [...new Set([selectedSwing.cbarStartId, selectedSwing.cbarEndId])]
      .filter((id) => geometry?.cbarRectangles.some((item) => item.id === id))
    : selectedTrendStart && selectedTrendEnd
      ? [...new Set([selectedTrendStart.cbarStartId, selectedTrendEnd.cbarEndId])]
        .filter((id) => geometry?.cbarRectangles.some((item) => item.id === id))
      : [];
  surface.value?.setStructureInteractionState(hovered, selected, hoveredCbarIds, selectedCbarIds);
}

function updateSbarInteractionMarkers(): void {
  hoveredSbarMarker.value = hoveredObject.value?.kind === "sbar"
    ? surface.value?.getSbarRangeHighlight(hoveredObject.value.id) ?? null
    : null;
  selectedSbarMarker.value = selectedObject.value?.kind === "sbar"
    ? surface.value?.getSbarMarker(selectedObject.value.id) ?? null
    : null;
  snapshotSbarMarkerPrimitive.update({
    hovered: hoveredSbarMarker.value,
    selected: selectedSbarMarker.value,
    selectedFill: "rgb(217 154 69 / 10%)",
    selectedStroke: "#D99A45",
    selectedWidth: 1.5,
  });
}

function updateHoveredObject(point: { x: number; y: number } | null): void {
  const port = surface.value;
  let next: ReplayChartSelection | null = null;
  if (port && point && Number.isFinite(point.x) && Number.isFinite(point.y)) {
    const geometry = port.getStructureGeometry();
    const hit = hitTestStructureObject({
      x: point.x,
      y: point.y,
      swings: geometry.swingSegments,
      cbars: geometry.cbarRectangles,
      trends: geometry.trendSegments,
      swingVisible: true,
      cbarVisible: true,
      trendVisible: true,
    });
    const sbarId = port.getSbarIdAtCoordinate(point.x);
    if (hit) {
      next = { kind: hit.kind, id: hit.id, checkpointSbarId: sbarId };
    } else if (sbarId) {
      const marker = port.getSbarRangeHighlight(sbarId);
      if (marker && point.x >= marker.x && point.x <= marker.x + marker.width
        && point.y >= marker.y - 5 && point.y <= marker.y + marker.height + 5) {
        next = { kind: "sbar", id: sbarId, checkpointSbarId: sbarId };
      }
    }
  }

  const current = hoveredObject.value;
  if (current?.kind === next?.kind && current?.id === next?.id
    && current?.checkpointSbarId === next?.checkpointSbarId) return;
  hoveredObject.value = next;
  updateSbarInteractionMarkers();
  syncStructureInteractionState();
}

function handlePointerPosition(point: { x: number; y: number } | null): void {
  updateHoveredObject(point);
}

function handleProjectionFrame(): void {
  refreshSnapshotGeometry();
  const hovered = hoveredObject.value;
  if (hovered?.kind === "sbar") {
    if (!surface.value?.getSbarRangeHighlight(hovered.id)) hoveredObject.value = null;
  } else if (hovered?.kind === "cbar" || hovered?.kind === "swing" || hovered?.kind === "trend") {
    const geometry = surface.value?.getStructureGeometry();
    const stillProjected = hovered.kind === "cbar"
      ? geometry?.cbarRectangles.some((item) => item.id === hovered.id)
      : hovered.kind === "swing"
        ? geometry?.swingSegments.some((item) => item.id === hovered.id)
        : geometry?.trendSegments.some((item) => item.id === hovered.id);
    if (!stillProjected) hoveredObject.value = null;
  }
  updateSbarInteractionMarkers();
  syncStructureInteractionState();
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
    trends: geometry.trendSegments,
    swingVisible: true,
    cbarVisible: true,
    trendVisible: true,
  });
  if (structureHit) {
    const selection = { kind: structureHit.kind, id: structureHit.id, checkpointSbarId: anchorSbarId } satisfies ReplayChartSelection;
    selectedObject.value = selection;
    updateSbarInteractionMarkers();
    syncStructureInteractionState();
    emit("objectSelect", selection);
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
  const selection = { kind: "sbar", id: anchorSbarId, checkpointSbarId: anchorSbarId } satisfies ReplayChartSelection;
  selectedObject.value = selection;
  updateSbarInteractionMarkers();
  syncStructureInteractionState();
  emit("objectSelect", selection);
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
  () => [props.syncEnabled, props.playbackEnabled, props.playbackOffset, props.processedCount, props.liveBarCount] as const,
  syncStructurePlaybackBrightness,
  { deep: true, flush: "post" },
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
  unregisterSnapshotSbarMarkerPrimitive = surface.value?.registerPrimitive(
    "snapshot-reference:sbar-interaction-markers",
    snapshotSbarMarkerPrimitive,
  ) ?? null;
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
  syncStructurePlaybackBrightness();
  applyPlaybackSeriesStyles();
  applyViewportRequest(props.syncRequest);
  applyCrosshairRequest(props.crosshairSync);
});
onBeforeUnmount(() => {
  unregisterSnapshotSbarMarkerPrimitive?.();
  unregisterSnapshotSbarMarkerPrimitive = null;
  unregisterSnapshotMarkerPrimitive?.();
  unregisterSnapshotMarkerPrimitive = null;
  unregisterSnapshotVolumeMarkerPrimitive?.();
  unregisterSnapshotVolumeMarkerPrimitive = null;
  appliedPlaybackStyleState = null;
  baseSeriesProjection = null;
  baseSeriesBars = null;
  snapshotRangeMarkerPrimitive.dispose();
  snapshotVolumeMarkerPrimitive.dispose();
  snapshotSbarMarkerPrimitive.dispose();
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
    @crosshair-anchor-change="handleCrosshairChange"
    @pointer-position="handlePointerPosition"
    @chart-click="handleChartClick"
  />
</template>

<style scoped>
/* The Snapshot panel already supplies its outer frame. */
:deep(.snapshot-reference-chart) {
  border: 0;
}

</style>
