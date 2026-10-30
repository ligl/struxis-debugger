<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import WorkbenchTopbar from "./components/WorkbenchTopbar.vue";
import AppToastHost from "./components/AppToastHost.vue";
import WorkspaceToolbar from "./components/WorkspaceToolbar.vue";
import CompareToolbarControls from "./components/CompareToolbarControls.vue";
import ReplayToolbarControls from "./components/ReplayToolbarControls.vue";
import ObjectInspector from "./components/ObjectInspector.vue";
import Diagnostics from "./components/Diagnostics.vue";
import DatasetWorkspace from "./components/DatasetWorkspace.vue";
import ReplayWorkspace from "./components/ReplayWorkspace.vue";
import CompareWorkspace from "./components/CompareWorkspace.vue";
import type { InspectorWorkspaceContext, ObjectDifferenceDto, OriginObjectSelection, ReplayChartSelection, ReplaySnapshotInspectorSelection } from "./origin-types";
import type { RunCommand } from "./run-command-eligibility";
import { hasCompletedRunResult, isRunCommandEligible } from "./run-command-eligibility";
import { useSnapshots } from "./composables/useSnapshots";
import { useCompareWorkspace } from "./composables/useCompareWorkspace";
import { useOriginLoad } from "./composables/useOriginLoad";
import { useTestDataset } from "./composables/useTestDataset";
import { useRunControl } from "./composables/useRunControl";
import { useCatalogGroups } from "./composables/useCatalogGroups";
import { useOriginRangeSelection } from "./composables/useOriginRangeSelection";
import { useDockLayout } from "./composables/useDockLayout";
import { useInspectorSelection } from "./composables/useInspectorSelection";
import { useReplayInspector } from "./composables/useReplayInspector";
import { useReplayKeyboardShortcut } from "./composables/useReplayKeyboardShortcut";
import { usePlaybackController } from "./composables/usePlaybackController";
import { useDevtoolsContextMenu } from "./composables/useDevtoolsContextMenu";
import { formatDomainTimestamp, formatLifecycleTimestamp } from "./timestamp-format";
import { notifyError } from "./composables/useAppToast";

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
  snapshotSaveBusy,
  refreshSnapshots,
  saveCompletedRunSnapshot,
} = useSnapshots();

const {
  compareResult,
  compareLoading,
  compareError,
  runCompare,
} = useCompareWorkspace();

const {
  runState,
  runBusy,
  runError,
  lastStepResult,
  refreshRunState,
  executeRunCommand,
  executeRestartToSBar,
  waitForIdle: waitForRunIdle,
} = useRunControl();

const originLoadPreparing = ref(false);
const originLoading = computed(() => loading.value || originLoadPreparing.value);
const displayedOriginLoadStatus = computed(
  () => originLoadPreparing.value ? "loading" : loadStatus.value,
);
const canMutateTest = computed(
  () => !originLoading.value && !runBusy.value && !snapshotSaveBusy.value &&
    (!runState.value || ["completed", "disposed"].includes(runState.value.status)),
);

const {
  testDataset,
  testLoading,
  testError,
  refreshCurrentTestDataset,
  prepareForOrigin,
  createTestDataset,
} = useTestDataset(origin, canMutateTest);
const canLoadOrigin = computed(
  () => canMutateTest.value && !testLoading.value && !compareLoading.value,
);

const {
  startSbarId, endSbarId, rangeSelectionPendingStart, rangeSelectionReady,
  selectedRangeCount, rangeSelectionStatus, handleRangeSbarClick, selectAllOriginRange,
  handleRangeBoundaryChange, handleRangeSelectionError, cancelOriginRangeSelection,
  resetForOrigin, initializeFromTestDataset,
} = useOriginRangeSelection(origin, canMutateTest, testLoading);

const {
  replayInspector,
  replayInspectorError,
  refresh: refreshReplayInspectorState,
} = useReplayInspector();

watch(lastStepResult, (result) => {
  if (!result) return;
  replayInspector.value = result.inspector;
  replayInspectorError.value = "";
});

const selectedCompareDifference = ref<ObjectDifferenceDto | null>(null);
const selectedReplayChartObject = ref<ReplayChartSelection | null>(null);
const selectedReplaySnapshotObject = ref<ReplaySnapshotInspectorSelection | null>(null);
const targetSbarId = ref<string | null>(null);
const fastForwarding = ref(false);
const restartToSBarPending = ref(false);

