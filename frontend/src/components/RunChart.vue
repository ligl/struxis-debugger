<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { type IChartApi, type ISeriesApi, type Time } from "lightweight-charts";
import { createSbarChartRuntime } from "../sbar-chart-runtime";
import type { ChartPrimitiveHost } from "../sbar-chart-primitive-host";
import { registerCBarPrimitive, registerSwingPrimitive, type StructurePrimitiveController } from "../sbar-chart-structure-primitives";
import { observeSbarChartResize } from "../sbar-chart-resize";
import { createAnimationFrameCoalescer } from "../animation-frame-coalescer";
import { projectCBarRectangles, projectSwingSegments } from "../sbar-chart-structure-geometry";
import { hitTestStructureObject as resolveStructureHit } from "../sbar-chart-structure-hit-test";
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

const chartHost = ref<HTMLDivElement | null>(null);
const structureOverlayWidth = ref(0);
const chartError = ref("");
const layerVisibility = ref({ sbar: true, volume: true, cbar: true, swing: true });
type CBarRectangle = { id: string; x: number; y: number; width: number; height: number };
type SwingSegment = { id: string; x1: number; y1: number; x2: number; y2: number; color: string; dasharray: string; state: string };
type SBarSelectionMarker = { id: string; x: number; y: number; width: number; height: number };
const selectedSbarMarker = ref<SBarSelectionMarker | null>(null);
const targetSbarX = ref<number | null>(null);
const hoveredSbarMarker = ref<SBarSelectionMarker | null>(null);
const hoveredObject = ref<ReplayChartSelection | null>(null);
const cbarRectangles = ref<CBarRectangle[]>([]);
const swingSegments = ref<SwingSegment[]>([]);
let timeBySbarId: ReadonlyMap<string, Time> = new Map();
let indexBySbarId: ReadonlyMap<string, number> = new Map();
let cachedProjection: ReturnType<typeof mapSBarsToChart> | null = null;
const swingStyleByState: Record<string, { color: string; dasharray: string }> = {
  Confirmed: { color: "#B49ACD", dasharray: "" },
  Tentative: { color: "#D6A85D", dasharray: "6 3" },
  Extending: { color: "#8FA9C4", dasharray: "2 3" },
};
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

let chart: IChartApi | null = null;
let candleSeries: ISeriesApi<"Candlestick"> | null = null;
let volumeSeries: ISeriesApi<"Histogram"> | null = null;
let primitiveHost: ChartPrimitiveHost | null = null;
let cbarPrimitive: StructurePrimitiveController | null = null;
let swingPrimitive: StructurePrimitiveController | null = null;
let stopObservingResize: (() => void) | null = null;

let fittedTestDatasetId: string | null = null;
let lastProcessedCount: number | null = null;
let lastRunId: string | null = null;
let lastProgressApplies: boolean | null = null;
let visibleRangeListener: (() => void) | null = null;
let chartClickListener: ((param: { point?: { x: number; y: number } | undefined }) => void) | null = null;
let chartMoveListener: ((param: { point?: { x: number; y: number } | undefined }) => void) | null = null;
let crosshairLogicalIndex: number | null = null;
let crosshairUpdateFrame: number | null = null;
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

