<script setup lang="ts">
defineProps<{
  label: string;
  value: string;
  testId?: string;
  copyValue?: string;
  title?: string;
  wide?: boolean;
}>();
</script>

<template>
  <div class="inspector-field" :class="{ 'inspector-field-wide': wide }">
    <dt>{{ label }}</dt>
    <dd>
      <code
        :data-testid="testId"
         :data-copy-value="copyValue ?? value"
        :title="title"
      >{{ value }}</code>
    </dd>
  </div>
</template>
