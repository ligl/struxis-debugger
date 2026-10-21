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
  <header class="topbar workbench-topbar" data-testid="topbar">
    <div class="brand">
      <span class="brandmark" aria-hidden="true">Sx</span>
      <span class="brand-name">STRUXIS DEBUGGER</span>
    </div>
    <nav class="workspace-tabs" aria-label="Debugger workspace">
      <button class="workspace-tab" data-testid="workspace-dataset" :class="{ active: workspaceMode === 'dataset' }" :aria-current="workspaceMode === 'dataset' ? 'page' : undefined" @click="emit('update:workspaceMode', 'dataset')">01&nbsp; Dataset</button>
      <button class="workspace-tab" data-testid="workspace-replay" :class="{ active: workspaceMode === 'replay' }" :aria-current="workspaceMode === 'replay' ? 'page' : undefined" @click="emit('update:workspaceMode', 'replay')">02&nbsp; Replay</button>
      <button class="workspace-tab" data-testid="workspace-compare" :class="{ active: workspaceMode === 'compare' }" :aria-current="workspaceMode === 'compare' ? 'page' : undefined" @click="emit('update:workspaceMode', 'compare')">03&nbsp; Compare</button>
    </nav>
    <div class="top-right">
      <span class="runtime-mark">
        <span class="status-dot" :class="{ active: originAvailable }"></span>
        {{ originAvailable ? "ORIGIN AVAILABLE" : "NO ORIGIN LOADED" }}
      </span>
      <span class="keycap">CAPITUS</span>
    </div>
  </header>
</template>
