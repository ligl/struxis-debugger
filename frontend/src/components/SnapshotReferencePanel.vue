<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from "vue";
import SnapshotReferenceChart from "./SnapshotReferenceChart.vue";
import { describeIpcError, getSnapshotReference, getSnapshotReferenceCheckpoint, getSnapshotReferenceObject } from "../origin-bridge";
import type { ReplayChartCrosshairSync, ReplayChartSelection, ReplayChartViewportSync, ReplaySnapshotInspectorSelection, SnapshotArtifactDto, SnapshotReferenceDto, SnapshotStructureCheckpointDto } from "../origin-types";
import { formatDomainTimestamp, formatLifecycleTimestamp } from "../timestamp-format";

const props = withDefaults(defineProps<{
  /** Mirrors Live Replay chart lifecycle; panel state stays mounted while its chart runtime is recreated. */
  active?: boolean;
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
}>(), {
  active: true,
});

const emit = defineEmits<{
  chartActivate: [];
  viewportChange: [sync: Omit<ReplayChartViewportSync, "revision" | "offset">];
  syncSequence: [sequence: { snapshotId: string; barType: string; sbarIds: string[] } | null];
  crosshairChange: [sync: Omit<ReplayChartCrosshairSync, "revision">];
  objectSelect: [selection: ReplaySnapshotInspectorSelection | null];
}>();

const selectedSnapshotId = ref<string | null>(null);
const reference = shallowRef<SnapshotReferenceDto | null>(null);
const referenceLoading = ref(false);
const referenceError = ref("");
let requestRevision = 0;
let inspectorRevision = 0;
let checkpointCache = new Map<string, SnapshotStructureCheckpointDto>();
let objectCache = new Map<string, SnapshotStructureCheckpointDto | null>();
let checkpointRequests = new Map<string, Promise<SnapshotStructureCheckpointDto | null>>();
const checkpointError = ref("");
const inspectorError = ref("");

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
interface SnapshotFrameTarget {
  snapshotId: string;
  syncIdentity: string | null;
  sbarId: string | null;
  playbackEnabled: boolean;
  offset: number | null;
  processedCount: number;
  liveBarCount: number;
}
interface SnapshotDisplayFrame extends SnapshotFrameTarget {
  checkpoint: SnapshotStructureCheckpointDto | null;
}
const requestedFrame = computed<SnapshotFrameTarget | null>(() => {
  const current = reference.value;
  if (!current) return null;
  const playbackEnabled = snapshotPlaybackEnabled.value;
  const sbarId = !playbackEnabled
    ? current.structureTimeline.at(-1)?.sbarId ?? null
    : processedCount.value === 0 ? null
      : current.bars[(syncOffset.value ?? 0) + processedCount.value - 1]?.sbarId ?? null;
  return {
    snapshotId: current.snapshotId, syncIdentity: props.syncIdentity ?? null, sbarId,
    playbackEnabled, offset: syncOffset.value,
    processedCount: processedCount.value, liveBarCount: props.liveSbarIds?.length ?? 0,
  };
});
const displayFrame = shallowRef<SnapshotDisplayFrame | null>(null);
let frameRevision = 0;
const displayCheckpoint = computed(() => displayFrame.value?.checkpoint ?? null);
const playbackStructure = computed(() => displayCheckpoint.value?.structure ?? null);
const playbackKeyzones = computed(() => displayCheckpoint.value?.keyzones ?? null);
const keyzoneUntil = computed(() => displayCheckpoint.value?.sbarId ?? null);
const displayPlaybackEnabled = computed(() => displayFrame.value?.playbackEnabled ?? false);
const checkpointLoading = ref(false);

type FooterMessage = { kind: "reference" | "checkpoint" | "inspector" | "recorded"; message: string };
const informationalSeverities = new Set(["info", "debug", "trace"]);
const footerMessages = computed<FooterMessage[]>(() => {
  const messages: FooterMessage[] = [];
  if (referenceError.value) messages.push({ kind: "reference", message: referenceError.value });
  if (checkpointError.value) messages.push({ kind: "checkpoint", message: checkpointError.value });
  if (inspectorError.value) messages.push({ kind: "inspector", message: inspectorError.value });
  for (const diagnostic of displayCheckpoint.value?.diagnostics ?? []) {
    if (!informationalSeverities.has(diagnostic.severity.toLowerCase())) {
      messages.push({ kind: "recorded", message: `${diagnostic.severity} · ${diagnostic.source}: ${diagnostic.message}` });
    }
  }
  return messages;
});
const footerDetails = computed(() => footerMessages.value.map((item) => item.message).join("\n"));
const footerMessageTestId = computed(() => {
  switch (footerMessages.value[0]?.kind) {
    case "reference": return "snapshot-reference-read-error";
    case "checkpoint": return "snapshot-checkpoint-error";
    case "inspector": return "snapshot-inspector-error";
    case "recorded": return "snapshot-recorded-diagnostic";
    default: return undefined;
  }
});

