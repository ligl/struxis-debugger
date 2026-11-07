<script setup lang="ts">
import { computed } from "vue";
import type { KeyZoneCheckpointDto, KeyZoneDto, ObservationControlsContext, CreateObservationDto, CancelObservationDto, ObservationCommandResultDto } from "../origin-types";
import KeyZoneObservationControls from "./KeyZoneObservationControls.vue";
import InspectorPropertyField from "./InspectorPropertyField.vue";
import { formatDomainTimestamp, formatLifecycleTimestamp } from "../timestamp-format";
const props = defineProps<{
  zone: KeyZoneDto; registry: KeyZoneCheckpointDto;
  observationContext?: ObservationControlsContext;
  createObservation?: (request: CreateObservationDto) => Promise<ObservationCommandResultDto>;
  cancelObservation?: (request: CancelObservationDto) => Promise<ObservationCommandResultDto>;
}>();
const interactions = computed(() => props.registry.interactions.filter((item) => item.keyzoneId === props.zone.keyzoneId));
const groups = computed(() => props.registry.observations.filter((task) => task.keyzoneId === props.zone.keyzoneId)
    .map((task) => ({ id: task.observationId, task, interactions: interactions.value.filter((item) => item.observationId === task.observationId) })));
const fields = computed(() => [
  { label: "KeyZone ID", value: props.zone.keyzoneId },
  { label: "Instrument", value: props.registry.instrumentId },
  { label: "Source timeframe", value: props.zone.timeframe },
  { label: "Origin", value: props.zone.originKind },
  { label: "Origin ID", value: props.zone.originId ?? "—" },
  { label: "State", value: props.zone.state },
  { label: "Lower", value: props.zone.lower },
  { label: "Upper", value: props.zone.upper },
  { label: "Formed · UTC", value: formatDomainTimestamp(props.zone.formedAt, props.zone.timeframe), raw: props.zone.formedAt },
  { label: "Finalized · UTC", value: formatDomainTimestamp(props.zone.finalizedAt, props.zone.timeframe), raw: props.zone.finalizedAt },
  { label: "Invalidated · UTC", value: formatDomainTimestamp(props.zone.invalidatedAt, props.zone.timeframe), raw: props.zone.invalidatedAt },
  { label: "Created", value: formatLifecycleTimestamp(props.zone.createdAt), raw: props.zone.createdAt },
  { label: "Finalized detected", value: formatLifecycleTimestamp(props.zone.finalizedDetectedAt), raw: props.zone.finalizedDetectedAt },
  { label: "Invalidated detected", value: formatLifecycleTimestamp(props.zone.invalidatedDetectedAt), raw: props.zone.invalidatedDetectedAt },
]);
</script>
<template>
  <section class="keyzone-details" data-testid="keyzone-details">
    <div class="inspector-object-heading"><h3>KeyZone</h3><span class="inspector-object-kind">{{ zone.state }}</span></div>
    <KeyZoneObservationControls v-if="observationContext && createObservation && cancelObservation"
      :key="`${observationContext.runId}:${zone.keyzoneId}`" :zone="zone" :registry="registry" :context="observationContext"
      :create="createObservation" :cancel="cancelObservation" />
    <dl class="inspector-fields">
      <InspectorPropertyField v-for="field in fields" :key="field.label" :label="field.label" :value="field.value" :copy-value="field.raw ?? field.value" wide />
    </dl>
    <p v-if="!groups.length" class="keyzone-empty" data-testid="keyzone-observations-empty">No observations recorded for this zone.</p>
    <section v-for="group in groups" :key="group.id" class="keyzone-observation" data-testid="keyzone-observation" :data-observation-id="group.task.observationId">
      <h4>Observation {{ group.task.observationId }} · {{ group.task.state }}</h4>
      <dl class="inspector-fields">
        <InspectorPropertyField label="Consumer" :value="group.task.consumerId" wide />
        <InspectorPropertyField label="Request" :value="group.task.requestId" wide />
        <InspectorPropertyField label="Observer" :value="`${group.task.observer.instrumentId} · ${group.task.observer.timeframe}`" wide />
        <InspectorPropertyField label="Start policy" :value="group.task.startMode" />
        <InspectorPropertyField label="Start boundary" :value="group.task.startExclusive ? 'Exclusive' : 'Inclusive'" />
        <InspectorPropertyField label="Start · UTC" :value="formatDomainTimestamp(group.task.startAt, group.task.observer.timeframe)" :copy-value="group.task.startAt" wide />
        <InspectorPropertyField label="Deadline · UTC" :value="formatDomainTimestamp(group.task.deadline, group.task.observer.timeframe)" :copy-value="group.task.deadline" wide />
        <InspectorPropertyField label="Completion" :value="group.task.completion" wide />
        <InspectorPropertyField label="N" :value="group.task.configN" />
        <InspectorPropertyField label="X" :value="String(group.task.configX)" />
        <InspectorPropertyField label="Progress · UTC" :value="formatDomainTimestamp(group.task.lastProcessedAt, group.task.observer.timeframe)" wide />
        <InspectorPropertyField label="Terminal reason" :value="group.task.reason ?? '—'" wide />
        <InspectorPropertyField label="Terminal · UTC" :value="formatDomainTimestamp(group.task.terminalAt, group.task.observer.timeframe)" wide />
        <InspectorPropertyField label="Terminal detected" :value="formatLifecycleTimestamp(group.task.terminalDetectedAt)" wide />
      </dl>
      <p class="section-index keyzone-interactions-heading">INTERACTIONS · {{ group.interactions.length }}</p>
      <p v-if="!group.interactions.length" class="keyzone-empty">No interactions recorded for this zone.</p>
      <details v-for="item in group.interactions" :key="item.interactionId" class="keyzone-interaction" data-testid="keyzone-interaction" :data-interaction-id="item.interactionId">
        <summary>
          <span class="interaction-title">Interaction {{ item.interactionId }}</span>
          <span class="interaction-overview">{{ item.observerTimeframe }} · {{ item.state }}</span>
          <span class="interaction-start">Started · UTC {{ formatDomainTimestamp(item.startedAt, item.observerTimeframe) }}</span>
        </summary>
        <dl class="inspector-fields">
          <InspectorPropertyField label="Interaction ID" :value="item.interactionId" wide />
          <InspectorPropertyField label="Observer" :value="`${item.observer.instrumentId} · ${item.observer.timeframe}`" wide />
          <InspectorPropertyField label="N" :value="item.configN" />
          <InspectorPropertyField label="X" :value="String(item.configX)" />
          <InspectorPropertyField label="Outside count" :value="item.outsideCount" />
          <InspectorPropertyField label="Started · UTC" :value="formatDomainTimestamp(item.startedAt, item.observerTimeframe)" :copy-value="item.startedAt" wide />
          <InspectorPropertyField label="Last processed · UTC" :value="formatDomainTimestamp(item.lastProcessedAt, item.observerTimeframe)" :copy-value="item.lastProcessedAt ?? undefined" wide />
          <InspectorPropertyField label="Ended · UTC" :value="formatDomainTimestamp(item.endedAt, item.observerTimeframe)" :copy-value="item.endedAt ?? undefined" wide />
          <InspectorPropertyField label="Invalidated · UTC" :value="formatDomainTimestamp(item.invalidatedAt, item.observerTimeframe)" :copy-value="item.invalidatedAt ?? undefined" wide />
          <InspectorPropertyField v-if="item.interruptedAt !== undefined" label="Interrupted · UTC" :value="formatDomainTimestamp(item.interruptedAt, item.observerTimeframe)" wide />
          <InspectorPropertyField v-if="item.interruptionReason !== undefined" label="Interruption reason" :value="item.interruptionReason" wide />
          <InspectorPropertyField v-if="item.interruptedDetectedAt !== undefined" label="Interrupted detected" :value="formatLifecycleTimestamp(item.interruptedDetectedAt)" wide />
          <InspectorPropertyField label="Started detected" :value="formatLifecycleTimestamp(item.startedDetectedAt)" wide />
          <InspectorPropertyField label="Ended detected" :value="formatLifecycleTimestamp(item.endedDetectedAt)" wide />
          <InspectorPropertyField label="Invalidated detected" :value="formatLifecycleTimestamp(item.invalidatedDetectedAt)" wide />
        </dl>
      </details>
    </section>
  </section>
