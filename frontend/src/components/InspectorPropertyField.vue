<script setup lang="ts">
import { computed } from "vue";
import InspectorDomainId from "./InspectorDomainId.vue";

const props = defineProps<{
  label: string;
  value: string;
  testId?: string;
  copyValue?: string;
  title?: string;
  wide?: boolean;
  domainId?: boolean;
}>();

const isDomainId = computed(() =>
  /\b(?:(?:Start|End) )?(?:SBar|CBar|Swing|Trend|KeyZone)(?: (?:Start|End))? ID$/i.test(props.label),
);
</script>

<template>
  <div class="inspector-field" :class="{ 'inspector-field-wide': wide }">
    <dt>{{ label }}</dt>
    <dd>
      <InspectorDomainId
        v-if="isDomainId"
        :value="value"
        :copy-value="copyValue ?? value"
        :test-id="testId"
      />
      <code
        v-else
        :data-testid="testId"
        :data-copy-value="copyValue ?? value"
        :title="title"
      >{{ value }}</code>
    </dd>
  </div>
</template>
