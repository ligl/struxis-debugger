<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { Time } from "lightweight-charts";
import ChartSurface from "./ChartSurface.vue";
import type { ChartSurfacePort } from "../chart-surface-contract";
import { createStructureProjectionScheduler } from "../structure-projection-scheduler";
import { hitTestStructureObject as resolveStructureHit } from "../sbar-chart-structure-hit-test";
import { SBarMarkerPrimitive } from "../sbar-marker-primitive";
import { ReplayTargetMarkerPrimitive } from "../replay-target-marker-primitive";
import { mapSBarsToChart } from "../sbar-chart-data";
import { createSbarChartIndex, resolveSbarChartAnchor } from "../sbar-chart-index";
import { ReplayCrosshairSyncGate, isSameLogicalRange, resolveReplayCrosshairCommand, translateReplayViewportRange } from "../replay-chart-sync";
import type { OriginDatasetDto, ReplayChartCrosshairSync, ReplayChartSelection, ReplayChartViewportSync, ReplayInspectorStructureDto, RunStateDto, SBarDto, TestDatasetDto } from "../origin-types";

const props = withDefaults(defineProps<{
  origin: OriginDatasetDto | null;
  testDataset: TestDatasetDto | null;
  runState: RunStateDto | null;
  structure?: ReplayInspectorStructureDto | null;
  selectedObject?: ReplayChartSelection | null;
  targetSbarId?: string | null;
  keyboardActive?: boolean;
  syncOwner?: "live" | "snapshot";
  syncEnabled?: boolean;
  syncOffset?: number | null;
  syncRequest?: ReplayChartViewportSync | null;
  crosshairSync?: ReplayChartCrosshairSync | null;
}>(), {
  keyboardActive: undefined,
});
const emit = defineEmits<{
  activate: [];
  objectSelect: [selection: ReplayChartSelection];
  targetSelect: [sbarId: string];
  targetCancel: [];
  viewportChange: [sync: Omit<ReplayChartViewportSync, "revision" | "offset">];
  crosshairChange: [sync: Omit<ReplayChartCrosshairSync, "revision">];
}>();

const surface = ref<ChartSurfacePort | null>(null);
const chartError = ref("");
const layerVisibility = ref({ sbar: true, volume: true, cbar: true, swing: true, trend: true });
type CBarRectangle = { id: string; x: number; y: number; width: number; height: number };
type SwingSegment = { id: string; x1: number; y1: number; x2: number; y2: number; color: string; dasharray: string; state: string };
type TrendSegment = Pick<SwingSegment, "id" | "x1" | "y1" | "x2" | "y2" | "state">;
type SBarSelectionMarker = { id: string; x: number; y: number; width: number; height: number };
const selectedSbarMarker = ref<SBarSelectionMarker | null>(null);
const targetSbarX = ref<number | null>(null);
const hoveredSbarMarker = ref<SBarSelectionMarker | null>(null);
const hoveredObject = ref<ReplayChartSelection | null>(null);
const cbarRectangles = ref<CBarRectangle[]>([]);
const swingSegments = ref<SwingSegment[]>([]);
const trendSegments = ref<TrendSegment[]>([]);
let timeBySbarId: ReadonlyMap<string, Time> = new Map();
let cachedProjection: ReturnType<typeof mapSBarsToChart> | null = null;
const sbarMarkerPrimitive = new SBarMarkerPrimitive();
let unregisterSbarMarkerPrimitive: (() => void) | null = null;
const targetGuidePrimitive = new ReplayTargetMarkerPrimitive({ x: null, label: true, endpoint: false });
const targetEndpointPrimitive = new ReplayTargetMarkerPrimitive({ x: null, label: false, endpoint: true });
let unregisterTargetGuidePrimitive: (() => void) | null = null;
let unregisterTargetEndpointPrimitive: (() => void) | null = null;

function syncTargetMarkerPrimitives(): void {
  const x = targetSbarX.value;
  targetGuidePrimitive.update({ x, label: true, endpoint: false });
  targetEndpointPrimitive.update({ x, label: false, endpoint: true });
}

