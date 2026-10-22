import { ref } from "vue";
import {
  describeIpcError,
  disposeRun,
  getRunState,
  pauseRun,
  playRun,
  restartRun,
  startRun,
  stepRun,
  stopRun,
} from "../origin-bridge";
import type { RunStateDto } from "../origin-types";
import type { RunCommand } from "../run-command-eligibility";
export type { RunCommand } from "../run-command-eligibility";

export function useRunControl(
  refreshSnapshots: () => Promise<void>,
) {
  const runState = ref<RunStateDto | null>(null);
  const runBusy = ref(false);
  const runError = ref("");

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
      switch (command) {
        case "start":
          next = await startRun();
          break;
        case "restart":
          next = await restartRun();
          break;
        case "step":
          next = await stepRun();
          break;
        case "play":
          next = await playRun();
          break;
        case "pause":
          next = await pauseRun();
          break;
        case "stop":
          next = await stopRun();
          break;
        case "dispose":
          next = await disposeRun();
          break;
      }
      runState.value = next;
      await refreshSnapshots();
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
    refreshRunState,
    executeRunCommand,
  };
}
