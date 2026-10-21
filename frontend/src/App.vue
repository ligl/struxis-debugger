<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import WorkbenchTopbar from "./components/WorkbenchTopbar.vue";
import WorkspaceToolbar from "./components/WorkspaceToolbar.vue";
import CatalogPanel from "./components/CatalogPanel.vue";
import OriginPanel from "./components/OriginPanel.vue";
import OriginChart from "./components/OriginChart.vue";
import RunChart from "./components/RunChart.vue";
import DualChartStack from "./components/DualChartStack.vue";
import SnapshotReferencePanel from "./components/SnapshotReferencePanel.vue";
import ComparisonChartPlaceholder from "./components/ComparisonChartPlaceholder.vue";
import TestDatasetPanel from "./components/TestDatasetPanel.vue";
import RunControlPanel from "./components/RunControlPanel.vue";
import SnapshotPanel from "./components/SnapshotPanel.vue";
import ObjectInspector from "./components/ObjectInspector.vue";
import type { ObjectDifferenceDto, SnapshotArtifactDto } from "./origin-types";
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
  runStatusMessage,
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

const selectedInspectorSbarId = ref<string | null>(null);
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
  const selectedId = selectedInspectorSbarId.value;
  if (!selectedId) return null;
  return origin.value?.bars.find((bar) => bar.sbarId === selectedId) ?? null;
});

const rangeSelectionPendingStart = ref<string | null>(null);
const rangeSelectionReady = ref(false);
const selectedRangeCount = ref(0);
const rangeSelectionStatus = ref(
  "Click anywhere in the chart plot to select the start time of your Test interval.",
);

