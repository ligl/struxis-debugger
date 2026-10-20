<script setup lang="ts">
type WorkspaceMode = "dataset" | "replay" | "compare";

defineProps<{
  workspaceMode: WorkspaceMode;
  originAvailable: boolean;
}>();

const emit = defineEmits<{
  "update:workspaceMode": [mode: WorkspaceMode];
}>();
</script>

<template>
  <header class="topbar workbench-topbar">
    <div class="brand-block">
      <p class="eyebrow">CAPITUS / STRUXIS DEBUGGER</p>
      <h1>Struxis Debugger</h1>
    </div>
    <nav class="workspace-switcher" aria-label="Debugger workspace">
      <button class="workspace-tab" data-testid="workspace-dataset" :class="{ active: workspaceMode === 'dataset' }" @click="emit('update:workspaceMode', 'dataset')">01 / Dataset</button>
      <button class="workspace-tab" data-testid="workspace-replay" :class="{ active: workspaceMode === 'replay' }" @click="emit('update:workspaceMode', 'replay')">02 / Replay</button>
      <button class="workspace-tab" data-testid="workspace-compare" :class="{ active: workspaceMode === 'compare' }" @click="emit('update:workspaceMode', 'compare')">03 / Compare</button>
    </nav>
    <div class="runtime-mark">
      <span class="runtime-dot" :class="{ active: originAvailable }"></span>
      <span>{{ originAvailable ? "ORIGIN AVAILABLE" : "NO ORIGIN LOADED" }}</span>
    </div>
  </header>
</template>
