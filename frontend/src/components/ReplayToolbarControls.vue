<script setup lang="ts">
import type { RunStateDto } from "../origin-types";
import type { RunCommand } from "../run-command-eligibility";
import type { PlaybackStatus } from "../composables/usePlaybackController";
import { ref } from "vue";
import { isRunCommandEligible } from "../run-command-eligibility";

const props = defineProps<{
  runState: RunStateDto | null;
  runBusy: boolean;
  runError: string;
  snapshotSaveBusy: boolean;
  playbackStatus: PlaybackStatus;
  playbackDelayMs: number;
  canStartRun: boolean;
  canRestartRun: boolean;
}>();

const emit = defineEmits<{
  command: [command: RunCommand];
  refresh: [];
  saveSnapshot: [];
  setPlaybackDelay: [milliseconds: number];
}>();

const speedMenuOpen = ref(false);
const speedOptions = [
  { label: "0.5×", delayMs: 500 },
  { label: "0.75×", delayMs: 300 },
  { label: "1×", delayMs: 200 },
  { label: "1.25×", delayMs: 160 },
  { label: "1.5×", delayMs: 135 },
  { label: "2×", delayMs: 100 },
  { label: "3×", delayMs: 65 },
  { label: "4×", delayMs: 50 },
  { label: "MAX", delayMs: 0 },
];
const selectedSpeed = () =>
  speedOptions.find((option) => option.delayMs === props.playbackDelayMs)?.label ?? "1×";
</script>

<template>
  <div class="toolbar-actions replay-toolbar-actions" data-testid="replay-toolbar-controls">
    <div class="replay-transport" role="group" aria-label="Replay transport controls">
      <button class="subtle-button" data-testid="run-start" title="Start a new replay run" :disabled="playbackStatus === 'playing' || !isRunCommandEligible('start', runState?.status ?? null, runBusy, canStartRun, canRestartRun)" @click="emit('command', 'start')">START</button>
      <button class="subtle-button" data-testid="run-step" title="Process one SBar" :disabled="playbackStatus === 'playing' || !isRunCommandEligible('step', runState?.status ?? null, runBusy, canStartRun, canRestartRun)" @click="emit('command', 'step')">STEP ▶|</button>
      <button class="subtle-button replay-play-toggle" data-testid="run-play-pause" :title="playbackStatus === 'playing' ? 'Pause replay (Space)' : 'Play replay (Space)'" :disabled="(runBusy && playbackStatus !== 'playing') || (playbackStatus !== 'playing' && !['ready', 'paused'].includes(runState?.status ?? ''))" @click="emit('command', playbackStatus === 'playing' ? 'pause' : 'play')">{{ playbackStatus === 'playing' ? 'Ⅱ PAUSE' : '▶ PLAY' }}</button>
      <button class="subtle-button" data-testid="run-stop" title="Stop the current run" :disabled="!isRunCommandEligible('stop', runState?.status ?? null, runBusy, canStartRun, canRestartRun) && playbackStatus !== 'playing'" @click="emit('command', 'stop')">STOP</button>
      <button class="subtle-button" data-testid="run-restart" title="Reset by restarting the run" :disabled="playbackStatus === 'playing' || !isRunCommandEligible('restart', runState?.status ?? null, runBusy, canStartRun, canRestartRun)" @click="emit('command', 'restart')">RESET</button>
      <div class="replay-speed-control" data-testid="replay-speed-control" @mouseenter="speedMenuOpen = true" @mouseleave="speedMenuOpen = false">
        <button
          type="button"
          class="replay-speed-trigger"
          data-testid="replay-speed"
          :aria-expanded="speedMenuOpen"
          aria-haspopup="menu"
          title="Playback speed"
        >倍速</button>
        <div v-if="speedMenuOpen" class="replay-speed-menu" role="menu" aria-label="Playback speed options" data-testid="replay-speed-menu">
          <button
            v-for="option in speedOptions"
            :key="option.delayMs"
            type="button"
            role="menuitemradio"
            class="replay-speed-option"
            :class="{ selected: option.delayMs === playbackDelayMs }"
            :aria-checked="option.delayMs === playbackDelayMs"
            :data-speed-delay="option.delayMs"
            @click="emit('setPlaybackDelay', option.delayMs); speedMenuOpen = false"
          >{{ option.label }}<span v-if="option.delayMs === playbackDelayMs" class="replay-speed-check">✓</span></button>
        </div>
      </div>
    </div>
    <span class="run-state" data-testid="run-toolbar-status">
      <b :class="`run-status-${playbackStatus === 'playing' ? 'running' : (runState?.status ?? 'none')}`">{{ playbackStatus === 'playing' ? 'PLAYING' : (runState?.status ? runState.status.toUpperCase() : "NO RUN") }}</b>
      <span>{{ runState ? `${runState.processedCount.toLocaleString()} / ${runState.inputCount.toLocaleString()}` : "—" }}</span>
    </span>
    <div class="progress replay-progress" aria-label="Replay progress" role="progressbar" :aria-valuenow="runState?.processedCount ?? 0" :aria-valuemin="0" :aria-valuemax="runState?.inputCount ?? 0">
      <i :style="{ width: runState && runState.inputCount > 0 ? (runState.processedCount / runState.inputCount * 100) + '%' : '0%' }"></i>
    </div>
    <button
      class="subtle-button replay-save-snapshot"
      data-testid="run-save-snapshot"
      title="Persist the completed Run as a new Snapshot"
      :disabled="snapshotSaveBusy || runBusy || playbackStatus === 'playing' || runState?.status !== 'completed'"
      @click="emit('saveSnapshot')"
    >{{ snapshotSaveBusy ? 'SAVING…' : 'SAVE SNAPSHOT' }}</button>
    <button class="subtle-button replay-refresh" data-testid="run-refresh-state" title="Refresh state from the backend" :disabled="runBusy || playbackStatus === 'playing'" @click="emit('refresh')">REFRESH</button>
    <span v-if="runError" class="error-message toolbar-error" role="alert">{{ runError }}</span>
  </div>
</template>
