<script setup lang="ts">
import { onBeforeUnmount, ref } from "vue";

const props = defineProps<{
  workspace: "replay" | "compare";
}>();

const initialUpperShare = props.workspace === "replay" ? 75 : 50;
const upperShare = ref(initialUpperShare);
const stackElement = ref<HTMLElement | null>(null);
let dragStartY = 0;
let dragStartShare = initialUpperShare;

function clampShare(value: number): number {
  return Math.max(25, Math.min(75, value));
}

function handlePointerMove(event: PointerEvent): void {
  const bounds = stackElement.value?.getBoundingClientRect();
  if (!bounds || bounds.height <= 0) return;
  upperShare.value = clampShare(
    dragStartShare + ((event.clientY - dragStartY) / bounds.height) * 100,
  );
}

function stopPointerResize(): void {
  window.removeEventListener("pointermove", handlePointerMove);
  window.removeEventListener("pointerup", stopPointerResize);
  window.removeEventListener("pointercancel", stopPointerResize);
}

function startPointerResize(event: PointerEvent): void {
  if (event.button !== 0) return;
  const bounds = stackElement.value?.getBoundingClientRect();
  if (!bounds || bounds.height <= 0) return;

  event.preventDefault();
  dragStartY = event.clientY;
  dragStartShare = upperShare.value;
  window.addEventListener("pointermove", handlePointerMove);
  window.addEventListener("pointerup", stopPointerResize);
  window.addEventListener("pointercancel", stopPointerResize);
}

function focusSplitter(event: MouseEvent): void {
  // Hovering the splitter should make its arrow-key resize affordance immediately usable.
  (event.currentTarget as HTMLElement).focus({ preventScroll: true });
}

function handleSplitterKey(event: KeyboardEvent): void {
  if (event.key === "ArrowUp") upperShare.value = clampShare(upperShare.value - 2);
  else if (event.key === "ArrowDown") upperShare.value = clampShare(upperShare.value + 2);
  else if (event.key === "Home") upperShare.value = 25;
  else if (event.key === "End") upperShare.value = 75;
  else return;
  event.preventDefault();
}

onBeforeUnmount(stopPointerResize);
</script>

<template>
  <section
    ref="stackElement"
    class="dual-chart-stack"
    :class="`dual-chart-stack-${props.workspace}`"
    :data-testid="`dual-chart-stack-${props.workspace}`"
    :style="{
      '--upper-chart-track': `${upperShare}fr`,
      '--lower-chart-track': `${100 - upperShare}fr`,
    }"
  >
    <div class="dual-chart-track" :data-testid="`${props.workspace}-upper-chart-track`">
      <slot name="upper" />
    </div>
    <div
      class="dual-chart-splitter"
      :data-testid="`${props.workspace}-chart-splitter`"
      role="separator"
      aria-orientation="horizontal"
      :aria-label="`Resize ${props.workspace === 'replay' ? 'Live Replay and Snapshot Reference' : 'Candidate and Baseline'} chart panels`"
      :aria-valuenow="Math.round(upperShare)"
      aria-valuemin="25"
      aria-valuemax="75"
      tabindex="0"
      @pointerdown="startPointerResize"
      @mouseenter="focusSplitter"
      @keydown="handleSplitterKey"
    >
    </div>
    <div class="dual-chart-track" :data-testid="`${props.workspace}-lower-chart-track`">
      <slot name="lower" />
    </div>
  </section>
</template>
