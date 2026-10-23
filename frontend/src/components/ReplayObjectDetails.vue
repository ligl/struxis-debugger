<script setup lang="ts">
import { computed } from "vue";
import type { InspectorWorkspaceContext, ReplayInspectorDto, ReplayInspectorCBarDto, SBarDto } from "../origin-types";
import { formatDomainTimestamp, formatLifecycleTimestamp } from "../timestamp-format";
import { formatInspectorValue } from "../inspector-format";
import InspectorPropertyField from "./InspectorPropertyField.vue";
import InspectorDomainId from "./InspectorDomainId.vue";

type ReplaySelectedObject = Extract<InspectorWorkspaceContext, { workspace: "replay" }>["selectedObject"];

const props = defineProps<{
  selectedObject: NonNullable<ReplaySelectedObject>;
  timeframe: string | null;
  checkpoint: ReplayInspectorDto | null;
  bars: SBarDto[];
}>();

type InspectorRow = { label: string; value: string; copyValue?: string };

const title = computed(() => props.selectedObject.kind.toUpperCase());
const sourceLabel = computed(() => {
  if (props.selectedObject.kind === "sbar") {
    return props.selectedObject.source === "checkpoint" ? "CONFIRMED CHECKPOINT" : "TEST INPUT";
  }
  return "CONFIRMED CHECKPOINT STRUCTURE";
});

const relatedObjects = computed(() => {
  const selected = props.selectedObject;
  const structure = props.checkpoint?.structure;
  if (selected.kind === "cbar") {
    return [
      { kind: "sbar" as const, label: "Start SBar", id: selected.object.sbarStartId },
      { kind: "sbar" as const, label: "End SBar", id: selected.object.sbarEndId },
    ].flatMap((relation) => {
      const object = props.bars.find((bar) => bar.sbarId === relation.id);
      return object ? [{ ...relation, object }] : [];
    });
  }
  if (selected.kind === "swing") {
    return [
      { kind: "cbar" as const, label: "Start CBar", id: selected.object.cbarStartId },
      { kind: "cbar" as const, label: "End CBar", id: selected.object.cbarEndId },
      { kind: "sbar" as const, label: "Start SBar", id: selected.object.sbarStartId },
      { kind: "sbar" as const, label: "End SBar", id: selected.object.sbarEndId },
    ].flatMap((relation) => {
      const object = relation.kind === "cbar"
        ? structure?.cbars.find((cbar) => cbar.cbarId === relation.id)
        : props.bars.find((bar) => bar.sbarId === relation.id);
      return object ? [{ ...relation, object }] : [];
    });
  }
  return [];
});

const rows = computed<InspectorRow[]>(() => {
  const selected = props.selectedObject;
  if (selected.kind === "sbar") {
    const bar = selected.object;
    const result = [
      { label: "SBar ID", value: bar.sbarId, copyValue: bar.sbarId },
      { label: "Bar Type", value: bar.barType, copyValue: bar.barType },
      { label: "Event Time · UTC", value: formatDomainTimestamp(bar.tsEvent, props.timeframe), copyValue: bar.tsEvent },
      { label: "Init Time · UTC", value: formatDomainTimestamp(bar.tsInit, props.timeframe), copyValue: bar.tsInit },
      { label: "Open", value: bar.open },
      { label: "High", value: bar.high },
      { label: "Low", value: bar.low },
      { label: "Close", value: bar.close },
      { label: "Volume", value: bar.volume },
    ];
    if (selected.source === "checkpoint") {
      const checkpointBar = selected.object as Extract<typeof selected, { kind: "sbar" }>["object"] & {
        body?: string; upperShadow?: string; lowerShadow?: string; totalRange?: string;
        bodyRatio?: number; shadowRatio?: number; direction?: string;
      };
      result.push(
        { label: "Body", value: checkpointBar.body ?? "—" },
        { label: "Upper Shadow", value: checkpointBar.upperShadow ?? "—" },
        { label: "Lower Shadow", value: checkpointBar.lowerShadow ?? "—" },
        { label: "Total Range", value: checkpointBar.totalRange ?? "—" },
        { label: "Body Ratio", value: checkpointBar.bodyRatio == null ? "—" : String(checkpointBar.bodyRatio) },
        { label: "Shadow Ratio", value: checkpointBar.shadowRatio == null ? "—" : String(checkpointBar.shadowRatio) },
        { label: "Direction", value: checkpointBar.direction ?? "—" },
      );
    }
    return result;
  }
  if (selected.kind === "cbar") {
    const cbar = selected.object;
    return [
      { label: "CBar ID", value: cbar.cbarId, copyValue: cbar.cbarId },
      { label: "High", value: cbar.high },
      { label: "Low", value: cbar.low },
      { label: "SBar Start ID", value: cbar.sbarStartId, copyValue: cbar.sbarStartId },
      { label: "SBar End ID", value: cbar.sbarEndId, copyValue: cbar.sbarEndId },
      { label: "Span SBars", value: String(cbar.spanSbars) },
      { label: "Fractal Type", value: formatInspectorValue(cbar.fractalType) },
      { label: "Created At", value: formatLifecycleTimestamp(cbar.createdAt), copyValue: cbar.createdAt },
    ];
  }
  const swing = selected.object;
  return [
    { label: "Swing ID", value: swing.swingId, copyValue: swing.swingId },
    { label: "Direction", value: swing.direction },
    { label: "High", value: swing.high },
    { label: "Low", value: swing.low },
    { label: "CBar Start ID", value: swing.cbarStartId, copyValue: swing.cbarStartId },
    { label: "CBar End ID", value: swing.cbarEndId, copyValue: swing.cbarEndId },
    { label: "SBar Start ID", value: swing.sbarStartId, copyValue: swing.sbarStartId },
    { label: "SBar End ID", value: swing.sbarEndId, copyValue: swing.sbarEndId },
    { label: "Start OI", value: formatInspectorValue(swing.startOi) },
    { label: "End OI", value: formatInspectorValue(swing.endOi) },
    { label: "Volume", value: swing.volume },
    { label: "Span SBars", value: String(swing.spanSbars) },
    { label: "State", value: swing.state },
    { label: "Created At", value: formatLifecycleTimestamp(swing.createdAt), copyValue: swing.createdAt },
    { label: "Updated At", value: formatLifecycleTimestamp(swing.updatedAt), copyValue: swing.updatedAt },
  ];
});
</script>