function loadCheckpoint(sbarId: string): Promise<SnapshotStructureCheckpointDto | null> {
  const current = reference.value;
  if (!current) return Promise.resolve(null);
  const cached = checkpointCache.get(sbarId);
  if (cached) return Promise.resolve(cached);
  const pending = checkpointRequests.get(sbarId);
  if (pending) return pending;
  const revision = requestRevision;
  const cache = checkpointCache;
  const requests = checkpointRequests;
  const request = getSnapshotReferenceCheckpoint(current.snapshotId, sbarId).then((checkpoint) => {
    if (revision !== requestRevision) return null;
    cache.set(sbarId, checkpoint);
    return checkpoint;
  }).finally(() => requests.delete(sbarId));
  requests.set(sbarId, request);
  return request;
}

watch(requestedFrame, async (target) => {
  const revision = ++frameRevision;
  const snapshotRevision = requestRevision;
  checkpointError.value = "";
  checkpointLoading.value = false;
  if (!target) { displayFrame.value = null; return; }

  if (!displayFrame.value || displayFrame.value.snapshotId !== target.snapshotId
    || displayFrame.value.syncIdentity !== target.syncIdentity) {
    // A new identity has no accepted historical frame yet. Start at zero
    // progress rather than pairing the final Snapshot structure with a live cursor.
    displayFrame.value = { ...target, sbarId: null, processedCount: 0, checkpoint: null };
  }
  if (!target.sbarId) {
    displayFrame.value = { ...target, checkpoint: null };
    return;
  }
  const cached = checkpointCache.get(target.sbarId);
  if (cached) {
    displayFrame.value = { ...target, checkpoint: cached };
    return;
  }
  checkpointLoading.value = true;
  try {
    const checkpoint = await loadCheckpoint(target.sbarId);
    if (checkpoint && revision === frameRevision && snapshotRevision === requestRevision) {
      // Publish structure, KeyZone boundary, progress styling and diagnostics
      // through one immutable frame. Pending targets never clear the old frame.
      displayFrame.value = { ...target, checkpoint };
    }
  } catch (error) {
    if (revision === frameRevision && snapshotRevision === requestRevision) {
      checkpointError.value = describeIpcError(error);
    }
  } finally {
    if (revision === frameRevision && snapshotRevision === requestRevision) checkpointLoading.value = false;
  }
});

