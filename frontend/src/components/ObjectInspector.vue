<script setup lang="ts">
import { ref } from "vue";
import type { ObjectDifferenceDto, ReplayInspectorCBarDto, ReplayInspectorDto, ReplayInspectorSwingDto, SBarDto } from "../origin-types";
import { formatDomainTimestamp, formatLifecycleTimestamp } from "../timestamp-format";

const props = defineProps<{
  selectedSbar: SBarDto | null;
  selectedCbar: ReplayInspectorCBarDto | null;
  selectedSwing: ReplayInspectorSwingDto | null;
  originDatasetId: string | null;
  timeframe: string | null;
  workspaceMode: "dataset" | "replay" | "compare";
  selectedDifference: ObjectDifferenceDto | null;
  compareBaselineSnapshotId: string | null;
  compareCandidateSnapshotId: string | null;
  replayInspector: ReplayInspectorDto | null;
  replayInspectorError: string;
}>();

const copyStatus = ref("");

async function handleInspectorContextMenu(event: MouseEvent): Promise<void> {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const valueNode = target.closest("dd, code");
  const root = event.currentTarget;
  if (!(root instanceof Element) || !valueNode || !root.contains(valueNode)) return;
  const value = valueNode.getAttribute("data-copy-value") ?? valueNode.textContent ?? "";
  if (value.length === 0) return;
  event.preventDefault();
  try {
    await navigator.clipboard.writeText(value);
    copyStatus.value = "COPIED";
  } catch {
    copyStatus.value = "COPY FAILED · CLIPBOARD UNAVAILABLE";
  }
}

function formatValue(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "—";
  if (typeof value === "string") return value;
  return JSON.stringify(value) ?? String(value);
}

function formatReplayField(field: string, value: unknown): string {
  if (field === "tsEvent" || field === "tsInit") {
    return formatDomainTimestamp(value == null ? null : String(value), props.timeframe);
  }
  if (field === "createdAt" || field === "updatedAt") {
    return formatLifecycleTimestamp(value == null ? null : String(value));
  }
  return formatValue(value);
}
</script>

