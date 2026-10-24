<script setup lang="ts">
import SBarChartSurface from "./SBarChartSurface.vue";
import SnapshotPlaybackOverlay from "./SnapshotPlaybackOverlay.vue";
import SnapshotLiveRangeMarkers from "./SnapshotLiveRangeMarkers.vue";
import type { ReplayChartCrosshairSync, ReplayChartViewportSync, ReplayInspectorStructureDto, SBarDto } from "../origin-types";

defineProps<{
  bars: SBarDto[];
  structure: ReplayInspectorStructureDto | null;
  snapshotId: string;
  syncEnabled: boolean;
  syncRequest?: ReplayChartViewportSync | null;
  crosshairSync?: ReplayChartCrosshairSync | null;
  liveBarCount: number;
  playbackEnabled: boolean;
  playbackOffset: number | null;
  processedCount: number;
}>();

const emit = defineEmits<{
  viewportChange: [sync: Omit<ReplayChartViewportSync, "revision" | "offset">];
  crosshairChange: [sync: Omit<ReplayChartCrosshairSync, "revision">];
}>();
</script>

<template>
  <SBarChartSurface
    :bars="bars"
    :structure="structure"
    :origin-dataset-id="snapshotId"
    :selection-editable="false"
    display-context="snapshot-reference"
    :sync-enabled="syncEnabled"
    :sync-request="syncRequest"
    :crosshair-sync="crosshairSync"
    :sync-live-bar-count="liveBarCount"
    :snapshot-playback-enabled="playbackEnabled"
    :snapshot-playback-offset="playbackOffset"
    :snapshot-processed-count="processedCount"
    @viewport-change="emit('viewportChange', $event)"
    @crosshair-change="emit('crosshairChange', $event)"
  >
    <template #snapshot-overlays="{ enabled, brightCandles, cbarRectangles, swingSegments, boundaries }">
      <SnapshotPlaybackOverlay
        :enabled="enabled"
        :bright-candles="brightCandles"
        :cbar-rectangles="cbarRectangles"
        :swing-segments="swingSegments"
      />
      <SnapshotLiveRangeMarkers :boundaries="boundaries" />
    </template>
  </SBarChartSurface>
</template>