function syncSbarMarkerPrimitive(): void {
  sbarMarkerPrimitive.update({
    hovered: hoveredSbarMarker.value,
    selected: selectedSbarMarker.value,
    selectedFill: "rgba(0, 0, 0, 0)",
    selectedStroke: "#D6A85D",
    selectedWidth: 1.5,
  });
}
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
const replayProgressApplies = computed(() =>
  Boolean(
    props.runState &&
    props.testDataset &&
    props.runState.testDatasetId === props.testDataset.testDatasetId &&
    props.runState.status !== "disposed",
  ),
);
const displayedBar = computed(() => {
  if (!replayProgressApplies.value) return bars.value[bars.value.length - 1] ?? null;
  const processedCount = Math.min(props.runState?.processedCount ?? 0, bars.value.length);
  return processedCount > 0 ? bars.value[processedCount - 1] : null;
});

let fittedTestDatasetId: string | null = null;
let lastProcessedCount: number | null = null;
let lastRunId: string | null = null;
let lastProgressApplies: boolean | null = null;
let crosshairLogicalIndex: number | null = null;
const crosshairSyncGate = new ReplayCrosshairSyncGate();
let pendingViewportRange: { from: number; to: number } | null = null;

function isInteractiveKeyboardTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return target.closest(
    "input, textarea, select, button, a[href], summary, [contenteditable]:not([contenteditable='false']), [role='button'], [role='link'], [role='menuitem'], [role='slider'], [role='textbox'], [role='combobox'], [tabindex]:not([tabindex='-1'])",
  ) !== null;
}

function barAtLogicalIndex(logical: number): SBarDto | null {
  if (!Number.isFinite(logical)) return null;
  return bars.value[Math.round(logical)] ?? null;
}

function handleChartKeyboard(event: KeyboardEvent): void {
  // Replay target control has higher priority than chart-local navigation.
  // RunChart is mounted only while Replay is active, so T works regardless
  // of whether Live or Snapshot currently owns chart-navigation keys.
  const isTargetShortcut = event.key.toLowerCase() === "t" && !event.ctrlKey &&
    !event.altKey && !event.metaKey && !event.shiftKey;
  if (
    !isTargetShortcut ||
    event.repeat ||
    isInteractiveKeyboardTarget(event.target) ||
    isInteractiveKeyboardTarget(document.activeElement)
  ) return;

  if (props.targetSbarId) {
    emit("targetCancel");
    event.preventDefault();
    return;
  }
  if (!chartError.value && !projectionMessage.value && bars.value.length > 0) {
    // If Snapshot owns the workspace, only a qualified synchronized
    // Crosshair can be mapped back to the Live Test Dataset. Never use a
    // stale Live-local index when the two sequences are not sync-eligible.
    if (
      props.syncOwner === "snapshot" &&
      (!props.syncEnabled || !props.crosshairSync?.sbarId)
    ) {
      event.preventDefault();
      return;
    }
    const bar = crosshairLogicalIndex === null ? null : barAtLogicalIndex(crosshairLogicalIndex);
    if (bar) {
      emit("targetSelect", bar.sbarId);
      event.preventDefault();
    }
  }
}

function handleSurfaceKeyboardCrosshair(anchor: { sbarId: string; price: number }): void {
  const index = bars.value.findIndex((bar) => bar.sbarId === anchor.sbarId);
  if (index < 0) return;
  crosshairLogicalIndex = index;
  if (!props.syncEnabled) return;
  crosshairSyncGate.setPeerPositionActive(false);
  // ChartSurface emits this event immediately before positioning the
  // Crosshair, so suppress the resulting chart callback from echoing it.
  crosshairSyncGate.beginApply();
  emit("crosshairChange", { source: "live", sbarId: anchor.sbarId, price: anchor.price });
}

function handleSurfaceLayerVisibility(visibility: typeof layerVisibility.value): void {
  layerVisibility.value = { ...visibility };
  updateHoveredObject(undefined);
  scheduleOverlayUpdate.flush();
}

function toggleLayer(layer: keyof typeof layerVisibility.value): void {
  layerVisibility.value[layer] = !layerVisibility.value[layer];
  surface.value?.setLayerVisibility(layerVisibility.value);
  updateHoveredObject(undefined);
  // Keep layer state and geometry consumed by hit-testing in the same turn.
  scheduleOverlayUpdate.flush();
}

function fitContent(): void {
  surface.value?.fitContent();
}