<template>
  <div class="inspector-object-heading" data-testid="inspector-replay-selected-object">
    <div>
      <p class="section-index">{{ sourceLabel }}</p>
      <h3>{{ title }}</h3>
    </div>
    <span class="inspector-object-kind">{{ selectedObject.kind.toUpperCase() }}</span>
  </div>
  <dl class="inspector-fields">
    <InspectorPropertyField
      v-for="row in rows"
      :key="row.label"
      :label="row.label"
      :value="row.value"
      :copy-value="row.copyValue"
      :test-id="'inspector-replay-selected-' + row.label.toLowerCase().replaceAll(' ', '-').replaceAll('·', '').trim()"
      :wide="row.label.includes('ID') || row.label.includes('Time')"
    />
  </dl>
  <section
    v-if="relatedObjects.length > 0"
    class="inspector-related"
    data-testid="inspector-replay-related-objects"
  >
    <p class="section-index">RELATED OBJECTS</p>
    <details
      v-for="endpoint in relatedObjects"
      :key="endpoint.label"
      class="inspector-related-item"
      :data-testid="'inspector-replay-related-' + endpoint.label.toLowerCase().replaceAll(' ', '-')"
    >
      <summary>{{ endpoint.label }} <InspectorDomainId :value="endpoint.id" /></summary>
      <dl v-if="endpoint.kind === 'cbar'" class="inspector-fields inspector-related-fields">
        <InspectorPropertyField label="CBar ID" :value="(endpoint.object as ReplayInspectorCBarDto).cbarId" wide />
        <InspectorPropertyField label="High" :value="(endpoint.object as ReplayInspectorCBarDto).high" />
        <InspectorPropertyField label="Low" :value="(endpoint.object as ReplayInspectorCBarDto).low" />
        <InspectorPropertyField label="SBar Start ID" :value="(endpoint.object as ReplayInspectorCBarDto).sbarStartId" wide />
        <InspectorPropertyField label="SBar End ID" :value="(endpoint.object as ReplayInspectorCBarDto).sbarEndId" wide />
        <InspectorPropertyField label="Span SBars" :value="String((endpoint.object as ReplayInspectorCBarDto).spanSbars)" />
        <InspectorPropertyField label="Fractal Type" :value="formatInspectorValue((endpoint.object as ReplayInspectorCBarDto).fractalType)" />
        <InspectorPropertyField label="Created At" :value="formatLifecycleTimestamp((endpoint.object as ReplayInspectorCBarDto).createdAt)" :copy-value="(endpoint.object as ReplayInspectorCBarDto).createdAt" wide />
      </dl>
      <dl v-else class="inspector-fields inspector-related-fields">
        <InspectorPropertyField label="SBar ID" :value="(endpoint.object as SBarDto).sbarId" wide />
        <InspectorPropertyField label="Bar Type" :value="(endpoint.object as SBarDto).barType" wide />
        <InspectorPropertyField label="Event Time · UTC" :value="formatDomainTimestamp((endpoint.object as SBarDto).tsEvent, timeframe)" :copy-value="(endpoint.object as SBarDto).tsEvent" wide />
        <InspectorPropertyField label="Init Time · UTC" :value="formatDomainTimestamp((endpoint.object as SBarDto).tsInit, timeframe)" :copy-value="(endpoint.object as SBarDto).tsInit" wide />
        <InspectorPropertyField label="Open" :value="(endpoint.object as SBarDto).open" />
        <InspectorPropertyField label="High" :value="(endpoint.object as SBarDto).high" />
        <InspectorPropertyField label="Low" :value="(endpoint.object as SBarDto).low" />
        <InspectorPropertyField label="Close" :value="(endpoint.object as SBarDto).close" />
        <InspectorPropertyField label="Volume" :value="(endpoint.object as SBarDto).volume" />
      </dl>
    </details>
  </section>
  <p v-if="selectedObject.kind === 'sbar' && selectedObject.source === 'input'" class="inspector-provenance">
    Market fields are from the validated Test Dataset input sequence. This historical input bar is not represented as a backend-confirmed checkpoint.
  </p>
  <p v-else class="inspector-provenance">
    Object fields are from the currently backend-confirmed Replay checkpoint. The UI does not infer or mutate Struxis state.
  </p>
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