function moveCrosshairTo(index: number, alignToBoundary = false): boolean {
  if (!chart || !candleSeries || bars.value.length === 0) return false;
  const nextIndex = Math.max(0, Math.min(bars.value.length - 1, index));
  const bar = bars.value[nextIndex];
  if (!bar) return false;
  const time = timeBySbarId.get(bar.sbarId);
  if (time === undefined) return false;
  crosshairLogicalIndex = nextIndex;

  // Keep the selected candle inside the viewport without scrolling the
  // logical range beyond the Test Dataset's first/last candle. A simple
  // edge shift can push the range past index 0 or the final index, making
  // Ctrl+Left / Ctrl+Right appear to land outside the dataset.
  const timeScale = chart.timeScale();
  const range = timeScale.getVisibleLogicalRange?.();
  if (range && Number.isFinite(range.from) && Number.isFinite(range.to)) {
    const width = range.to - range.from;
    if (width > 0) {
      const lastIndex = bars.value.length - 1;
      let from = range.from;
      let to = range.to;

      if (alignToBoundary && width < bars.value.length) {
        // Ctrl+Left / Ctrl+Right are absolute navigation commands. Align the
        // viewport to the requested dataset edge instead of applying the
        // ordinary arrow-key margin heuristic, which can leave the target
        // candle visually at or beyond the edge after range clamping.
        from = nextIndex === 0 ? -0.5 : lastIndex + 0.5 - width;
        to = from + width;
      } else {
        const margin = Math.min(2, width * 0.08);
        if (nextIndex < from + margin) {
          from = nextIndex - margin;
          to = from + width;
        } else if (nextIndex > to - margin) {
          to = nextIndex + margin;
          from = to - width;
        }

        // Keep the viewport within the dataset candle-center bounds when it
        // is narrower than the sequence. Wider viewports retain their zoom.
        if (width < bars.value.length) {
          from = Math.max(-0.5, Math.min(from, bars.value.length - 0.5 - width));
          to = from + width;
        } else {
          from = Math.min(from, -0.5);
          to = from + width;
        }
      }
      if (Math.abs(from - range.from) > 0.001 || Math.abs(to - range.to) > 0.001) {
        timeScale.setVisibleLogicalRange({ from, to });
      }
    }
  }

  // Pin both axes of the crosshair to the selected candle: horizontal
  // position uses that SBar's chart time, vertical position uses its close.
  // Re-apply on the next frame as well because changing the visible logical
  // range can trigger a chart layout pass; doing this only synchronously can
  // leave the crosshair at its previous pointer-derived position.
  const selectedIndex = nextIndex;
  const applySelectedCrosshair = () => {
    if (!chart || !candleSeries || crosshairLogicalIndex !== selectedIndex) return;
    // Suppress the chart callback caused by our own programmatic positioning,
    // including the deferred re-application after the viewport layout pass.
    if (props.syncEnabled) crosshairSyncGate.beginApply();
    chart.setCrosshairPosition?.(Number(bar.close), time, candleSeries);
  };
  // Programmatic keyboard navigation does not reliably produce a
  // subscribeCrosshairMove notification. Publish the selected SBar explicitly
  // so the synchronized Snapshot chart follows the same keyboard command.
  if (props.syncEnabled) {
    crosshairSyncGate.setPeerPositionActive(false);
    emit("crosshairChange", { source: "live", sbarId: bar.sbarId, price: Number(bar.close) });
  }
  applySelectedCrosshair();
  if (crosshairUpdateFrame !== null) cancelAnimationFrame(crosshairUpdateFrame);
  crosshairUpdateFrame = requestAnimationFrame(() => {
    crosshairUpdateFrame = null;
    applySelectedCrosshair();
  });
  return true;
}

function moveCrosshairBy(delta: number): boolean {
  const currentIndex = crosshairLogicalIndex ??
    (props.runState?.cursorSbarId
      ? bars.value.findIndex((bar) => bar.sbarId === props.runState?.cursorSbarId)
      : 0);
  const targetIndex = currentIndex + delta;

  // Dataset navigation is bounded, not cyclic. At either edge, leave the
  // crosshair and viewport untouched instead of clamping and re-applying the
  // same candle (or accidentally reinitializing from Replay progress).
  if (targetIndex < 0 || targetIndex >= bars.value.length) return false;
  return moveCrosshairTo(targetIndex);
}

function zoomTimeScale(direction: "in" | "out"): boolean {
  if (!chart || bars.value.length === 0) return false;
  const timeScale = chart.timeScale();
  const range = timeScale.getVisibleLogicalRange?.();
  if (!range || !Number.isFinite(range.from) || !Number.isFinite(range.to)) return false;
  const width = range.to - range.from;
  if (width <= 0) return false;
  if (direction === "in" && width <= 2) return false;
  // Match continuous wheel zoom: zooming out is not capped at fit-content.
  // The visible logical range may extend beyond the dataset at either end.
  const nextWidth = direction === "in"
    ? Math.max(2, width * 0.8)
    : width * 1.25;
  if (Math.abs(nextWidth - width) < 0.01) return false;
  const anchor = crosshairLogicalIndex !== null &&
    crosshairLogicalIndex >= range.from && crosshairLogicalIndex <= range.to
    ? crosshairLogicalIndex
    : (range.from + range.to) / 2;
  const anchorRatio = (anchor - range.from) / width;
  const from = anchor - nextWidth * anchorRatio;
  timeScale.setVisibleLogicalRange({ from, to: from + nextWidth });
  return true;
}