function handleReplayTargetSelection(sbarId: string): void {
  if (fastForwarding.value || restartToSBarPending.value) return;
  const test = testDataset.value;
  const currentOrigin = origin.value;
  if (
    workspaceMode.value !== "replay" ||
    !test ||
    !currentOrigin ||
    currentOrigin.originDatasetId !== test.originDatasetId ||
    !currentOrigin.bars.some((bar) => bar.sbarId === sbarId)
  ) return;
  const start = currentOrigin.bars.findIndex((bar) => bar.sbarId === test.startSbarId);
  const end = currentOrigin.bars.findIndex((bar) => bar.sbarId === test.endSbarId);
  const target = currentOrigin.bars.findIndex((bar) => bar.sbarId === sbarId);
  if (start < 0 || end < start || target < start || target > end) return;
  targetSbarId.value = sbarId;
}

function cancelReplayTarget(): void {
  if (!fastForwarding.value) targetSbarId.value = null;
}

async function handleRestartToSBar(): Promise<void> {
  const target = targetSbarId.value;
  if (
    !target ||
    fastForwarding.value ||
    restartToSBarPending.value ||
    workspaceMode.value !== "replay"
  ) return;

  restartToSBarPending.value = true;
  try {
    // Stop frontend scheduling first, then wait for either a Play-owned or
    // manually initiated Step to finish before acquiring the fast-forward path.
    await stopPlayback();
    await waitForRunIdle();
    if (
      targetSbarId.value !== target ||
      workspaceMode.value !== "replay" ||
      runBusy.value
    ) return;

    fastForwarding.value = true;
    const succeeded = await executeRestartToSBar(target);
    if (succeeded) {
      replayInspector.value = lastStepResult.value?.inspector ?? null;
      replayInspectorError.value = "";
    } else {
      notifyError("Replay restore failed", runError.value || "Replay could not restore the selected checkpoint.");
    }
  } finally {
    fastForwarding.value = false;
    restartToSBarPending.value = false;
    targetSbarId.value = null;
  }
}

function handleReplayObjectSelection(selection: ReplayChartSelection): void {
  const currentRun = runState.value;
  const currentCheckpoint = replayInspector.value;
  const currentTest = testDataset.value;
  const currentOrigin = origin.value;
  if (
    workspaceMode.value !== "replay" ||
    !currentTest ||
    !currentOrigin ||
    currentOrigin.originDatasetId !== currentTest.originDatasetId ||
    (currentRun && currentRun.testDatasetId !== currentTest.testDatasetId)
  ) return;

  const start = currentOrigin.bars.findIndex((bar) => bar.sbarId === currentTest.startSbarId);
  const end = currentOrigin.bars.findIndex((bar) => bar.sbarId === currentTest.endSbarId);
  const selectedIndex = currentOrigin.bars.findIndex((bar) => bar.sbarId === selection.id);
  if (start < 0 || end < start) return;

  if (selection.kind === "sbar") {
    if (selectedIndex < start || selectedIndex > end) return;
    if (selection.checkpointSbarId === null) {
      if (currentRun?.cursorSbarId) return;
      selectedReplaySnapshotObject.value = null;
      selectedReplayChartObject.value = selection;
      return;
    }
    if (
      !currentRun ||
      selection.checkpointSbarId !== currentRun.cursorSbarId ||
      currentCheckpoint?.sbarId !== currentRun.cursorSbarId
    ) return;
  } else {
    if (
      !currentRun ||
      !currentRun.cursorSbarId ||
      selection.checkpointSbarId !== currentRun.cursorSbarId ||
      currentCheckpoint?.sbarId !== currentRun.cursorSbarId
    ) return;
    const structure = currentCheckpoint.structure;
    const exists = selection.kind === "cbar"
      ? structure?.cbars.some((item) => item.cbarId === selection.id)
      : structure?.swings.some((item) => item.swingId === selection.id);
    if (!exists) return;
  }
  selectedReplaySnapshotObject.value = null;
  selectedReplayChartObject.value = selection;
}

function handleReplaySnapshotSelection(selection: ReplaySnapshotInspectorSelection | null): void {
  selectedReplaySnapshotObject.value = selection;
  if (selection) selectedReplayChartObject.value = null;
}

