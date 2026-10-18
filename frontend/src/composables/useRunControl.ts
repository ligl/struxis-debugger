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

export type RunCommand =
  | "start"
  | "restart"
  | "step"
  | "play"
  | "pause"
  | "stop"
  | "dispose";

export function useRunControl(
  refreshSnapshots: () => Promise<void>,
) {
  const runState = ref<RunStateDto | null>(null);
  const runBusy = ref(false);
  const runError = ref("");
  const runStatusMessage = ref("");

  async function refreshRunState(): Promise<void> {
    if (runBusy.value) return;
    runBusy.value = true;
    runError.value = "";
    try {
      runState.value = await getRunState();
      runStatusMessage.value = "Run state refreshed from the backend.";
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
    runStatusMessage.value = "";
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
      runStatusMessage.value = `Backend confirmed Run status: ${next.status}.`;
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
    runStatusMessage,
    refreshRunState,
    executeRunCommand,
  };
}
