<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import WorkbenchTopbar from "./components/WorkbenchTopbar.vue";
import WorkspaceToolbar from "./components/WorkspaceToolbar.vue";
import CompareToolbarControls from "./components/CompareToolbarControls.vue";
import ReplayToolbarControls from "./components/ReplayToolbarControls.vue";
import ObjectInspector from "./components/ObjectInspector.vue";
import Diagnostics from "./components/Diagnostics.vue";
import DatasetWorkspace from "./components/DatasetWorkspace.vue";
import ReplayWorkspace from "./components/ReplayWorkspace.vue";
import CompareWorkspace from "./components/CompareWorkspace.vue";
import type { InspectorWorkspaceContext, ObjectDifferenceDto, OriginObjectSelection, ReplayChartSelection } from "./origin-types";
import type { RunCommand } from "./run-command-eligibility";
import { isRunCommandEligible } from "./run-command-eligibility";
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
} = useRunControl();

const canMutateTest = computed(
  () => !loading.value && !runBusy.value &&
    (!runState.value || ["completed", "disposed"].includes(runState.value.status)),
);

const {
  testDataset,
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

const {
  startSbarId, endSbarId, rangeSelectionPendingStart, rangeSelectionReady,
  selectedRangeCount, rangeSelectionStatus, handleRangeSbarClick,
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
  selectedReplayChartObject.value = selection;
}

type ReplayInspectorSelection = Extract<InspectorWorkspaceContext, { workspace: "replay" }>["selectedObject"];
const selectedReplayInspectorObject = computed<ReplayInspectorSelection>(() => {
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
  const object = checkpoint.structure?.swings.find((item) => item.swingId === selection.id);
  return object ? { kind: "swing", object } : null;
});

watch(
  [
    () => runState.value?.runId,
    () => runState.value?.cursorSbarId,
    () => testDataset.value?.testDatasetId,
  ],
  () => { selectedReplayChartObject.value = null; },
);

async function refreshReplayInspector(): Promise<void> {
  await refreshReplayInspectorState(Boolean(runState.value));
}

function handleCompareDifferenceSelection(difference: ObjectDifferenceDto | null): void {
  selectedCompareDifference.value = difference;
}


function handleOriginObjectClick(selection: Extract<OriginObjectSelection, { kind: "cbar" | "swing" }>): void {
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

  // Reconcile against backend ownership immediately before mutating Test Dataset.
  // The local Run DTO can be stale (for example after returning from Replay).
  const refreshed = await refreshRunState();
  if (!refreshed || !canMutateTest.value || !rangeSelectionReady.value) return;

  await createTestDataset(startSbarId.value, endSbarId.value);
}
const canStartRun = computed(
  () => Boolean(testDataset.value) && !loading.value && !testLoading.value &&
    (!runState.value || ["completed", "failed", "disposed"].includes(runState.value.status)) && !runBusy.value,
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
      timeframe: testDataset.value?.timeframe ?? origin.value?.timeframe ?? null,
      checkpoint: replayInspector.value,
      selectedObject: selectedReplayInspectorObject.value,
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
  if (mode !== "replay") selectedReplayChartObject.value = null;
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
  await executeRunCommand(command);
  if (command === "start" || command === "restart") {
    await refreshReplayInspector();
  } else if (command === "reset") {
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
  executeRunCommand,
);

async function handleSaveSnapshot(): Promise<void> {
  if (playbackStatus.value === "playing" || runState.value?.status !== "completed") return;
  await saveCompletedRunSnapshot();
}

const canControlPlaybackShortcut = computed(() =>
  workspaceMode.value === "replay" &&
  (playbackStatus.value === "playing" ||
    Boolean(runState.value && ["ready", "paused"].includes(runState.value.status))),
);
watch(workspaceMode, (mode) => {
  if (mode !== "replay") void pausePlayback();
});

useReplayKeyboardShortcut(
  playbackStatus,
  canControlPlaybackShortcut,
  runBusy,
  handleRunCommand,
);

async function startLoad(): Promise<void> {
  if (!canLoadOrigin.value) return;
  await loadSelectedOrigin(async (loadedOrigin) => {
    originHandoffDuringStartup = true;
    clearInspectorSelection();
    resetForOrigin();
    // Keep cross-domain handoff in the page composition root.
    prepareForOrigin(loadedOrigin);
    const currentTestDataset = await refreshCurrentTestDataset();
    initializeFromTestDataset(currentTestDataset);
  });
}


onMounted(async () => {
  // Run state is part of startup hydration; Replay no longer relies on manual Refresh.
  await Promise.all([refreshDatasets(), refreshCurrentOrigin(), refreshSnapshots(), refreshRunState()]);
  // If a user Load completed during startup, its handoff already refreshed the
  // Test Dataset. Do not issue a later startup read that could overwrite a mutation.
  if (!originHandoffDuringStartup) {
    const currentTestDataset = await refreshCurrentTestDataset();
    if (!originHandoffDuringStartup) initializeFromTestDataset(currentTestDataset);
  }
});

</script>

<template>
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
            <DatasetWorkspace
              :active="workspaceMode === 'dataset'"
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
              :selected-object="selectedInspectorObject"
              :selection-start-sbar-id="rangeSelectionPendingStart ?? (rangeSelectionReady ? startSbarId : null)"
              :selection-end-sbar-id="rangeSelectionReady ? endSbarId : null"
              :selection-pending="rangeSelectionPendingStart !== null"
              :selection-editable="canMutateTest && !testLoading"
              @refresh-catalog="refreshDatasets"
              @select-dataset="selectedId = $event"
              @update-enable-structure="enableStructure = $event"
              @load-origin="startLoad"
              @create-test-dataset="createSelectedTestDataset"
              @sbar-click="handleOriginSbarClick"
              @object-click="handleOriginObjectClick"
              @range-boundary-change="handleRangeBoundaryChange"
              @selection-error="handleRangeSelectionError"
              @cancel-range-selection="cancelOriginRangeSelection"
            />
            <ReplayWorkspace
              :active="workspaceMode === 'replay'"
              :origin="origin"
              :test-dataset="testDataset"
              :run-state="runState"
              :structure="replayInspector?.sbarId === runState?.cursorSbarId ? (replayInspector?.structure ?? null) : null"
              :selected-object="selectedReplayChartObject"
              :snapshots="snapshots"
              @object-select="handleReplayObjectSelection"
            />
<CompareWorkspace
              :active="workspaceMode === 'compare'"
              :snapshots="snapshots"
              :snapshots-loading="snapshotsLoading"
              :snapshots-error="snapshotsError"
              :compare-result="compareResult"
              :compare-loading="compareLoading"
              :compare-error="compareError"
              :format-lifecycle-timestamp="formatLifecycleTimestamp"
              @refresh-snapshots="refreshSnapshots"
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
