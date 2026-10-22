<script setup lang="ts">
import type { RunStateDto } from "../origin-types";
import type { RunCommand } from "../run-command-eligibility";
import type { PlaybackStatus } from "../composables/usePlaybackController";
import { isRunCommandEligible } from "../run-command-eligibility";

defineProps<{
  runState: RunStateDto | null;
  runBusy: boolean;
  runError: string;
  playbackStatus: PlaybackStatus;
  playbackDelayMs: number;
  canStartRun: boolean;
  canRestartRun: boolean;
}>();

const emit = defineEmits<{
  command: [command: RunCommand];
  refresh: [];
  setPlaybackDelay: [milliseconds: number];
}>();

function onSpeedChange(event: Event): void {
  const target = event.target;
  if (target instanceof HTMLSelectElement) {
    emit("setPlaybackDelay", Number(target.value));
  }
}
</script>

<template>
  <div class="toolbar-actions replay-toolbar-actions" data-testid="replay-toolbar-controls">
    <div class="replay-transport" role="group" aria-label="Replay transport controls">
      <button class="subtle-button" data-testid="run-start" title="Start a new replay run" :disabled="playbackStatus === 'playing' || !isRunCommandEligible('start', runState?.status ?? null, runBusy, canStartRun, canRestartRun)" @click="emit('command', 'start')">START</button>
      <button class="subtle-button" data-testid="run-step" title="Process one SBar" :disabled="playbackStatus === 'playing' || !isRunCommandEligible('step', runState?.status ?? null, runBusy, canStartRun, canRestartRun)" @click="emit('command', 'step')">STEP ▶|</button>
      <button class="subtle-button replay-play-toggle" data-testid="run-play-pause" :title="playbackStatus === 'playing' ? 'Pause replay (Space)' : 'Play replay (Space)'" :disabled="(runBusy && playbackStatus !== 'playing') || (playbackStatus !== 'playing' && !['ready', 'paused'].includes(runState?.status ?? ''))" @click="emit('command', playbackStatus === 'playing' ? 'pause' : 'play')">{{ playbackStatus === 'playing' ? 'Ⅱ PAUSE' : '▶ PLAY' }}</button>
      <button class="subtle-button" data-testid="run-stop" title="Stop the current run" :disabled="!isRunCommandEligible('stop', runState?.status ?? null, runBusy, canStartRun, canRestartRun) && playbackStatus !== 'playing'" @click="emit('command', 'stop')">STOP</button>
      <button class="subtle-button" data-testid="run-restart" title="Reset by restarting the run" :disabled="playbackStatus === 'playing' || !isRunCommandEligible('restart', runState?.status ?? null, runBusy, canStartRun, canRestartRun)" @click="emit('command', 'restart')">RESET</button>
      <label class="replay-speed-control" title="Delay between completed SBar steps">
        <span>SPEED</span>
        <select data-testid="replay-speed" :value="playbackDelayMs" :disabled="runBusy" @change="onSpeedChange">
          <option :value="500">0.5×</option>
          <option :value="200">1×</option>
          <option :value="100">2×</option>
          <option :value="25">4×</option>
          <option :value="0">MAX</option>
        </select>
      </label>
    </div>
    <span class="run-state" data-testid="run-toolbar-status">
      <b :class="`run-status-${playbackStatus === 'playing' ? 'running' : (runState?.status ?? 'none')}`">{{ playbackStatus === 'playing' ? 'PLAYING' : (runState?.status ? runState.status.toUpperCase() : "NO RUN") }}</b>
      <span>{{ runState ? `${runState.processedCount.toLocaleString()} / ${runState.inputCount.toLocaleString()}` : "—" }}</span>
    </span>
    <div class="progress replay-progress" aria-label="Replay progress" role="progressbar" :aria-valuenow="runState?.processedCount ?? 0" :aria-valuemin="0" :aria-valuemax="runState?.inputCount ?? 0">
      <i :style="{ width: runState && runState.inputCount > 0 ? (runState.processedCount / runState.inputCount * 100) + '%' : '0%' }"></i>
    </div>
    <button class="subtle-button replay-refresh" data-testid="run-refresh-state" title="Refresh state from the backend" :disabled="runBusy || playbackStatus === 'playing'" @click="emit('refresh')">REFRESH</button>
    <span v-if="runError" class="error-message toolbar-error" role="alert">{{ runError }}</span>
  </div>
</template>
