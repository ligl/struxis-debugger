<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { invoke, isTauri } from "@tauri-apps/api/core";
import WorkbenchTopbar from "./components/WorkbenchTopbar.vue";
import WorkspaceToolbar from "./components/WorkspaceToolbar.vue";
import CompareToolbarControls from "./components/CompareToolbarControls.vue";
import CompareSummary from "./components/CompareSummary.vue";
import CatalogPanel from "./components/CatalogPanel.vue";
import OriginChart from "./components/OriginChart.vue";
import RunChart from "./components/RunChart.vue";
import DualChartStack from "./components/DualChartStack.vue";
import SnapshotReferencePanel from "./components/SnapshotReferencePanel.vue";
import ComparisonChartPlaceholder from "./components/ComparisonChartPlaceholder.vue";
import TestDatasetPanel from "./components/TestDatasetPanel.vue";
import SnapshotPanel from "./components/SnapshotPanel.vue";
import ObjectInspector from "./components/ObjectInspector.vue";
import type { ObjectDifferenceDto, OriginObjectSelection, ReplayInspectorCBarDto, ReplayInspectorSwingDto, SnapshotArtifactDto } from "./origin-types";
import type { RunCommand } from "./run-command-eligibility";
import { isRunCommandEligible } from "./run-command-eligibility";
import { useSnapshots } from "./composables/useSnapshots";
import { useOriginLoad } from "./composables/useOriginLoad";
import { useTestDataset } from "./composables/useTestDataset";
import { useRunControl } from "./composables/useRunControl";
import { useCatalogGroups } from "./composables/useCatalogGroups";
import { resolveOriginRangeClick } from "./origin-range-selection";
import { getReplayInspector } from "./origin-bridge";
import type { ReplayInspectorDto } from "./origin-types";
import { formatDomainTimestamp, formatLifecycleTimestamp } from "./timestamp-format";

const devtoolsContextMenu = ref({ visible: false, x: 0, y: 0 });
const devtoolsAvailable = import.meta.env.DEV;

function handleContextMenu(event: MouseEvent) {
  // Check Tauri at event time rather than module initialization. The native
  // bridge may not be detectable yet when this module is first evaluated.
  if (!devtoolsAvailable || !isTauri()) return;
  event.preventDefault();
  devtoolsContextMenu.value = {
    visible: true,
    x: Math.min(event.clientX, window.innerWidth - 190),
    y: Math.min(event.clientY, window.innerHeight - 82),
  };
}

function dismissDevtoolsContextMenu() {
  devtoolsContextMenu.value.visible = false;
}

async function openDevtoolsFromContextMenu() {
  dismissDevtoolsContextMenu();
  await invoke("open_devtools");
}

function refreshPageFromContextMenu() {
  dismissDevtoolsContextMenu();
  window.location.reload();
}

const {
  datasets,
  selectedId,
  enableStructure,
  loading,
  loadStatus,
  loadError,
  discoveryError,
  origin,
  refreshing,
  selectedDataset,
  refreshDatasets,
  refreshCurrentOrigin,
  startLoad: loadSelectedOrigin,
} = useOriginLoad();

const {
  snapshots,
  snapshotsLoading,
  snapshotsError,
  compareResult,
  compareLoading,
  compareError,
  runCompare,
  refreshSnapshots,
} = useSnapshots();

const {
  runState,
  runBusy,
  runError,
  refreshRunState,
  executeRunCommand,
} = useRunControl(refreshSnapshots);

const canMutateTest = computed(
  () => !loading.value && !runBusy.value &&
    (!runState.value || runState.value.status === "disposed"),
);

const {
  testDataset,
  startSbarId,
  endSbarId,
  testLoading,
  testError,
  testStatus,
  refreshCurrentTestDataset,
  prepareForOrigin,
  createTestDataset,
} = useTestDataset(origin, canMutateTest);
const canLoadOrigin = computed(
  () => canMutateTest.value && !testLoading.value,
);

const selectedInspectorObject = ref<OriginObjectSelection | null>(null);
const replayInspector = ref<ReplayInspectorDto | null>(null);
const replayInspectorError = ref("");
let replayInspectorLoading = false;
const selectedCompareDifferenceKey = ref<string | null>(null);

async function refreshReplayInspector(): Promise<void> {
  if (!runState.value) {
    replayInspector.value = null;
    replayInspectorError.value = "";
    return;
  }
  if (replayInspectorLoading) return;
  replayInspectorLoading = true;
  replayInspectorError.value = "";
  try {
    replayInspector.value = await getReplayInspector();
  } catch (error) {
    replayInspectorError.value = error instanceof Error ? error.message : String(error);
  } finally {
    replayInspectorLoading = false;
  }
}

function compareDifferenceKey(difference: ObjectDifferenceDto): string {
  return [difference.checkpointIndex, difference.sbarId, difference.objectType, difference.objectId, difference.kind].join("|");
}

const selectedCompareDifference = computed(() => {
  const key = selectedCompareDifferenceKey.value;
  if (!key || !compareResult.value) return null;
  return compareResult.value.differences.find((difference) => compareDifferenceKey(difference) === key) ?? null;
});

function selectCompareDifference(difference: ObjectDifferenceDto): void {
  selectedCompareDifferenceKey.value = compareDifferenceKey(difference);
}

watch(compareResult, () => {
  selectedCompareDifferenceKey.value = null;
});

const selectedInspectorSbar = computed(() => {
  const selection = selectedInspectorObject.value;
  if (selection?.kind !== "sbar") return null;
  return origin.value?.bars.find((bar) => bar.sbarId === selection.id) ?? null;
});

