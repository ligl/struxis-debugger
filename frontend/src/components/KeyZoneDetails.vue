<script setup lang="ts">
import { computed } from "vue";
import type { KeyZoneCheckpointDto, KeyZoneDto } from "../origin-types";
import InspectorPropertyField from "./InspectorPropertyField.vue";
import { formatDomainTimestamp, formatLifecycleTimestamp } from "../timestamp-format";
const props = defineProps<{ zone: KeyZoneDto; registry: KeyZoneCheckpointDto }>();
const interactions = computed(() => props.registry.interactions.filter((item) => item.keyzoneId === props.zone.keyzoneId));
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
  <section data-testid="keyzone-details">
    <div class="inspector-object-heading"><h3>KeyZone</h3><span class="inspector-object-kind">{{ zone.state }}</span></div>
    <dl class="inspector-fields">
      <InspectorPropertyField v-for="field in fields" :key="field.label" :label="field.label" :value="field.value" :copy-value="field.raw ?? field.value" wide />
    </dl>
    <p class="section-index">INTERACTIONS · {{ interactions.length }}</p>
    <p v-if="!interactions.length">No interactions recorded for this zone.</p>
    <section v-for="item in interactions" :key="item.interactionId" data-testid="keyzone-interaction">
      <h4>{{ item.observerTimeframe }} · {{ item.state }}</h4>
      <dl class="inspector-fields">
        <InspectorPropertyField label="Interaction ID" :value="item.interactionId" wide />
        <InspectorPropertyField label="Observer BarType" :value="item.observerBarType" wide />
        <InspectorPropertyField label="N" :value="item.configN" />
        <InspectorPropertyField label="X" :value="String(item.configX)" />
        <InspectorPropertyField label="Outside count" :value="item.outsideCount" />
        <InspectorPropertyField label="Started · UTC" :value="formatDomainTimestamp(item.startedAt, item.observerTimeframe)" :copy-value="item.startedAt" wide />
        <InspectorPropertyField label="Last processed · UTC" :value="formatDomainTimestamp(item.lastProcessedAt, item.observerTimeframe)" :copy-value="item.lastProcessedAt ?? undefined" wide />
        <InspectorPropertyField label="Ended · UTC" :value="formatDomainTimestamp(item.endedAt, item.observerTimeframe)" :copy-value="item.endedAt ?? undefined" wide />
        <InspectorPropertyField label="Invalidated · UTC" :value="formatDomainTimestamp(item.invalidatedAt, item.observerTimeframe)" :copy-value="item.invalidatedAt ?? undefined" wide />
        <InspectorPropertyField label="Started detected" :value="formatLifecycleTimestamp(item.startedDetectedAt)" wide />
        <InspectorPropertyField label="Ended detected" :value="formatLifecycleTimestamp(item.endedDetectedAt)" wide />
        <InspectorPropertyField label="Invalidated detected" :value="formatLifecycleTimestamp(item.invalidatedDetectedAt)" wide />
      </dl>
    </section>
  </section>
</template>