function syncStructurePrimitives(): void {
  const cursorSbarId = props.runState?.cursorSbarId ?? null;
  const hoveredObjectValue = hoveredObject.value;
  const selectedObjectValue = props.selectedObject;
  const hovered = hoveredObjectValue &&
    hoveredObjectValue.checkpointSbarId === cursorSbarId &&
    (hoveredObjectValue.kind === "cbar" || hoveredObjectValue.kind === "swing" || hoveredObjectValue.kind === "trend")
    ? { kind: hoveredObjectValue.kind, id: hoveredObjectValue.id }
    : null;
  const hoveredSwing = hovered?.kind === "swing"
    ? props.structure?.swings.find((item) => item.swingId === hovered.id)
    : null;
  const hoveredCbarIds = hoveredSwing
    ? [...new Set([hoveredSwing.cbarStartId, hoveredSwing.cbarEndId])]
      .filter((id) => cbarRectangles.value.some((item) => item.id === id))
    : [];
  const selected = selectedObjectValue &&
    selectedObjectValue.checkpointSbarId === cursorSbarId &&
    (selectedObjectValue.kind === "cbar" || selectedObjectValue.kind === "swing" || selectedObjectValue.kind === "trend")
    ? { kind: selectedObjectValue.kind, id: selectedObjectValue.id }
    : null;
  const selectedSwing = selected?.kind === "swing"
    ? props.structure?.swings.find((item) => item.swingId === selected.id)
    : null;
  const selectedCbarIds = selectedSwing
    ? [...new Set([selectedSwing.cbarStartId, selectedSwing.cbarEndId])]
      .filter((id) => cbarRectangles.value.some((item) => item.id === id))
    : [];
  surface.value?.setStructureInteractionState(hovered, selected, hoveredCbarIds, selectedCbarIds);
}

function updateStructureOverlays(): void {
  const port = surface.value;
  if (!port) {
    selectedSbarMarker.value = null;
    hoveredSbarMarker.value = null;
    cbarRectangles.value = [];
    swingSegments.value = [];
    trendSegments.value = [];
    targetSbarX.value = null;
    return;
  }
  const geometry = port.getStructureGeometry();
  cbarRectangles.value = geometry.cbarRectangles;
  swingSegments.value = geometry.swingSegments;
  trendSegments.value = geometry.trendSegments;
  const selected = props.selectedObject;
  selectedSbarMarker.value = layerVisibility.value.sbar
    && selected?.kind === "sbar"
    && ((selected.checkpointSbarId === null && !props.runState) || selected.checkpointSbarId === props.runState?.cursorSbarId)
    ? port.getSbarMarker(selected.id)
    : null;
  targetSbarX.value = props.targetSbarId ? port.getSbarCoordinate(props.targetSbarId) : null;
  updateHoverMarker();
}

function markerForSbar(sbarId: string | null | undefined): SBarSelectionMarker | null {
  if (!layerVisibility.value.sbar || !sbarId) return null;
  return surface.value?.getSbarMarker(sbarId) ?? null;
}

function sbarRangeHighlight(sbarId: string | null | undefined): SBarSelectionMarker | null {
  // Hover and Selection must use the same live-projected SBar geometry.
  return markerForSbar(sbarId);
}

function updateHoverMarker(): void {
  hoveredSbarMarker.value = hoveredObject.value?.kind === "sbar"
    ? sbarRangeHighlight(hoveredObject.value.id)
    : null;
}

function handleVisibleRangeChange(range?: { from: number; to: number } | null): void {
  scheduleOverlayUpdate();
  if (!props.syncEnabled || (props.syncOwner !== undefined && props.syncOwner !== "live") || !surface.value || bars.value.length === 0) return;
  const currentRange = range ?? surface.value.getVisibleLogicalRange();
  if (!currentRange || !Number.isFinite(currentRange.from) || !Number.isFinite(currentRange.to)) return;

  // Coalesce high-frequency wheel/pan events; publish the latest fractional
  // viewport in the same frame as the overlay projection.
  pendingViewportRange = { from: currentRange.from, to: currentRange.to };
  scheduleOverlayUpdate();
}

