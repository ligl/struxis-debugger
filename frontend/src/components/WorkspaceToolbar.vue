<script setup lang="ts">
type WorkspaceMode = "dataset" | "replay" | "compare";

defineProps<{
  workspaceMode: WorkspaceMode;
}>();
</script>

<template>
  <div class="workflow-toolbar" data-testid="chart-toolbar">
    <template v-if="workspaceMode === 'dataset'">
      <span class="workspace-title" data-testid="workspace-toolbar-title">DATASET</span>
      <span class="toolbar-context">CATALOG / ORIGIN / INCLUSIVE INTERVAL</span>
      <span class="spacer"></span>
      <span class="tag">ORIGIN LOAD</span>
    </template>
    <template v-else-if="workspaceMode === 'replay'">
      <span class="workspace-title" data-testid="workspace-toolbar-title">REPLAY</span>
      <span class="toolbar-context">LIVE + SNAPSHOT REFERENCE</span>
      <span class="spacer"></span>
    </template>
    <template v-else>
      <span class="workspace-title" data-testid="workspace-toolbar-title">COMPARE</span>
      <span class="toolbar-context">STRICT · ORDERED · BAR-BY-BAR</span>
      <span class="spacer"></span>
      <span class="tag amber">STRICT MODE</span>
    </template>
    <slot name="actions" />
  </div>
</template>