const selectedInspectorCbar = computed<ReplayInspectorCBarDto | null>(() => {
  const selection = selectedInspectorObject.value;
  if (selection?.kind !== "cbar") return null;
  return origin.value?.structure?.cbars.find((cbar) => cbar.cbarId === selection.id) ?? null;
});

const selectedInspectorSwing = computed<ReplayInspectorSwingDto | null>(() => {
  const selection = selectedInspectorObject.value;
  if (selection?.kind !== "swing") return null;
  return origin.value?.structure?.swings.find((swing) => swing.swingId === selection.id) ?? null;
});

function handleOriginObjectClick(selection: Extract<OriginObjectSelection, { kind: "cbar" | "swing" }>): void {
  if (!origin.value || selection.originDatasetId !== origin.value.originDatasetId) return;
  const exists = selection.kind === "cbar"
    ? origin.value.structure?.cbars.some((cbar) => cbar.cbarId === selection.id)
    : origin.value.structure?.swings.some((swing) => swing.swingId === selection.id);
  if (!exists) return;
  selectedInspectorObject.value = selection;
}

const rangeSelectionPendingStart = ref<string | null>(null);
const rangeSelectionReady = ref(false);
const selectedRangeCount = ref(0);
const rangeSelectionStatus = ref(
  "Click anywhere in the chart plot to select the start time of your Test interval.",
);

function handleOriginSbarClick(sbarId: string): void {
  if (!origin.value) return;
  if (origin.value.bars.some((bar) => bar.sbarId === sbarId)) {
    selectedInspectorObject.value = { kind: "sbar", id: sbarId, originDatasetId: origin.value.originDatasetId };
  }
  // Inspection remains available when mutation is blocked; range selection
  // still obeys the existing Origin/Test Dataset/Run lifecycle guard.
  if (!canMutateTest.value || testLoading.value) return;
  const result = resolveOriginRangeClick(
    origin.value.bars,
    rangeSelectionPendingStart.value,
    sbarId,
  );

  if (result.kind === "invalid") {
    rangeSelectionStatus.value = result.message;
    return;
  }

  if (result.kind === "start") {
    rangeSelectionPendingStart.value = result.sbarId;
    startSbarId.value = result.sbarId;
    endSbarId.value = "";
    rangeSelectionReady.value = false;
    selectedRangeCount.value = 0;
    rangeSelectionStatus.value =
      `Start SBar selected: ${result.sbarId}. Move the pointer to preview the range, then click to fix the inclusive end boundary.`;
    return;
  }

  startSbarId.value = result.startSbarId;
  endSbarId.value = result.endSbarId;
  rangeSelectionPendingStart.value = null;
  rangeSelectionReady.value = true;
  selectedRangeCount.value = result.count;
  rangeSelectionStatus.value =
    `Selected ${result.count.toLocaleString()} SBars: ${result.startSbarId} → ${result.endSbarId} (inclusive).`;
}

function handleOriginBoundaryChange(edge: "start" | "end", sbarId: string): void {
  if (!origin.value || !canMutateTest.value || testLoading.value || !rangeSelectionReady.value) return;
  const bars = origin.value.bars;
  const nextIndex = bars.findIndex((bar) => bar.sbarId === sbarId);
  const currentStartIndex = bars.findIndex((bar) => bar.sbarId === startSbarId.value);
  const currentEndIndex = bars.findIndex((bar) => bar.sbarId === endSbarId.value);
  if (nextIndex < 0 || currentStartIndex < 0 || currentEndIndex < 0) {
    rangeSelectionStatus.value = "The dragged boundary is not part of the current Origin. The interval was not changed.";
    return;
  }

  if (edge === "start") {
    if (nextIndex > currentEndIndex) return;
    startSbarId.value = sbarId;
  } else {
    if (nextIndex < currentStartIndex) return;
    endSbarId.value = sbarId;
  }

  const startIndex = edge === "start" ? nextIndex : currentStartIndex;
  const endIndex = edge === "end" ? nextIndex : currentEndIndex;
  selectedRangeCount.value = endIndex - startIndex + 1;
  rangeSelectionPendingStart.value = null;
  rangeSelectionReady.value = true;
  rangeSelectionStatus.value =
    `Adjusted inclusive interval: ${startSbarId.value} → ${endSbarId.value} (${selectedRangeCount.value.toLocaleString()} SBars).`;
}

function handleOriginSelectionError(message: string): void {
  rangeSelectionStatus.value = message;
}

function cancelOriginRangeSelection(): void {
  rangeSelectionPendingStart.value = null;
  rangeSelectionReady.value = false;
  startSbarId.value = "";
  endSbarId.value = "";
  selectedRangeCount.value = 0;
  rangeSelectionStatus.value =
    "Range selection cancelled. Click the chart to choose a new start SBar.";
}

async function createSelectedTestDataset(): Promise<void> {
  if (!rangeSelectionReady.value) return;
  await createTestDataset();
}
const canStartRun = computed(
  () => Boolean(testDataset.value) && !loading.value && !testLoading.value &&
    !runState.value && !runBusy.value,
);
const canRestartRun = computed(
  () => Boolean(testDataset.value) && !loading.value && !testLoading.value &&
    Boolean(runState.value) && runState.value?.status !== "running" &&
    !runBusy.value,
);
const replayToolbarContext = computed(() => {
  const test = testDataset.value;
  if (!test) return "NO TEST DATASET · CREATE AN INCLUSIVE INTERVAL";
  return `${test.instrumentId} · ${test.timeframe} · ${test.sbarCount.toLocaleString()} SBARS · ${test.startSbarId} → ${test.endSbarId}`;
});

const { instrumentGroups } = useCatalogGroups(datasets);