type ReplayInspectorSelection = Extract<InspectorWorkspaceContext, { workspace: "replay" }>["selectedObject"];
const selectedReplayInspectorObject = computed<ReplayInspectorSelection>(() => {
  const snapshotSelection = selectedReplaySnapshotObject.value;
  if (snapshotSelection) {
    if (snapshotSelection.kind === "sbar") {
      return { kind: "sbar", object: snapshotSelection.object, source: "snapshot" };
    }
    if (snapshotSelection.kind === "cbar") {
      return { kind: "cbar", object: snapshotSelection.object, source: "snapshot" };
    }
    if (snapshotSelection.kind === "swing") {
      return { kind: "swing", object: snapshotSelection.object, source: "snapshot" };
    }
    return { kind: "trend", object: snapshotSelection.object, source: "snapshot" };
  }
  const selection = selectedReplayChartObject.value;
  const checkpoint = replayInspector.value;
  const currentRun = runState.value;
  const currentTest = testDataset.value;
  const currentOrigin = origin.value;
  if (
    !selection ||
    !currentTest ||
    !currentOrigin ||
    currentOrigin.originDatasetId !== currentTest.originDatasetId
  ) return null;

  const start = currentOrigin.bars.findIndex((bar) => bar.sbarId === currentTest.startSbarId);
  const end = currentOrigin.bars.findIndex((bar) => bar.sbarId === currentTest.endSbarId);
  const index = currentOrigin.bars.findIndex((bar) => bar.sbarId === selection.id);
  if (start < 0 || end < start) return null;

  if (selection.kind === "sbar") {
    if (index < start || index > end) return null;
    if (selection.checkpointSbarId === null) {
      if (currentRun?.cursorSbarId) return null;
      const inputBar = currentOrigin.bars[index];
      return inputBar ? { kind: "sbar", object: inputBar, source: "input" } : null;
    }
    if (
      !currentRun ||
      !checkpoint ||
      currentRun.testDatasetId !== currentTest.testDatasetId ||
      selection.checkpointSbarId !== currentRun.cursorSbarId ||
      checkpoint.sbarId !== currentRun.cursorSbarId
    ) return null;
    if (selection.id === checkpoint.sbarId) {
      return { kind: "sbar", object: checkpoint.sbar, source: "checkpoint" };
    }
    const inputBar = currentOrigin.bars[index];
    return inputBar ? { kind: "sbar", object: inputBar, source: "input" } : null;
  }

  if (
    !currentRun ||
    !checkpoint ||
    currentRun.testDatasetId !== currentTest.testDatasetId ||
    selection.checkpointSbarId !== currentRun.cursorSbarId ||
    checkpoint.sbarId !== currentRun.cursorSbarId
  ) return null;
  if (selection.kind === "cbar") {
    const object = checkpoint.structure?.cbars.find((item) => item.cbarId === selection.id);
    return object ? { kind: "cbar", object } : null;
  }
  if (selection.kind === "swing") {
    const object = checkpoint.structure?.swings.find((item) => item.swingId === selection.id);
    return object ? { kind: "swing", object } : null;
  }
  const object = checkpoint.structure?.trends.find((item) => item.trendId === selection.id);
  return object ? { kind: "trend", object } : null;
});

watch(
  [
    () => runState.value?.runId,
    () => runState.value?.cursorSbarId,
    () => testDataset.value?.testDatasetId,
  ],
  () => { selectedReplayChartObject.value = null; },
);

watch(() => testDataset.value?.testDatasetId, () => {
  targetSbarId.value = null;
});

async function refreshReplayInspector(): Promise<void> {
  await refreshReplayInspectorState(Boolean(runState.value));
}

function handleCompareDifferenceSelection(difference: ObjectDifferenceDto | null): void {
  selectedCompareDifference.value = difference;
}


function handleOriginObjectClick(selection: Extract<OriginObjectSelection, { kind: "cbar" | "swing" | "trend" }>): void {
  selectInspectorStructureObject(selection);
}

function handleOriginSbarClick(sbarId: string): void {
  // Inspection remains available when mutation is blocked; the range module
  // independently enforces the Origin/Test Dataset/Run lifecycle guard.
  selectInspectorSbar(sbarId);
  handleRangeSbarClick(sbarId);
}

