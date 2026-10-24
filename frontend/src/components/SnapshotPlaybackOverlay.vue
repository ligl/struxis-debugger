<script setup lang="ts">
type SnapshotBrightCandle = { id: string; x: number; y: number; width: number; height: number };
type CBarRectangle = { id: string; x: number; y: number; width: number; height: number };
type SwingSegment = {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  state: string;
  color: string;
  dasharray: string;
};

defineProps<{
  enabled: boolean;
  brightCandles: SnapshotBrightCandle[];
  cbarRectangles: CBarRectangle[];
  swingSegments: SwingSegment[];
}>();
</script>

<template>
  <defs v-if="enabled">
    <mask id="snapshot-playback-brightness-mask" maskUnits="userSpaceOnUse">
      <rect x="0" y="0" width="100%" height="100%" fill="white" />
      <rect
        v-for="overlay in brightCandles"
        :key="overlay.id"
        :x="overlay.x"
        :y="overlay.y"
        :width="overlay.width"
        :height="overlay.height"
        fill="black"
        data-testid="snapshot-bright-candle-cutout"
        :data-sbar-id="overlay.id"
      />
      <rect
        v-for="rectangle in cbarRectangles"
        :key="`bright-cbar-${rectangle.id}`"
        :x="rectangle.x"
        :y="rectangle.y"
        :width="rectangle.width"
        :height="rectangle.height"
        fill="white"
        stroke="black"
        stroke-width="3"
        data-testid="snapshot-bright-cbar-cutout"
        :data-cbar-id="rectangle.id"
      />
      <line
        v-for="segment in swingSegments"
        :key="`bright-swing-${segment.id}`"
        :x1="segment.x1"
        :y1="segment.y1"
        :x2="segment.x2"
        :y2="segment.y2"
        stroke="black"
        stroke-width="5"
        stroke-linecap="round"
        data-testid="snapshot-bright-swing-cutout"
        :data-swing-id="segment.id"
      />
    </mask>
  </defs>
  <rect
    v-if="enabled"
    class="snapshot-playback-dimming"
    x="0"
    y="0"
    width="100%"
    height="100%"
    fill="#050709"
    fill-opacity="0.68"
    mask="url(#snapshot-playback-brightness-mask)"
    data-testid="snapshot-playback-dimming"
  />
</template>
