import { onMounted, onUnmounted, type Ref } from "vue";
import type { RunStateDto } from "../origin-types";

/**
 * Owns the periodic refresh lifecycle for an active Replay Run.
 * Backend RunState remains the progress authority; App supplies the refresh
 * operations so this module does not own IPC or Replay Inspector state.
 */
export function useRunPolling(
  runState: Readonly<Ref<RunStateDto | null>>,
  runBusy: Readonly<Ref<boolean>>,
  refreshRunState: (silent?: boolean) => Promise<void>,
  refreshReplayInspector: () => Promise<void>,
): void {
  let intervalId: number | null = null;

  async function pollRunningRun(): Promise<void> {
    if (runState.value?.status !== "running" || runBusy.value) return;
    await refreshRunState(true);
    await refreshReplayInspector();
  }

  onMounted(() => {
    intervalId = window.setInterval(() => {
      void pollRunningRun();
    }, 250);
  });

  onUnmounted(() => {
    if (intervalId !== null) window.clearInterval(intervalId);
    intervalId = null;
  });
}