async function createSelectedTestDataset(): Promise<void> {
  if (!rangeSelectionReady.value || !canMutateTest.value) return;

  // Reconcile against backend ownership immediately before coordinating the
  // cross-workspace mutation. The local Run DTO may be stale.
  const refreshed = await refreshRunState();
  if (!refreshed) {
    testError.value = runError.value || "Could not verify Replay state; Test Dataset was not replaced.";
    notifyError("Test Dataset creation failed", testError.value);
    return;
  }
  if (!canMutateTest.value || !rangeSelectionReady.value) return;

  testError.value = "";
  const currentRun = runState.value;
  if (currentRun) {
    // Replacing the Test Dataset is an explicit context change. Reset Replay
    // unconditionally for an existing Run, regardless of Snapshot save state.
    // Snapshot persistence is independent and must not gate this workflow.
    await stopPlayback();
    const resetSucceeded = await executeRunCommand("reset");
    if (!resetSucceeded || runState.value !== null) {
      testError.value = runError.value ||
        "Replay Reset did not confirm an empty Run state; Test Dataset was not replaced.";
      notifyError("Test Dataset creation failed", testError.value);
      return;
    }

    replayInspector.value = null;
    replayInspectorError.value = "";
    selectedReplayChartObject.value = null;
  }

  // If Reset fails or its authoritative empty state is not confirmed, never
  // proceed to Test Dataset creation.
  const created = await createTestDataset(startSbarId.value, endSbarId.value);
  if (created) {
    workspaceMode.value = "replay";
  } else if (testError.value) {
    notifyError("Test Dataset creation failed", testError.value);
  }
}
const canStartRun = computed(
  () => Boolean(testDataset.value) && !originLoading.value && !testLoading.value &&
    (!runState.value || ["completed", "disposed"].includes(runState.value.status)) && !runBusy.value,
);
const canRestartRun = computed(
  () => Boolean(testDataset.value) && !originLoading.value && !testLoading.value &&
    Boolean(runState.value) && runState.value?.status !== "running" &&
    !runBusy.value,
);
const replayToolbarContext = computed(() => {
  const test = testDataset.value;
  if (!test) return "NO TEST DATASET · CREATE AN INCLUSIVE INTERVAL";

  const bars = origin.value?.bars ?? [];
  const startBar = bars.find((bar) => bar.sbarId === test.startSbarId);
  const endBar = bars.find((bar) => bar.sbarId === test.endSbarId);
  const startTime = startBar
    ? formatDomainTimestamp(startBar.tsEvent, test.timeframe)
    : "—";
  const endTime = endBar
    ? formatDomainTimestamp(endBar.tsEvent, test.timeframe)
    : "—";

  return `${test.instrumentId} · ${test.timeframe} · ${test.sbarCount.toLocaleString()} SBARS · ${startTime} → ${endTime}`;
});

const {
  devtoolsContextMenu,
  devtoolsAvailable,
  handleContextMenu,
  dismissDevtoolsContextMenu,
  openDevtoolsFromContextMenu,
  refreshPageFromContextMenu,
} = useDevtoolsContextMenu();

const { instrumentGroups } = useCatalogGroups(datasets);

// Layout-only state: changing workspace or panel visibility never mutates domain state.
type WorkspaceMode = "dataset" | "replay" | "compare";
const workspaceMode = ref<WorkspaceMode>("dataset");

const {
  selectedInspectorObject,
  selectedInspectorSbar,
  selectedInspectorCbar,
  selectedInspectorSwing,
  selectedInspectorTrend,
  selectSbar: selectInspectorSbar,
  selectStructureObject: selectInspectorStructureObject,
  clearSelection: clearInspectorSelection,
} = useInspectorSelection(origin, workspaceMode);
const inspectorContext = computed<InspectorWorkspaceContext>(() => {
  if (workspaceMode.value === "dataset") {
    const selectedObject = selectedInspectorSbar.value
      ? { kind: "sbar" as const, object: selectedInspectorSbar.value }
      : selectedInspectorCbar.value
        ? { kind: "cbar" as const, object: selectedInspectorCbar.value }
        : selectedInspectorSwing.value
          ? { kind: "swing" as const, object: selectedInspectorSwing.value }
          : selectedInspectorTrend.value
            ? { kind: "trend" as const, object: selectedInspectorTrend.value }
            : null;
    return {
      workspace: "dataset",
      originDatasetId: origin.value?.originDatasetId ?? null,
      timeframe: origin.value?.timeframe ?? null,
      structureEnabled: origin.value?.enableStructure ?? false,
      selectedObject,
    };
  }
  if (workspaceMode.value === "replay") {
    return {
      workspace: "replay",
      timeframe: selectedReplaySnapshotObject.value?.timeframe ?? testDataset.value?.timeframe ?? origin.value?.timeframe ?? null,
      checkpoint: replayInspector.value,
      selectedObject: selectedReplayInspectorObject.value,
      snapshotId: selectedReplaySnapshotObject.value?.snapshotId ?? null,
      snapshotLabel: selectedReplaySnapshotObject.value?.snapshotLabel ?? null,
      snapshotBars: selectedReplaySnapshotObject.value?.bars ?? [],
      snapshotStructure: selectedReplaySnapshotObject.value?.structure ?? null,
      error: replayInspectorError.value,
    };
  }
  return {
    workspace: "compare",
    difference: selectedCompareDifference.value,
    baselineSnapshotId: compareResult.value?.baseline.snapshotId ?? null,
    candidateSnapshotId: compareResult.value?.candidate.snapshotId ?? null,
  };
});
watch(workspaceMode, (mode) => {
  if (mode !== "compare") selectedCompareDifference.value = null;
  if (mode !== "replay") {
    selectedReplayChartObject.value = null;
    selectedReplaySnapshotObject.value = null;
  }
  if (mode === "replay") void refreshReplayInspector();
});