onBeforeUnmount(() => { requestRevision++; inspectorRevision++; frameRevision++; });

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
  inspectorRevision++;
  frameRevision++;
  displayFrame.value = null;
  checkpointLoading.value = false;
  checkpointCache = new Map();
  objectCache = new Map();
  checkpointRequests = new Map();
  checkpointError.value = "";
  inspectorError.value = "";
  reference.value = null;
  referenceError.value = "";
  emit("syncSequence", null);
  emit("objectSelect", null);
  if (!snapshotId) {
    referenceLoading.value = false;
    return;
  }

  referenceLoading.value = true;
  try {
    const result = await getSnapshotReference(snapshotId);
    if (revision !== requestRevision || selectedSnapshotId.value !== snapshotId) return;
    for (const checkpoint of result.structureTimeline) checkpointCache.set(checkpoint.sbarId, checkpoint);
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

function emitCheckpointSelection(
  current: SnapshotReferenceDto,
  selection: ReplayChartSelection,
  checkpoint: SnapshotStructureCheckpointDto | null,
): void {
  const snapshotLabel = selectedSnapshot.value ? describeSnapshot(selectedSnapshot.value) : current.snapshotId;
  const common = { snapshotId: current.snapshotId, snapshotLabel,
    checkpointSbarId: checkpoint?.sbarId ?? selection.id, timeframe: current.timeframe,
    bars: current.bars, structure: checkpoint?.structure ?? null };
  const structure = checkpoint?.structure;
  if (selection.kind === "sbar") {
    const object = current.bars.find((bar) => bar.sbarId === selection.id);
    emit("objectSelect", object ? { ...common, kind: "sbar", object } : null);
  } else if (selection.kind === "keyzone") {
    const registry = checkpoint?.keyzones;
    const object = registry?.zones.find((zone) => zone.keyzoneId === selection.id);
    emit("objectSelect", object && registry ? { ...common, kind: "keyzone", object, registry } : null);
  } else if (selection.kind === "cbar") {
    const object = structure?.cbars.find((bar) => bar.cbarId === selection.id);
    emit("objectSelect", object ? { ...common, kind: "cbar", object } : null);
  } else if (selection.kind === "swing") {
    const object = structure?.swings.find((swing) => swing.swingId === selection.id);
    emit("objectSelect", object ? { ...common, kind: "swing", object } : null);
  } else {
    const object = structure?.trends.find((trend) => trend.trendId === selection.id);
    emit("objectSelect", object ? { ...common, kind: "trend", object } : null);
  }
}

function handleSnapshotObjectSelect(selection: ReplayChartSelection): void {
  const current = reference.value;
  if (!current || current.snapshotId !== selectedSnapshotId.value) return;
  const revision = requestRevision;
  const selectionRevision = ++inspectorRevision;
  inspectorError.value = "";
  if (selection.kind === "sbar" || selection.kind === "keyzone") {
    const id = selection.kind === "sbar" ? selection.id : keyzoneUntil.value;
    if (!id) { emit("objectSelect", null); return; }
    const cached = checkpointCache.get(id);
    if (cached) { emitCheckpointSelection(current, selection, cached); return; }
    emit("objectSelect", null);
    void loadCheckpoint(id).then((checkpoint) => {
      if (revision === requestRevision && selectionRevision === inspectorRevision && checkpoint) {
        emitCheckpointSelection(current, selection, checkpoint);
      }
    }).catch((error) => {
      if (revision === requestRevision && selectionRevision === inspectorRevision) {
        inspectorError.value = describeIpcError(error);
      }
    });
    return;
  }
  // Historical CBar/Swing/Trend inspection uses the latest recorded state that
  // contains the ID, even if that object disappeared before the final checkpoint.
  const last = current.structureTimeline.at(-1);
  const containsObject = last && (selection.kind === "cbar"
    ? last.structure?.cbars.some((object) => object.cbarId === selection.id)
    : selection.kind === "swing"
      ? last.structure?.swings.some((object) => object.swingId === selection.id)
      : last.structure?.trends.some((object) => object.trendId === selection.id));
  if (containsObject) { emitCheckpointSelection(current, selection, last); return; }
  const objectKey = `${selection.kind}:${selection.id}`;
  if (objectCache.has(objectKey)) {
    emitCheckpointSelection(current, selection, objectCache.get(objectKey) ?? null);
    return;
  }
  emit("objectSelect", null);
  void getSnapshotReferenceObject(current.snapshotId, selection.kind, selection.id).then((checkpoint) => {
    if (revision !== requestRevision) return;
    objectCache.set(objectKey, checkpoint);
    if (checkpoint) {
      checkpointCache.set(checkpoint.sbarId, checkpoint);
    }
    if (selectionRevision === inspectorRevision) {
      emitCheckpointSelection(current, selection, checkpoint);
    }
  }).catch((error) => {
    if (revision === requestRevision && selectionRevision === inspectorRevision) {
      inspectorError.value = describeIpcError(error);
    }
  });
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
        <span>Reading Snapshot and chart data…</span>
      </div>
      <div v-else-if="referenceError" class="snapshot-reference-state" role="status" data-testid="snapshot-reference-error">
        <div class="snapshot-reference-identity">
          <span class="reference-status-dot reference-status-dot-error" aria-hidden="true"></span>
          <strong>{{ selectedSnapshotId }}</strong>
          <span class="reference-tag">REFERENCE UNAVAILABLE</span>
        </div>
        <p class="snapshot-reference-unavailable">Snapshot or chart data could not be read.</p>
      </div>
      <div v-else-if="reference" class="snapshot-reference-chart" :class="{ 'is-sync-eligible': syncEligible, 'is-progress-active': displayPlaybackEnabled }" :data-sync-eligible="syncEligible" :data-progress-active="displayPlaybackEnabled" data-testid="snapshot-reference-chart">
        <SnapshotReferenceChart
          v-if="active !== false"
          :bars="reference.bars"
          :structure="playbackStructure"
          :keyzones="playbackKeyzones"
          :keyzone-observer="{ instrumentId: reference.instrumentId, timeframe: reference.timeframe }"
          :keyzone-until="keyzoneUntil"
          :snapshot-id="reference.snapshotId"
          :sync-enabled="syncEligible"
          :keyboard-active="keyboardActive"
          :sync-owner="syncOwner"
          :sync-request="syncRequest"
          :crosshair-sync="crosshairSync"
          :live-bar-count="displayFrame?.liveBarCount ?? 0"
          :playback-enabled="displayPlaybackEnabled"
          :playback-offset="displayFrame?.offset ?? null"
          :processed-count="displayFrame?.processedCount ?? 0"
          @activate="emit('chartActivate')"
          @viewport-change="emit('viewportChange', $event)"
          @crosshair-change="emit('crosshairChange', $event)"
          @object-select="handleSnapshotObjectSelect"
        />
      </div>
      <div v-else class="snapshot-reference-empty" data-testid="snapshot-reference-empty">
        <strong>{{ availableSnapshots.length ? "SELECT A COMPLETED SNAPSHOT" : "NO COMPLETED SNAPSHOT AVAILABLE" }}</strong>
        <p>{{ availableSnapshots.length ? "Choose an immutable reference from the control above." : "A completed Run Snapshot will appear here after it is published and discovered." }}</p>
      </div>
    </div>

    <footer v-if="reference || footerMessages.length" class="snapshot-reference-foot" data-testid="snapshot-reference-metadata">
      <div v-if="reference" class="snapshot-reference-footer-metadata" data-testid="snapshot-reference-footer-fields">
        <span>RUN <b>{{ reference.runId }}</b></span>
        <span>SBARS <b>{{ reference.bars.length.toLocaleString() }}</b></span>
        <span>GENERATED <b>{{ formatLifecycleTimestamp(reference.snapshotGeneratedAt) }}</b></span>
        <span class="snapshot-reference-state-key">FINGERPRINT <b>{{ reference.sbarSequenceFingerprint.slice(0, 12) }}</b></span>
      </div>
      <div class="snapshot-reference-footer-status" data-testid="snapshot-reference-footer-status">
        <span v-if="checkpointLoading" role="status" data-testid="snapshot-checkpoint-loading">Loading checkpoint…</span>
        <span v-if="reference && !playbackKeyzones && !displayPlaybackEnabled" class="snapshot-reference-footer-notice" role="status" data-testid="snapshot-keyzone-unrecorded">KEYZONE NOT RECORDED</span>
        <span v-if="footerMessages.length" class="snapshot-reference-footer-alert" role="alert" :title="footerDetails" data-testid="snapshot-reference-footer-message">
          <span v-if="footerMessages.length > 1" class="snapshot-reference-message-count">{{ footerMessages.length }} ·</span>
          <span :data-testid="footerMessageTestId">{{ footerMessages[0]?.message }}</span>
        </span>
      </div>
    </footer>
  </section>
</template>


<style scoped>
.snapshot-reference-title {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 7px;
}

.snapshot-reference-loading-spinner {
  width: 26px;
  height: 26px;
  border: 2px solid #343c42;
  border-top-color: var(--dbg-accent, #D6A85D);
  border-radius: 50%;
  animation: snapshot-reference-spin 0.8s linear infinite;
}

@keyframes snapshot-reference-spin {
  to { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  .snapshot-reference-loading-spinner {
    animation-duration: 2.4s;
  }
}

.snapshot-reference-foot {
  display: flex;
  height: 18px;
  min-height: 18px;
  min-width: 0;
  flex: 0 0 18px;
  align-items: center;
  gap: 8px;
  padding: 0 8px;
  overflow: hidden;
  background: #191e22;
  color: var(--dbg-text-muted);
  font: 8px ui-monospace, SFMono-Regular, Consolas, monospace;
  letter-spacing: .04em;
}

.snapshot-reference-footer-metadata,
.snapshot-reference-footer-status {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: inherit;
  overflow: hidden;
}

.snapshot-reference-footer-metadata {
  flex: 0 0 auto;
  max-width: 100%;
}

.snapshot-reference-footer-metadata > span {
  flex-shrink: 0;
}

.snapshot-reference-footer-status {
  flex: 1;
}

.snapshot-reference-foot span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.snapshot-reference-foot .snapshot-reference-footer-alert {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 4px;
  color: #b46868;
}

.snapshot-reference-foot .snapshot-reference-footer-notice {
  flex-shrink: 0;
  color: #b46868;
}

.snapshot-reference-footer-alert .snapshot-reference-message-count {
  flex-shrink: 0;
}

.snapshot-reference-foot b {
  color: var(--dbg-text-secondary);
  font-weight: 500;
  letter-spacing: 0;
}

@media (max-height: 760px) {
  .snapshot-reference-foot {
    gap: 6px;
    flex-wrap: nowrap;
    padding: 0 6px;
  }
}
</style>