function applyCrosshairSync(sync: ReplayChartCrosshairSync | null | undefined): void {
  if (!surface.value || !props.syncEnabled) return;
  const command = resolveReplayCrosshairCommand(sync, bars.value, timeBySbarId, "live");
  if (command.kind === "ignore") return;
  if (command.kind === "clear") {
    // A peer clear may only remove a Crosshair that this adapter installed.
    // If local interaction already took ownership, preserve the local position.
    if (crosshairSyncGate.hasPeerPosition) {
      crosshairSyncGate.setPeerPositionActive(false);
      crosshairSyncGate.beginApply();
      surface.value?.clearCrosshairPosition();
    }
    return;
  }

  // A synchronized Snapshot Crosshair is also the authoritative target
  // anchor while Snapshot owns the Replay workspace. Lightweight Charts does
  // not guarantee a Crosshair-move callback for programmatic positioning, so
  // update the logical SBar anchor from the resolved peer identity directly.
  const mappedIndex = bars.value.findIndex((bar) => bar.sbarId === command.sbarId);
  if (mappedIndex >= 0) crosshairLogicalIndex = mappedIndex;

  crosshairSyncGate.setPeerPositionActive(true);
  crosshairSyncGate.beginApply();
  surface.value.applyCrosshairPosition(command.sbarId, command.price);
}
function applySyncRequest(request: ReplayChartViewportSync | null | undefined): void {
  if (!request || request.source === "live" || !props.syncEnabled || !surface.value) return;
  const current = surface.value.getVisibleLogicalRange();
  // Snapshot = Live + offset: the shared protocol owns the inverse transform.
  const target = translateReplayViewportRange(request, "reference-to-live");
  if (!target) return;
  if (current && isSameLogicalRange(current, target)) return;
  const { from, to } = target;
  surface.value.applyViewportRange({ from, to });
}

const scheduleOverlayUpdate = createStructureProjectionScheduler(() => {
  updateStructureOverlays();
  const latest = pendingViewportRange;
  pendingViewportRange = null;
  if (latest && props.syncEnabled && (props.syncOwner === undefined || props.syncOwner === "live") && surface.value) {
    emit("viewportChange", { source: "live", from: latest.from, to: latest.to });
  }
});

function hitTestStructureObject(x: number, y: number): { kind: "swing" | "cbar" | "trend"; id: string } | null {
  if (!props.runState?.cursorSbarId) return null;
  const hit = resolveStructureHit({
    x,
    y,
    swings: swingSegments.value,
    cbars: cbarRectangles.value,
    trends: trendSegments.value,
    swingVisible: layerVisibility.value.swing,
    cbarVisible: layerVisibility.value.cbar,
    trendVisible: layerVisibility.value.trend,
  });
  return hit ? { kind: hit.kind, id: hit.id } : null;
}

function hitTestSbar(x: number, y: number): string | null {
  if (!surface.value || !layerVisibility.value.sbar || bars.value.length === 0) return null;
  const logical = surface.value.getLogicalIndexAtCoordinate(x);
  if (logical === null || logical === undefined || !Number.isFinite(logical)) return null;
  const index = Math.round(logical);
  const bar = bars.value[index];
  if (!bar) return null;
  const marker = markerForSbar(bar.sbarId);
  if (!marker) return null;
  if (x < marker.x || x > marker.x + marker.width ||
      y < marker.y || y > marker.y + marker.height) return null;
  return bar.sbarId;
}

function updateHoveredObject(point: { x: number; y: number } | undefined): void {
  const checkpointSbarId = props.runState?.cursorSbarId ?? null;
  let next: ReplayChartSelection | null = null;
  if (point && Number.isFinite(point.x) && Number.isFinite(point.y) && !chartError.value) {
    const structureHit = hitTestStructureObject(point.x, point.y);
    if (structureHit && checkpointSbarId) next = { ...structureHit, checkpointSbarId };
    else {
      const sbarId = hitTestSbar(point.x, point.y);
      if (sbarId) next = { kind: "sbar", id: sbarId, checkpointSbarId };
    }
  }
  const current = hoveredObject.value;
  if (current?.kind === next?.kind && current?.id === next?.id && current?.checkpointSbarId === next?.checkpointSbarId) return;
  hoveredObject.value = next;
  syncStructurePrimitives();
  updateHoverMarker();
}


