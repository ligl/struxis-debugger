<script setup lang="ts">
defineProps<{
  boundaries: { start: number; end: number } | null;
}>();
</script>

<template>
  <g
    v-if="boundaries"
    class="snapshot-live-range-markers"
    data-testid="snapshot-live-range-markers"
  >
    <line
      :x1="boundaries.start"
      y1="0"
      :x2="boundaries.start"
      y2="100%"
      stroke="#77838C"
      stroke-width="0.9"
      stroke-dasharray="3 5"
      opacity="0.42"
      data-testid="snapshot-live-range-start"
    />
    <line
      :x1="boundaries.end"
      y1="0"
      :x2="boundaries.end"
      y2="100%"
      stroke="#77838C"
      stroke-width="0.9"
      stroke-dasharray="3 5"
      opacity="0.42"
      data-testid="snapshot-live-range-end"
    />
    <path
      :d="`M ${boundaries.start + 2} 7 H ${boundaries.start + 8} M ${boundaries.start + 5} 4 L ${boundaries.start + 8} 7 L ${boundaries.start + 5} 10`"
      fill="none"
      stroke="#77838C"
      stroke-width="0.9"
      stroke-linecap="round"
      stroke-linejoin="round"
      opacity="0.55"
      pointer-events="none"
      data-testid="snapshot-live-range-start-arrow"
    />
    <path
      :d="`M ${boundaries.end - 2} 7 H ${boundaries.end - 8} M ${boundaries.end - 5} 4 L ${boundaries.end - 8} 7 L ${boundaries.end - 5} 10`"
      fill="none"
      stroke="#77838C"
      stroke-width="0.9"
      stroke-linecap="round"
      stroke-linejoin="round"
      opacity="0.55"
      pointer-events="none"
      data-testid="snapshot-live-range-end-arrow"
    />
  </g>
</template>
