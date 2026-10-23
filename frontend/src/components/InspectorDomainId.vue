<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  value: string;
  copyValue?: string;
  testId?: string;
}>();

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
