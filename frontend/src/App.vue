<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import CatalogPanel from "./components/CatalogPanel.vue";
import OriginPanel from "./components/OriginPanel.vue";
import TestDatasetPanel from "./components/TestDatasetPanel.vue";
import RunControlPanel from "./components/RunControlPanel.vue";
import SnapshotPanel from "./components/SnapshotPanel.vue";
import {
  describeIpcError,
  disposeRun,
  getRunState,
  listSnapshots,
  pauseRun,
  playRun,
  restartRun,
  startRun,
  stepRun,
  stopRun,
} from "./origin-bridge";
import { useOriginLoad } from "./composables/useOriginLoad";
import { useTestDataset } from "./composables/useTestDataset";
import type {
  CatalogDatasetEntry,
  RunStateDto,
  SnapshotArtifactDto,
} from "./origin-types";

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

const runState = ref<RunStateDto | null>(null);
const runBusy = ref(false);
const runError = ref("");
const runStatusMessage = ref("");

const snapshots = ref<SnapshotArtifactDto[]>([]);
const snapshotsLoading = ref(false);
const snapshotsError = ref("");

const canMutateTest = computed(
  () => !runState.value || runState.value.status === "disposed",
);
const canStartRun = computed(
  () => Boolean(testDataset.value) && !runState.value && !runBusy.value,
);
const canRestartRun = computed(
  () => Boolean(testDataset.value) && Boolean(runState.value) &&
    runState.value?.status !== "running" && !runBusy.value,
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

interface InstrumentGroup {
  key: string;
  label: string;
  unresolved: boolean;
  datasets: CatalogDatasetEntry[];
  readyCount: number;
}

const collapsedInstrumentIds = ref<Set<string>>(new Set());
const instrumentGroups = computed<InstrumentGroup[]>(() => {
  const groups = new Map<string, InstrumentGroup>();

  for (const dataset of datasets.value) {
    const unresolved = !dataset.instrumentId;
    const key = unresolved ? "__unresolved_instrument__" : dataset.instrumentId!;
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        label: unresolved ? "Unresolved / Unavailable" : dataset.instrumentId!,
        unresolved,
        datasets: [],
        readyCount: 0,
      };
      groups.set(key, group);
    }
    group.datasets.push(dataset);
    if (dataset.available) group.readyCount += 1;
  }

  return [...groups.values()];
});
const previewBars = computed(() => origin.value?.bars.slice(0, 12) ?? []);

function toggleInstrumentGroup(key: string): void {
  const next = new Set(collapsedInstrumentIds.value);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  collapsedInstrumentIds.value = next;
}

async function startLoad(): Promise<void> {
  await loadSelectedOrigin(async (loadedOrigin) => {
    // Keep cross-domain handoff in the page composition root.
    prepareForOrigin(loadedOrigin);
    await refreshCurrentTestDataset();
  });
}

async function refreshRunState(): Promise<void> {
  if (runBusy.value) return;
  runBusy.value = true;
  runError.value = "";
  try {
    runState.value = await getRunState();
    runStatusMessage.value = "Run state refreshed from the backend.";
  } catch (error) {
    runError.value = describeIpcError(error);
  } finally {
    runBusy.value = false;
  }
}

type RunCommand = "start" | "restart" | "step" | "play" | "pause" | "stop" | "dispose";

async function executeRunCommand(command: RunCommand): Promise<void> {
  if (runBusy.value) return;
  runBusy.value = true;
  runError.value = "";
  runStatusMessage.value = "";
  try {
    let next: RunStateDto;
    switch (command) {
      case "start":
        next = await startRun();
        break;
      case "restart":
        next = await restartRun();
        break;
      case "step":
        next = await stepRun();
        break;
      case "play":
        next = await playRun();
        break;
      case "pause":
        next = await pauseRun();
        break;
      case "stop":
        next = await stopRun();
        break;
      case "dispose":
        next = await disposeRun();
        break;
    }
    runState.value = next;
    runStatusMessage.value = `Backend confirmed Run status: ${next.status}.`;
    await refreshSnapshots();
  } catch (error) {
    runError.value = describeIpcError(error);
  } finally {
    runBusy.value = false;
  }
}

async function refreshSnapshots(): Promise<void> {
  if (snapshotsLoading.value) return;
  snapshotsLoading.value = true;
  snapshotsError.value = "";
  try {
    snapshots.value = await listSnapshots();
  } catch (error) {
    snapshotsError.value = describeIpcError(error);
  } finally {
    snapshotsLoading.value = false;
  }
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
  await Promise.all([refreshDatasets(), refreshCurrentOrigin(), refreshSnapshots()]);
  await refreshCurrentTestDataset();
});
</script>

<template>
  <main class="debugger-shell">
    <header class="topbar">
      <div>
        <p class="eyebrow">CAPITUS / STRUXIS DEBUGGER</p>
        <h1>Origin Load</h1>
        <p class="subtitle">Catalog → Nautilus → Strategy → Struxis</p>
      </div>
      <div class="runtime-mark">
        <span class="runtime-dot" :class="{ active: origin }"></span>
        <span>{{ origin ? "ORIGIN AVAILABLE" : "NO ORIGIN LOADED" }}</span>
      </div>
    </header>

    <section class="workspace">
      <CatalogPanel :datasets="datasets" :selected-id="selectedId" :selected-dataset="selectedDataset" :instrument-groups="instrumentGroups" :collapsed-instrument-ids="collapsedInstrumentIds" :refreshing="refreshing" :loading="loading" :discovery-error="discoveryError" :enable-structure="enableStructure" @refresh="refreshDatasets" @select-dataset="selectedId = $event" @toggle-group="toggleInstrumentGroup" @update:enable-structure="enableStructure = $event" @load="startLoad" />

      <OriginPanel :origin="origin" :load-status="loadStatus" :load-error="loadError" :preview-bars="previewBars" :format-timestamp="formatTimestamp" />
    </section>

    <section class="operations-grid">
      <TestDatasetPanel :origin="origin" :test-dataset="testDataset" :start-sbar-id="startSbarId" :end-sbar-id="endSbarId" :test-loading="testLoading" :can-mutate-test="canMutateTest" :test-error="testError" :test-status="testStatus" @update:start-sbar-id="startSbarId = $event" @update:end-sbar-id="endSbarId = $event" @create="createTestDataset" />

      <RunControlPanel :run-state="runState" :run-busy="runBusy" :run-error="runError" :run-status-message="runStatusMessage" :can-start-run="canStartRun" :can-restart-run="canRestartRun" @command="executeRunCommand" @refresh="refreshRunState" />
    </section>

    <SnapshotPanel :snapshots="snapshots" :snapshots-loading="snapshotsLoading" :snapshots-error="snapshotsError" :snapshot-kind-label="snapshotKindLabel" :format-timestamp="formatTimestamp" @refresh="refreshSnapshots" />

    <footer class="footer-bar">
      <span>STRUXIS DEBUGGER / PHASE 01</span>
      <span>LOAD CONTRACT · COMPLETE INPUT · ATOMIC REPLACEMENT</span>
    </footer>
  </main>
</template>