const {
  inspectorCollapsed, diagnosticsCollapsed, inspectorDock, diagnosticsDock,
  inspectorWidth, inspectorHeight, diagnosticsWidth, diagnosticsHeight,
  shellStyle, setDock, toggleCollapsed, handleInspectorHeadingClick, handleDiagnosticsHeadingClick,
  startPanelResize, handlePanelResizeKey, inspectorWidthLimit, inspectorHeightLimit,
  diagnosticsWidthLimit, diagnosticsHeightLimit, startDockDrag, allowDockDrop, dropDockPanel,
  closeDockMenus,
} = useDockLayout();
// A successful user Load owns the Origin → Test Dataset handoff. Startup must
// not launch a later refresh that could supersede a Test Dataset created meanwhile.
let originHandoffDuringStartup = false;

async function handleRunCommand(command: RunCommand): Promise<void> {
  if (command === "play") {
    startPlayback();
    return;
  }
  if (command === "pause") {
    await pausePlayback();
    return;
  }
  // Lifecycle commands must wait for an in-flight playback Step before
  // validating against the resulting authoritative RunState.
  if (
    ["stop", "restart", "reset"].includes(command) &&
    playbackStatus.value === "playing"
  ) {
    await stopPlayback();
  }
  if (!isRunCommandEligible(
    command,
    runState.value?.status ?? null,
    runBusy.value,
    canStartRun.value,
    canRestartRun.value,
  )) return;

  // Stop scheduling and wait for an in-flight Step before any conflicting command.
  await stopPlayback();

  // START owns the transition from a retained prior result to a fresh Run.
  // Reset is still a lifecycle operation, but no longer a separate toolbar action.
  if (command === "start" && runState.value) {
    const resetSucceeded = await executeRunCommand("reset");
    if (!resetSucceeded) {
      runError.value = runError.value ||
        "Replay could not clear the previous Run context; a new Run was not started.";
      notifyError("Replay start failed", runError.value);
      return;
    }
    const resetStateConfirmed = await refreshRunState();
    if (!resetStateConfirmed || runState.value !== null) {
      runError.value = runError.value ||
        "Replay did not confirm an empty Run state; a new Run was not started.";
      notifyError("Replay start failed", runError.value);
      return;
    }
    replayInspector.value = null;
    replayInspectorError.value = "";
    selectedReplayChartObject.value = null;
  }

  // Re-check after the internal Reset; Start must not proceed unless the
  // previous Run context is confirmed empty and all prerequisites still hold.
  if (!isRunCommandEligible(
    command,
    runState.value?.status ?? null,
    runBusy.value,
    canStartRun.value,
    canRestartRun.value,
  )) return;

  const commandSucceeded = await executeRunCommand(command);
  if (!commandSucceeded) {
    notifyError(`Replay ${command} failed`, runError.value || "The operation did not complete.");
    return;
  }
  if (command === "start" || command === "restart") {
    await refreshReplayInspector();
  }
  if (command === "reset") {
    replayInspector.value = null;
    replayInspectorError.value = "";
  }
}

const {
  playbackStatus,
  playbackDelayMs,
  play: startPlayback,
  pauseAndWait: pausePlayback,
  stopAndWait: stopPlayback,
  setPlaybackDelay,
} = usePlaybackController(
  runState,
  runBusy,
  runError,
  async (command) => { await executeRunCommand(command); },
);

async function handleSaveSnapshot(): Promise<void> {
  if (playbackStatus.value === "playing" || !hasCompletedRunResult(runState.value)) return;
  await saveCompletedRunSnapshot();
  if (snapshotsError.value) notifyError("Snapshot save failed", snapshotsError.value);
}

async function handleRefreshCatalog(): Promise<void> {
  await refreshDatasets();
  if (discoveryError.value) notifyError("Catalog refresh failed", discoveryError.value);
}