</template>

<style scoped>
.keyzone-details {
  display: grid;
  gap: 16px;
  min-width: 0;
}
.keyzone-details > .inspector-object-heading {
  padding: 0 8px 12px;
}
.keyzone-details .inspector-fields {
  min-width: 0;
  margin: 0;
  padding: 0;
}
.keyzone-details :deep(.inspector-field) {
  gap: 6px 10px;
  padding: 10px 8px;
}
.keyzone-details :deep(.inspector-field:last-child) {
  border-bottom: 0;
}
.keyzone-details :deep(.inspector-field dt),
.keyzone-details :deep(.inspector-field dd) {
  line-height: 1.6;
  overflow-wrap: anywhere;
}
.keyzone-observation {
  display: grid;
  gap: 12px;
  min-width: 0;
  padding-top: 14px;
  border-top: 1px solid var(--dbg-border-strong);
}
.keyzone-observation > h4 {
  margin: 0;
  padding: 0 8px;
  font-size: 11px;
  line-height: 1.6;
  overflow-wrap: anywhere;
}
.keyzone-interactions-heading {
  margin: 0;
  padding: 4px 8px 0;
  font-size: 9px;
  line-height: 1.6;
}
.keyzone-interaction {
  min-width: 0;
  border-radius: 4px;
  background: var(--dbg-surface-1);
}
.keyzone-interaction > summary {
  padding: 12px 16px;
  border-radius: 4px;
  cursor: pointer;
  text-align: left;
  font-size: 11px;
  line-height: 1.6;
  overflow-wrap: anywhere;
}
.keyzone-interaction > summary::marker { color: var(--dbg-accent); }
.keyzone-interaction > summary:hover { background: var(--dbg-surface-2); }
.keyzone-interaction > summary:focus-visible {
  outline: 1px solid var(--dbg-accent);
  outline-offset: 2px;
}
.interaction-title { font-weight: 600; }
.interaction-overview,
.interaction-start { display: block; margin-top: 6px; }
.interaction-start { color: var(--dbg-text-secondary); }
.keyzone-interaction > .inspector-fields { padding: 0 8px 4px; }
.keyzone-empty {
  margin: 0;
  padding: 0 8px;
  color: var(--dbg-text-muted);
  font-size: 11px;
  line-height: 1.6;
}
</style>
