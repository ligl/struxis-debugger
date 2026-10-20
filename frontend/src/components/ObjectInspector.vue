<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { ObjectDifferenceDto, ReplayInspectorDto, SBarDto } from "../origin-types";

const props = defineProps<{
  selectedSbar: SBarDto | null;
  originDatasetId: string | null;
  workspaceMode: "dataset" | "replay" | "compare";
  selectedDifference: ObjectDifferenceDto | null;
  compareBaselineSnapshotId: string | null;
  compareCandidateSnapshotId: string | null;
  replayInspector: ReplayInspectorDto | null;
  replayInspectorError: string;
}>();

const selectedReplayObjectKey = ref<string | null>(null);
const selectedReplayCbar = computed(() => {
  if (!selectedReplayObjectKey.value?.startsWith("cbar:")) return null;
  const id = selectedReplayObjectKey.value.slice("cbar:".length);
  return props.replayInspector?.structure?.cbars.find((cbar) => cbar.cbarId === id) ?? null;
});
const selectedReplaySwing = computed(() => {
  if (!selectedReplayObjectKey.value?.startsWith("swing:")) return null;
  const id = selectedReplayObjectKey.value.slice("swing:".length);
  return props.replayInspector?.structure?.swings.find((swing) => swing.swingId === id) ?? null;
});

watch(() => props.replayInspector, (projection) => {
  if (!projection) {
    selectedReplayObjectKey.value = null;
    return;
  }
  const key = selectedReplayObjectKey.value;
  if (!key) return;
  const stillExists = key.startsWith("cbar:")
    ? projection.structure?.cbars.some((cbar) => `cbar:${cbar.cbarId}` === key)
    : projection.structure?.swings.some((swing) => `swing:${swing.swingId}` === key);
  if (!stillExists) selectedReplayObjectKey.value = null;
});

function formatValue(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "—";
  if (typeof value === "string") return value;
  return JSON.stringify(value) ?? String(value);
}
</script>

<template>
  <section class="inspector-object" data-testid="inspector-object">
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
          <dt>Event Timestamp (ns)</dt>
          <dd><code>{{ selectedSbar.tsEvent }}</code></dd>
        </div>
        <div class="inspector-field inspector-field-wide">
          <dt>Init Timestamp (ns)</dt>
          <dd><code>{{ selectedSbar.tsInit }}</code></dd>
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
      <p>Select an SBar on the Origin chart to inspect its exact identity, timestamps and market fields.</p>
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
      <div v-if="replayInspector.structure" class="inspector-subsection">
        <p class="section-index">CBARS · {{ replayInspector.structure.cbarCount }}</p>
        <div class="inspector-object-list" data-testid="inspector-replay-cbars">
          <button
            v-for="cbar in replayInspector.structure.cbars"
            :key="cbar.cbarId"
            type="button"
            class="inspector-object-row"
            :class="{ selected: selectedReplayObjectKey === 'cbar:' + cbar.cbarId }"
            :data-testid="'inspector-select-cbar-' + cbar.cbarId"
            @click="selectedReplayObjectKey = 'cbar:' + cbar.cbarId"
          >
            <span><strong>CBar</strong><small>{{ cbar.sbarStartId }} → {{ cbar.sbarEndId }}</small></span>
            <code>{{ cbar.cbarId }}</code>
          </button>
        </div>
        <p class="section-index inspector-list-heading">SWINGS · {{ replayInspector.structure.swingCount }}</p>
        <div class="inspector-object-list" data-testid="inspector-replay-swings">
          <button
            v-for="swing in replayInspector.structure.swings"
            :key="swing.swingId"
            type="button"
            class="inspector-object-row"
            :class="{ selected: selectedReplayObjectKey === 'swing:' + swing.swingId }"
            :data-testid="'inspector-select-swing-' + swing.swingId"
            @click="selectedReplayObjectKey = 'swing:' + swing.swingId"
          >
            <span><strong>{{ swing.direction }} Swing</strong><small>{{ swing.state }} · {{ swing.sbarStartId }} → {{ swing.sbarEndId }}</small></span>
            <code>{{ swing.swingId }}</code>
          </button>
        </div>
      </div>
      <div v-if="selectedReplayCbar" class="inspector-subsection" data-testid="inspector-replay-selected-cbar">
        <p class="section-index">SELECTED CBAR PROPERTIES</p>
        <dl class="inspector-fields">
          <div v-for="(value, field) in selectedReplayCbar" :key="field" class="inspector-field">
            <dt>{{ field }}</dt><dd><code>{{ formatValue(value) }}</code></dd>
          </div>
        </dl>
      </div>
      <div v-else-if="selectedReplaySwing" class="inspector-subsection" data-testid="inspector-replay-selected-swing">
        <p class="section-index">SELECTED SWING PROPERTIES</p>
        <dl class="inspector-fields">
          <div v-for="(value, field) in selectedReplaySwing" :key="field" class="inspector-field">
            <dt>{{ field }}</dt><dd><code>{{ formatValue(value) }}</code></dd>
          </div>
        </dl>
      </div>
      <p class="inspector-provenance">SBar, CBar and Swing values are copied from the latest backend-confirmed Struxis checkpoint. The UI does not infer or mutate structure state.</p>
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
  </section>
</template>