// Layout-only state: changing workspace or panel visibility never mutates domain state.
type WorkspaceMode = "dataset" | "replay" | "compare";
const workspaceMode = ref<WorkspaceMode>("dataset");
const replayReferenceSnapshots = computed(() =>
  snapshots.value.filter((snapshot) => snapshot.kind === "complete" && snapshot.snapshotId !== null),
);
const selectedReplayReferenceSnapshotId = ref<string | null>(null);
watch(replayReferenceSnapshots, (available) => {
  if (!available.some((snapshot) => snapshot.snapshotId === selectedReplayReferenceSnapshotId.value)) {
    selectedReplayReferenceSnapshotId.value = null;
  }
});
watch(workspaceMode, (mode) => {
  selectedInspectorObject.value = null;
  if (mode !== "compare") selectedCompareDifferenceKey.value = null;
  if (mode === "replay") void refreshReplayInspector();
});
const inspectorCollapsed = ref(false);
const diagnosticsCollapsed = ref(true);
const diagnosticsCategory = ref("all");

function handleDiagnosticsHeadingClick(): void {
  if (diagnosticsCollapsed.value && (diagnosticsDock.value === "left" || diagnosticsDock.value === "right")) {
    diagnosticsCollapsed.value = false;
  }
}
type DockDirection = "left" | "right" | "top" | "bottom";
const inspectorDock = ref<DockDirection>("right");
const diagnosticsDock = ref<DockDirection>("bottom");

// Dock dimensions are presentation state only; they never affect Struxis state.
const inspectorWidth = ref(282);
const inspectorHeight = ref(145);
const diagnosticsWidth = ref(330);
const diagnosticsHeight = ref(164);
let runPollInterval: number | null = null;
type PanelResizeTarget = "inspector" | "diagnostics" | null;
const panelResizeTarget = ref<PanelResizeTarget>(null);
let panelResizeStart = 0;
let panelResizeInitialSize = 0;

function startPanelResize(target: Exclude<PanelResizeTarget, null>, event: PointerEvent): void {
  if (event.button !== 0) return;
  panelResizeTarget.value = target;
  const dock = target === "inspector" ? inspectorDock.value : diagnosticsDock.value;
  panelResizeStart = dock === "left" || dock === "right" ? event.clientX : event.clientY;
  panelResizeInitialSize = target === "inspector"
    ? (dock === "left" || dock === "right" ? inspectorWidth.value : inspectorHeight.value)
    : (dock === "left" || dock === "right" ? diagnosticsWidth.value : diagnosticsHeight.value);
  event.preventDefault();
}

type DockAxis = "horizontal" | "vertical";

function workbenchExtent(axis: DockAxis): number {
  const workbench = document.querySelector<HTMLElement>('[data-testid="workbench"]');
  const measured = axis === "horizontal" ? workbench?.clientWidth : workbench?.clientHeight;
  return measured && measured > 0
    ? measured
    : axis === "horizontal" ? window.innerWidth : window.innerHeight;
}

function peerDockReservation(target: Exclude<PanelResizeTarget, null>, axis: DockAxis): number {
  const peerDirection = target === "inspector" ? diagnosticsDock.value : inspectorDock.value;
  const peerUsesAxis = axis === "horizontal"
    ? peerDirection === "left" || peerDirection === "right"
    : peerDirection === "top" || peerDirection === "bottom";
  if (!peerUsesAxis) return 0;

  if (target === "inspector") {
    if (diagnosticsCollapsed.value) return 36;
    return axis === "horizontal" ? diagnosticsWidth.value : diagnosticsHeight.value;
  }

  // A collapsed Inspector still reserves its narrow reopen rail.
  if (inspectorCollapsed.value) return 36;
  return axis === "horizontal" ? inspectorWidth.value : inspectorHeight.value;
}

function dockSizeLimit(target: Exclude<PanelResizeTarget, null>, axis: DockAxis): number {
  const minimum = axis === "horizontal" ? 180 : 100;
  const chartMinimum = axis === "horizontal" ? 320 : 180;
  const configuredMaximum = axis === "horizontal"
    ? Math.min(520, window.innerWidth * 0.5)
    : Math.min(480, window.innerHeight * 0.55);
  // The prototype keeps a 5px optical inset between the dock edge and Chart Workspace.
  // Reserve that inset too, otherwise two maximum vertical docks leave only 175px
  // of usable chart height despite the 180px minimum contract.
  const layoutInset = 5;
  const available = workbenchExtent(axis) - peerDockReservation(target, axis) - chartMinimum - layoutInset;
  // Preserve a usable workspace when possible; on exceptionally small windows,
  // the minimum panel size remains the hard floor and responsive layout takes over.
  return Math.max(minimum, Math.min(configuredMaximum, available));
}

function inspectorWidthLimit(): number { return dockSizeLimit("inspector", "horizontal"); }
function inspectorHeightLimit(): number { return dockSizeLimit("inspector", "vertical"); }
function diagnosticsWidthLimit(): number { return dockSizeLimit("diagnostics", "horizontal"); }
function diagnosticsHeightLimit(): number { return dockSizeLimit("diagnostics", "vertical"); }

function dockFor(target: Exclude<PanelResizeTarget, null>): DockDirection {
  return target === "inspector" ? inspectorDock.value : diagnosticsDock.value;
}

function resizeIsHorizontal(target: Exclude<PanelResizeTarget, null>): boolean {
  const dock = dockFor(target);
  return dock === "left" || dock === "right";
}

function resizeValue(target: Exclude<PanelResizeTarget, null>, value: number): void {
  const dock = dockFor(target);
  const horizontal = dock === "left" || dock === "right";
  if (target === "inspector") {
    if (horizontal) inspectorWidth.value = value;
    else inspectorHeight.value = value;
  } else {
    if (horizontal) diagnosticsWidth.value = value;
    else diagnosticsHeight.value = value;
  }
}

