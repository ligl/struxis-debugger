<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import CatalogPanel from "./components/CatalogPanel.vue";
import OriginPanel from "./components/OriginPanel.vue";
import OriginChart from "./components/OriginChart.vue";
import RunChart from "./components/RunChart.vue";
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
watch(workspaceMode, (mode) => {
  if (mode !== "compare") selectedCompareDifferenceKey.value = null;
  if (mode === "replay") void refreshReplayInspector();
});
const catalogCollapsed = ref(false);
const inspectorCollapsed = ref(false);
const diagnosticsCollapsed = ref(false);
const inspectorDock = ref<"left" | "right">("right");
const diagnosticsDock = ref<"top" | "bottom">("bottom");

// Dock dimensions are presentation state only; they never affect Struxis state.
const inspectorWidth = ref(282);
const diagnosticsHeight = ref(164);
let runPollInterval: number | null = null;
type PanelResizeTarget = "inspector" | "diagnostics" | null;
const panelResizeTarget = ref<PanelResizeTarget>(null);
let panelResizeStart = 0;
let panelResizeInitialSize = 0;

function startPanelResize(target: Exclude<PanelResizeTarget, null>, event: PointerEvent): void {
  if (event.button !== 0) return;
  panelResizeTarget.value = target;
  panelResizeStart = target === "inspector" ? event.clientX : event.clientY;
  panelResizeInitialSize = target === "inspector" ? inspectorWidth.value : diagnosticsHeight.value;
  event.preventDefault();
}

function inspectorWidthLimit(): number {
  // Preserve a useful chart viewport when the app runs in a smaller window.
  return Math.max(220, Math.min(520, window.innerWidth - 420));
}

function diagnosticsHeightLimit(): number {
  // Keep enough vertical room for the active workspace and its toolbar.
  return Math.max(100, Math.min(480, window.innerHeight - 260));
}

function handlePanelResize(event: PointerEvent): void {
  const target = panelResizeTarget.value;
  if (!target) return;
  if (target === "inspector") {
    // Dragging the divider away from the chart increases the dock width on
    // either side: left-docked panels grow to the right, right-docked panels
    // grow to the left.
    const delta = inspectorDock.value === "right"
      ? panelResizeStart - event.clientX
      : event.clientX - panelResizeStart;
    inspectorWidth.value = Math.max(220, Math.min(inspectorWidthLimit(), panelResizeInitialSize + delta));
  } else {
    // A top-docked Diagnostics panel grows downward; a bottom-docked panel
    // grows upward.
    const delta = diagnosticsDock.value === "bottom"
      ? panelResizeStart - event.clientY
      : event.clientY - panelResizeStart;
    diagnosticsHeight.value = Math.max(100, Math.min(diagnosticsHeightLimit(), panelResizeInitialSize + delta));
  }
}

function handlePanelResizeKey(
  target: Exclude<PanelResizeTarget, null>,
  event: KeyboardEvent,
): void {
  const increase = target === "inspector"
    ? (inspectorDock.value === "right" ? event.key === "ArrowLeft" : event.key === "ArrowRight")
    : (diagnosticsDock.value === "bottom" ? event.key === "ArrowUp" : event.key === "ArrowDown");
  const decrease = target === "inspector"
    ? (inspectorDock.value === "right" ? event.key === "ArrowRight" : event.key === "ArrowLeft")
    : (diagnosticsDock.value === "bottom" ? event.key === "ArrowDown" : event.key === "ArrowUp");
  if (!increase && !decrease && event.key !== "Home" && event.key !== "End") return;

  event.preventDefault();
  if (target === "inspector") {
    inspectorWidth.value = event.key === "Home"
      ? 220
      : event.key === "End"
        ? inspectorWidthLimit()
        : Math.max(220, Math.min(inspectorWidthLimit(), inspectorWidth.value + (increase ? 12 : -12)));
  } else {
    diagnosticsHeight.value = event.key === "Home"
      ? 100
      : event.key === "End"
        ? diagnosticsHeightLimit()
        : Math.max(100, Math.min(diagnosticsHeightLimit(), diagnosticsHeight.value + (increase ? 12 : -12)));
  }
}

function stopPanelResize(): void {
  panelResizeTarget.value = null;
}