function handleOriginSbarClick(sbarId: string): void {
  if (!origin.value) return;
  if (origin.value.bars.some((bar) => bar.sbarId === sbarId)) {
    selectedInspectorSbarId.value = sbarId;
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

function handleOriginSelectionError(message: string): void {
  rangeSelectionStatus.value = message;
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

const {
  collapsedInstrumentIds,
  instrumentGroups,
  toggleInstrumentGroup,
} = useCatalogGroups(datasets);

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
  if (mode !== "compare") selectedCompareDifferenceKey.value = null;
  if (mode === "replay") void refreshReplayInspector();
});
const catalogCollapsed = ref(false);
const inspectorCollapsed = ref(false);
const diagnosticsCollapsed = ref(false);
const diagnosticsCategory = ref("all");
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
  const available = workbenchExtent(axis) - peerDockReservation(target, axis) - chartMinimum;
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
    selectedInspectorSbarId.value = null;
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

function formatTimestamp(value: string | null): string {
  return value || "—";
}

onMounted(async () => {
  document.addEventListener("keydown", handleReplayShortcut);
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

onUnmounted(() => {
  document.removeEventListener("keydown", handleReplayShortcut);
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

    <div data-testid="workbench" class="workbench-body" :class="{ 'catalog-is-collapsed': catalogCollapsed, 'catalog-is-hidden': workspaceMode !== 'dataset', 'inspector-is-collapsed': inspectorCollapsed, ['diagnostics-dock-' + diagnosticsDock]: true, 'diagnostics-is-collapsed': diagnosticsCollapsed }" :style="{ '--diagnostics-reserve-left': diagnosticsDock === 'left' ? (diagnosticsCollapsed ? '36px' : diagnosticsWidth + 'px') : '0px', '--diagnostics-reserve-right': diagnosticsDock === 'right' ? (diagnosticsCollapsed ? '36px' : diagnosticsWidth + 'px') : '0px', '--diagnostics-reserve-top': diagnosticsDock === 'top' ? (diagnosticsCollapsed ? '36px' : diagnosticsHeight + 'px') : '0px', '--diagnostics-reserve-bottom': diagnosticsDock === 'bottom' ? (diagnosticsCollapsed ? '36px' : diagnosticsHeight + 'px') : '0px', '--inspector-offset-left': diagnosticsDock === 'left' ? (diagnosticsCollapsed ? '36px' : diagnosticsWidth + 'px') : '0px', '--inspector-offset-right': diagnosticsDock === 'right' ? (diagnosticsCollapsed ? '36px' : diagnosticsWidth + 'px') : '0px', '--inspector-offset-top': diagnosticsDock === 'top' ? (diagnosticsCollapsed ? '36px' : diagnosticsHeight + 'px') : '0px', '--inspector-offset-bottom': diagnosticsDock === 'bottom' ? (diagnosticsCollapsed ? '36px' : diagnosticsHeight + 'px') : '0px' }" @dragover="allowDockDrop" @drop="dropDockPanel">


      <section data-testid="chart-workspace" class="workbench-main">
        <WorkspaceToolbar
          :workspace-mode="workspaceMode"
          :catalog-collapsed="catalogCollapsed"
          :diagnostics-collapsed="diagnosticsCollapsed"
          @toggle-catalog="catalogCollapsed = !catalogCollapsed"
          @toggle-diagnostics="diagnosticsCollapsed = !diagnosticsCollapsed"
        />

        <div data-testid="chart-panels" class="chart-panels" :class="{ 'catalog-is-collapsed': catalogCollapsed }">
          <aside v-if="workspaceMode === 'dataset'" data-testid="catalog-rail" class="catalog-rail" :class="{ collapsed: catalogCollapsed }">
            <div class="rail-heading">
              <span class="section-index">SOURCE</span>
              <button class="subtle-button rail-toggle" :aria-label="catalogCollapsed ? 'Expand Catalog' : 'Collapse Catalog'" @click="catalogCollapsed = !catalogCollapsed">{{ catalogCollapsed ? '›' : '‹' }}</button>
            </div>
            <CatalogPanel v-if="!catalogCollapsed" :datasets="datasets" :selected-id="selectedId" :selected-dataset="selectedDataset" :instrument-groups="instrumentGroups" :collapsed-instrument-ids="collapsedInstrumentIds" :refreshing="refreshing" :loading="loading" :mutation-busy="!canLoadOrigin" :discovery-error="discoveryError" :enable-structure="enableStructure" @refresh="refreshDatasets" @select-dataset="selectedId = $event" @toggle-group="toggleInstrumentGroup" @update:enable-structure="enableStructure = $event" @load="startLoad" />
          </aside>

          <div data-testid="workspace-content" class="workspace-content">
            <template v-if="origin && workspaceMode === 'dataset'">
              <OriginChart
                :bars="origin.bars"
                :origin-dataset-id="origin.originDatasetId"
                :selection-start-sbar-id="rangeSelectionPendingStart ?? (rangeSelectionReady ? startSbarId : null)"
                :selection-end-sbar-id="rangeSelectionReady ? endSbarId : null"
                :selection-pending="rangeSelectionPendingStart !== null"
                @sbar-click="handleOriginSbarClick"
                @selection-error="handleOriginSelectionError"
              />
              <p class="microcopy chart-selection-hint" data-testid="origin-range-selection-status" aria-live="polite">{{ rangeSelectionStatus }}</p>
              <p class="source-note">Source: {{ origin.sourceCatalog }} · Chart values are projected from the validated Struxis SBar series; domain IDs remain exact strings.</p>
            </template>
            <div v-show="workspaceMode === 'dataset'" class="workspace-mode dataset-preparation-panel">
              <OriginPanel :origin="origin" :load-status="loadStatus" :load-error="loadError" :format-timestamp="formatTimestamp" />
              <TestDatasetPanel :origin="origin" :test-dataset="testDataset" :start-sbar-id="startSbarId" :end-sbar-id="endSbarId" :range-selection-ready="rangeSelectionReady" :range-selection-pending="rangeSelectionPendingStart !== null" :selected-range-count="selectedRangeCount" :test-loading="testLoading" :can-mutate-test="canMutateTest" :test-error="testError" :test-status="testStatus" @create="createSelectedTestDataset" />
            </div>
            <div v-show="workspaceMode === 'replay'" class="workspace-mode replay-controls">
              <RunControlPanel :run-state="runState" :run-busy="runBusy" :run-error="runError" :run-status-message="runStatusMessage" :can-start-run="canStartRun" :can-restart-run="canRestartRun" @command="handleRunCommand" @refresh="refreshRunState" />
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
              <SnapshotPanel :snapshots="snapshots" :snapshots-loading="snapshotsLoading" :snapshots-error="snapshotsError" :snapshot-kind-label="snapshotKindLabel" :format-timestamp="formatTimestamp" :compare-result="compareResult" :compare-loading="compareLoading" :compare-error="compareError" :selected-difference-key="selectedCompareDifferenceKey" @refresh="refreshSnapshots" @compare="runCompare" @select-difference="selectCompareDifference" />
            </div>
          </div>


        </div>
      </section>
      <aside data-testid="inspector-panel" class="inspector-rail" :class="['dock-' + inspectorDock, { collapsed: inspectorCollapsed }]">
        <div class="panel-resize-edge inspector-resize-edge" data-testid="inspector-resize-edge" role="separator" aria-label="Resize Inspector" :aria-orientation="inspectorDock === 'left' || inspectorDock === 'right' ? 'vertical' : 'horizontal'" :aria-valuenow="inspectorDock === 'left' || inspectorDock === 'right' ? inspectorWidth : inspectorHeight" :aria-valuemin="inspectorDock === 'left' || inspectorDock === 'right' ? 180 : 100" :aria-valuemax="inspectorDock === 'left' || inspectorDock === 'right' ? inspectorWidthLimit() : inspectorHeightLimit()" tabindex="0" @pointerdown="startPanelResize('inspector', $event)" @keydown="handlePanelResizeKey('inspector', $event)"></div>
        <div class="rail-heading">
          <span class="section-index panel-dock-drag-handle" data-testid="inspector-dock-drag-handle" draggable="true" title="Drag to any workbench edge to dock" @dragstart="startDockDrag('inspector', $event)">INSPECTOR</span>
          <details class="dock-menu" data-testid="inspector-dock-menu">
            <summary class="subtle-button rail-toggle" aria-label="Inspector panel options" title="Inspector panel options">⋯</summary>
            <div class="dock-menu-options" role="group" aria-label="Inspector docking position">
              <button class="dock-menu-option" data-testid="inspector-dock-left" :aria-pressed="inspectorDock === 'left'" @click="inspectorDock = 'left'">LEFT</button>
              <button class="dock-menu-option" data-testid="inspector-dock-right" :aria-pressed="inspectorDock === 'right'" @click="inspectorDock = 'right'">RIGHT</button>
              <button class="dock-menu-option" data-testid="inspector-dock-top" :aria-pressed="inspectorDock === 'top'" @click="inspectorDock = 'top'">TOP</button>
              <button class="dock-menu-option" data-testid="inspector-dock-bottom" :aria-pressed="inspectorDock === 'bottom'" @click="inspectorDock = 'bottom'">BOTTOM</button>
            </div>
          </details>
          <button class="subtle-button rail-toggle" :aria-label="inspectorCollapsed ? 'Expand Inspector' : 'Collapse Inspector'" @click="inspectorCollapsed = !inspectorCollapsed">{{ inspectorCollapsed ? '‹' : '›' }}</button>
        </div>
        <ObjectInspector
          v-if="!inspectorCollapsed"
          :selected-sbar="workspaceMode === 'dataset' ? selectedInspectorSbar : null"
          :origin-dataset-id="origin?.originDatasetId ?? null"
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
          draggable="true"
          @dragstart="startDockDrag('diagnostics', $event)"
        >
          <div class="diagnostics-title-block">
            <p class="section-index" data-testid="diagnostics-dock-drag-handle">DIAGNOSTICS</p>
            <h2>Workflow events &amp; errors</h2>
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
              <summary class="subtle-button" aria-label="Diagnostics panel options" title="Diagnostics panel options">⋯</summary>
              <div class="dock-menu-options" role="group" aria-label="Diagnostics docking position">
                <button class="dock-menu-option" data-testid="diagnostics-dock-left" :aria-pressed="diagnosticsDock === 'left'" @click="diagnosticsDock = 'left'">LEFT</button>
                <button class="dock-menu-option" data-testid="diagnostics-dock-right" :aria-pressed="diagnosticsDock === 'right'" @click="diagnosticsDock = 'right'">RIGHT</button>
                <button class="dock-menu-option" data-testid="diagnostics-dock-top" :aria-pressed="diagnosticsDock === 'top'" @click="diagnosticsDock = 'top'">TOP</button>
                <button class="dock-menu-option" data-testid="diagnostics-dock-bottom" :aria-pressed="diagnosticsDock === 'bottom'" @click="diagnosticsDock = 'bottom'">BOTTOM</button>
              </div>
            </details>
            <button class="subtle-button" data-testid="diagnostics-collapse-toggle"  :aria-label="diagnosticsCollapsed ? 'Expand Diagnostics' : 'Collapse Diagnostics'" :title="diagnosticsCollapsed ? 'Expand Diagnostics' : 'Collapse Diagnostics'" @click="diagnosticsCollapsed = !diagnosticsCollapsed">{{ diagnosticsCollapsed ? '+' : '−' }}</button>
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

  </main>
</template>
