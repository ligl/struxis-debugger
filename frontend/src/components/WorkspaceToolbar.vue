<script setup lang="ts">
type WorkspaceMode = "dataset" | "replay" | "compare";

defineProps<{
  workspaceMode: WorkspaceMode;
}>();
</script>

<template>
  <div class="workflow-toolbar" data-testid="chart-toolbar">
    <template v-if="workspaceMode === 'dataset'">
      <span class="workspace-title">DATASET</span>
      <span class="toolbar-context">CATALOG / ORIGIN / INCLUSIVE INTERVAL</span>
      <span class="spacer"></span>
      <span class="tag">ORIGIN LOAD</span>
    </template>
    <template v-else-if="workspaceMode === 'replay'">
      <span class="workspace-title">REPLAY</span>
      <span class="toolbar-context">LIVE + SNAPSHOT REFERENCE</span>
      <span class="spacer"></span>
      <slot name="actions" />
    </template>
    <template v-else>
      <span class="workspace-title">COMPARE</span>
      <span class="toolbar-context">STRICT · ORDERED · BAR-BY-BAR</span>
      <span class="spacer"></span>
      <span class="tag amber">STRICT MODE</span>
      <slot name="actions" />
    </template>
  </div>
</template>