function publishCrosshair(param: { point?: { x: number; y: number } | undefined }): void {
  if (!props.syncEnabled || crosshairSyncGate.isApplying) return;
  crosshairSyncGate.setPeerPositionActive(false);
  const point = param.point;
  if (!point || !surface.value || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    emit("crosshairChange", { source: "live", sbarId: null, price: null });
    return;
  }
  const logical = surface.value.getLogicalIndexAtCoordinate(point.x);
  const anchor = resolveSbarChartAnchor(bars.value, logical);
  const bar = anchor ? bars.value[anchor.index] : undefined;
  const price = surface.value.getPriceAtCoordinate(point.y);
  emit("crosshairChange", {
    source: "live",
    sbarId: bar?.sbarId ?? null,
    price: price !== null && price !== undefined && Number.isFinite(price) ? price : null,
  });
}

function handleSurfacePointer(point: { x: number; y: number } | null): void {
  handleChartMove({ point: point ?? undefined });
}

function handleSurfaceClick(point: { x: number; y: number | null } | null): void {
  if (!point || point.y === null) return;
  handleChartClick({ point: { x: point.x, y: point.y } });
}

function handleChartMove(param: { point?: { x: number; y: number } | undefined }): void {
  publishCrosshair(param);
  const x = param.point?.x;
  // A leave event clears hover, but retains the last logical crosshair anchor
  // so T still targets the position the user was inspecting.
  if (typeof x === "number") {
    const logical = surface.value?.getLogicalIndexAtCoordinate(x);
    // Only adopt a real candle under the pointer. When the pointer/crosshair
    // is outside the Test Dataset, retain the last valid navigation anchor;
    // clearing it makes the next keypress fall back to the backend cursor and
    // can appear to jump back to the beginning after boundary navigation.
    const anchor = resolveSbarChartAnchor(bars.value, logical);
    if (anchor) crosshairLogicalIndex = anchor.index;
  }
  updateHoveredObject(param.point);
}

function handleChartClick(param: { point?: { x: number; y: number } | undefined }): void {
  const x = param.point?.x;
  const y = param.point?.y;
  if (!surface.value || chartError.value || typeof x !== "number" || typeof y !== "number" || !Number.isFinite(x) || !Number.isFinite(y)) return;
  const structureHit = hitTestStructureObject(x, y);
  const checkpointSbarId = props.runState?.cursorSbarId;
  if (structureHit && checkpointSbarId) {
    emit("objectSelect", { ...structureHit, checkpointSbarId });
    return;
  }
  // Match the hover hit-test: only the visible OHLC body bounds select an SBar.
  // Clicks in the same logical column but outside the candle do not select it.
  const sbarId = hitTestSbar(x, y);
  if (!sbarId) return;
  emit("objectSelect", { kind: "sbar", id: sbarId, checkpointSbarId: checkpointSbarId ?? null });
}

function handleChartDoubleClick(event: MouseEvent): void {
  // Restart targeting is a chart-area gesture, not an OHLC hit test. Resolve
  // the same horizontal coordinate used by the crosshair against the Test
  // Dataset's logical SBar sequence; Y position and visible layer state do
  // not affect which SBar is targeted.
  const target = event.target;
  if (
    !surface.value ||
    chartError.value ||
    !(target instanceof Element) ||
    target.closest(".run-chart-legend, button, .run-chart-heading")
  ) return;
  const sbarId = surface.value.getSbarIdAtClientX(event.clientX);
  if (!sbarId) return;
  emit("targetSelect", sbarId);
}

function handleContextMenu(event: MouseEvent): void {
  if (!props.targetSbarId) return;
  event.preventDefault();
  event.stopPropagation();
  emit("targetCancel");
}

