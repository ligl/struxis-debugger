<script setup lang="ts">
import type { RunStateDto } from "../origin-types";
import type { RunCommand } from "../run-command-eligibility";
import { isRunCommandEligible } from "../run-command-eligibility";

defineProps<{
  runState: RunStateDto | null;
  runBusy: boolean;
  runError: string;
  canStartRun: boolean;
  canRestartRun: boolean;
}>();

const emit = defineEmits<{
  command: [command: RunCommand];
  refresh: [];
}>();
</script>

<template>
  <div class="toolbar-actions replay-toolbar-actions" data-testid="replay-toolbar-controls">
    <div class="replay-transport" role="group" aria-label="Replay transport controls">
      <button class="subtle-button" data-testid="run-start" title="Start a new replay run" :disabled="!isRunCommandEligible('start', runState?.status ?? null, runBusy, canStartRun, canRestartRun)" @click="emit('command', 'start')">START</button>
      <button class="subtle-button" data-testid="run-step" title="Process one SBar" :disabled="!isRunCommandEligible('step', runState?.status ?? null, runBusy, canStartRun, canRestartRun)" @click="emit('command', 'step')">STEP ▶|</button>
      <button class="subtle-button replay-play-toggle" data-testid="run-play-pause" :title="runState?.status === 'running' ? 'Pause replay (Space)' : 'Play replay (Space)'" :disabled="!isRunCommandEligible(runState?.status === 'running' ? 'pause' : 'play', runState?.status ?? null, runBusy, canStartRun, canRestartRun)" @click="emit('command', runState?.status === 'running' ? 'pause' : 'play')">{{ runState?.status === 'running' ? 'Ⅱ PAUSE' : '▶ PLAY' }}</button>
      <button class="subtle-button" data-testid="run-stop" title="Stop the current run" :disabled="!isRunCommandEligible('stop', runState?.status ?? null, runBusy, canStartRun, canRestartRun)" @click="emit('command', 'stop')">STOP</button>
      <button class="subtle-button" data-testid="run-restart" title="Reset by restarting the run" :disabled="!isRunCommandEligible('restart', runState?.status ?? null, runBusy, canStartRun, canRestartRun)" @click="emit('command', 'restart')">RESET</button>
    </div>
    <span class="run-state" data-testid="run-toolbar-status">
      <b :class="`run-status-${runState?.status ?? 'none'}`">{{ runState?.status ? runState.status.toUpperCase() : "NO RUN" }}</b>
      <span>{{ runState ? `${runState.processedCount.toLocaleString()} / ${runState.inputCount.toLocaleString()}` : "—" }}</span>
    </span>
    <div class="progress replay-progress" aria-label="Replay progress" role="progressbar" :aria-valuenow="runState?.processedCount ?? 0" :aria-valuemin="0" :aria-valuemax="runState?.inputCount ?? 0">
      <i :style="{ width: runState && runState.inputCount > 0 ? (runState.processedCount / runState.inputCount * 100) + '%' : '0%' }"></i>
    </div>
    <button class="subtle-button replay-refresh" data-testid="run-refresh-state" title="Refresh state from the backend" :disabled="runBusy" @click="emit('refresh')">REFRESH</button>
    <span v-if="runError" class="error-message toolbar-error" role="alert">{{ runError }}</span>
  </div>
</template>
