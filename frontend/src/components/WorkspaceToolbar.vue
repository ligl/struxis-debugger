<script setup lang="ts">
type WorkspaceMode = "dataset" | "replay" | "compare";

defineProps<{
  workspaceMode: WorkspaceMode;
  catalogCollapsed: boolean;
  diagnosticsCollapsed: boolean;
}>();

const emit = defineEmits<{
  "toggle-catalog": [];
  "toggle-diagnostics": [];
}>();
</script>

<template>
  <div class="workflow-toolbar">
    <div>
      <p class="section-index">{{ workspaceMode === "dataset" ? "WORKSPACE / 01" : workspaceMode === "replay" ? "WORKSPACE / 02" : "WORKSPACE / 03" }}</p>
      <h2>{{ workspaceMode === "dataset" ? "Dataset Preparation" : workspaceMode === "replay" ? "Run Replay" : "Snapshot Comparison" }}</h2>
    </div>
    <div class="toolbar-actions">
      <button v-if="workspaceMode === 'dataset'" class="subtle-button" @click="emit('toggle-catalog')">{{ catalogCollapsed ? "Show Catalog" : "Hide Catalog" }}</button>
      <button class="subtle-button" @click="emit('toggle-diagnostics')">{{ diagnosticsCollapsed ? "Show Diagnostics" : "Hide Diagnostics" }}</button>
    </div>
  </div>
</template>