function updateChart(): void {
  if (!surface.value) return;
  try {
    if (projectionMessage.value) {
      surface.value.replaceSeriesData([], []);
      timeBySbarId = new Map();
      cachedProjection = null;
      lastProcessedCount = null;
      lastRunId = props.runState?.runId ?? null;
      lastProgressApplies = replayProgressApplies.value;
      selectedSbarMarker.value = null;
      cbarRectangles.value = [];
      swingSegments.value = [];
      trendSegments.value = [];
      surface.value.setStructureInteractionState(null, null);
      targetSbarX.value = null;
      chartError.value = "";
      return;
    }
    const projection = mapSBarsToChart(bars.value);
    cachedProjection = projection;
    const processedCount = replayProgressApplies.value
      ? Math.min(props.runState?.processedCount ?? 0, bars.value.length)
      : bars.value.length;
    const chartIndex = createSbarChartIndex(
      bars.value,
      projection.candles.map((candle) => candle.time),
    );
    timeBySbarId = chartIndex.timeBySbarId;
    const candles = projection.candles.map((candle, index) => {
      if (!replayProgressApplies.value || index < processedCount) return candle;
      return {
        ...candle,
        color: "#454b53",
        borderColor: "#454b53",
        wickColor: "#454b53",
      };
    });
    const volume = projection.volume.map((bar, index) =>
      replayProgressApplies.value && index >= processedCount
        ? { ...bar, color: "#454b53" }
        : bar,
    );
    surface.value.replaceSeriesData(candles, volume);
    syncStructurePrimitives();
    lastProcessedCount = processedCount;
    lastRunId = props.runState?.runId ?? null;
    lastProgressApplies = replayProgressApplies.value;
    chartError.value = "";
    updateStructureOverlays();
    if (props.testDataset && fittedTestDatasetId !== props.testDataset.testDatasetId) {
      surface.value.fitContent();
      surface.value.applyViewportRange({
        from: -0.5,
        to: projection.candles.length + 3.5,
      });
      fittedTestDatasetId = props.testDataset.testDatasetId;
    }
    applyCrosshairSync(props.crosshairSync);
  } catch (error) {
    surface.value.replaceSeriesData([], []);
    cachedProjection = null;
    lastProcessedCount = null;
    lastRunId = props.runState?.runId ?? null;
    lastProgressApplies = replayProgressApplies.value;
    selectedSbarMarker.value = null;
    cbarRectangles.value = [];
    swingSegments.value = [];
    surface.value.setStructureInteractionState(null, null);
    targetSbarX.value = null;
    chartError.value = error instanceof Error ? error.message : String(error);
  }
}

function updateProgressSeries(): void {
  if (!surface.value || projectionMessage.value) return;
  const processedCount = replayProgressApplies.value
    ? Math.min(props.runState?.processedCount ?? 0, bars.value.length)
    : bars.value.length;
  const runId = props.runState?.runId ?? null;

  // Run identity and progress mode changes are reset boundaries, not a one-bar
  // transition. The dataset watcher normally handles these first; this guard
  // also makes the progress path safe if Vue batches multiple prop changes.
  if (
    lastProcessedCount === null ||
    lastRunId !== runId ||
    lastProgressApplies !== replayProgressApplies.value
  ) {
    updateChart();
    return;
  }
  if (processedCount === lastProcessedCount) return;

  if (
    replayProgressApplies.value &&
    processedCount === lastProcessedCount + 1 &&
    processedCount > 0
  ) {
    const index = processedCount - 1;
    const projection = cachedProjection;
    if (!projection) {
      updateChart();
      return;
    }
    const candle = projection.candles[index];
    const volume = projection.volume[index];
    if (!candle || !volume) {
      updateChart();
      return;
    }
    // Visibility is controlled by shared series options. Keep point styling
    // independent so hiding a layer cannot poison historical points and leave
    // them transparent after the layer is shown again.
    // Future candles are already dimmed, so promote only the newly confirmed
    // SBar and volume bar instead of replacing the complete historical series.
    surface.value.updateSeriesData(candle, volume, true);
    lastProcessedCount = processedCount;
    updateStructureOverlays();
    return;
  }

  // Unexpected jumps/backtracking are uncommon (e.g. a restored Run state).
  // Rebuild from the authoritative input projection rather than infer a delta.
  updateChart();
}

onMounted(() => {
  document.addEventListener("keydown", handleChartKeyboard);
  unregisterSbarMarkerPrimitive = surface.value?.registerPrimitive("run-sbar-markers", sbarMarkerPrimitive) ?? null;
  updateChart();
  unregisterTargetGuidePrimitive = surface.value?.registerPrimitive("run-target-guide", targetGuidePrimitive) ?? null;
  unregisterTargetEndpointPrimitive = surface.value?.registerPrimitive("run-target-endpoint", targetEndpointPrimitive, { target: "volume" }) ?? null;
  updateStructureOverlays();
  syncSbarMarkerPrimitive();
  syncTargetMarkerPrimitives();
  surface.value?.setLayerVisibility(layerVisibility.value);
  if (props.syncEnabled) {
    if (props.syncRequest?.source === "reference") applySyncRequest(props.syncRequest);
    else handleVisibleRangeChange();
  }
});