function resizeLimit(target: Exclude<PanelResizeTarget, null>): number {
  return target === "inspector"
    ? (resizeIsHorizontal(target) ? inspectorWidthLimit() : inspectorHeightLimit())
    : (resizeIsHorizontal(target) ? diagnosticsWidthLimit() : diagnosticsHeightLimit());
}

function resizeMinimum(target: Exclude<PanelResizeTarget, null>): number {
  return resizeIsHorizontal(target) ? 180 : 100;
}

function handlePanelResize(event: PointerEvent): void {
  const target = panelResizeTarget.value;
  if (!target) return;
  const dock = dockFor(target);
  const horizontal = dock === "left" || dock === "right";
  const coordinate = horizontal ? event.clientX : event.clientY;
  const growsTowardPositive = dock === "left" || dock === "top";
  const delta = growsTowardPositive ? coordinate - panelResizeStart : panelResizeStart - coordinate;
  const value = Math.max(resizeMinimum(target), Math.min(resizeLimit(target), panelResizeInitialSize + delta));
  resizeValue(target, value);
}

function handlePanelResizeKey(target: Exclude<PanelResizeTarget, null>, event: KeyboardEvent): void {
  const dock = dockFor(target);
  const horizontal = dock === "left" || dock === "right";
  const positiveKey = horizontal ? "ArrowRight" : "ArrowDown";
  const negativeKey = horizontal ? "ArrowLeft" : "ArrowUp";
  const increase = dock === "left" || dock === "top"
    ? event.key === positiveKey
    : event.key === negativeKey;
  const decrease = dock === "left" || dock === "top"
    ? event.key === negativeKey
    : event.key === positiveKey;
  if (!increase && !decrease && event.key !== "Home" && event.key !== "End") return;
  event.preventDefault();
  const minimum = resizeMinimum(target);
  const maximum = resizeLimit(target);
  const current = target === "inspector"
    ? (horizontal ? inspectorWidth.value : inspectorHeight.value)
    : (horizontal ? diagnosticsWidth.value : diagnosticsHeight.value);
  resizeValue(target, event.key === "Home"
    ? minimum
    : event.key === "End"
      ? maximum
      : Math.max(minimum, Math.min(maximum, current + (increase ? 12 : -12))));
}

function stopPanelResize(): void {
  panelResizeTarget.value = null;
}

type DockDragTarget = "inspector" | "diagnostics";
const dockDragMime = "application/x-struxis-debugger-panel";

function startDockDrag(target: DockDragTarget, event: DragEvent): void {
  if (!event.dataTransfer) return;
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData(dockDragMime, target);
}

function allowDockDrop(event: DragEvent): void {
  if (!event.dataTransfer) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
}

function dropDockPanel(event: DragEvent): void {
  const transfer = event.dataTransfer;
  if (!transfer) return;
  const target = transfer.getData(dockDragMime);
  if (target !== "inspector" && target !== "diagnostics") return;
  event.preventDefault();
  const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect();
  const x = (event.clientX - bounds.left) / Math.max(1, bounds.width);
  const y = (event.clientY - bounds.top) / Math.max(1, bounds.height);
  let dock: DockDirection | null = null;
  if (x < 0.13) dock = "left";
  else if (x > 0.87) dock = "right";
  else if (y < 0.16) dock = "top";
  else if (y > 0.84) dock = "bottom";
  if (!dock) return;
  if (target === "inspector") inspectorDock.value = dock;
  else diagnosticsDock.value = dock;
}

// A successful user Load owns the Origin → Test Dataset handoff. Startup must
// not launch a later refresh that could supersede a Test Dataset created meanwhile.
let originHandoffDuringStartup = false;

async function handleRunCommand(command: RunCommand): Promise<void> {
  if (!isRunCommandEligible(
    command,
    runState.value?.status ?? null,
    runBusy.value,
    canStartRun.value,
    canRestartRun.value,
  )) return;

  await executeRunCommand(command);
  await refreshReplayInspector();
}

async function startLoad(): Promise<void> {
  if (!canLoadOrigin.value) return;
  await loadSelectedOrigin(async (loadedOrigin) => {
    originHandoffDuringStartup = true;
    selectedInspectorObject.value = null;
    rangeSelectionPendingStart.value = null;
    rangeSelectionReady.value = false;
    selectedRangeCount.value = 0;
    rangeSelectionStatus.value = "Click anywhere in the chart plot to select the start time of your Test interval.";
    // Keep cross-domain handoff in the page composition root.
    prepareForOrigin(loadedOrigin);
    await refreshCurrentTestDataset();
  });
}

function isInteractiveKeyboardTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return target.closest(
    [
      "input",
      "textarea",
      "select",
      "button",
      "a[href]",
      "summary",
      "[contenteditable]:not([contenteditable='false'])",
      "[role='button']",
      "[role='link']",
      "[role='checkbox']",
      "[role='radio']",
      "[role='switch']",
      "[role='tab']",
      "[role='menuitem']",
      "[role='slider']",
      "[role='spinbutton']",
      "[role='textbox']",
      "[role='combobox']",
      "[tabindex]:not([tabindex='-1'])",
    ].join(","),
  ) !== null;
}

function handleReplayShortcut(event: KeyboardEvent): void {
  if (event.code !== "Space" || event.repeat) return;
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
  if (
    isInteractiveKeyboardTarget(event.target) ||
    isInteractiveKeyboardTarget(document.activeElement) ||
    runBusy.value
  ) return;

  const status = runState.value?.status;
  const command = status === "running"
    ? "pause"
    : status === "paused"
      ? "play"
      : null;
  if (!command) return;

  event.preventDefault();
  void handleRunCommand(command);
}

