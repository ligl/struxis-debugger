<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import CatalogPanel from "./components/CatalogPanel.vue";
import OriginPanel from "./components/OriginPanel.vue";
import OriginChart from "./components/OriginChart.vue";
import RunChart from "./components/RunChart.vue";
import TestDatasetPanel from "./components/TestDatasetPanel.vue";
import RunControlPanel from "./components/RunControlPanel.vue";
import SnapshotPanel from "./components/SnapshotPanel.vue";
import type { SnapshotArtifactDto } from "./origin-types";
import type { RunCommand } from "./run-command-eligibility";
import { isRunCommandEligible } from "./run-command-eligibility";
import { useSnapshots } from "./composables/useSnapshots";
import { useOriginLoad } from "./composables/useOriginLoad";
import { useTestDataset } from "./composables/useTestDataset";
import { useRunControl } from "./composables/useRunControl";
import { useCatalogGroups } from "./composables/useCatalogGroups";
import { resolveOriginRangeClick } from "./origin-range-selection";

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

const rangeSelectionPendingStart = ref<string | null>(null);
const rangeSelectionReady = ref(false);
const selectedRangeCount = ref(0);
const rangeSelectionStatus = ref(
  "Click anywhere in the chart plot to select the start time of your Test interval.",
);

function handleOriginSbarClick(sbarId: string): void {
  if (!origin.value || !canMutateTest.value || testLoading.value) return;
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
type WorkspaceMode = "origin" | "replay" | "snapshots";
const workspaceMode = ref<WorkspaceMode>("origin");
const catalogCollapsed = ref(false);
const inspectorCollapsed = ref(false);
const diagnosticsCollapsed = ref(false);

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
}

