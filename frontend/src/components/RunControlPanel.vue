<script setup lang="ts">
import type { RunStateDto } from "../origin-types";
type RunCommand = "start" | "restart" | "step" | "play" | "pause" | "stop" | "dispose";
defineProps<{ runState: RunStateDto | null; runBusy: boolean; runError: string; runStatusMessage: string; canStartRun: boolean; canRestartRun: boolean; }>();
const emit = defineEmits<{ command: [command: RunCommand]; refresh: []; }>();
</script>

<template>
<section class="panel operations-panel">
        <div class="panel-heading">
          <div>
            <p class="section-index">04 / REPLAY</p>
            <h2>Run Control</h2>
          </div>
          <span class="status-label" :class="{ loaded: runState?.status === 'completed', failed: runState?.status === 'failed' }">
            {{ runState ? runState.status.toUpperCase() : "NO RUN" }}
          </span>
        </div>

        <p v-if="runError" class="error-message">{{ runError }}</p>
        <p v-else-if="runStatusMessage" class="success-message">{{ runStatusMessage }}</p>
        <p v-if="runState?.failureDiagnostic" class="error-message">{{ runState.failureDiagnostic }}</p>

        <div class="action-grid">
          <button class="action-button action-primary" :disabled="!canStartRun" @click="emit('command', 'start')">START</button>
          <button class="action-button" :disabled="!canRestartRun" @click="emit('command', 'restart')">RESTART</button>
          <button class="action-button" :disabled="!runState || !['ready', 'paused'].includes(runState.status) || runBusy" @click="emit('command', 'step')">STEP</button>
          <button class="action-button" :disabled="!runState || !['ready', 'paused'].includes(runState.status) || runBusy" @click="emit('command', 'play')">PLAY</button>
          <button class="action-button" :disabled="runState?.status !== 'running' || runBusy" @click="emit('command', 'pause')">PAUSE</button>
          <button class="action-button" :disabled="!runState || !['ready', 'running', 'paused'].includes(runState.status) || runBusy" @click="emit('command', 'stop')">STOP</button>
          <button class="action-button" :disabled="!runState || runState.status === 'running' || runBusy" @click="emit('command', 'dispose')">DISPOSE</button>
          <button class="action-button" :disabled="runBusy" @click="emit('refresh')">REFRESH STATE</button>
        </div>

        <div v-if="runState" class="detail-list">
          <div><span>RUN ID</span><code>{{ runState.runId }}</code></div>
          <div><span>TEST DATASET</span><code>{{ runState.testDatasetId }}</code></div>
          <div><span>PROGRESS</span><strong>{{ runState.processedCount.toLocaleString() }} / {{ runState.inputCount.toLocaleString() }}</strong></div>
          <div><span>CURSOR SBAR ID</span><code>{{ runState.cursorSbarId ?? "—" }}</code></div>
          <div><span>INPUT FINGERPRINT</span><code>{{ runState.inputFingerprint }}</code></div>
        </div>
        <p v-else class="empty-state">Create a Test Dataset to enable Run execution.</p>
      </section>
</template>
