<script setup lang="ts">
import { computed, inject, onBeforeUnmount, watch } from "vue";
import { inspectorChartHoverKey, type InspectorChartObjectKind, type InspectorHoverChannel } from "../inspector-chart-hover";

const props = defineProps<{
  value: string;
  copyValue?: string;
  testId?: string;
  referenceKind?: InspectorChartObjectKind;
}>();

const reportHover = inject(inspectorChartHoverKey, null);
const source = Symbol("Inspector ID");
const reference = computed(() => props.referenceKind && props.value
  ? { kind: props.referenceKind, id: props.value }
  : null);
const interactive = computed(() => reportHover !== null && reference.value !== null);

function updateHover(channel: InspectorHoverChannel, active: boolean): void {
  reportHover?.(source, channel, active ? reference.value : null);
}

function clearHover(): void {
  updateHover("pointer", false);
  updateHover("focus", false);
}

watch([() => props.referenceKind, () => props.value], clearHover);
onBeforeUnmount(clearHover);

// IDs are opaque strings. Group from the right without parsing, padding, or
// otherwise changing the domain identity.
const groups = computed(() => {
  const value = props.value;
  if (value.length <= 4) return [value];
  const result: string[] = [];
  let end = value.length;
  while (end > 0) {
    const start = Math.max(0, end - 4);
    result.unshift(value.slice(start, end));
    end = start;
  }
  return result;
});
</script>

<template>
  <code
    class="inspector-domain-id"
    :data-testid="testId"
    :data-copy-value="copyValue ?? value"
    :title="value"
    aria-label="Domain ID"
    :tabindex="interactive ? 0 : undefined"
    :class="{ 'inspector-domain-id-reference': interactive }"
    @mouseenter="updateHover('pointer', true)"
    @mouseleave="updateHover('pointer', false)"
    @focus="updateHover('focus', true)"
    @blur="updateHover('focus', false)"
  ><span
      v-for="(group, index) in groups"
      :key="index"
      class="inspector-domain-id-group"
      :class="{ 'inspector-domain-id-group-alt': index % 2 === 1 }"
    >{{ group }}</span></code>
</template>

<style scoped>
.inspector-domain-id {
  display: inline-flex;
  flex-wrap: nowrap;
  align-items: baseline;
  max-width: 100%;
  overflow-x: auto;
  color: #d8dfe4;
  font: 10px/1.6 ui-monospace, SFMono-Regular, Consolas, monospace;
  white-space: nowrap;
  scrollbar-width: thin;
  font-variant-numeric: tabular-nums;
}

.inspector-domain-id-reference:hover,
.inspector-domain-id-reference:focus-visible {
  color: var(--dbg-accent, #f0cb87);
}

.inspector-domain-id-group {
  flex: 0 0 auto;
  padding: 0 1px;
  border-radius: 2px;
}

.inspector-domain-id-group + .inspector-domain-id-group {
  margin-left: 4px;
}

.inspector-domain-id-group-alt {
  background: #242b30;
}
</style>