function handleChartKeyboard(event: KeyboardEvent): void {
  // Replay target control has higher priority than chart-local navigation.
  // RunChart is mounted only while Replay is active, so T works regardless
  // of whether Live or Snapshot currently owns chart-navigation keys.
  const isTargetShortcut = event.key.toLowerCase() === "t" && !event.ctrlKey &&
    !event.altKey && !event.metaKey && !event.shiftKey;
  if (
    isTargetShortcut &&
    !event.repeat &&
    !isInteractiveKeyboardTarget(event.target) &&
    !isInteractiveKeyboardTarget(document.activeElement)
  ) {
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
    return;
  }

  // ReplayWorkspace is the sole owner of chart-local keyboard routing.
  // Keep the previous local fallback for isolated component mounts / tests.
  if (props.keyboardActive === false) return;
  if (
    props.keyboardActive === undefined &&
    (!chartHost.value || (!chartHost.value.matches(":hover") && !chartHost.value.contains(document.activeElement)))
  ) return;

  // Vim normal-mode navigation aliases: h/ j/ k/ l behave exactly like the
  // corresponding arrow keys, without changing the existing chart commands.
  const key = ({ h: "ArrowLeft", j: "ArrowDown", k: "ArrowUp", l: "ArrowRight" } as const)[
    event.key as "h" | "j" | "k" | "l"
  ] ?? event.key;
  const isArrowKey = key === "ArrowUp" || key === "ArrowDown" ||
    key === "ArrowLeft" || key === "ArrowRight";
  const isFitShortcut = event.ctrlKey && !event.altKey && !event.metaKey &&
    !event.shiftKey && key === "0";
  const isBoundaryNavigation = event.ctrlKey && !event.altKey && !event.metaKey &&
    !event.shiftKey && (key === "ArrowLeft" || key === "ArrowRight");
  if (
    (event.repeat && !isArrowKey) ||
    event.altKey || event.metaKey || (event.ctrlKey && !isBoundaryNavigation && !isFitShortcut) ||
    (event.shiftKey && !isBoundaryNavigation) ||
    isInteractiveKeyboardTarget(event.target) ||
    isInteractiveKeyboardTarget(document.activeElement)
  ) return;

  if (chartError.value || projectionMessage.value || bars.value.length === 0) return;

  let handled = false;
  if (isFitShortcut) handled = fitContentShortcut();
  else if (isBoundaryNavigation) {
    handled = moveCrosshairTo(key === "ArrowLeft" ? 0 : bars.value.length - 1, true);
  } else if (key === "ArrowUp") handled = zoomTimeScale("in");
  else if (key === "ArrowDown") handled = zoomTimeScale("out");
  else if (key === "ArrowLeft") handled = moveCrosshairBy(-1);
  else if (key === "ArrowRight") handled = moveCrosshairBy(1);
  if (handled) event.preventDefault();
}

function toggleLayer(layer: keyof typeof layerVisibility.value): void {
  layerVisibility.value[layer] = !layerVisibility.value[layer];
  if (layer === "sbar" && candleSeries) {
    candleSeries.applyOptions?.({ visible: layerVisibility.value.sbar });
  }
  if (layer === "volume" && volumeSeries) {
    volumeSeries.applyOptions?.({ visible: layerVisibility.value.volume });
  }
  updateStructureOverlays();
}

function fitContent(): void {
  chart?.timeScale().fitContent();
}

function fitContentShortcut(): boolean {
  if (!chart || bars.value.length === 0) return false;
  fitContent();
  updateStructureOverlays();
  return true;
}

function syncStructurePrimitives(): void {
  const projection = { timeBySbarId, indexBySbarId };
  cbarPrimitive?.setData(props.structure?.cbars ?? [], projection);
  swingPrimitive?.setData(props.structure?.swings ?? [], projection);
  cbarPrimitive?.setVisible(layerVisibility.value.cbar);
  swingPrimitive?.setVisible(layerVisibility.value.swing);
  const cursorSbarId = props.runState?.cursorSbarId ?? null;
  const hoveredObjectValue = hoveredObject.value;
  const selectedObjectValue = props.selectedObject;
  const hovered = hoveredObjectValue &&
    hoveredObjectValue.checkpointSbarId === cursorSbarId &&
    (hoveredObjectValue.kind === "cbar" || hoveredObjectValue.kind === "swing")
    ? { kind: hoveredObjectValue.kind, id: hoveredObjectValue.id }
    : null;
  const selected = selectedObjectValue &&
    selectedObjectValue.checkpointSbarId === cursorSbarId &&
    (selectedObjectValue.kind === "cbar" || selectedObjectValue.kind === "swing")
    ? { kind: selectedObjectValue.kind, id: selectedObjectValue.id }
    : null;
  cbarPrimitive?.setInteractionState({
    hoveredId: hovered?.kind === "cbar" ? hovered.id : null,
    selectedId: selected?.kind === "cbar" ? selected.id : null,
    selectedColor: "#D6A85D",
    selectedWidth: 2,
  });
  swingPrimitive?.setInteractionState({
    hoveredId: hovered?.kind === "swing" ? hovered.id : null,
    selectedId: selected?.kind === "swing" ? selected.id : null,
    selectedColor: "#D6A85D",
    selectedWidth: 2.25,
  });
}