watch(
  [
    () => bars.value,
    () => props.testDataset?.testDatasetId,
    () => props.origin?.originDatasetId,
    () => props.runState?.testDatasetId,
    () => props.runState?.runId,
    () => replayProgressApplies.value,
  ],
  (current, previous) => {
    const identityChanged = previous !== undefined && (
      current[1] !== previous[1]
      || current[2] !== previous[2]
      || current[3] !== previous[3]
      || current[4] !== previous[4]
    );
    if (identityChanged) {
      // Do not let a queued source range cross a dataset/run boundary.
      pendingViewportRange = null;
    }
    updateChart();
    updateHoveredObject(undefined);
    if (props.syncEnabled) handleVisibleRangeChange();
  },
);

watch(
  () => props.runState?.processedCount,
  () => updateProgressSeries(),
);

watch(() => props.structure, () => {
  syncStructurePrimitives();
  updateStructureOverlays();
  updateHoveredObject(undefined);
}, { deep: true });
watch(() => props.selectedObject, () => {
  syncStructurePrimitives();
  updateStructureOverlays();
});
watch(() => props.targetSbarId, updateStructureOverlays);
watch(targetSbarX, syncTargetMarkerPrimitives);
watch([hoveredSbarMarker, selectedSbarMarker], syncSbarMarkerPrimitive, { deep: true });
watch(() => props.runState?.cursorSbarId, () => updateHoveredObject(undefined));
watch(() => props.crosshairSync, (sync) => {
  if (!props.syncEnabled || !sync) {
    if (crosshairSyncGate.hasPeerPosition) {
      crosshairSyncGate.setPeerPositionActive(false);
      // Clearing a peer-installed position is still a programmatic chart
      // mutation. Suppress its synchronous Crosshair callback so it cannot
      // be re-published as a fresh local command during identity invalidation.
      crosshairSyncGate.beginApply();
      surface.value?.clearCrosshairPosition();
    }
    return;
  }
  applyCrosshairSync(sync);
}, { deep: true });
watch(() => props.syncEnabled, (enabled) => {
  if (!enabled && crosshairSyncGate.hasPeerPosition) {
    crosshairSyncGate.setPeerPositionActive(false);
    crosshairSyncGate.beginApply();
    surface.value?.clearCrosshairPosition();
  }
});
watch(() => props.syncRequest, (request) => {
  applySyncRequest(request);
  // The source chart already scheduled its overlay refresh from its own range
  // callback. Only reproject here when applying the peer chart's viewport.
  if (request?.source !== "live") scheduleOverlayUpdate();
}, { deep: true });
watch([() => props.syncEnabled, () => props.syncOffset], ([enabled]) => {
  if (enabled) {
    handleVisibleRangeChange();
    return;
  }

  // Drop any deferred source range when synchronization eligibility is lost.
  pendingViewportRange = null;
});
watch(() => ({ ...layerVisibility.value }), (visibility) => {
  surface.value?.setLayerVisibility(visibility);
  updateHoveredObject(undefined);
}, { deep: true });

onBeforeUnmount(() => {
  document.removeEventListener("keydown", handleChartKeyboard);
  crosshairLogicalIndex = null;
  hoveredObject.value = null;
  hoveredSbarMarker.value = null;
  unregisterSbarMarkerPrimitive?.();
  unregisterSbarMarkerPrimitive = null;
  unregisterTargetGuidePrimitive?.();
  unregisterTargetGuidePrimitive = null;
  unregisterTargetEndpointPrimitive?.();
  unregisterTargetEndpointPrimitive = null;
  sbarMarkerPrimitive.dispose();
  targetGuidePrimitive.dispose();
  targetEndpointPrimitive.dispose();
  scheduleOverlayUpdate.cancel();
  pendingViewportRange = null;
  crosshairSyncGate.clear();
});
</script>

