<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
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
import type { InspectorWorkspaceContext, ObjectDifferenceDto, OriginObjectSelection } from "./origin-types";
import type { RunCommand } from "./run-command-eligibility";
import { isRunCommandEligible } from "./run-command-eligibility";
import { useSnapshots } from "./composables/useSnapshots";
import { useOriginLoad } from "./composables/useOriginLoad";
import { useTestDataset } from "./composables/useTestDataset";
import { useRunControl } from "./composables/useRunControl";
import { useCatalogGroups } from "./composables/useCatalogGroups";
import { useOriginRangeSelection } from "./composables/useOriginRangeSelection";
import { useDockLayout } from "./composables/useDockLayout";
import { useInspectorSelection } from "./composables/useInspectorSelection";
import { useReplayInspector } from "./composables/useReplayInspector";
import { useReplayKeyboardShortcut } from "./composables/useReplayKeyboardShortcut";
import { useRunPolling } from "./composables/useRunPolling";
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
const selectedCompareDifferenceKey = ref<string | null>(null);

async function refreshReplayInspector(): Promise<void> {
  await refreshReplayInspectorState(Boolean(runState.value));
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
const diagnosticsCategory = ref("all");

const {
  inspectorCollapsed, diagnosticsCollapsed, inspectorDock, diagnosticsDock,
  inspectorWidth, inspectorHeight, diagnosticsWidth, diagnosticsHeight,
  shellStyle, setDock, toggleCollapsed, handleDiagnosticsHeadingClick,
  startPanelResize, handlePanelResizeKey, inspectorWidthLimit, inspectorHeightLimit,
  diagnosticsWidthLimit, diagnosticsHeightLimit, startDockDrag, allowDockDrop, dropDockPanel,
} = useDockLayout();
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

useReplayKeyboardShortcut(runState, runBusy, handleRunCommand);
useRunPolling(runState, runBusy, refreshRunState, refreshReplayInspector);

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
  document.addEventListener("pointerdown", handleDockMenuPointerDown);
  await Promise.all([refreshDatasets(), refreshCurrentOrigin(), refreshSnapshots()]);
  // If a user Load completed during startup, its handoff already refreshed the
  // Test Dataset. Do not issue a later startup read that could overwrite a mutation.
  if (!originHandoffDuringStartup) {
    const currentTestDataset = await refreshCurrentTestDataset();
    if (!originHandoffDuringStartup) initializeFromTestDataset(currentTestDataset);
  }
});

onUnmounted(() => {
  document.removeEventListener("pointerdown", handleDockMenuPointerDown);
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
                :selected-object="selectedInspectorObject"
                :selection-start-sbar-id="rangeSelectionPendingStart ?? (rangeSelectionReady ? startSbarId : null)"
                :selection-end-sbar-id="rangeSelectionReady ? endSbarId : null"
                :selection-pending="rangeSelectionPendingStart !== null"
                :selection-editable="canMutateTest && !testLoading"
                @sbar-click="handleOriginSbarClick"
                @object-click="handleOriginObjectClick"
                @range-boundary-change="handleRangeBoundaryChange"
                @selection-error="handleRangeSelectionError"
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
              <button class="dock-menu-option" data-testid="inspector-dock-left" :aria-pressed="inspectorDock === 'left'" @click="setDock('inspector', 'left'); closeDockMenus()">Dock Left</button>
              <button class="dock-menu-option" data-testid="inspector-dock-right" :aria-pressed="inspectorDock === 'right'" @click="setDock('inspector', 'right'); closeDockMenus()">Dock Right</button>
              <button class="dock-menu-option" data-testid="inspector-dock-top" :aria-pressed="inspectorDock === 'top'" @click="setDock('inspector', 'top'); closeDockMenus()">Dock Top</button>
              <button class="dock-menu-option" data-testid="inspector-dock-bottom" :aria-pressed="inspectorDock === 'bottom'" @click="setDock('inspector', 'bottom'); closeDockMenus()">Dock Bottom</button>
            </div>
          </details>
          <button class="subtle-button rail-toggle" :aria-label="inspectorCollapsed ? 'Expand Inspector' : 'Collapse Inspector'" :title="inspectorCollapsed ? 'Expand Inspector' : 'Collapse Inspector'" @click="toggleCollapsed('inspector')">{{ inspectorCollapsed ? '+' : '−' }}</button>
        </div>
        <ObjectInspector
          v-if="!inspectorCollapsed"
          :context="inspectorContext"
          :origin-bars="origin?.bars ?? []"
          :origin-structure="origin?.structure ?? null"
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
                <button class="dock-menu-option" data-testid="diagnostics-dock-left" :aria-pressed="diagnosticsDock === 'left'" @click="setDock('diagnostics', 'left'); closeDockMenus()">Dock Left</button>
                <button class="dock-menu-option" data-testid="diagnostics-dock-right" :aria-pressed="diagnosticsDock === 'right'" @click="setDock('diagnostics', 'right'); closeDockMenus()">Dock Right</button>
                <button class="dock-menu-option" data-testid="diagnostics-dock-top" :aria-pressed="diagnosticsDock === 'top'" @click="setDock('diagnostics', 'top'); closeDockMenus()">Dock Top</button>
                <button class="dock-menu-option" data-testid="diagnostics-dock-bottom" :aria-pressed="diagnosticsDock === 'bottom'" @click="setDock('diagnostics', 'bottom'); closeDockMenus()">Dock Bottom</button>
              </div>
            </details>
            <button class="subtle-button" data-testid="diagnostics-collapse-toggle"  :aria-label="diagnosticsCollapsed ? 'Expand Diagnostics' : 'Collapse Diagnostics'" :title="diagnosticsCollapsed ? 'Expand Diagnostics' : 'Collapse Diagnostics'" @click.stop="toggleCollapsed('diagnostics')">{{ diagnosticsCollapsed ? '+' : '−' }}</button>
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