function updateStructureOverlays(): void {
  if (!chart || !candleSeries || typeof chart.timeScale().timeToCoordinate !== "function" || typeof candleSeries.priceToCoordinate !== "function") {
    selectedSbarMarker.value = null;
    hoveredSbarMarker.value = null;
    cbarRectangles.value = [];
    swingSegments.value = [];
    cbarPrimitive?.setData([], { timeBySbarId, indexBySbarId });
    swingPrimitive?.setData([], { timeBySbarId, indexBySbarId });
    targetSbarX.value = null;
    return;
  }
  const timeScale = chart.timeScale();
  // Clip the SVG overlay to the plot area so it cannot cover the right price scale.
  structureOverlayWidth.value = typeof timeScale.width === "function"
    ? timeScale.width()
    : chartHost.value?.clientWidth ?? 0;
  const structure = props.structure;
  const selected = props.selectedObject;
  if (layerVisibility.value.sbar && selected?.kind === "sbar" && ((selected.checkpointSbarId === null && !props.runState) || selected.checkpointSbarId === props.runState?.cursorSbarId)) {
    const selectedTime = timeBySbarId.get(selected.id);
    const selectedBar = bars.value.find((bar) => bar.sbarId === selected.id);
    const selectedX = selectedTime === undefined ? null : timeScale.timeToCoordinate(selectedTime);
    const selectedHigh = selectedBar ? candleSeries.priceToCoordinate(Number(selectedBar.high)) : null;
    const selectedLow = selectedBar ? candleSeries.priceToCoordinate(Number(selectedBar.low)) : null;
    if (selectedBar && selectedX !== null && selectedX !== undefined && selectedHigh !== null && selectedHigh !== undefined && selectedLow !== null && selectedLow !== undefined) {
      selectedSbarMarker.value = { id: selected.id, x: selectedX - 6, y: Math.min(selectedHigh, selectedLow), width: 12, height: Math.max(4, Math.abs(selectedLow - selectedHigh)) };
    } else selectedSbarMarker.value = null;
  } else selectedSbarMarker.value = null;
  const visibleRange = timeScale.getVisibleLogicalRange?.();
  const projectionRange = visibleRange && Number.isFinite(visibleRange.from) && Number.isFinite(visibleRange.to)
    ? { from: visibleRange.from, to: visibleRange.to }
    : null;
  cbarRectangles.value = layerVisibility.value.cbar
    ? projectCBarRectangles({
      cbars: structure?.cbars ?? [],
      indexBySbarId,
      visibleRange: projectionRange,
      coordinateForSbarId: (sbarId) => {
        const time = timeBySbarId.get(sbarId);
        return time === undefined ? null : timeScale.timeToCoordinate(time);
      },
      priceToCoordinate: (price) => candleSeries!.priceToCoordinate(price),
    })
    : [];
  swingSegments.value = layerVisibility.value.swing
    ? projectSwingSegments({
      swings: structure?.swings ?? [],
      indexBySbarId,
      visibleRange: projectionRange,
      coordinateForSbarId: (sbarId) => {
        const time = timeBySbarId.get(sbarId);
        return time === undefined ? null : timeScale.timeToCoordinate(time);
      },
      priceToCoordinate: (price) => candleSeries!.priceToCoordinate(price),
    }).map((segment) => {
      const style = swingStyleByState[segment.state] ?? { color: "#A0A7B0", dasharray: "4 3" };
      return { ...segment, color: style.color, dasharray: style.dasharray };
    })
    : [];
  cbarPrimitive?.setVisible(layerVisibility.value.cbar);
  swingPrimitive?.setVisible(layerVisibility.value.swing);
  const targetTime = props.targetSbarId ? timeBySbarId.get(props.targetSbarId) : undefined;
  const targetX = targetTime === undefined ? null : timeScale.timeToCoordinate(targetTime);
  targetSbarX.value = targetX !== null && targetX !== undefined && Number.isFinite(targetX)
    ? targetX
    : null;
  updateHoverMarker();
}