<template>
  <section class="inspector-object" data-testid="inspector-object" @contextmenu="handleInspectorContextMenu">
    <template v-if="workspaceMode === 'dataset' && selectedSbar">
      <div class="inspector-object-heading">
        <div>
          <p class="section-index">SELECTED INPUT OBJECT</p>
          <h3>SBar</h3>
        </div>
        <span class="inspector-object-kind">SOURCE DATA</span>
      </div>
      <dl class="inspector-fields">
        <div class="inspector-field inspector-field-wide">
          <dt>SBar ID</dt>
          <dd><code data-testid="inspector-sbar-id" :title="selectedSbar.sbarId">{{ selectedSbar.sbarId }}</code></dd>
        </div>
        <div class="inspector-field inspector-field-wide">
          <dt>Origin Dataset</dt>
          <dd><code :title="originDatasetId ?? ''">{{ originDatasetId ?? "—" }}</code></dd>
        </div>
        <div class="inspector-field inspector-field-wide">
          <dt>Bar Type</dt>
          <dd><code :title="selectedSbar.barType">{{ selectedSbar.barType }}</code></dd>
        </div>
        <div class="inspector-field inspector-field-wide">
          <dt>Event Time · UTC</dt>
          <dd><code data-testid="inspector-sbar-ts-event" :data-copy-value="selectedSbar.tsEvent">{{ formatDomainTimestamp(selectedSbar.tsEvent, timeframe) }}</code></dd>
        </div>
        <div class="inspector-field inspector-field-wide">
          <dt>Init Time · UTC</dt>
          <dd><code data-testid="inspector-sbar-ts-init" :data-copy-value="selectedSbar.tsInit">{{ formatDomainTimestamp(selectedSbar.tsInit, timeframe) }}</code></dd>
        </div>
      </dl>
      <div class="inspector-subsection">
        <p class="section-index">MARKET FIELDS</p>
        <dl class="inspector-market-grid">
          <div><dt>OPEN</dt><dd data-testid="inspector-sbar-open">{{ selectedSbar.open }}</dd></div>
          <div><dt>HIGH</dt><dd data-testid="inspector-sbar-high">{{ selectedSbar.high }}</dd></div>
          <div><dt>LOW</dt><dd data-testid="inspector-sbar-low">{{ selectedSbar.low }}</dd></div>
          <div><dt>CLOSE</dt><dd data-testid="inspector-sbar-close">{{ selectedSbar.close }}</dd></div>
          <div class="inspector-volume"><dt>VOLUME</dt><dd data-testid="inspector-sbar-volume">{{ selectedSbar.volume }}</dd></div>
        </dl>
      </div>
      <p class="inspector-provenance">Values shown verbatim from the validated Origin SBar projection. No domain fields are inferred in the UI.</p>
    </template>

    <template v-else-if="workspaceMode === 'dataset' && selectedCbar">
      <div class="inspector-object-heading">
        <div>
          <p class="section-index">SELECTED DOMAIN OBJECT</p>
          <h3>CBar</h3>
        </div>
        <span class="inspector-object-kind">STRUCTURE</span>
      </div>
      <dl class="inspector-fields">
        <div v-for="(value, field) in selectedCbar" :key="field" class="inspector-field">
          <dt>{{ field }}</dt>
          <dd><code :data-testid="'inspector-cbar-' + String(field)" :data-copy-value="value == null ? '—' : String(value)">{{ formatReplayField(String(field), value) }}</code></dd>
        </div>
      </dl>
      <p class="inspector-provenance">Values shown from the validated Origin Structure projection.</p>
    </template>
    <template v-else-if="workspaceMode === 'dataset' && selectedSwing">
      <div class="inspector-object-heading">
        <div>
          <p class="section-index">SELECTED DOMAIN OBJECT</p>
          <h3>Swing</h3>
        </div>
        <span class="inspector-object-kind">{{ selectedSwing.state.toUpperCase() }}</span>
      </div>
      <dl class="inspector-fields">
        <div v-for="(value, field) in selectedSwing" :key="field" class="inspector-field">
          <dt>{{ field }}</dt>
          <dd><code :data-testid="'inspector-swing-' + String(field)" :data-copy-value="value == null ? '—' : String(value)">{{ formatReplayField(String(field), value) }}</code></dd>
        </div>
      </dl>
      <p class="inspector-provenance">Values shown from the validated Origin Structure projection.</p>
    </template>
    <template v-else-if="workspaceMode === 'compare' && selectedDifference">
      <div class="inspector-object-heading">
        <div>
          <p class="section-index">SELECTED COMPARE DIFFERENCE</p>
          <h3>{{ selectedDifference.objectType }}</h3>
        </div>
        <span class="inspector-object-kind" :class="'difference-kind-' + selectedDifference.kind">{{ selectedDifference.kind.toUpperCase() }}</span>
      </div>
      <dl class="inspector-fields">
        <div class="inspector-field inspector-field-wide">
          <dt>Domain Object ID</dt>
          <dd><code data-testid="inspector-difference-object-id" :title="selectedDifference.objectId">{{ selectedDifference.objectId }}</code></dd>
        </div>
        <div class="inspector-field inspector-field-wide">
          <dt>Baseline Snapshot</dt>
          <dd><code data-testid="inspector-baseline-snapshot">{{ compareBaselineSnapshotId ?? "—" }}</code></dd>
        </div>
        <div class="inspector-field inspector-field-wide">
          <dt>Candidate Snapshot</dt>
          <dd><code data-testid="inspector-candidate-snapshot">{{ compareCandidateSnapshotId ?? "—" }}</code></dd>
        </div>
        <div class="inspector-field">
          <dt>Object Type</dt>
          <dd><code>{{ selectedDifference.objectType }}</code></dd>
        </div>
        <div class="inspector-field">
          <dt>Change</dt>
          <dd><code>{{ selectedDifference.kind.toUpperCase() }}</code></dd>
        </div>
        <div class="inspector-field">
          <dt>Checkpoint</dt>
          <dd><code data-testid="inspector-difference-checkpoint">{{ selectedDifference.checkpointIndex }}</code></dd>
        </div>
        <div class="inspector-field inspector-field-wide">
          <dt>Anchor SBar ID</dt>
          <dd><code data-testid="inspector-difference-sbar-id">{{ selectedDifference.sbarId }}</code></dd>
        </div>
      </dl>
      <div class="inspector-subsection">
        <p class="section-index">PROPERTY DELTAS</p>
        <div v-if="selectedDifference.properties.length" class="inspector-difference-properties" data-testid="inspector-difference-properties">
          <div v-for="property in selectedDifference.properties" :key="property.field" class="inspector-difference-property">
            <strong>{{ property.field }}</strong>
            <div class="inspector-difference-values">
              <div><span>BASELINE</span><code>{{ formatValue(property.baselineValue) }}</code></div>
              <div><span>CANDIDATE</span><code>{{ formatValue(property.candidateValue) }}</code></div>
            </div>
          </div>
        </div>
        <p v-else class="empty-state">No property deltas were supplied for this difference.</p>
      </div>
      <p class="inspector-provenance">Checkpoint and property values are read from the validated Snapshot Compare result. The Inspector does not reconstruct either Snapshot's domain state.</p>
    </template>

    <div v-else-if="workspaceMode === 'dataset'" class="inspector-empty" data-testid="inspector-empty">
      <span class="placeholder-mark">S/</span>
      <h3>Object Inspector</h3>
      <p>Click an SBar, CBar range, or Swing segment on the Origin chart to inspect its exact domain fields.</p>
      <small>Authoritative Origin data only</small>
    </div>
    <template v-else-if="workspaceMode === 'replay' && replayInspector">
      <div class="inspector-object-heading">
        <div>
          <p class="section-index">CONFIRMED REPLAY CHECKPOINT</p>
          <h3>Struxis State</h3>
        </div>
        <span class="inspector-object-kind">BACKEND</span>
      </div>
      <dl class="inspector-fields">
        <div class="inspector-field inspector-field-wide">
          <dt>State Key</dt>
          <dd><code>{{ replayInspector.stateKey }}</code></dd>
        </div>
        <div class="inspector-field">
          <dt>Checkpoint</dt>
          <dd><code data-testid="inspector-replay-checkpoint">{{ replayInspector.checkpointIndex }}</code></dd>
        </div>
        <div class="inspector-field inspector-field-wide">
          <dt>Confirmed SBar ID</dt>
          <dd><code data-testid="inspector-replay-sbar-id">{{ replayInspector.sbarId }}</code></dd>
        </div>
      </dl>
      <div class="inspector-subsection">
        <p class="section-index">CONFIRMED SBAR</p>
        <dl class="inspector-market-grid">
          <div><dt>OPEN</dt><dd>{{ replayInspector.sbar.open }}</dd></div>
          <div><dt>HIGH</dt><dd>{{ replayInspector.sbar.high }}</dd></div>
          <div><dt>LOW</dt><dd>{{ replayInspector.sbar.low }}</dd></div>
          <div><dt>CLOSE</dt><dd>{{ replayInspector.sbar.close }}</dd></div>
          <div class="inspector-volume"><dt>VOLUME</dt><dd>{{ replayInspector.sbar.volume }}</dd></div>
        </dl>
      </div>
      <div class="inspector-subsection" data-testid="inspector-replay-sbar-times">
        <p class="section-index">CONFIRMED SBAR TIMES · UTC</p>
        <dl class="inspector-fields">
          <div class="inspector-field inspector-field-wide">
            <dt>Event Time · UTC</dt>
            <dd><code data-testid="inspector-replay-ts-event" :data-copy-value="replayInspector.sbar.tsEvent">{{ formatDomainTimestamp(replayInspector.sbar.tsEvent, timeframe) }}</code></dd>
          </div>
          <div class="inspector-field inspector-field-wide">
            <dt>Init Time · UTC</dt>
            <dd><code data-testid="inspector-replay-ts-init" :data-copy-value="replayInspector.sbar.tsInit">{{ formatDomainTimestamp(replayInspector.sbar.tsInit, timeframe) }}</code></dd>
          </div>
        </dl>
      </div>
      <div v-if="replayInspector.structure" class="inspector-subsection" data-testid="inspector-replay-related-objects">
        <p class="section-index">RELATED OBJECTS</p>
        <dl class="inspector-fields">
          <div class="inspector-field">
            <dt>CBar Series</dt>
            <dd><code data-testid="inspector-replay-cbar-count">{{ replayInspector.structure.cbarCount }}</code></dd>
          </div>
          <div class="inspector-field">
            <dt>Swing Series</dt>
            <dd><code data-testid="inspector-replay-swing-count">{{ replayInspector.structure.swingCount }}</code></dd>
          </div>
        </dl>
        <p class="inspector-provenance">Structure counts are from the backend-confirmed checkpoint. Select a structure object on a chart when that chart exposes its authoritative geometry.</p>
      </div>
      <p class="inspector-provenance">SBar and structure values are read from the latest backend-confirmed Struxis checkpoint. The UI does not infer or mutate structure state.</p>
    </template>
    <div v-else-if="workspaceMode === 'replay' && replayInspectorError" class="inspector-empty" data-testid="inspector-replay-error">
      <h3>Replay Inspector unavailable</h3>
      <p>{{ replayInspectorError }}</p>
    </div>
    <div v-else-if="workspaceMode === 'replay'" class="inspector-empty" data-testid="inspector-empty">
      <span class="placeholder-mark">[ ]</span>
      <h3>Object Inspector</h3>
      <p>Step or Play a Run to inspect its first backend-confirmed Struxis checkpoint.</p>
      <small>No inferred or fabricated domain state is displayed.</small>
    </div>
    <div v-else-if="workspaceMode === 'compare'" class="inspector-empty" data-testid="inspector-empty">
      <span class="placeholder-mark">Δ/</span>
      <h3>Compare Inspector</h3>
      <p>Select an object difference in the Compare results to inspect its domain identity, checkpoint and exact property deltas.</p>
      <small>Validated Compare result only</small>
    </div>
    <div v-else class="inspector-empty" data-testid="inspector-empty">
      <span class="placeholder-mark">[ ]</span>
      <h3>Object Inspector</h3>
      <p>Structural-object selection for Replay is not connected to an authoritative object projection yet.</p>
      <small>No inferred or fabricated domain state is displayed.</small>
    </div>
    <p v-if="copyStatus" class="inspector-copy-status" role="status">{{ copyStatus }}</p>
  </section>
</template>