function snapshotKindLabel(kind: SnapshotArtifactDto["kind"]): string {
  const labels: Record<SnapshotArtifactDto["kind"], string> = {
    complete: "COMPLETE / VERIFIED",
    invalidPublished: "INVALID PUBLISHED",
    recordingTemporary: "RECORDING TEMP",
    finalizingTemporary: "FINALIZING TEMP",
    failedTemporary: "FAILED TEMP",
    completeButUnpublished: "COMPLETE / UNPUBLISHED",
    unreadableTemporary: "UNREADABLE TEMP",
  };
  return labels[kind];
}


function closeDockMenus(event?: Event): void {
  const target = event?.target;
  document.querySelectorAll<HTMLDetailsElement>(".dock-menu[open]").forEach((menu) => {
    if (target instanceof Element && menu.contains(target)) return;
    menu.open = false;
  });
}

function handleDockMenuPointerDown(event: PointerEvent): void {
  closeDockMenus(event);
}

onMounted(async () => {
  document.addEventListener("keydown", handleReplayShortcut);
  document.addEventListener("pointerdown", handleDockMenuPointerDown);
  window.addEventListener("pointermove", handlePanelResize);
  window.addEventListener("pointerup", stopPanelResize);
  window.addEventListener("pointercancel", stopPanelResize);
  // RunState is the only progress authority exposed by the backend. Poll while
  // the worker is running so the replay chart follows committed checkpoints.
  runPollInterval = window.setInterval(() => {
    if (runState.value?.status === "running" && !runBusy.value) {
      void (async () => {
        await refreshRunState(true);
        await refreshReplayInspector();
      })();
    }
  }, 250);
  await Promise.all([refreshDatasets(), refreshCurrentOrigin(), refreshSnapshots()]);
  // If a user Load completed during startup, its handoff already refreshed the
  // Test Dataset. Do not issue a later startup read that could overwrite a mutation.
  if (!originHandoffDuringStartup) await refreshCurrentTestDataset();
});

onMounted(() => {
  if (devtoolsAvailable) {
    window.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("click", dismissDevtoolsContextMenu);
    window.addEventListener("keydown", dismissDevtoolsContextMenu);
  }
});

onUnmounted(() => {
  window.removeEventListener("contextmenu", handleContextMenu);
  window.removeEventListener("click", dismissDevtoolsContextMenu);
  window.removeEventListener("keydown", dismissDevtoolsContextMenu);
  document.removeEventListener("keydown", handleReplayShortcut);
  document.removeEventListener("pointerdown", handleDockMenuPointerDown);
  if (runPollInterval !== null) window.clearInterval(runPollInterval);
  runPollInterval = null;
  window.removeEventListener("pointermove", handlePanelResize);
  window.removeEventListener("pointerup", stopPanelResize);
  window.removeEventListener("pointercancel", stopPanelResize);
});
</script>

