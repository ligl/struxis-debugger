import { ref } from "vue";
import {
  describeIpcError,
  disposeRun,
  getRunState,
  restartRun,
  startRun,
  stepRun,
  stopRun,
} from "../origin-bridge";
import type { ReplayStepResultDto, RunStateDto } from "../origin-types";
import type { RunCommand } from "../run-command-eligibility";
export type { RunCommand } from "../run-command-eligibility";

/**
 * Owns backend Run commands only. Playback scheduling is a separate Replay
 * concern and Snapshot Catalog refresh is deliberately not part of Step.
 */
export function useRunControl() {
  const runState = ref<RunStateDto | null>(null);
  const runBusy = ref(false);
  const runError = ref("");
  const lastStepResult = ref<ReplayStepResultDto | null>(null);

  async function refreshRunState(_silent = false): Promise<void> {
    if (runBusy.value) return;
    runBusy.value = true;
    runError.value = "";
    try {
      runState.value = await getRunState();
    } catch (error) {
      runError.value = describeIpcError(error);
    } finally {
      runBusy.value = false;
    }
  }

  async function executeRunCommand(command: RunCommand): Promise<void> {
    if (runBusy.value) return;
    runBusy.value = true;
    runError.value = "";
    try {
      let next: RunStateDto;
      lastStepResult.value = null;
      switch (command) {
        case "start":
          next = await startRun();
          break;
        case "restart":
          next = await restartRun();
          break;
        case "step": {
          const result = await stepRun();
          lastStepResult.value = result;
          next = result.runState;
          break;
        }
        case "stop":
          next = await stopRun();
          break;
        case "dispose":
          next = await disposeRun();
          break;
        case "play":
        case "pause":
          throw new Error("Play and Pause are frontend Playback controls, not backend Run commands.");
      }
      runState.value = next;
    } catch (error) {
      runError.value = describeIpcError(error);
    } finally {
      runBusy.value = false;
    }
  }

  return {
    runState,
    runBusy,
    runError,
    lastStepResult,
    refreshRunState,
    executeRunCommand,
  };
}
