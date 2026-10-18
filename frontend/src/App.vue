<script setup lang="ts">
import { computed, onMounted } from "vue";
import CatalogPanel from "./components/CatalogPanel.vue";
import OriginPanel from "./components/OriginPanel.vue";
import TestDatasetPanel from "./components/TestDatasetPanel.vue";
import RunControlPanel from "./components/RunControlPanel.vue";
import SnapshotPanel from "./components/SnapshotPanel.vue";
import type { SnapshotArtifactDto } from "./origin-types";
import { useSnapshots } from "./composables/useSnapshots";
import { useOriginLoad } from "./composables/useOriginLoad";
import { useTestDataset } from "./composables/useTestDataset";
import { useRunControl } from "./composables/useRunControl";
import { useCatalogGroups } from "./composables/useCatalogGroups";

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
  () => !loading.value &&
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
const canStartRun = computed(
  () => Boolean(testDataset.value) && !runState.value && !runBusy.value,
);
const canRestartRun = computed(
  () => Boolean(testDataset.value) && Boolean(runState.value) &&
    runState.value?.status !== "running" && !runBusy.value,
);

const {
  collapsedInstrumentIds,
  instrumentGroups,
  toggleInstrumentGroup,
} = useCatalogGroups(datasets);

const previewBars = computed(() => origin.value?.bars.slice(0, 12) ?? []);

async function startLoad(): Promise<void> {
  if (testLoading.value) return;
  await loadSelectedOrigin(async (loadedOrigin) => {
    // Keep cross-domain handoff in the page composition root.
    prepareForOrigin(loadedOrigin);
    await refreshCurrentTestDataset();
  });
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
      <CatalogPanel :datasets="datasets" :selected-id="selectedId" :selected-dataset="selectedDataset" :instrument-groups="instrumentGroups" :collapsed-instrument-ids="collapsedInstrumentIds" :refreshing="refreshing" :loading="loading" :mutation-busy="testLoading" :discovery-error="discoveryError" :enable-structure="enableStructure" @refresh="refreshDatasets" @select-dataset="selectedId = $event" @toggle-group="toggleInstrumentGroup" @update:enable-structure="enableStructure = $event" @load="startLoad" />

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
