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
import type { InspectorWorkspaceContext, ObjectDifferenceDto, OriginObjectSelection } from "./origin-types";
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
  refreshRunState,
  executeRunCommand,
} = useRunControl();

const canMutateTest = computed(
  () => !loading.value && !runBusy.value &&
    (!runState.value || runState.value.status === "disposed"),
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
const selectedCompareDifference = ref<ObjectDifferenceDto | null>(null);

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
  if (!rangeSelectionReady.value) return;
  await createTestDataset(startSbarId.value, endSbarId.value);
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
    ["stop", "restart", "dispose"].includes(command) &&
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
  if (command === "step" || command === "start" || command === "restart") {
    await refreshReplayInspector();
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
  refreshReplayInspector,
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
  await Promise.all([refreshDatasets(), refreshCurrentOrigin(), refreshSnapshots()]);
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
              :structure="replayInspector?.structure ?? null"
              :snapshots="snapshots"
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