<template>
  <main class="debugger-shell" data-testid="debugger-shell" :style="{ '--inspector-width': inspectorWidth + 'px', '--inspector-height': inspectorHeight + 'px', '--diagnostics-width': diagnosticsWidth + 'px', '--diagnostics-height': diagnosticsHeight + 'px', '--inspector-reserve-left': !inspectorCollapsed && inspectorDock === 'left' ? inspectorWidth + 'px' : (inspectorDock === 'left' ? '36px' : '0px'), '--inspector-reserve-right': !inspectorCollapsed && inspectorDock === 'right' ? inspectorWidth + 'px' : (inspectorDock === 'right' ? '36px' : '0px'), '--inspector-reserve-top': !inspectorCollapsed && inspectorDock === 'top' ? inspectorHeight + 'px' : (inspectorDock === 'top' ? '36px' : '0px'), '--inspector-reserve-bottom': !inspectorCollapsed && inspectorDock === 'bottom' ? inspectorHeight + 'px' : (inspectorDock === 'bottom' ? '36px' : '0px') }">
    <WorkbenchTopbar :workspace-mode="workspaceMode" :origin-available="Boolean(origin)" @update:workspace-mode="workspaceMode = $event" />

    <div data-testid="workbench" class="workbench-body" :class="{ 'catalog-is-hidden': workspaceMode !== 'dataset', ['inspector-dock-' + inspectorDock]: true, 'inspector-is-collapsed': inspectorCollapsed, ['diagnostics-dock-' + diagnosticsDock]: true, 'diagnostics-is-collapsed': diagnosticsCollapsed }" :style="{ '--diagnostics-reserve-left': diagnosticsDock === 'left' ? (diagnosticsCollapsed ? '36px' : diagnosticsWidth + 'px') : '0px', '--diagnostics-reserve-right': diagnosticsDock === 'right' ? (diagnosticsCollapsed ? '36px' : diagnosticsWidth + 'px') : '0px', '--diagnostics-reserve-top': diagnosticsDock === 'top' ? (diagnosticsCollapsed ? '36px' : diagnosticsHeight + 'px') : '0px', '--diagnostics-reserve-bottom': diagnosticsDock === 'bottom' ? (diagnosticsCollapsed ? '36px' : diagnosticsHeight + 'px') : '0px', '--inspector-offset-left': diagnosticsDock === 'left' ? (diagnosticsCollapsed ? '36px' : diagnosticsWidth + 'px') : '0px', '--inspector-offset-right': diagnosticsDock === 'right' ? (diagnosticsCollapsed ? '36px' : diagnosticsWidth + 'px') : '0px', '--inspector-offset-top': diagnosticsDock === 'top' ? (diagnosticsCollapsed ? '36px' : diagnosticsHeight + 'px') : '0px', '--inspector-offset-bottom': diagnosticsDock === 'bottom' ? (diagnosticsCollapsed ? '36px' : diagnosticsHeight + 'px') : '0px' }" @dragover="allowDockDrop" @drop="dropDockPanel">


      <section data-testid="chart-workspace" class="workbench-main">
        <WorkspaceToolbar
          :workspace-mode="workspaceMode"
          :replay-context="replayToolbarContext"
        >
          <template #actions>
            <div v-if="workspaceMode === 'replay'" class="toolbar-actions replay-toolbar-actions">
              <div class="replay-transport" role="group" aria-label="Replay transport controls">
                <button class="subtle-button" data-testid="run-start" title="Start a new replay run" :disabled="!isRunCommandEligible('start', runState?.status ?? null, runBusy, canStartRun, canRestartRun)" @click="handleRunCommand('start')">START</button>
                <button class="subtle-button" data-testid="run-step" title="Process one SBar" :disabled="!isRunCommandEligible('step', runState?.status ?? null, runBusy, canStartRun, canRestartRun)" @click="handleRunCommand('step')">STEP ▶|</button>
                <button class="subtle-button replay-play-toggle" data-testid="run-play-pause" :title="runState?.status === 'running' ? 'Pause replay (Space)' : 'Play replay (Space)'" :disabled="!isRunCommandEligible(runState?.status === 'running' ? 'pause' : 'play', runState?.status ?? null, runBusy, canStartRun, canRestartRun)" @click="handleRunCommand(runState?.status === 'running' ? 'pause' : 'play')">{{ runState?.status === 'running' ? 'Ⅱ PAUSE' : '▶ PLAY' }}</button>
                <button class="subtle-button" data-testid="run-stop" title="Stop the current run" :disabled="!isRunCommandEligible('stop', runState?.status ?? null, runBusy, canStartRun, canRestartRun)" @click="handleRunCommand('stop')">STOP</button>
                <button class="subtle-button" data-testid="run-restart" title="Reset by restarting the run" :disabled="!isRunCommandEligible('restart', runState?.status ?? null, runBusy, canStartRun, canRestartRun)" @click="handleRunCommand('restart')">RESET</button>
              </div>
              <span class="run-state" data-testid="run-toolbar-status">
                <b :class="`run-status-${runState?.status ?? 'none'}`">{{ runState?.status ? runState.status.toUpperCase() : "NO RUN" }}</b>
                <span>{{ runState ? `${runState.processedCount.toLocaleString()} / ${runState.inputCount.toLocaleString()}` : "—" }}</span>
              </span>
              <div class="progress replay-progress" aria-label="Replay progress" role="progressbar" :aria-valuenow="runState?.processedCount ?? 0" :aria-valuemin="0" :aria-valuemax="runState?.inputCount ?? 0">
                <i :style="{ width: runState && runState.inputCount > 0 ? (runState.processedCount / runState.inputCount * 100) + '%' : '0%' }"></i>
              </div>
              <button class="subtle-button replay-refresh" data-testid="run-refresh-state" title="Refresh state from the backend" :disabled="runBusy" @click="refreshRunState">REFRESH</button>
              <span v-if="runError" class="error-message toolbar-error" role="alert">{{ runError }}</span>
            </div>
            <CompareToolbarControls
              v-show="workspaceMode === 'compare'"
              :snapshots="snapshots"
              :compare-loading="compareLoading"
              @compare="runCompare"
            />
          </template>
        </WorkspaceToolbar>

        <div
          data-testid="chart-panels"
          class="chart-panels"
          :style="workspaceMode === 'dataset' ? { gridTemplateColumns: 'minmax(0, 1fr)' } : undefined"
        >
          <div
            data-testid="workspace-content"
            class="workspace-content"
            :class="{ 'dataset-workspace-content': workspaceMode === 'dataset' }"
            
          >
            <div v-if="workspaceMode === 'dataset'" class="dataset-controls-host">
              <TestDatasetPanel
                :origin="origin"
                :test-dataset="testDataset"
                :start-sbar-id="startSbarId"
                :end-sbar-id="endSbarId"
                :range-selection-ready="rangeSelectionReady"
                :range-selection-pending="rangeSelectionPendingStart !== null"
                :selected-range-count="selectedRangeCount"
                :range-selection-status="rangeSelectionStatus"
                :test-loading="testLoading"
                :can-mutate-test="canMutateTest"
                :test-error="testError"
                :test-status="testStatus"
                @create="createSelectedTestDataset"
              >
                <template #source>
                  <CatalogPanel
                    :datasets="datasets"
                    :selected-id="selectedId"
                    :selected-dataset="selectedDataset"
                    :instrument-groups="instrumentGroups"
                    :refreshing="refreshing"
                    :loading="loading"
                    :mutation-busy="!canLoadOrigin"
                    :discovery-error="discoveryError"
                    :enable-structure="enableStructure"
                    :origin="origin"
                    :load-status="loadStatus"
                    :load-error="loadError"
                    :format-domain-timestamp="formatDomainTimestamp"
                    @refresh="refreshDatasets"
                    @select-dataset="selectedId = $event"
                    @update:enable-structure="enableStructure = $event"
                    @load="startLoad"
                  />
                </template>
              </TestDatasetPanel>
            </div>
            <template v-if="origin && workspaceMode === 'dataset'">
              <OriginChart
                :bars="origin.bars"
                :structure="origin.structure"
                :origin-dataset-id="origin.originDatasetId"
                :selection-start-sbar-id="rangeSelectionPendingStart ?? (rangeSelectionReady ? startSbarId : null)"
                :selection-end-sbar-id="rangeSelectionReady ? endSbarId : null"
                :selection-pending="rangeSelectionPendingStart !== null"
                :selection-editable="canMutateTest && !testLoading"
                @sbar-click="handleOriginSbarClick"
                @object-click="handleOriginObjectClick"
                @range-boundary-change="handleOriginBoundaryChange"
                @selection-error="handleOriginSelectionError"
                @cancel-range-selection="cancelOriginRangeSelection"
              />
            </template>
            <div v-show="workspaceMode === 'replay'" class="workspace-mode replay-controls">
              <DualChartStack workspace="replay">
                <template #upper>
                  <RunChart v-if="workspaceMode === 'replay'" :origin="origin" :test-dataset="testDataset" :run-state="runState" />
                </template>
                <template #lower>
                  <SnapshotReferencePanel
                    :snapshots="replayReferenceSnapshots"
                    :selected-snapshot-id="selectedReplayReferenceSnapshotId"
                    @update:selected-snapshot-id="selectedReplayReferenceSnapshotId = $event"
                  />
                </template>
              </DualChartStack>
            </div>
            <div v-show="workspaceMode === 'compare'" class="workspace-mode compare-workspace">
              <CompareSummary
                :compare-result="compareResult"
                :compare-loading="compareLoading"
                :compare-error="compareError"
              />
              <DualChartStack workspace="compare">
                <template #upper>
                  <ComparisonChartPlaceholder
                    side="candidate"
                    :has-comparison="Boolean(compareResult)"
                    :checkpoint-count="compareResult?.checkpointCount ?? null"
                  />
                </template>
                <template #lower>
                  <ComparisonChartPlaceholder
                    side="baseline"
                    :has-comparison="Boolean(compareResult)"
                    :checkpoint-count="compareResult?.checkpointCount ?? null"
                  />
                </template>
              </DualChartStack>
              <details class="snapshot-store-disclosure" data-testid="snapshot-store-disclosure">
                <summary data-testid="snapshot-store-toggle">SNAPSHOT STORE / DIFFERENCES</summary>
                <SnapshotPanel
                  :snapshots="snapshots"
                  :snapshots-loading="snapshotsLoading"
                  :snapshots-error="snapshotsError"
                  :snapshot-kind-label="snapshotKindLabel"
                  :format-lifecycle-timestamp="formatLifecycleTimestamp"
                  :compare-result="compareResult"
                  :compare-loading="compareLoading"
                  :compare-error="compareError"
                  :selected-difference-key="selectedCompareDifferenceKey"
                  @refresh="refreshSnapshots"
                  @select-difference="selectCompareDifference"
                />
              </details>
            </div>
          </div>


        </div>
      </section>
      <aside data-testid="inspector-panel" class="inspector-rail" :class="['dock-' + inspectorDock, { collapsed: inspectorCollapsed }]">
        <div class="panel-resize-edge inspector-resize-edge" data-testid="inspector-resize-edge" role="separator" aria-label="Resize Inspector" :aria-orientation="inspectorDock === 'left' || inspectorDock === 'right' ? 'vertical' : 'horizontal'" :aria-valuenow="inspectorDock === 'left' || inspectorDock === 'right' ? inspectorWidth : inspectorHeight" :aria-valuemin="inspectorDock === 'left' || inspectorDock === 'right' ? 180 : 100" :aria-valuemax="inspectorDock === 'left' || inspectorDock === 'right' ? inspectorWidthLimit() : inspectorHeightLimit()" tabindex="0" @pointerdown="startPanelResize('inspector', $event)" @keydown="handlePanelResizeKey('inspector', $event)"></div>
        <div class="rail-heading">
          <span class="panel-title panel-dock-drag-handle" data-testid="inspector-dock-drag-handle" draggable="true" title="Drag to any workbench edge to dock" @dragstart="startDockDrag('inspector', $event)">Inspector</span>
          <span class="tag inspector-object-tag">OBJECT</span>
          <span class="spacer"></span>
          <details class="dock-menu" data-testid="inspector-dock-menu">
            <summary class="subtle-button rail-toggle" aria-label="Move Inspector" title="Move or dock panel">⋯</summary>
            <div class="dock-menu-options" role="group" aria-label="Inspector docking position">
              <button class="dock-menu-option" data-testid="inspector-dock-left" :aria-pressed="inspectorDock === 'left'" @click="inspectorDock = 'left'; closeDockMenus()">Dock Left</button>
              <button class="dock-menu-option" data-testid="inspector-dock-right" :aria-pressed="inspectorDock === 'right'" @click="inspectorDock = 'right'; closeDockMenus()">Dock Right</button>
              <button class="dock-menu-option" data-testid="inspector-dock-top" :aria-pressed="inspectorDock === 'top'" @click="inspectorDock = 'top'; closeDockMenus()">Dock Top</button>
              <button class="dock-menu-option" data-testid="inspector-dock-bottom" :aria-pressed="inspectorDock === 'bottom'" @click="inspectorDock = 'bottom'; closeDockMenus()">Dock Bottom</button>
            </div>
          </details>
          <button class="subtle-button rail-toggle" :aria-label="inspectorCollapsed ? 'Expand Inspector' : 'Collapse Inspector'" :title="inspectorCollapsed ? 'Expand Inspector' : 'Collapse Inspector'" @click="inspectorCollapsed = !inspectorCollapsed">{{ inspectorCollapsed ? '+' : '−' }}</button>
        </div>
        <ObjectInspector
          v-if="!inspectorCollapsed"
          :selected-sbar="workspaceMode === 'dataset' ? selectedInspectorSbar : null"
          :selected-cbar="workspaceMode === 'dataset' ? selectedInspectorCbar : null"
          :selected-swing="workspaceMode === 'dataset' ? selectedInspectorSwing : null"
          :origin-dataset-id="origin?.originDatasetId ?? null"
          :timeframe="workspaceMode === 'replay' ? (testDataset?.timeframe ?? origin?.timeframe ?? null) : (origin?.timeframe ?? null)"
          :workspace-mode="workspaceMode"
          :replay-inspector="workspaceMode === 'replay' ? replayInspector : null"
          :replay-inspector-error="replayInspectorError"
          :selected-difference="workspaceMode === 'compare' ? selectedCompareDifference : null"
          :compare-baseline-snapshot-id="compareResult?.baseline.snapshotId ?? null"
          :compare-candidate-snapshot-id="compareResult?.candidate.snapshotId ?? null"
        />
      </aside>
      <section data-testid="diagnostics-dock" class="diagnostics-dock" :class="['dock-' + diagnosticsDock, { collapsed: diagnosticsCollapsed }]">
        <div class="panel-resize-edge diagnostics-resize-edge" data-testid="diagnostics-resize-edge" role="separator" aria-label="Resize Diagnostics" :aria-orientation="diagnosticsDock === 'left' || diagnosticsDock === 'right' ? 'vertical' : 'horizontal'" :aria-valuenow="diagnosticsDock === 'left' || diagnosticsDock === 'right' ? diagnosticsWidth : diagnosticsHeight" :aria-valuemin="diagnosticsDock === 'left' || diagnosticsDock === 'right' ? 180 : 100" :aria-valuemax="diagnosticsDock === 'left' || diagnosticsDock === 'right' ? diagnosticsWidthLimit() : diagnosticsHeightLimit()" tabindex="0" @pointerdown="startPanelResize('diagnostics', $event)" @keydown="handlePanelResizeKey('diagnostics', $event)"></div>
        <div
          class="diagnostics-heading"
          data-testid="diagnostics-heading"
          :class="{ 'collapsed-side-heading': diagnosticsCollapsed && (diagnosticsDock === 'left' || diagnosticsDock === 'right') }"
          @click="handleDiagnosticsHeadingClick"
          draggable="true"
          @dragstart="startDockDrag('diagnostics', $event)"
        >
          <div class="diagnostics-title-block">
            <span class="panel-title diagnostics-panel-title" data-testid="diagnostics-dock-drag-handle">Diagnostics</span>
          </div>
          <nav class="diagnostics-tabs" data-testid="diagnostics-category-tabs" aria-label="Diagnostic categories">
            <button v-for="category in [
              { id: 'all', label: 'ALL' },
              { id: 'errors', label: 'ERRORS' },
              { id: 'warnings', label: 'WARNINGS' },
              { id: 'replay', label: 'REPLAY' },
              { id: 'structure', label: 'STRUCTURE' },
              { id: 'snapshots', label: 'SNAPSHOTS' },
              { id: 'validation', label: 'VALIDATION' },
              { id: 'differences', label: 'DIFFERENCES' },
            ]" :key="category.id" :class="{ active: diagnosticsCategory === category.id }" :aria-pressed="diagnosticsCategory === category.id" @click="diagnosticsCategory = category.id">{{ category.label }}</button>
          </nav>
          <div class="dock-actions">
            <details class="dock-menu" data-testid="diagnostics-dock-menu">
              <summary class="subtle-button" aria-label="Move Diagnostics" title="Move or dock panel">⋯</summary>
              <div class="dock-menu-options" role="group" aria-label="Diagnostics docking position">
                <button class="dock-menu-option" data-testid="diagnostics-dock-left" :aria-pressed="diagnosticsDock === 'left'" @click="diagnosticsDock = 'left'; closeDockMenus()">Dock Left</button>
                <button class="dock-menu-option" data-testid="diagnostics-dock-right" :aria-pressed="diagnosticsDock === 'right'" @click="diagnosticsDock = 'right'; closeDockMenus()">Dock Right</button>
                <button class="dock-menu-option" data-testid="diagnostics-dock-top" :aria-pressed="diagnosticsDock === 'top'" @click="diagnosticsDock = 'top'; closeDockMenus()">Dock Top</button>
                <button class="dock-menu-option" data-testid="diagnostics-dock-bottom" :aria-pressed="diagnosticsDock === 'bottom'" @click="diagnosticsDock = 'bottom'; closeDockMenus()">Dock Bottom</button>
              </div>
            </details>
            <button class="subtle-button" data-testid="diagnostics-collapse-toggle"  :aria-label="diagnosticsCollapsed ? 'Expand Diagnostics' : 'Collapse Diagnostics'" :title="diagnosticsCollapsed ? 'Expand Diagnostics' : 'Collapse Diagnostics'" @click.stop="diagnosticsCollapsed = !diagnosticsCollapsed">{{ diagnosticsCollapsed ? '+' : '−' }}</button>
          </div>
        </div>
        <div class="diagnostics-content">
          <p v-if="loadError || discoveryError || testError || runError || snapshotsError" class="error-message">
            <span v-if="discoveryError">Catalog: {{ discoveryError }}</span>
            <span v-if="loadError">Origin Load: {{ loadError }}</span>
            <span v-if="testError">Test Dataset: {{ testError }}</span>
            <span v-if="runError">Run / Replay: {{ runError }}</span>
            <span v-if="snapshotsError">Snapshots: {{ snapshotsError }}</span>
          </p>
          <p v-else class="empty-state">No active errors. Structured event history and domain diagnostics are not yet connected.</p>
        </div>
      </section>
    </div>

    <div
      v-if="devtoolsAvailable && devtoolsContextMenu.visible"
      class="devtools-context-menu"
      data-testid="devtools-context-menu"
      :style="{ left: devtoolsContextMenu.x + 'px', top: devtoolsContextMenu.y + 'px' }"
      @click.stop
      @contextmenu.prevent
    >
      <button data-testid="open-devtools" type="button" @click="openDevtoolsFromContextMenu">Open DevTools</button>
      <button data-testid="refresh-page" type="button" @click="refreshPageFromContextMenu">Refresh Page</button>
    </div>
  </main>
</template>
