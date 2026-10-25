<script setup lang="ts">
import { computed, ref, watch } from "vue";
import SnapshotReferenceChart from "./SnapshotReferenceChart.vue";
import { describeIpcError, getSnapshotReference } from "../origin-bridge";
import type { ReplayChartCrosshairSync, ReplayChartViewportSync, SnapshotArtifactDto, SnapshotReferenceDto } from "../origin-types";
import { formatDomainTimestamp, formatLifecycleTimestamp } from "../timestamp-format";

const props = defineProps<{
  instrumentId: string | null;
  snapshots: SnapshotArtifactDto[];
  liveSbarIds?: string[];
  syncEligible?: boolean;
  keyboardActive?: boolean;
  syncOwner?: "live" | "snapshot";
  syncOffset?: number | null;
  syncRequest?: ReplayChartViewportSync | null;
  crosshairSync?: ReplayChartCrosshairSync | null;
  progressApplies?: boolean;
  processedCount?: number;
  /** Changes whenever the Live sequence identity is replaced. */
  syncIdentity?: string | null;
}>();

const emit = defineEmits<{
  chartActivate: [];
  viewportChange: [sync: Omit<ReplayChartViewportSync, "revision" | "offset">];
  syncSequence: [sequence: { snapshotId: string; barType: string; sbarIds: string[] } | null];
  crosshairChange: [sync: Omit<ReplayChartCrosshairSync, "revision">];
}>();

const selectedSnapshotId = ref<string | null>(null);
const reference = ref<SnapshotReferenceDto | null>(null);
const referenceLoading = ref(false);
const referenceError = ref("");
let requestRevision = 0;

const availableSnapshots = computed(() =>
  props.instrumentId
    ? props.snapshots
      .filter((snapshot) => snapshot.instrumentId === props.instrumentId && snapshot.kind === "complete" && snapshot.snapshotId !== null)
      .sort((left, right) => compareGeneratedAtDescending(left.generatedAt, right.generatedAt))
    : [],
);
const selectedSnapshot = computed(
  () => availableSnapshots.value.find((snapshot) => snapshot.snapshotId === selectedSnapshotId.value) ?? null,
);

const displayInstrumentId = computed(() => props.instrumentId ?? "INSTRUMENT");
const selectedSnapshotLabel = computed(() =>
  selectedSnapshot.value
    ? describeSnapshot(selectedSnapshot.value).replace(/ · [^·]*$/, "")
    : "Choose completed Snapshot…",
);

const syncEligible = computed(() => props.syncEligible === true);
const syncOffset = computed(() => syncEligible.value ? props.syncOffset ?? null : null);
const processedCount = computed(() =>
  Math.max(0, Math.min(props.liveSbarIds?.length ?? 0, props.processedCount ?? 0)),
);
const snapshotPlaybackEnabled = computed(() =>
  props.progressApplies === true &&
  syncEligible.value &&
  (props.liveSbarIds?.length ?? 0) > 0 &&
  processedCount.value < (props.liveSbarIds?.length ?? 0),
);
const playbackStructure = computed(() => {
  const current = reference.value;
  if (!current) return null;
  if (!snapshotPlaybackEnabled.value) return current.structure;
  if (processedCount.value === 0) return null;
  const snapshotIndex = (syncOffset.value ?? 0) + processedCount.value - 1;
  const checkpointSbarId = current.bars[snapshotIndex]?.sbarId;
  if (!checkpointSbarId) return null;
  return current.structureTimeline.find((checkpoint) => checkpoint.sbarId === checkpointSbarId)?.structure ?? null;
});

