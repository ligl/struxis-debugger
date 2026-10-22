<script setup lang="ts">
import { ref } from "vue";
import type { DockDirection } from "../composables/useDockLayout";

const props = defineProps<{
  dock: DockDirection;
  collapsed: boolean;
  width: number;
  height: number;
  widthLimit: () => number;
  heightLimit: () => number;
  discoveryError: string;
  loadError: string;
  testError: string;
  runError: string;
  snapshotsError: string;
}>();

const emit = defineEmits<{
  "set-dock": [direction: DockDirection];
  "toggle-collapsed": [];
  "heading-click": [];
  "start-resize": [event: PointerEvent];
  "resize-key": [event: KeyboardEvent];
  "start-dock-drag": [event: DragEvent];
  "close-dock-menus": [];
}>();

const categories = [
  { id: "all", label: "ALL" },
  { id: "errors", label: "ERRORS" },
  { id: "warnings", label: "WARNINGS" },
  { id: "replay", label: "REPLAY" },
  { id: "structure", label: "STRUCTURE" },
  { id: "snapshots", label: "SNAPSHOTS" },
  { id: "validation", label: "VALIDATION" },
  { id: "differences", label: "DIFFERENCES" },
] as const;
const selectedCategory = ref<string>("all");

const hasErrors = () => Boolean(
  props.loadError || props.discoveryError || props.testError || props.runError || props.snapshotsError,
);

function setDock(direction: DockDirection): void {
  emit("set-dock", direction);
  emit("close-dock-menus");
}
</script>

<template>
  <section
    data-testid="diagnostics-dock"
    class="diagnostics-dock"
    :class="['dock-' + dock, { collapsed }]"
  >
    <div
      class="panel-resize-edge diagnostics-resize-edge"
      data-testid="diagnostics-resize-edge"
      role="separator"
      aria-label="Resize Diagnostics"
      :aria-orientation="dock === 'left' || dock === 'right' ? 'vertical' : 'horizontal'"
      :aria-valuenow="dock === 'left' || dock === 'right' ? width : height"
      :aria-valuemin="dock === 'left' || dock === 'right' ? 180 : 100"
      :aria-valuemax="dock === 'left' || dock === 'right' ? widthLimit() : heightLimit()"
      tabindex="0"
      @pointerdown="emit('start-resize', $event)"
      @keydown="emit('resize-key', $event)"
    ></div>
    <div
      class="diagnostics-heading"
      data-testid="diagnostics-heading"
      :class="{ 'collapsed-side-heading': collapsed && (dock === 'left' || dock === 'right') }"
      draggable="true"
      @click="emit('heading-click')"
      @dragstart="emit('start-dock-drag', $event)"
    >
      <div class="diagnostics-title-block">
        <span class="panel-title diagnostics-panel-title" data-testid="diagnostics-dock-drag-handle">Diagnostics</span>
      </div>
      <nav class="diagnostics-tabs" data-testid="diagnostics-category-tabs" aria-label="Diagnostic categories" @click.stop>
        <button
          v-for="category in categories"
          :key="category.id"
          :class="{ active: selectedCategory === category.id }"
          :aria-pressed="selectedCategory === category.id"
          @click="selectedCategory = category.id"
        >{{ category.label }}</button>
      </nav>
      <div class="dock-actions" @click.stop>
        <details class="dock-menu" data-testid="diagnostics-dock-menu">
          <summary class="subtle-button" aria-label="Move Diagnostics" title="Move or dock panel">⋯</summary>
          <div class="dock-menu-options" role="group" aria-label="Diagnostics docking position">
            <button class="dock-menu-option" data-testid="diagnostics-dock-left" :aria-pressed="dock === 'left'" @click="setDock('left')">Dock Left</button>
            <button class="dock-menu-option" data-testid="diagnostics-dock-right" :aria-pressed="dock === 'right'" @click="setDock('right')">Dock Right</button>
            <button class="dock-menu-option" data-testid="diagnostics-dock-top" :aria-pressed="dock === 'top'" @click="setDock('top')">Dock Top</button>
            <button class="dock-menu-option" data-testid="diagnostics-dock-bottom" :aria-pressed="dock === 'bottom'" @click="setDock('bottom')">Dock Bottom</button>
          </div>
        </details>
        <button
          class="subtle-button"
          data-testid="diagnostics-collapse-toggle"
          :aria-label="collapsed ? 'Expand Diagnostics' : 'Collapse Diagnostics'"
          :title="collapsed ? 'Expand Diagnostics' : 'Collapse Diagnostics'"
          @click.stop="emit('toggle-collapsed')"
        >{{ collapsed ? '+' : '−' }}</button>
      </div>
    </div>
    <div class="diagnostics-content">
      <p v-if="hasErrors()" class="error-message">
        <span v-if="discoveryError">Catalog: {{ discoveryError }}</span>
        <span v-if="loadError">Origin Load: {{ loadError }}</span>
        <span v-if="testError">Test Dataset: {{ testError }}</span>
        <span v-if="runError">Run / Replay: {{ runError }}</span>
        <span v-if="snapshotsError">Snapshots: {{ snapshotsError }}</span>
      </p>
      <p v-else class="empty-state">No active errors. Structured event history and domain diagnostics are not yet connected.</p>
    </div>
  </section>
</template>