async function startLoad(): Promise<void> {
  if (!canLoadOrigin.value) return;
  await loadSelectedOrigin(async (loadedOrigin) => {
    originHandoffDuringStartup = true;
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
  await Promise.all([refreshDatasets(), refreshCurrentOrigin(), refreshSnapshots()]);
  // If a user Load completed during startup, its handoff already refreshed the
  // Test Dataset. Do not issue a later startup read that could overwrite a mutation.
  if (!originHandoffDuringStartup) await refreshCurrentTestDataset();
});

onUnmounted(() => {
  document.removeEventListener("keydown", handleReplayShortcut);
});
</script>

<template>
  <main class="debugger-shell" data-testid="debugger-shell">
    <header class="topbar workbench-topbar">
      <div class="brand-block">
        <p class="eyebrow">CAPITUS / STRUXIS DEBUGGER</p>
        <h1>Struxis Debugger</h1>
      </div>
      <nav class="workspace-switcher" aria-label="Debugger workspace">
        <button class="workspace-tab" :class="{ active: workspaceMode === 'origin' }" @click="workspaceMode = 'origin'">01 / Origin</button>
        <button class="workspace-tab" :class="{ active: workspaceMode === 'replay' }" @click="workspaceMode = 'replay'">02 / Test &amp; Replay</button>
        <button class="workspace-tab" :class="{ active: workspaceMode === 'snapshots' }" @click="workspaceMode = 'snapshots'">03 / Snapshots</button>
      </nav>
      <div class="runtime-mark">
        <span class="runtime-dot" :class="{ active: origin }"></span>
        <span>{{ origin ? "ORIGIN AVAILABLE" : "NO ORIGIN LOADED" }}</span>
      </div>
    </header>

    <div data-testid="workbench-body" class="workbench-body" :class="{ 'catalog-is-collapsed': catalogCollapsed, 'inspector-is-collapsed': inspectorCollapsed }">
      <aside data-testid="catalog-rail" class="catalog-rail" :class="{ collapsed: catalogCollapsed }">
        <div class="rail-heading">
          <span class="section-index">SOURCE</span>
          <button class="subtle-button rail-toggle" :aria-label="catalogCollapsed ? 'Expand Catalog' : 'Collapse Catalog'" @click="catalogCollapsed = !catalogCollapsed">{{ catalogCollapsed ? '›' : '‹' }}</button>
        </div>
        <CatalogPanel v-if="!catalogCollapsed" :datasets="datasets" :selected-id="selectedId" :selected-dataset="selectedDataset" :instrument-groups="instrumentGroups" :collapsed-instrument-ids="collapsedInstrumentIds" :refreshing="refreshing" :loading="loading" :mutation-busy="!canLoadOrigin" :discovery-error="discoveryError" :enable-structure="enableStructure" @refresh="refreshDatasets" @select-dataset="selectedId = $event" @toggle-group="toggleInstrumentGroup" @update:enable-structure="enableStructure = $event" @load="startLoad" />
      </aside>

      <section data-testid="workbench-main" class="workbench-main">
        <div class="workflow-toolbar">
          <div>
            <p class="section-index">{{ workspaceMode === "origin" ? "WORKFLOW / 01" : workspaceMode === "replay" ? "WORKFLOW / 02" : "WORKFLOW / 03" }}</p>
            <h2>{{ workspaceMode === "origin" ? "Origin Load" : workspaceMode === "replay" ? "Test Dataset & Replay" : "Snapshot Inventory" }}</h2>
          </div>
          <div class="toolbar-actions">
            <button class="subtle-button" @click="catalogCollapsed = !catalogCollapsed">{{ catalogCollapsed ? "Show Catalog" : "Hide Catalog" }}</button>
            <button class="subtle-button" @click="diagnosticsCollapsed = !diagnosticsCollapsed">{{ diagnosticsCollapsed ? "Show Diagnostics" : "Hide Diagnostics" }}</button>
          </div>
        </div>

        <div data-testid="primary-workspace" class="primary-workspace">
          <div data-testid="workspace-content" class="workspace-content">
            <template v-if="origin && workspaceMode === 'origin'">
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
              v-else-if="workspaceMode === 'replay'"
              :origin="origin"
              :test-dataset="testDataset"
              :run-state="runState"
            />
            <div v-show="workspaceMode === 'origin'" class="workspace-mode">
              <OriginPanel :origin="origin" :load-status="loadStatus" :load-error="loadError" :format-timestamp="formatTimestamp" />
            </div>
            <div v-show="workspaceMode === 'replay'" class="workspace-mode">
              <TestDatasetPanel :origin="origin" :test-dataset="testDataset" :start-sbar-id="startSbarId" :end-sbar-id="endSbarId" :range-selection-ready="rangeSelectionReady" :range-selection-pending="rangeSelectionPendingStart !== null" :selected-range-count="selectedRangeCount" :test-loading="testLoading" :can-mutate-test="canMutateTest" :test-error="testError" :test-status="testStatus" @create="createSelectedTestDataset" />
              <RunControlPanel :run-state="runState" :run-busy="runBusy" :run-error="runError" :run-status-message="runStatusMessage" :can-start-run="canStartRun" :can-restart-run="canRestartRun" @command="handleRunCommand" @refresh="refreshRunState" />
            </div>
            <div v-show="workspaceMode === 'snapshots'" class="workspace-mode">
              <SnapshotPanel :snapshots="snapshots" :snapshots-loading="snapshotsLoading" :snapshots-error="snapshotsError" :snapshot-kind-label="snapshotKindLabel" :format-timestamp="formatTimestamp" :compare-result="compareResult" :compare-loading="compareLoading" :compare-error="compareError" @refresh="refreshSnapshots" @compare="runCompare" />
            </div>
          </div>

          <aside data-testid="inspector-rail" class="inspector-rail" :class="{ collapsed: inspectorCollapsed }">
            <div class="rail-heading">
              <span class="section-index">INSPECTOR</span>
              <button class="subtle-button rail-toggle" :aria-label="inspectorCollapsed ? 'Expand Inspector' : 'Collapse Inspector'" @click="inspectorCollapsed = !inspectorCollapsed">{{ inspectorCollapsed ? '‹' : '›' }}</button>
            </div>
            <div v-if="!inspectorCollapsed" class="inspector-placeholder">
              <span class="placeholder-mark">[ ]</span>
              <h3>Object Inspector</h3>
              <p>Waiting for the authoritative Struxis chart and object-selection projection.</p>
              <small>UI shell only · no derived domain state</small>
            </div>
          </aside>
        </div>
      </section>
    </div>

    <section v-if="!diagnosticsCollapsed" data-testid="diagnostics-dock" class="diagnostics-dock">
      <div class="diagnostics-heading">
        <div>
          <p class="section-index">DIAGNOSTICS</p>
          <h2>Workflow events &amp; errors</h2>
        </div>
        <button class="subtle-button" @click="diagnosticsCollapsed = true">Collapse</button>
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
      <span>STRUXIS DEBUGGER / PHASE 01</span>
      <span>LOAD CONTRACT · COMPLETE INPUT · ATOMIC REPLACEMENT</span>
    </footer>
  </main>
</template>