function compareGeneratedAtDescending(left: string | null, right: string | null): number {
  if (left === right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  if (/^\d+$/.test(left) && /^\d+$/.test(right)) {
    const a = BigInt(left);
    const b = BigInt(right);
    return a === b ? 0 : a > b ? -1 : 1;
  }
  return right.localeCompare(left);
}

function timeframeFromBarType(barType: string | null | undefined): string {
  if (!barType) return "—";
  const match = /-(\d+)-(SECOND|MINUTE|HOUR|DAY|WEEK|MONTH|YEAR)-/i.exec(barType);
  if (!match) return "—";
  const amount = match[1];
  switch (match[2]!.toUpperCase()) {
    case "SECOND": return `${amount}s`;
    case "MINUTE": return `${amount}m`;
    case "HOUR": return `${amount}h`;
    case "DAY": return `${amount}D`;
    case "WEEK": return `${amount}W`;
    case "MONTH": return `${amount}M`;
    case "YEAR": return `${amount}Y`;
    default: return "—";
  }
}

function formatEventTime(value: string | null | undefined, barType: string | null | undefined): string {
  return formatDomainTimestamp(value, timeframeFromBarType(barType));
}

function formatGeneratedAt(value: string | null | undefined): string {
  if (!value) return "time unavailable";
  return /^\d+$/.test(value) ? formatLifecycleTimestamp(value) : value;
}

function describeSnapshot(snapshot: SnapshotArtifactDto): string {
  const timeframe = timeframeFromBarType(snapshot.barType);
  const start = formatEventTime(snapshot.inputStartTsEvent, snapshot.barType);
  const end = formatEventTime(snapshot.inputEndTsEvent, snapshot.barType);
  return `${timeframe} · ${start} → ${end} · ${formatGeneratedAt(snapshot.generatedAt)}`;
}

watch(
  () => props.syncIdentity,
  () => {
    // The workspace invalidates qualification at every Live identity boundary.
    // Re-publish only the already-loaded immutable sequence, after the parent's
    // invalidation watcher has run; the workspace must still resolve compatibility.
    const current = reference.value;
    if (!current || selectedSnapshotId.value !== current.snapshotId) return;
    emit("syncSequence", {
      snapshotId: current.snapshotId,
      barType: current.barType,
      sbarIds: current.bars.map((bar) => bar.sbarId),
    });
  },
  { flush: "post" },
);

watch(availableSnapshots, (available) => {
  if (!available.some((snapshot) => snapshot.snapshotId === selectedSnapshotId.value)) {
    selectedSnapshotId.value = null;
    reference.value = null;
    referenceError.value = "";
  }
});

watch(selectedSnapshotId, async (snapshotId) => {
  const revision = ++requestRevision;
  reference.value = null;
  referenceError.value = "";
  emit("syncSequence", null);
  if (!snapshotId) {
    referenceLoading.value = false;
    return;
  }

  referenceLoading.value = true;
  try {
    const result = await getSnapshotReference(snapshotId);
    if (revision !== requestRevision || selectedSnapshotId.value !== snapshotId) return;
    reference.value = result;
    emit("syncSequence", {
      snapshotId: result.snapshotId,
      barType: result.barType,
      sbarIds: result.bars.map((bar) => bar.sbarId),
    });
  } catch (error) {
    if (revision !== requestRevision || selectedSnapshotId.value !== snapshotId) return;
    referenceError.value = describeIpcError(error);
  } finally {
    if (revision === requestRevision) referenceLoading.value = false;
  }
});

function handleSelection(event: Event): void {
  const value = (event.target as HTMLSelectElement).value;
  selectedSnapshotId.value = value || null;
}
</script>

<template>
  <section class="snapshot-reference-panel" data-testid="snapshot-reference-panel">
    <header class="snapshot-reference-heading">
      <div class="snapshot-reference-title">
        <h3>SNAPSHOT REFERENCE</h3>
        <span
          v-if="syncEligible"
          class="snapshot-reference-sync-indicator"
          data-testid="snapshot-reference-sync-indicator"
          role="img"
          aria-label="Viewport synchronization available"
          title="Viewport synchronization available"
        >↕</span>
      </div>
      <label class="snapshot-reference-select">
        <span class="snapshot-reference-instrument">{{ displayInstrumentId }}</span>
        <span class="snapshot-reference-control" :style="{ width: `calc(${selectedSnapshotLabel.length}ch + 23px)` }">
          <span class="snapshot-reference-selected-label" aria-hidden="true">
            {{ selectedSnapshotLabel }}
          </span>
          <select
            data-testid="replay-reference-select"
            :value="selectedSnapshotId ?? ''"
            :disabled="availableSnapshots.length === 0"
            :aria-label="`Snapshot Reference for ${displayInstrumentId}`"
            @change="handleSelection"
          >
            <option value="">Choose completed Snapshot…</option>
            <option v-for="snapshot in availableSnapshots" :key="snapshot.snapshotId ?? snapshot.fileName" :value="snapshot.snapshotId ?? ''">
              {{ describeSnapshot(snapshot) }}
            </option>
          </select>
        </span>
      </label>
    </header>

    <div class="snapshot-reference-stage" :class="{ 'has-reference': reference }" data-testid="snapshot-reference-stage">
      <div v-if="referenceLoading" class="snapshot-reference-loading" role="status" aria-live="polite" data-testid="snapshot-reference-loading">
        <span class="snapshot-reference-loading-spinner" aria-hidden="true"></span>
        <strong>LOADING SNAPSHOT</strong>
        <span>Validating historical SBar data…</span>
      </div>
      <div v-else-if="referenceError" class="snapshot-reference-state" role="alert" data-testid="snapshot-reference-error">
        <div class="snapshot-reference-identity">
          <span class="reference-status-dot reference-status-dot-error" aria-hidden="true"></span>
          <strong>{{ selectedSnapshotId }}</strong>
          <span class="reference-tag">REFERENCE UNAVAILABLE</span>
        </div>
        <p class="snapshot-reference-unavailable">{{ referenceError }}</p>
        <p class="snapshot-reference-unavailable">No candles or structure are shown unless the Catalog sequence matches the Snapshot fingerprint.</p>
      </div>
      <div v-else-if="reference" class="snapshot-reference-chart" :class="{ 'is-sync-eligible': syncEligible, 'is-progress-active': snapshotPlaybackEnabled }" :data-sync-eligible="syncEligible" :data-progress-active="snapshotPlaybackEnabled" data-testid="snapshot-reference-chart">
        <SnapshotReferenceChart
          :bars="reference.bars"
          :structure="playbackStructure"
          :snapshot-id="reference.snapshotId"
          :sync-enabled="syncEligible"
          :keyboard-active="keyboardActive"
          :sync-owner="syncOwner"
          :sync-request="syncRequest"
          :crosshair-sync="crosshairSync"
          :live-bar-count="liveSbarIds?.length ?? 0"
          :playback-enabled="snapshotPlaybackEnabled"
          :playback-offset="syncOffset"
          :processed-count="processedCount ?? 0"
          @activate="emit('chartActivate')"
          @viewport-change="emit('viewportChange', $event)"
          @crosshair-change="emit('crosshairChange', $event)"
        />
      </div>
      <div v-else class="snapshot-reference-empty" data-testid="snapshot-reference-empty">
        <strong>{{ availableSnapshots.length ? "SELECT A COMPLETED SNAPSHOT" : "NO COMPLETED SNAPSHOT AVAILABLE" }}</strong>
        <p>{{ availableSnapshots.length ? "Choose an immutable reference from the control above." : "A completed Run Snapshot will appear here after it is published and discovered." }}</p>
      </div>
    </div>

    <footer v-if="reference" class="snapshot-reference-foot" data-testid="snapshot-reference-metadata">
      <span>RUN <b>{{ reference.runId }}</b></span>
      <span>SBARS <b>{{ reference.bars.length.toLocaleString() }}</b></span>
      <span>GENERATED <b>{{ formatLifecycleTimestamp(reference.snapshotGeneratedAt) }}</b></span>
      <span class="snapshot-reference-state-key">FINGERPRINT <b>{{ reference.sbarSequenceFingerprint.slice(0, 12) }}</b></span>
    </footer>
  </section>
</template>