function toggleInspectorDock(): void {
  inspectorDock.value = inspectorDock.value === "right" ? "left" : "right";
}

function toggleDiagnosticsDock(): void {
  diagnosticsDock.value = diagnosticsDock.value === "bottom" ? "top" : "bottom";
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
  <main class="debugger-shell" data-testid="debugger-shell" :style="{ '--inspector-width': inspectorWidth + 'px', '--diagnostics-height': diagnosticsHeight + 'px' }" :class="{ 'inspector-dock-left': inspectorDock === 'left', 'diagnostics-dock-top': diagnosticsDock === 'top' }">
    <header class="topbar workbench-topbar">
      <div class="brand-block">
        <p class="eyebrow">CAPITUS / STRUXIS DEBUGGER</p>
        <h1>Struxis Debugger</h1>
      </div>
      <nav class="workspace-switcher" aria-label="Debugger workspace">
        <button class="workspace-tab" data-testid="workspace-dataset" :class="{ active: workspaceMode === 'dataset' }" @click="workspaceMode = 'dataset'">01 / Dataset</button>
        <button class="workspace-tab" data-testid="workspace-replay" :class="{ active: workspaceMode === 'replay' }" @click="workspaceMode = 'replay'">02 / Replay</button>
        <button class="workspace-tab" data-testid="workspace-compare" :class="{ active: workspaceMode === 'compare' }" @click="workspaceMode = 'compare'">03 / Compare</button>
      </nav>
      <div class="runtime-mark">
        <span class="runtime-dot" :class="{ active: origin }"></span>
        <span>{{ origin ? "ORIGIN AVAILABLE" : "NO ORIGIN LOADED" }}</span>
      </div>
    </header>

    <div data-testid="workbench-body" class="workbench-body" :class="{ 'catalog-is-collapsed': catalogCollapsed, 'catalog-is-hidden': workspaceMode !== 'dataset', 'inspector-is-collapsed': inspectorCollapsed }">
      <aside v-if="workspaceMode === 'dataset'" data-testid="catalog-rail" class="catalog-rail" :class="{ collapsed: catalogCollapsed }">
        <div class="rail-heading">
          <span class="section-index">SOURCE</span>
          <button class="subtle-button rail-toggle" :aria-label="catalogCollapsed ? 'Expand Catalog' : 'Collapse Catalog'" @click="catalogCollapsed = !catalogCollapsed">{{ catalogCollapsed ? '›' : '‹' }}</button>
        </div>
        <CatalogPanel v-if="!catalogCollapsed" :datasets="datasets" :selected-id="selectedId" :selected-dataset="selectedDataset" :instrument-groups="instrumentGroups" :collapsed-instrument-ids="collapsedInstrumentIds" :refreshing="refreshing" :loading="loading" :mutation-busy="!canLoadOrigin" :discovery-error="discoveryError" :enable-structure="enableStructure" @refresh="refreshDatasets" @select-dataset="selectedId = $event" @toggle-group="toggleInstrumentGroup" @update:enable-structure="enableStructure = $event" @load="startLoad" />
      </aside>

      <section data-testid="workbench-main" class="workbench-main">
        <div class="workflow-toolbar">
          <div>
            <p class="section-index">{{ workspaceMode === "dataset" ? "WORKSPACE / 01" : workspaceMode === "replay" ? "WORKSPACE / 02" : "WORKSPACE / 03" }}</p>
            <h2>{{ workspaceMode === "dataset" ? "Dataset Preparation" : workspaceMode === "replay" ? "Run Replay" : "Snapshot Comparison" }}</h2>
          </div>
          <div class="toolbar-actions">
            <button v-if="workspaceMode === 'dataset'" class="subtle-button" @click="catalogCollapsed = !catalogCollapsed">{{ catalogCollapsed ? "Show Catalog" : "Hide Catalog" }}</button>
            <button class="subtle-button" @click="diagnosticsCollapsed = !diagnosticsCollapsed">{{ diagnosticsCollapsed ? "Show Diagnostics" : "Hide Diagnostics" }}</button>
          </div>
        </div>

        <div data-testid="primary-workspace" class="primary-workspace" :class="{ 'inspector-dock-left': inspectorDock === 'left' }">
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
            <RunChart
              v-if="workspaceMode === 'replay'"
              :origin="origin"
              :test-dataset="testDataset"
              :run-state="runState"
            />
            <div v-show="workspaceMode === 'dataset'" class="workspace-mode dataset-preparation-panel">
              <OriginPanel :origin="origin" :load-status="loadStatus" :load-error="loadError" :format-timestamp="formatTimestamp" />
              <TestDatasetPanel :origin="origin" :test-dataset="testDataset" :start-sbar-id="startSbarId" :end-sbar-id="endSbarId" :range-selection-ready="rangeSelectionReady" :range-selection-pending="rangeSelectionPendingStart !== null" :selected-range-count="selectedRangeCount" :test-loading="testLoading" :can-mutate-test="canMutateTest" :test-error="testError" :test-status="testStatus" @create="createSelectedTestDataset" />
            </div>
            <div v-show="workspaceMode === 'replay'" class="workspace-mode replay-controls">
              <RunControlPanel :run-state="runState" :run-busy="runBusy" :run-error="runError" :run-status-message="runStatusMessage" :can-start-run="canStartRun" :can-restart-run="canRestartRun" @command="handleRunCommand" @refresh="refreshRunState" />
            </div>
            <div v-show="workspaceMode === 'compare'" class="workspace-mode">
              <SnapshotPanel :snapshots="snapshots" :snapshots-loading="snapshotsLoading" :snapshots-error="snapshotsError" :snapshot-kind-label="snapshotKindLabel" :format-timestamp="formatTimestamp" :compare-result="compareResult" :compare-loading="compareLoading" :compare-error="compareError" :selected-difference-key="selectedCompareDifferenceKey" @refresh="refreshSnapshots" @compare="runCompare" @select-difference="selectCompareDifference" />
            </div>
          </div>

          <aside data-testid="inspector-rail" class="inspector-rail" :class="{ collapsed: inspectorCollapsed }">
            <div class="panel-resize-edge inspector-resize-edge" data-testid="inspector-resize-edge" role="separator" aria-label="Resize Inspector" aria-orientation="vertical" :aria-valuenow="inspectorWidth" aria-valuemin="220" :aria-valuemax="inspectorWidthLimit()" tabindex="0" @pointerdown="startPanelResize('inspector', $event)" @keydown="handlePanelResizeKey('inspector', $event)"></div>
            <div class="rail-heading">
              <span class="section-index">INSPECTOR</span>
              <button class="subtle-button rail-toggle" aria-label="Move Inspector to opposite side" title="Move Inspector to opposite side" @click="toggleInspectorDock">⇆</button>
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
        </div>
      </section>
    </div>

    <section v-if="!diagnosticsCollapsed" data-testid="diagnostics-dock" class="diagnostics-dock">
      <div class="panel-resize-edge diagnostics-resize-edge" data-testid="diagnostics-resize-edge" role="separator" aria-label="Resize Diagnostics" aria-orientation="horizontal" :aria-valuenow="diagnosticsHeight" aria-valuemin="100" :aria-valuemax="diagnosticsHeightLimit()" tabindex="0" @pointerdown="startPanelResize('diagnostics', $event)" @keydown="handlePanelResizeKey('diagnostics', $event)"></div>
      <div class="diagnostics-heading">
        <div>
          <p class="section-index">DIAGNOSTICS</p>
          <h2>Workflow events &amp; errors</h2>
        </div>
        <div class="dock-actions"><button class="subtle-button" data-testid="diagnostics-dock-toggle" @click="toggleDiagnosticsDock">{{ diagnosticsDock === 'bottom' ? 'Move to Top' : 'Move to Bottom' }}</button><button class="subtle-button" data-testid="diagnostics-collapse-toggle" @click="diagnosticsCollapsed = true">Collapse</button></div>
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
    <button v-else class="diagnostics-reopen" @click="diagnosticsCollapsed = false">＋ Diagnostics</button>

    <footer class="footer-bar">
      <span>STRUXIS DEBUGGER / WORKBENCH</span>
      <span>LOAD CONTRACT · COMPLETE INPUT · ATOMIC REPLACEMENT</span>
    </footer>
  </main>
</template>
