<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { SnapshotRangeMarkerPrimitive, SnapshotReferencePrimitive, SnapshotVolumePrimitive, type SnapshotPrimitiveState, type SnapshotRangeMarkerState, type SnapshotVolumePrimitiveState } from "../snapshot-reference-primitives";
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
const snapshotPrimitive = new SnapshotReferencePrimitive();
const snapshotVolumePrimitive = new SnapshotVolumePrimitive();
const snapshotRangeMarkerPrimitive = new SnapshotRangeMarkerPrimitive();
const snapshotVolumeMarkerPrimitive = new SnapshotRangeMarkerPrimitive();
let unregisterSnapshotPrimitive: (() => void) | null = null;
let unregisterSnapshotVolumePrimitive: (() => void) | null = null;
let unregisterSnapshotMarkerPrimitive: (() => void) | null = null;
let unregisterSnapshotVolumeMarkerPrimitive: (() => void) | null = null;
const playbackOverlayEnabled = computed(() =>
  props.syncEnabled
  && props.playbackEnabled
  && props.playbackOffset !== null
  && props.playbackOffset !== undefined,
);

function currentPrimitiveState(): SnapshotPrimitiveState {
  return {
    bars: props.bars,
    structure: props.structure,
    enabled: props.syncEnabled && props.playbackOffset !== null && props.playbackOffset !== undefined && props.liveBarCount > 0,
    playbackEnabled: playbackOverlayEnabled.value,
    offset: props.playbackOffset,
    liveCount: props.liveBarCount,
    processedCount: props.processedCount,
  };
}

function currentVolumePrimitiveState(): SnapshotVolumePrimitiveState {
  return {
    bars: props.bars,
    enabled: props.syncEnabled && props.playbackOffset !== null && props.playbackOffset !== undefined && props.liveBarCount > 0,
    playbackEnabled: playbackOverlayEnabled.value,
    offset: props.playbackOffset,
    liveCount: props.liveBarCount,
  };
}

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
  snapshotPrimitive.update(currentPrimitiveState());
  snapshotVolumePrimitive.update(currentVolumePrimitiveState());
  snapshotRangeMarkerPrimitive.update(currentRangeMarkerState(true));
  snapshotVolumeMarkerPrimitive.update(currentRangeMarkerState(false));
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
  unregisterSnapshotPrimitive = surface.value?.registerPrimitive(
    "snapshot-reference:" + props.snapshotId + ":candle-overlays",
    snapshotPrimitive,
    { target: "candles", dispose: () => snapshotPrimitive.dispose() },
  ) ?? null;
  unregisterSnapshotVolumePrimitive = surface.value?.registerPrimitive(
    "snapshot-reference:" + props.snapshotId + ":volume-overlays",
    snapshotVolumePrimitive,
    { target: "volume", dispose: () => snapshotVolumePrimitive.dispose() },
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
  applyViewportRequest(props.syncRequest);
  applyCrosshairRequest(props.crosshairSync);
});
onBeforeUnmount(() => {
  unregisterSnapshotPrimitive?.();
  unregisterSnapshotPrimitive = null;
  unregisterSnapshotVolumePrimitive?.();
  unregisterSnapshotVolumePrimitive = null;
  unregisterSnapshotMarkerPrimitive?.();
  unregisterSnapshotMarkerPrimitive = null;
  unregisterSnapshotVolumeMarkerPrimitive?.();
  unregisterSnapshotVolumeMarkerPrimitive = null;
  snapshotPrimitive.dispose();
  snapshotVolumePrimitive.dispose();
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
    @projection-frame="refreshSnapshotGeometry"
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