<template>
  <section class="run-chart-panel" aria-label="Live Replay SBar chart" data-testid="run-chart-panel" @pointerenter="emit('activate')" @focusin="emit('activate')"
    :data-test-dataset-id="testDataset?.testDatasetId ?? ''" :data-sbar-count="bars.length">
    <header class="run-chart-heading">
      <div class="run-chart-title">
        <div class="run-chart-title-line">
          <span class="run-chart-name">LIVE REPLAY · {{ testDataset?.barType ?? origin?.barType ?? "NO TEST" }}</span>
          <span class="tag green">LIVE</span>
        </div>
      </div>
      <div class="chart-heading-actions">
        <span class="chart-bar-count">{{ bars.length.toLocaleString() }} SBARS</span>
        <button class="chart-tool-button" type="button" :disabled="bars.length === 0" data-testid="run-chart-fit" @click="fitContent">FIT</button>
      </div>
    </header>

    <div class="run-chart-stage" @contextmenu="handleContextMenu" @dblclick="handleChartDoubleClick">
      <div v-if="projectionMessage" class="run-chart-empty" data-testid="run-chart-empty">
        <div class="run-chart-empty-card">
          <span class="run-chart-empty-kicker">REPLAY INPUT</span>
          <strong class="run-chart-empty-title">LIVE REPLAY DATA NOT LOADED</strong>
          <p class="run-chart-empty-description">{{ projectionMessage }}</p>
          <div class="run-chart-empty-flow" aria-label="Replay data workflow">
            <span>LOAD ORIGIN</span><i>→</i><span>CREATE TEST DATASET</span><i>→</i><span>LIVE REPLAY</span>
          </div>
        </div>
      </div>
      <p v-else-if="replayProgressApplies && !displayedBar" class="run-chart-message" data-testid="run-chart-awaiting-checkpoint">
        Waiting for the first backend-confirmed checkpoint. Future input SBars are dimmed.
      </p>
      <div v-if="chartError" class="error-message chart-error" role="alert" data-testid="run-chart-error">
        <strong>Chart projection rejected</strong><span>{{ chartError }}</span>
      </div>
      <ChartSurface
        ref="surface"
        :bars="bars"
        :structure="structure ?? null"
        :sequence-id="testDataset?.testDatasetId ?? 'empty'"
        :show-header="false"
        :show-footer="false"
        :show-legend="false"
        :keyboard-active="syncOwner === 'snapshot' && !syncEnabled ? false : keyboardActive"
        :keyboard-initial-sbar-id="crosshairSync?.sbarId ?? runState?.cursorSbarId ?? null"
        :candle-last-value-visible="false"
        data-mode="external"
        panel-class="run-chart-surface"
        panel-label="Live Replay SBar chart"
        canvas-test-id="run-chart-canvas"
        :show-empty-state="false"
        :show-error-state="false"
        :chart-label="`Candlestick and volume chart for Test Dataset ${testDataset?.testDatasetId ?? 'not selected'}`"
        @chart-activate="emit('activate')"
        @chart-click="handleSurfaceClick"
        @pointer-position="handleSurfacePointer"
        @logical-range-change="handleVisibleRangeChange"
        @projection-frame="updateStructureOverlays"
        @keyboard-crosshair-change="handleSurfaceKeyboardCrosshair"
        @layer-visibility-change="handleSurfaceLayerVisibility"
      >
      </ChartSurface>
      <div v-if="!projectionMessage" class="run-chart-legend" role="group" aria-label="Chart layer visibility">
        <button type="button" class="origin-chart-legend-item" :class="{ active: layerVisibility.sbar }" :aria-pressed="layerVisibility.sbar" data-testid="run-layer-toggle-sbar" @click="toggleLayer('sbar')"><i class="legend-dot sbar-dot"></i>SBar</button>
        <button type="button" class="origin-chart-legend-item" :class="{ active: layerVisibility.cbar }" :aria-pressed="layerVisibility.cbar" :disabled="!structure || structure.cbars.length === 0" data-testid="run-layer-toggle-cbar" @click="toggleLayer('cbar')"><i class="legend-dot cbar-dot"></i>CBar</button>
        <button type="button" class="origin-chart-legend-item" :class="{ active: layerVisibility.swing }" :aria-pressed="layerVisibility.swing" :disabled="!structure || structure.swings.length === 0" data-testid="run-layer-toggle-swing" @click="toggleLayer('swing')"><i class="legend-dot swing-dot"></i>Swing</button>
        <button type="button" class="origin-chart-legend-item" :class="{ active: layerVisibility.volume }" :aria-pressed="layerVisibility.volume" data-testid="run-layer-toggle-volume" @click="toggleLayer('volume')"><i class="legend-dot volume-dot"></i>Volume</button>
      </div>
    </div>

  </section>
</template>