async function handleLoadOrigin(): Promise<void> {
  if (!canLoadOrigin.value) return;
  originLoadPreparing.value = true;
  try {
    await stopPlayback();
    await waitForRunIdle();
    if (runState.value) {
      const resetSucceeded = await executeRunCommand("reset");
      const resetStateConfirmed = resetSucceeded && await refreshRunState();
      if (!resetSucceeded || !resetStateConfirmed || runState.value !== null) {
        notifyError(
          "Origin load failed",
          runError.value || "Replay Reset did not confirm an empty Run state; Origin was not reloaded.",
        );
        return;
      }

      replayInspector.value = null;
      replayInspectorError.value = "";
      selectedReplayChartObject.value = null;
      selectedReplaySnapshotObject.value = null;
      targetSbarId.value = null;
    }
    await startLoad();
    if (loadStatus.value === "failed") notifyError("Origin load failed", loadError.value);
  } catch (error) {
    notifyError("Origin load failed", error instanceof Error ? error.message : String(error));
  } finally {
    originLoadPreparing.value = false;
  }
}

async function handleCompare(baselineSnapshotId: string, candidateSnapshotId: string): Promise<void> {
  if (originLoading.value) return;
  await runCompare(baselineSnapshotId, candidateSnapshotId);
  if (compareError.value) notifyError("Snapshot comparison failed", compareError.value);
}

async function handleRefreshSnapshots(): Promise<void> {
  await refreshSnapshots();
  if (snapshotsError.value) notifyError("Snapshot list refresh failed", snapshotsError.value);
}

const canControlPlaybackShortcut = computed(() =>
  workspaceMode.value === "replay" &&
  (Boolean(targetSbarId.value) || playbackStatus.value === "playing" ||
    Boolean(runState.value && ["ready", "paused"].includes(runState.value.status))),
);
const canUseReplayKeyboardShortcuts = computed(() =>
  workspaceMode.value === "replay" &&
  (canStartRun.value || canRestartRun.value ||
    Boolean(runState.value && ["ready", "running", "paused"].includes(runState.value.status)) ||
    playbackStatus.value === "playing"),
);
watch(workspaceMode, (mode) => {
  if (mode !== "replay") void pausePlayback();
});

useReplayKeyboardShortcut(
  playbackStatus,
  canControlPlaybackShortcut,
  runBusy,
  targetSbarId,
  handleRestartToSBar,
  handleRunCommand,
  canUseReplayKeyboardShortcuts,
  playbackDelayMs,
  setPlaybackDelay,
);

async function startLoad(): Promise<void> {
  await loadSelectedOrigin(async (loadedOrigin) => {
    originHandoffDuringStartup = true;
    clearInspectorSelection();
    resetForOrigin();
    // Keep cross-domain handoff in the page composition root.
    prepareForOrigin(loadedOrigin);
    replayInspector.value = null;
    replayInspectorError.value = "";
    selectedReplayChartObject.value = null;
    selectedReplaySnapshotObject.value = null;
    selectedCompareDifference.value = null;
    compareResult.value = null;
    compareError.value = "";
    targetSbarId.value = null;
    const currentTestDataset = await refreshCurrentTestDataset();
    initializeFromTestDataset(currentTestDataset);
    if (testError.value) notifyError("Test Dataset refresh failed", testError.value);
  });
}


onMounted(async () => {
  // Run state is part of startup hydration; Replay no longer relies on manual Refresh.
  await Promise.all([refreshDatasets(), refreshCurrentOrigin(), refreshSnapshots(), refreshRunState()]);
  // If a user Load completed during startup, its handoff already refreshed the
  // Test Dataset. Do not issue a later startup read that could overwrite a mutation.
  if (!originHandoffDuringStartup) {
    const currentTestDataset = await refreshCurrentTestDataset();
    if (!originHandoffDuringStartup) {
      initializeFromTestDataset(currentTestDataset);
      if (testError.value) notifyError("Test Dataset refresh failed", testError.value);
    }
  }
});

</script>

