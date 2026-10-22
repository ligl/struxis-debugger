<script setup lang="ts">
import type { ReplayInspectorCBarDto, ReplayInspectorSwingDto, SBarDto } from "../origin-types";
import { formatDomainTimestamp, formatLifecycleTimestamp } from "../timestamp-format";
import InspectorPropertyField from "./InspectorPropertyField.vue";
import { formatInspectorValue } from "../inspector-format";

const props = defineProps<{
  selectedSbar: SBarDto | null;
  selectedCbar: ReplayInspectorCBarDto | null;
  selectedSwing: ReplayInspectorSwingDto | null;
  originDatasetId: string | null;
  timeframe: string | null;
}>();

function formatReplayField(field: string, value: unknown): string {
  if (field === "tsEvent" || field === "tsInit") {
    return formatDomainTimestamp(value == null ? null : String(value), props.timeframe);
  }
  if (field === "createdAt" || field === "updatedAt") {
    return formatLifecycleTimestamp(value == null ? null : String(value));
  }
  return formatInspectorValue(value);
}
</script>

<template>
    <template v-if="selectedSbar">
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

    <template v-else-if="selectedCbar">
      <div class="inspector-object-heading">
        <div>
          <p class="section-index">SELECTED DOMAIN OBJECT</p>
          <h3>CBar</h3>
        </div>
        <span class="inspector-object-kind">STRUCTURE</span>
      </div>
      <dl class="inspector-fields">
        <InspectorPropertyField
          v-for="(value, field) in selectedCbar"
          :key="field"
          :label="String(field)"
          :value="formatReplayField(String(field), value)"
          :test-id="'inspector-cbar-' + String(field)"
          :copy-value="value === null ? 'null' : value === undefined ? '—' : String(value)"
        />
      </dl>
      <p class="inspector-provenance">Values shown from the validated Origin Structure projection.</p>
    </template>
    <template v-else-if="selectedSwing">
      <div class="inspector-object-heading">
        <div>
          <p class="section-index">SELECTED DOMAIN OBJECT</p>
          <h3>Swing</h3>
        </div>
        <span class="inspector-object-kind">{{ selectedSwing.state.toUpperCase() }}</span>
      </div>
      <dl class="inspector-fields">
        <InspectorPropertyField
          v-for="(value, field) in selectedSwing"
          :key="field"
          :label="String(field)"
          :value="formatReplayField(String(field), value)"
          :test-id="'inspector-swing-' + String(field)"
          :copy-value="value === null ? 'null' : value === undefined ? '—' : String(value)"
        />
      </dl>
      <p class="inspector-provenance">Values shown from the validated Origin Structure projection.</p>
    </template>
    <div v-else class="inspector-empty" data-testid="inspector-empty">
      <span class="placeholder-mark">S/</span>
      <h3>Object Inspector</h3>
      <p>Click an SBar, CBar range, or Swing segment on the Origin chart to inspect its exact domain fields.</p>
      <small>Authoritative Origin data only</small>
    </div>
</template>