function markerForSbar(sbarId: string | null | undefined): SBarSelectionMarker | null {
  if (!chart || !candleSeries || !sbarId || !layerVisibility.value.sbar) return null;
  const index = bars.value.findIndex((bar) => bar.sbarId === sbarId);
  const bar = index >= 0 ? bars.value[index] : undefined;
  const timeScale = chart.timeScale();
  if (!bar || index < 0) return null;

  // Use Lightweight Charts' actual logical slot boundaries, which track wheel
  // zoom, range zoom, pan and resize without a pixel-width heuristic.
  const left = timeScale.logicalToCoordinate(index - 0.5);
  const right = timeScale.logicalToCoordinate(index + 0.5);
  const highY = candleSeries.priceToCoordinate(Number(bar.high));
  const lowY = candleSeries.priceToCoordinate(Number(bar.low));
  if ([left, right, highY, lowY].some((value) => value === null || value === undefined || !Number.isFinite(value))) return null;

  const x1 = Math.min(left as number, right as number);
  const x2 = Math.max(left as number, right as number);
  const top = Math.min(highY as number, lowY as number);
  const bottom = Math.max(highY as number, lowY as number);
  return { id: sbarId, x: x1, y: top, width: Math.max(1, x2 - x1), height: Math.max(1, bottom - top) };
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

function handleVisibleRangeChange(): void {
  scheduleOverlayUpdate();
  if (!props.syncEnabled || (props.syncOwner !== undefined && props.syncOwner !== "live") || !chart || bars.value.length === 0) return;
  const range = chart.timeScale().getVisibleLogicalRange();
  if (!range || !Number.isFinite(range.from) || !Number.isFinite(range.to)) return;

  // Coalesce high-frequency wheel/pan events; publish the latest fractional
  // viewport in the same frame as the overlay projection.
  pendingViewportRange = { from: range.from, to: range.to };
  scheduleOverlayUpdate();
}

function applyCrosshairSync(sync: ReplayChartCrosshairSync | null | undefined): void {
  if (!chart || !candleSeries || !props.syncEnabled) return;
  const command = resolveReplayCrosshairCommand(sync, bars.value, timeBySbarId, "live");
  if (command.kind === "ignore") return;
  if (command.kind === "clear") {
    // A peer clear may only remove a Crosshair that this adapter installed.
    // If local interaction already took ownership, preserve the local position.
    if (crosshairSyncGate.hasPeerPosition) {
      crosshairSyncGate.setPeerPositionActive(false);
      crosshairSyncGate.beginApply();
      chart.clearCrosshairPosition?.();
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
  chart.setCrosshairPosition?.(command.price, command.time, candleSeries);
}
function applySyncRequest(request: ReplayChartViewportSync | null | undefined): void {
  if (!request || request.source === "live" || !props.syncEnabled || !chart) return;
  const current = chart.timeScale().getVisibleLogicalRange();
  // Snapshot = Live + offset: the shared protocol owns the inverse transform.
  const target = translateReplayViewportRange(request, "reference-to-live");
  if (!target) return;
  if (current && isSameLogicalRange(current, target)) return;
  const { from, to } = target;
  chart.timeScale().setVisibleLogicalRange({ from, to });
}

const scheduleOverlayUpdate = createAnimationFrameCoalescer(() => {
  updateStructureOverlays();
  const latest = pendingViewportRange;
  pendingViewportRange = null;
  if (latest && props.syncEnabled && (props.syncOwner === undefined || props.syncOwner === "live") && chart) {
    emit("viewportChange", { source: "live", from: latest.from, to: latest.to });
  }
});

function hitTestStructureObject(x: number, y: number): { kind: "swing" | "cbar"; id: string } | null {
  if (!props.runState?.cursorSbarId) return null;
  const hit = resolveStructureHit({
    x,
    y,
    swings: swingSegments.value,
    cbars: cbarRectangles.value,
    swingVisible: layerVisibility.value.swing,
    cbarVisible: layerVisibility.value.cbar,
  });
  return hit ? { kind: hit.kind, id: hit.id } : null;
}

function hitTestSbar(x: number, y: number): string | null {
  if (!chart || !candleSeries || !layerVisibility.value.sbar || bars.value.length === 0) return null;
  const logical = chart.timeScale().coordinateToLogical?.(x);
  if (logical === null || logical === undefined || !Number.isFinite(logical)) return null;
  const index = Math.round(logical);
  const bar = bars.value[index];
  if (!bar) return null;
  const marker = markerForSbar(bar.sbarId);
  if (!marker) return null;
  const centerX = marker.x + marker.width / 2;
  if (Math.abs(x - centerX) > Math.max(3, marker.width / 2 + 1) ||
      y < marker.y - 5 || y > marker.y + marker.height + 5) return null;
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
  if (!point || !chart || !candleSeries || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    emit("crosshairChange", { source: "live", sbarId: null, price: null });
    return;
  }
  const logical = chart.timeScale().coordinateToLogical?.(point.x);
  const anchor = resolveSbarChartAnchor(bars.value, logical);
  const bar = anchor ? bars.value[anchor.index] : undefined;
  const price = candleSeries.coordinateToPrice(point.y);
  emit("crosshairChange", {
    source: "live",
    sbarId: bar?.sbarId ?? null,
    price: price !== null && price !== undefined && Number.isFinite(price) ? price : null,
  });
}

function handleChartMove(param: { point?: { x: number; y: number } | undefined }): void {
  publishCrosshair(param);
  const x = param.point?.x;
  // A leave event clears hover, but retains the last logical crosshair anchor
  // so T still targets the position the user was inspecting.
  if (typeof x === "number") {
    const logical = chart?.timeScale().coordinateToLogical?.(x);
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
  if (!chart || chartError.value || typeof x !== "number" || typeof y !== "number" || !Number.isFinite(x) || !Number.isFinite(y)) return;
  const structureHit = hitTestStructureObject(x, y);
  const checkpointSbarId = props.runState?.cursorSbarId;
  if (structureHit && checkpointSbarId) {
    emit("objectSelect", { ...structureHit, checkpointSbarId });
    return;
  }
  const logical = chart.timeScale().coordinateToLogical?.(x);
  if (logical === null || logical === undefined || !Number.isFinite(logical)) return;
  const index = Math.round(logical);
  const bar = bars.value[index];
  if (!bar) return;
  emit("objectSelect", { kind: "sbar", id: bar.sbarId, checkpointSbarId: checkpointSbarId ?? null });
}

function handleChartDoubleClick(event: MouseEvent): void {
  // Restart targeting is a chart-area gesture, not an OHLC hit test. Resolve
  // the same horizontal coordinate used by the crosshair against the Test
  // Dataset's logical SBar sequence; Y position and visible layer state do
  // not affect which SBar is targeted.
  const target = event.target;
  if (
    !chart ||
    chartError.value ||
    !(target instanceof Element) ||
    target.closest(".run-chart-legend, button, .run-chart-heading")
  ) return;
  const hostLeft = chartHost.value?.getBoundingClientRect().left ?? 0;
  const x = event.clientX - hostLeft;
  if (!Number.isFinite(x)) return;
  const logical = chart.timeScale().coordinateToLogical?.(x);
  if (logical === null || logical === undefined || !Number.isFinite(logical)) return;
  const bar = barAtLogicalIndex(logical);
  if (!bar) return;
  emit("targetSelect", bar.sbarId);
}

function handleContextMenu(event: MouseEvent): void {
  if (!props.targetSbarId) return;
  event.preventDefault();
  event.stopPropagation();
  emit("targetCancel");
}

function updateChart(): void {
  if (!chart || !candleSeries || !volumeSeries) return;
  try {
    if (projectionMessage.value) {
      candleSeries.setData([]);
      volumeSeries.setData([]);
      timeBySbarId = new Map();
      indexBySbarId = new Map();
      cachedProjection = null;
      lastProcessedCount = null;
      lastRunId = props.runState?.runId ?? null;
      lastProgressApplies = replayProgressApplies.value;
      selectedSbarMarker.value = null;
      cbarRectangles.value = [];
      swingSegments.value = [];
      cbarPrimitive?.setData([], { timeBySbarId, indexBySbarId });
      swingPrimitive?.setData([], { timeBySbarId, indexBySbarId });
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
    indexBySbarId = chartIndex.indexBySbarId;
    const candles = projection.candles.map((candle, index) => {
      const base = layerVisibility.value.sbar ? candle : { ...candle, color: "rgba(0,0,0,0)", borderColor: "rgba(0,0,0,0)", wickColor: "rgba(0,0,0,0)" };
      if (!replayProgressApplies.value || index < processedCount) return base;
      return {
        ...base,
        color: layerVisibility.value.sbar ? "#454b53" : "rgba(0,0,0,0)",
        borderColor: layerVisibility.value.sbar ? "#454b53" : "rgba(0,0,0,0)",
        wickColor: layerVisibility.value.sbar ? "#454b53" : "rgba(0,0,0,0)",
      };
    });
    const volume = projection.volume.map((bar, index) =>
      !layerVisibility.value.volume
        ? { ...bar, color: "rgba(0,0,0,0)" }
        : replayProgressApplies.value && index >= processedCount
          ? { ...bar, color: "#454b53" }
          : bar,
    );
    candleSeries.setData(candles);
    volumeSeries.setData(volume);
    syncStructurePrimitives();
    lastProcessedCount = processedCount;
    lastRunId = props.runState?.runId ?? null;
    lastProgressApplies = replayProgressApplies.value;
    chartError.value = "";
    updateStructureOverlays();
    if (props.testDataset && fittedTestDatasetId !== props.testDataset.testDatasetId) {
      chart.timeScale().fitContent();
      chart.timeScale().setVisibleLogicalRange({
        from: -0.5,
        to: projection.candles.length + 3.5,
      });
      fittedTestDatasetId = props.testDataset.testDatasetId;
    }
    applyCrosshairSync(props.crosshairSync);
  } catch (error) {
    candleSeries.setData([]);
    volumeSeries.setData([]);
    cachedProjection = null;
    lastProcessedCount = null;
    lastRunId = props.runState?.runId ?? null;
    lastProgressApplies = replayProgressApplies.value;
    selectedSbarMarker.value = null;
    cbarRectangles.value = [];
    swingSegments.value = [];
    cbarPrimitive?.setData([], { timeBySbarId, indexBySbarId });
    swingPrimitive?.setData([], { timeBySbarId, indexBySbarId });
    targetSbarX.value = null;
    chartError.value = error instanceof Error ? error.message : String(error);
  }
}

function updateProgressSeries(): void {
  if (!chart || !candleSeries || !volumeSeries || projectionMessage.value) return;
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
    const candleUpdate = layerVisibility.value.sbar
      ? candle
      : { ...candle, color: "rgba(0,0,0,0)", borderColor: "rgba(0,0,0,0)", wickColor: "rgba(0,0,0,0)" };
    const volumeUpdate = layerVisibility.value.volume
      ? volume
      : { ...volume, color: "rgba(0,0,0,0)" };

    // lightweight-charts v5 supports historical updates. Future candles are
    // already present as dimmed points, so promote only the newly confirmed
    // SBar and volume bar instead of replacing the complete historical series.
    candleSeries.update(candleUpdate, true);
    volumeSeries.update(volumeUpdate, true);
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
  if (!chartHost.value) return;
  const runtime = createSbarChartRuntime(chartHost.value, {
    width: Math.max(1, Math.floor(chartHost.value.clientWidth)),
    height: Math.max(1, Math.floor(chartHost.value.clientHeight)),
    candleLastValueVisible: false,
  });
  chart = runtime.chart;
  candleSeries = runtime.candleSeries;
  volumeSeries = runtime.volumeSeries;
  primitiveHost = runtime.primitiveHost;
  cbarPrimitive = registerCBarPrimitive(runtime.primitiveHost, runtime.candleSeries);
  swingPrimitive = registerSwingPrimitive(runtime.primitiveHost, runtime.candleSeries);
  const timeScale = chart.timeScale();
  if (typeof chart.subscribeClick === "function") {
    chartClickListener = handleChartClick;
    chart.subscribeClick(chartClickListener);
  }
  if (typeof chart.subscribeCrosshairMove === "function") {
    chartMoveListener = handleChartMove;
    chart.subscribeCrosshairMove(chartMoveListener);
  }
  if (typeof timeScale.subscribeVisibleLogicalRangeChange === "function") {
    timeScale.subscribeVisibleLogicalRangeChange(handleVisibleRangeChange);
    visibleRangeListener = () => timeScale.unsubscribeVisibleLogicalRangeChange?.(handleVisibleRangeChange);
  }
  stopObservingResize = observeSbarChartResize(chartHost.value, chart, () => {
    scheduleOverlayUpdate();
  });
  updateChart();
  if (props.syncEnabled) {
    // The syncRequest watcher may run before the chart instance exists on
    // initial mount. Apply the initial peer command after chart setup, and do
    // not sample that peer-controlled viewport as a local Live gesture.
    if (props.syncRequest?.source === "reference") {
      applySyncRequest(props.syncRequest);
    } else {
      handleVisibleRangeChange();
    }
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
watch(() => props.runState?.cursorSbarId, () => updateHoveredObject(undefined));
watch(() => props.crosshairSync, (sync) => {
  if (!props.syncEnabled || !sync) {
    if (crosshairSyncGate.hasPeerPosition) {
      crosshairSyncGate.setPeerPositionActive(false);
      // Clearing a peer-installed position is still a programmatic chart
      // mutation. Suppress its synchronous Crosshair callback so it cannot
      // be re-published as a fresh local command during identity invalidation.
      crosshairSyncGate.beginApply();
      chart?.clearCrosshairPosition?.();
    }
    return;
  }
  applyCrosshairSync(sync);
}, { deep: true });
watch(() => props.syncEnabled, (enabled) => {
  if (!enabled && crosshairSyncGate.hasPeerPosition) {
    crosshairSyncGate.setPeerPositionActive(false);
    crosshairSyncGate.beginApply();
    chart?.clearCrosshairPosition?.();
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
watch(() => [layerVisibility.value.sbar, layerVisibility.value.cbar, layerVisibility.value.swing] as const, () => updateHoveredObject(undefined));

onBeforeUnmount(() => {
  document.removeEventListener("keydown", handleChartKeyboard);
  crosshairLogicalIndex = null;
  if (crosshairUpdateFrame !== null) {
    cancelAnimationFrame(crosshairUpdateFrame);
    crosshairUpdateFrame = null;
  }
  visibleRangeListener?.();
  visibleRangeListener = null;
  if (chart && chartClickListener) chart.unsubscribeClick?.(chartClickListener);
  if (chart && chartMoveListener) chart.unsubscribeCrosshairMove?.(chartMoveListener);
  chartClickListener = null;
  chartMoveListener = null;
  hoveredObject.value = null;
  hoveredSbarMarker.value = null;
  stopObservingResize?.();
  stopObservingResize = null;
  scheduleOverlayUpdate.cancel();
  pendingViewportRange = null;
  crosshairSyncGate.clear();
  primitiveHost?.dispose();
  primitiveHost = null;
  cbarPrimitive = null;
  swingPrimitive = null;
  chart?.remove();
  chart = null;
  candleSeries = null;
  volumeSeries = null;
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
      <div ref="chartHost" class="run-chart-host" :class="{ 'is-empty': Boolean(projectionMessage) }" data-testid="run-chart-canvas"
        :aria-label="`Candlestick and volume chart for Test Dataset ${testDataset?.testDatasetId ?? 'not selected'}`"></div>
      <svg v-if="!projectionMessage" class="run-structure-overlay" :style="{ width: `${structureOverlayWidth}px` }" data-testid="run-structure-overlay" aria-hidden="true">
        <g v-if="targetSbarId && targetSbarX !== null" data-testid="restart-to-sbar-target" :data-target-sbar-id="targetSbarId">
          <line :x1="targetSbarX" y1="0" :x2="targetSbarX" y2="100%" stroke="#C6A06B" stroke-width="1.25" stroke-dasharray="5 4" />
          <text :x="targetSbarX + 5" y="13" fill="#C6A06B" font-size="9" font-weight="600" letter-spacing="1">TARGET</text>
          <circle :cx="targetSbarX" cy="98%" r="3" fill="#C6A06B" />
        </g>
        <rect v-if="hoveredSbarMarker" :x="hoveredSbarMarker.x" :y="hoveredSbarMarker.y" :width="hoveredSbarMarker.width" :height="hoveredSbarMarker.height" fill="none" stroke="#C3CBD1" stroke-width="1.25" data-testid="run-hover-sbar" :data-sbar-id="hoveredSbarMarker.id" />
        <rect v-if="selectedSbarMarker" :x="selectedSbarMarker.x" :y="selectedSbarMarker.y" :width="selectedSbarMarker.width" :height="selectedSbarMarker.height" fill="none" stroke="#D6A85D" stroke-width="1.5" data-testid="run-selected-sbar" :data-sbar-id="selectedSbarMarker.id" />
         <line v-for="segment in swingSegments" :key="segment.id" :x1="segment.x1" :y1="segment.y1" :x2="segment.x2" :y2="segment.y2" :stroke="segment.color" stroke-width="1.25" :stroke-dasharray="segment.dasharray || undefined" stroke-linecap="round" visibility="hidden" data-testid="run-swing-segment" :data-swing-id="segment.id" :data-swing-state="segment.state" />
         <rect v-for="rectangle in cbarRectangles" :key="rectangle.id" :x="rectangle.x" :y="rectangle.y" :width="rectangle.width" :height="rectangle.height" fill="none" visibility="hidden" stroke="#A0A7B0" stroke-width="1" data-testid="run-cbar-rectangle" :data-cbar-id="rectangle.id" />
      </svg>
      <div v-if="hoveredObject" class="origin-object-hover-label" data-testid="run-object-hover-label" aria-live="off">{{ hoveredObject.kind.toUpperCase() }} · {{ hoveredObject.id }}</div>
      <div v-if="!projectionMessage" class="run-chart-legend" role="group" aria-label="Chart layer visibility">
        <button type="button" class="origin-chart-legend-item" :class="{ active: layerVisibility.sbar }" :aria-pressed="layerVisibility.sbar" data-testid="run-layer-toggle-sbar" @click="toggleLayer('sbar')"><i class="legend-dot sbar-dot"></i>SBar</button>
        <button type="button" class="origin-chart-legend-item" :class="{ active: layerVisibility.cbar }" :aria-pressed="layerVisibility.cbar" :disabled="!structure || structure.cbars.length === 0" data-testid="run-layer-toggle-cbar" @click="toggleLayer('cbar')"><i class="legend-dot cbar-dot"></i>CBar</button>
        <button type="button" class="origin-chart-legend-item" :class="{ active: layerVisibility.swing }" :aria-pressed="layerVisibility.swing" :disabled="!structure || structure.swings.length === 0" data-testid="run-layer-toggle-swing" @click="toggleLayer('swing')"><i class="legend-dot swing-dot"></i>Swing</button>
        <button type="button" class="origin-chart-legend-item" :class="{ active: layerVisibility.volume }" :aria-pressed="layerVisibility.volume" data-testid="run-layer-toggle-volume" @click="toggleLayer('volume')"><i class="legend-dot volume-dot"></i>Volume</button>
      </div>
    </div>

  </section>
</template>