<template>
  <AppToastHost />
  <main
    class="debugger-shell"
    data-testid="debugger-shell"
    :class="{ 'catalog-is-hidden': workspaceMode !== 'dataset', ['inspector-dock-' + inspectorDock]: true, 'inspector-is-collapsed': inspectorCollapsed, ['diagnostics-dock-' + diagnosticsDock]: true, 'diagnostics-is-collapsed': diagnosticsCollapsed }"
    :style="shellStyle"
    @dragover="allowDockDrop"
    @drop="dropDockPanel"
  >
    <WorkbenchTopbar :workspace-mode="workspaceMode" :origin-available="Boolean(origin)" @update:workspace-mode="workspaceMode = $event" />


      <section data-testid="chart-workspace" class="workbench-main">
        <WorkspaceToolbar
          :workspace-mode="workspaceMode"
          :replay-context="replayToolbarContext"
        >
          <template #actions>
            <ReplayToolbarControls
              v-if="workspaceMode === 'replay'"
              :run-state="runState"
              :run-busy="runBusy"
              :run-error="runError"
              :snapshot-save-busy="snapshotSaveBusy"
              :playback-status="playbackStatus"
              :playback-delay-ms="playbackDelayMs"
              @set-playback-delay="setPlaybackDelay"
              :can-start-run="canStartRun"
              :can-restart-run="canRestartRun"
              @command="handleRunCommand"
              @refresh="refreshRunState"
              @save-snapshot="handleSaveSnapshot"
            />
            <CompareToolbarControls
              v-show="workspaceMode === 'compare'"
              :snapshots="snapshots"
              :compare-loading="compareLoading || originLoading"
              @compare="handleCompare"
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
            <DatasetWorkspace
              :active="workspaceMode === 'dataset'"
              :datasets="datasets"
              :selected-id="selectedId"
              :selected-dataset="selectedDataset"
              :instrument-groups="instrumentGroups"
              :refreshing="refreshing"
              :loading="originLoading"
              :mutation-busy="!canLoadOrigin"
              :discovery-error="discoveryError"
              :enable-structure="enableStructure"
              :origin="origin"
              :load-status="displayedOriginLoadStatus"
              :load-error="loadError"
              :format-domain-timestamp="formatDomainTimestamp"
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
              :selected-object="selectedInspectorObject"
              :selection-start-sbar-id="rangeSelectionPendingStart ?? (rangeSelectionReady ? startSbarId : null)"
              :selection-end-sbar-id="rangeSelectionReady ? endSbarId : null"
              :selection-pending="rangeSelectionPendingStart !== null"
              :selection-editable="canMutateTest && !testLoading"
              @refresh-catalog="handleRefreshCatalog"
              @select-dataset="selectedId = $event"
              @update-enable-structure="enableStructure = $event"
              @load-origin="handleLoadOrigin"
              @create-test-dataset="createSelectedTestDataset"
              @select-all-sbars="selectAllOriginRange"
              @sbar-click="handleOriginSbarClick"
              @object-click="handleOriginObjectClick"
              @range-boundary-change="handleRangeBoundaryChange"
              @selection-error="handleRangeSelectionError"
              @cancel-range-selection="cancelOriginRangeSelection"
            />
            <ReplayWorkspace
              :key="origin?.originDatasetId ?? 'no-origin'"
              :active="workspaceMode === 'replay'"
              :origin="origin"
              :test-dataset="testDataset"
              :run-state="runState"
              :playback-status="playbackStatus"
              :structure="replayInspector?.sbarId === runState?.cursorSbarId ? (replayInspector?.structure ?? null) : null"
              :selected-object="selectedReplayChartObject"
              :target-sbar-id="targetSbarId"
              :fast-forwarding="fastForwarding"
              :snapshots="snapshots"
              @object-select="handleReplayObjectSelection"
              @snapshot-select="handleReplaySnapshotSelection"
              @target-select="handleReplayTargetSelection"
              @target-cancel="cancelReplayTarget"
            />
<CompareWorkspace
              :active="workspaceMode === 'compare'"
              :snapshots="snapshots"
              :snapshots-loading="snapshotsLoading"
              :snapshots-error="snapshotsError"
              :compare-result="compareResult"
              :compare-loading="compareLoading || originLoading"
              :compare-error="compareError"
              :format-lifecycle-timestamp="formatLifecycleTimestamp"
              @refresh-snapshots="handleRefreshSnapshots"
              @select-difference="handleCompareDifferenceSelection"
