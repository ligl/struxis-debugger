<script setup lang="ts">
import { computed } from "vue";
import type { ReplayInspectorCBarDto, ReplayInspectorStructureDto, ReplayInspectorSwingDto, SBarDto } from "../origin-types";
import { formatDomainTimestamp, formatLifecycleTimestamp } from "../timestamp-format";
import InspectorPropertyField from "./InspectorPropertyField.vue";
import InspectorDomainId from "./InspectorDomainId.vue";
import { formatInspectorValue } from "../inspector-format";

const props = defineProps<{
  selectedSbar: SBarDto | null;
  selectedCbar: ReplayInspectorCBarDto | null;
  selectedSwing: ReplayInspectorSwingDto | null;
  originDatasetId: string | null;
  timeframe: string | null;
  bars: SBarDto[];
  structure: ReplayInspectorStructureDto | null;
}>();

const cbarRelatedObjects = computed(() => {
  const cbar = props.selectedCbar;
  if (!cbar) return [];
  return [
    { label: "Start SBar", id: cbar.sbarStartId },
    { label: "End SBar", id: cbar.sbarEndId },
  ].flatMap((item) => {
    const object = props.bars.find((bar) => bar.sbarId === item.id);
    return object ? [{ ...item, object }] : [];
  });
});

const swingRelatedObjects = computed(() => {
  const swing = props.selectedSwing;
  if (!swing) return [];
  return [
    { kind: "cbar" as const, label: "Start CBar", id: swing.cbarStartId },
    { kind: "cbar" as const, label: "End CBar", id: swing.cbarEndId },
    { kind: "sbar" as const, label: "Start SBar", id: swing.sbarStartId },
    { kind: "sbar" as const, label: "End SBar", id: swing.sbarEndId },
  ].flatMap((item) => {
    const object = item.kind === "cbar"
      ? props.structure?.cbars.find((cbar) => cbar.cbarId === item.id)
      : props.bars.find((bar) => bar.sbarId === item.id);
    return object ? [{ ...item, object }] : [];
  });
});

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
        <InspectorPropertyField label="SBar ID" :value="selectedSbar.sbarId" :title="selectedSbar.sbarId" test-id="inspector-sbar-id" wide />
        <InspectorPropertyField label="Origin Dataset" :value="originDatasetId ?? '—'" :title="originDatasetId ?? ''" wide />
        <InspectorPropertyField label="Bar Type" :value="selectedSbar.barType" :title="selectedSbar.barType" wide />
        <InspectorPropertyField label="Event Time · UTC" :value="formatDomainTimestamp(selectedSbar.tsEvent, timeframe)" :copy-value="selectedSbar.tsEvent" test-id="inspector-sbar-ts-event" wide />
        <InspectorPropertyField label="Init Time · UTC" :value="formatDomainTimestamp(selectedSbar.tsInit, timeframe)" :copy-value="selectedSbar.tsInit" test-id="inspector-sbar-ts-init" wide />
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
        <InspectorPropertyField label="CBar ID" :value="selectedCbar.cbarId" :test-id="'inspector-cbar-cbarId'" />
        <InspectorPropertyField label="High" :value="selectedCbar.high" :test-id="'inspector-cbar-high'" />
        <InspectorPropertyField label="Low" :value="selectedCbar.low" :test-id="'inspector-cbar-low'" />
        <InspectorPropertyField label="SBar Start ID" :value="selectedCbar.sbarStartId" :test-id="'inspector-cbar-sbarStartId'" />
        <InspectorPropertyField label="SBar End ID" :value="selectedCbar.sbarEndId" :test-id="'inspector-cbar-sbarEndId'" />
        <InspectorPropertyField label="Span SBars" :value="String(selectedCbar.spanSbars)" :test-id="'inspector-cbar-spanSbars'" />
        <InspectorPropertyField label="Fractal Type" :value="formatInspectorValue(selectedCbar.fractalType)" :copy-value="formatInspectorValue(selectedCbar.fractalType)" :test-id="'inspector-cbar-fractalType'" />
        <InspectorPropertyField label="Created At" :value="formatReplayField('createdAt', selectedCbar.createdAt)" :copy-value="selectedCbar.createdAt" :test-id="'inspector-cbar-createdAt'" />
      </dl>
      <section class="inspector-related" data-testid="inspector-related-objects">
        <p class="section-index">RELATED OBJECTS</p>
        <details
          v-for="endpoint in cbarRelatedObjects"
          :key="endpoint.label"
          class="inspector-related-item"
          :data-testid="'inspector-related-' + endpoint.label.toLowerCase().replaceAll(' ', '-')"
        >
          <summary>{{ endpoint.label }} <InspectorDomainId :value="endpoint.id" /></summary>
          <dl class="inspector-fields inspector-related-fields">
            <InspectorPropertyField label="SBar ID" :value="endpoint.object.sbarId" wide />
            <InspectorPropertyField label="Bar Type" :value="endpoint.object.barType" wide />
            <InspectorPropertyField label="Event Time · UTC" :value="formatDomainTimestamp(endpoint.object.tsEvent, timeframe)" :copy-value="endpoint.object.tsEvent" wide />
            <InspectorPropertyField label="Init Time · UTC" :value="formatDomainTimestamp(endpoint.object.tsInit, timeframe)" :copy-value="endpoint.object.tsInit" wide />
            <InspectorPropertyField label="Open" :value="endpoint.object.open" />
            <InspectorPropertyField label="High" :value="endpoint.object.high" />
            <InspectorPropertyField label="Low" :value="endpoint.object.low" />
            <InspectorPropertyField label="Close" :value="endpoint.object.close" />
            <InspectorPropertyField label="Volume" :value="endpoint.object.volume" />
          </dl>
        </details>
      </section>
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
        <InspectorPropertyField label="Swing ID" :value="selectedSwing.swingId" :test-id="'inspector-swing-swingId'" />
        <InspectorPropertyField label="Direction" :value="selectedSwing.direction" :test-id="'inspector-swing-direction'" />
        <InspectorPropertyField label="High" :value="selectedSwing.high" :test-id="'inspector-swing-high'" />
        <InspectorPropertyField label="Low" :value="selectedSwing.low" :test-id="'inspector-swing-low'" />
        <InspectorPropertyField label="CBar Start ID" :value="selectedSwing.cbarStartId" :test-id="'inspector-swing-cbarStartId'" />
        <InspectorPropertyField label="CBar End ID" :value="selectedSwing.cbarEndId" :test-id="'inspector-swing-cbarEndId'" />
        <InspectorPropertyField label="SBar Start ID" :value="selectedSwing.sbarStartId" :test-id="'inspector-swing-sbarStartId'" />
        <InspectorPropertyField label="SBar End ID" :value="selectedSwing.sbarEndId" :test-id="'inspector-swing-sbarEndId'" />
        <InspectorPropertyField label="Start OI" :value="formatInspectorValue(selectedSwing.startOi)" :test-id="'inspector-swing-startOi'" />
        <InspectorPropertyField label="End OI" :value="formatInspectorValue(selectedSwing.endOi)" :test-id="'inspector-swing-endOi'" />
        <InspectorPropertyField label="Volume" :value="selectedSwing.volume" :test-id="'inspector-swing-volume'" />
        <InspectorPropertyField label="Span SBars" :value="String(selectedSwing.spanSbars)" :test-id="'inspector-swing-spanSbars'" />
        <InspectorPropertyField label="State" :value="selectedSwing.state" :test-id="'inspector-swing-state'" />
        <InspectorPropertyField label="Created At" :value="formatReplayField('createdAt', selectedSwing.createdAt)" :copy-value="selectedSwing.createdAt" :test-id="'inspector-swing-createdAt'" />
        <InspectorPropertyField label="Updated At" :value="formatReplayField('updatedAt', selectedSwing.updatedAt)" :copy-value="selectedSwing.updatedAt" :test-id="'inspector-swing-updatedAt'" />
      </dl>
      <section class="inspector-related" data-testid="inspector-related-objects">
        <p class="section-index">RELATED OBJECTS</p>
        <details
          v-for="endpoint in swingRelatedObjects"
          :key="endpoint.label"
          class="inspector-related-item"
          :data-testid="'inspector-related-' + endpoint.label.toLowerCase().replaceAll(' ', '-')"
        >
          <summary>{{ endpoint.label }} <code>{{ endpoint.id }}</code></summary>
          <dl v-if="endpoint.kind === 'cbar'" class="inspector-fields inspector-related-fields">
            <InspectorPropertyField label="CBar ID" :value="endpoint.object.cbarId" wide />
            <InspectorPropertyField label="High" :value="endpoint.object.high" />
            <InspectorPropertyField label="Low" :value="endpoint.object.low" />
            <InspectorPropertyField label="SBar Start ID" :value="endpoint.object.sbarStartId" wide />
            <InspectorPropertyField label="SBar End ID" :value="endpoint.object.sbarEndId" wide />
            <InspectorPropertyField label="Span SBars" :value="String(endpoint.object.spanSbars)" />
            <InspectorPropertyField label="Fractal Type" :value="formatInspectorValue(endpoint.object.fractalType)" :copy-value="formatInspectorValue(endpoint.object.fractalType)" />
            <InspectorPropertyField label="Created At" :value="formatReplayField('createdAt', endpoint.object.createdAt)" :copy-value="endpoint.object.createdAt" wide />
          </dl>
          <dl v-else class="inspector-fields inspector-related-fields">
            <InspectorPropertyField label="SBar ID" :value="endpoint.object.sbarId" wide />
            <InspectorPropertyField label="Bar Type" :value="endpoint.object.barType" wide />
            <InspectorPropertyField label="Event Time · UTC" :value="formatDomainTimestamp(endpoint.object.tsEvent, timeframe)" :copy-value="endpoint.object.tsEvent" wide />
            <InspectorPropertyField label="Init Time · UTC" :value="formatDomainTimestamp(endpoint.object.tsInit, timeframe)" :copy-value="endpoint.object.tsInit" wide />
            <InspectorPropertyField label="Open" :value="endpoint.object.open" />
            <InspectorPropertyField label="High" :value="endpoint.object.high" />
            <InspectorPropertyField label="Low" :value="endpoint.object.low" />
            <InspectorPropertyField label="Close" :value="endpoint.object.close" />
            <InspectorPropertyField label="Volume" :value="endpoint.object.volume" />
          </dl>
        </details>
      </section>
      <p class="inspector-provenance">Values shown from the validated Origin Structure projection.</p>
    </template>
    <div v-else class="inspector-empty" data-testid="inspector-empty">
      <span class="placeholder-mark">S/</span>
      <h3>Object Inspector</h3>
      <p>Click an SBar, CBar range, or Swing segment on the Origin chart to inspect its exact domain fields.</p>
      <small>Authoritative Origin data only</small>
    </div>
</template>


<style scoped>
.inspector-related {
  display: grid;
  gap: 4px;
  margin-top: 12px;
  padding-top: 8px;
  border-top: 1px solid #252c32;
}

.inspector-related .section-index {
  margin: 0 0 3px;
}

.inspector-related-item {
  min-width: 0;
  border: 1px solid #30383f;
  border-radius: 3px;
  background: #171c20;
}

.inspector-related-item > summary {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px;
  color: #aeb8bf;
  cursor: pointer;
  list-style-position: inside;
}

.inspector-related-item > summary:hover {
  background: #20272d;
  color: #e3e8eb;
}

.inspector-related-item > summary code {
  min-width: 0;
  max-width: 65%;
  overflow-x: auto;
  white-space: nowrap;
}

.inspector-related-fields {
  margin: 0 6px 6px;
  padding-top: 6px;
  border-top: 1px solid #30383f;
}
</style>
