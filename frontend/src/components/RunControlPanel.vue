<script setup lang="ts">
import type { RunStateDto } from "../origin-types";
import { isRunCommandEligible, type RunCommand } from "../run-command-eligibility";
const props = defineProps<{ runState: RunStateDto | null; runBusy: boolean; runError: string; runStatusMessage: string; canStartRun: boolean; canRestartRun: boolean; }>();
function commandDisabled(command: RunCommand): boolean {
  return !isRunCommandEligible(
    command,
    props.runState?.status ?? null,
    props.runBusy,
    props.canStartRun,
    props.canRestartRun,
  );
}
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
          <button class="action-button action-primary" :disabled="commandDisabled('start')" @click="emit('command', 'start')" data-testid="run-start">START</button>
          <button class="action-button" :disabled="commandDisabled('restart')" @click="emit('command', 'restart')" data-testid="run-restart">RESTART</button>
          <button class="action-button" :disabled="commandDisabled('step')" @click="emit('command', 'step')" data-testid="run-step">STEP</button>
          <button class="action-button" :disabled="commandDisabled('play')" @click="emit('command', 'play')" data-testid="run-play">PLAY</button>
          <button class="action-button" :disabled="commandDisabled('pause')" @click="emit('command', 'pause')" data-testid="run-pause">PAUSE</button>
          <button class="action-button" :disabled="commandDisabled('stop')" @click="emit('command', 'stop')" data-testid="run-stop">STOP</button>
          <button class="action-button" :disabled="commandDisabled('dispose')" @click="emit('command', 'dispose')" data-testid="run-dispose">DISPOSE</button>
          <button class="action-button" :disabled="runBusy" @click="emit('refresh')" data-testid="run-refresh-state">REFRESH STATE</button>
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