/>
          </div>


        </div>
      </section>
      <aside data-testid="inspector-panel" class="inspector-rail" :class="['dock-' + inspectorDock, { collapsed: inspectorCollapsed }]">
        <div class="panel-resize-edge inspector-resize-edge" data-testid="inspector-resize-edge" role="separator" aria-label="Resize Inspector" :aria-orientation="inspectorDock === 'left' || inspectorDock === 'right' ? 'vertical' : 'horizontal'" :aria-valuenow="inspectorDock === 'left' || inspectorDock === 'right' ? inspectorWidth : inspectorHeight" :aria-valuemin="inspectorDock === 'left' || inspectorDock === 'right' ? 180 : 100" :aria-valuemax="inspectorDock === 'left' || inspectorDock === 'right' ? inspectorWidthLimit() : inspectorHeightLimit()" tabindex="0" @pointerdown="startPanelResize('inspector', $event)" @keydown="handlePanelResizeKey('inspector', $event)"></div>
        <div
          class="rail-heading"
          data-testid="inspector-heading"
          :class="{ 'collapsed-heading-click-target': inspectorCollapsed }"
          @click="handleInspectorHeadingClick"
        >
          <span class="panel-title panel-dock-drag-handle" data-testid="inspector-dock-drag-handle" draggable="true" title="Drag to any workbench edge to dock" @dragstart="startDockDrag('inspector', $event)">Inspector</span>
          <span class="tag inspector-object-tag">OBJECT</span>
          <span class="spacer"></span>
          <details class="dock-menu" data-testid="inspector-dock-menu" @click.stop>
            <summary class="subtle-button rail-toggle" aria-label="Move Inspector" title="Move or dock panel">⋯</summary>
            <div class="dock-menu-options" role="group" aria-label="Inspector docking position">
              <button class="dock-menu-option" data-testid="inspector-dock-left" :aria-pressed="inspectorDock === 'left'" @click="setDock('inspector', 'left'); closeDockMenus()">Dock Left</button>
              <button class="dock-menu-option" data-testid="inspector-dock-right" :aria-pressed="inspectorDock === 'right'" @click="setDock('inspector', 'right'); closeDockMenus()">Dock Right</button>
              <button class="dock-menu-option" data-testid="inspector-dock-top" :aria-pressed="inspectorDock === 'top'" @click="setDock('inspector', 'top'); closeDockMenus()">Dock Top</button>
              <button class="dock-menu-option" data-testid="inspector-dock-bottom" :aria-pressed="inspectorDock === 'bottom'" @click="setDock('inspector', 'bottom'); closeDockMenus()">Dock Bottom</button>
            </div>
          </details>
          <button class="subtle-button rail-toggle" :aria-label="inspectorCollapsed ? 'Expand Inspector' : 'Collapse Inspector'" :title="inspectorCollapsed ? 'Expand Inspector' : 'Collapse Inspector'" @click.stop="toggleCollapsed('inspector')">{{ inspectorCollapsed ? '+' : '−' }}</button>
        </div>
        <ObjectInspector
          v-if="!inspectorCollapsed"
          :context="inspectorContext"
          :origin="origin"
          :origin-bars="origin?.bars ?? []"
          :origin-structure="origin?.structure ?? null"
        />
      </aside>
      <Diagnostics
        :dock="diagnosticsDock"
        :collapsed="diagnosticsCollapsed"
        :width="diagnosticsWidth"
        :height="diagnosticsHeight"
        :width-limit="diagnosticsWidthLimit"
        :height-limit="diagnosticsHeightLimit"
        :discovery-error="discoveryError"
        :load-error="loadError"
        :test-error="testError"
        :run-error="runError"
        :snapshots-error="snapshotsError"
        @set-dock="setDock('diagnostics', $event)"
        @toggle-collapsed="toggleCollapsed('diagnostics')"
        @heading-click="handleDiagnosticsHeadingClick"
        @start-resize="startPanelResize('diagnostics', $event)"
        @resize-key="handlePanelResizeKey('diagnostics', $event)"
        @start-dock-drag="startDockDrag('diagnostics', $event)"
        @close-dock-menus="closeDockMenus"
      />

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


<style scoped>
/* Development-only browser tooling entry point; not part of the production UI. */
.devtools-context-menu {
  position: fixed;
  z-index: 10000;
  min-width: 176px;
  padding: 4px;
  border: 1px solid var(--dbg-border);
  border-radius: 4px;
  background: var(--dbg-surface-1, #1b2025);
  box-shadow: 0 8px 24px #0009;
}

.devtools-context-menu button {
  display: block;
  width: 100%;
  min-height: 30px;
  padding: 0 9px;
  border: 0;
  border-radius: 2px;
  background: transparent;
  color: var(--dbg-text-primary, #e3e8eb);
  text-align: left;
  cursor: pointer;
  font: 11px ui-monospace, SFMono-Regular, Consolas, monospace;
}

.devtools-context-menu button:hover,
.devtools-context-menu button:focus-visible {
  outline: none;
  background: var(--dbg-surface-3, #30383f);
}
</style>
