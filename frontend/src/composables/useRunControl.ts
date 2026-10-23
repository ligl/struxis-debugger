import { ref } from "vue";
import {
  describeIpcError,
  getRunState,
  restartRun,
  restartToSBar,
  resetRun,
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

  let idleWaiters: Array<() => void> = [];
  function waitForIdle(): Promise<void> {
    if (!runBusy.value) return Promise.resolve();
    return new Promise((resolve) => idleWaiters.push(resolve));
  }
  function notifyIdle(): void {
    const waiters = idleWaiters;
    idleWaiters = [];
    waiters.forEach((resolve) => resolve());
  }

  async function refreshRunState(_silent = false): Promise<boolean> {
    if (runBusy.value) return false;
    runBusy.value = true;
    runError.value = "";
    try {
      runState.value = await getRunState();
      return true;
    } catch (error) {
      runError.value = describeIpcError(error);
      return false;
    } finally {
      runBusy.value = false;
      notifyIdle();
    }
  }

  async function executeRestartToSBar(targetSbarId: string): Promise<boolean> {
    if (runBusy.value) return false;
    runBusy.value = true;
    runError.value = "";
    lastStepResult.value = null;
    try {
      const result = await restartToSBar(targetSbarId);
      lastStepResult.value = result;
      runState.value = result.runState;
      return true;
    } catch (error) {
      runError.value = describeIpcError(error);
      try {
        runState.value = await getRunState();
      } catch {
        // Keep the last confirmed state if reconciliation also fails.
      }
      return false;
    } finally {
      runBusy.value = false;
      notifyIdle();
    }
  }

  async function executeRunCommand(command: RunCommand): Promise<boolean> {
    if (runBusy.value) return false;
    runBusy.value = true;
    runError.value = "";
    try {
      let next: RunStateDto | null;
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
        case "reset":
          await resetRun();
          next = null;
          break;
        case "play":
        case "pause":
          throw new Error("Play and Pause are frontend Playback controls, not backend Run commands.");
      }
      runState.value = next;
      return true;
    } catch (error) {
      runError.value = describeIpcError(error);
      // A failed Step may still have produced a terminal backend outcome and
      // completed internal cleanup. Reconcile state without hiding the original error.
      try {
        runState.value = await getRunState();
      } catch {
        // Keep the last confirmed UI state if the authoritative read also fails.
      }
      return false;
    } finally {
      runBusy.value = false;
      notifyIdle();
    }
  }

  return {
    runState,
    runBusy,
    runError,
    lastStepResult,
    refreshRunState,
    executeRunCommand,
    executeRestartToSBar,
    waitForIdle,
  };
}
