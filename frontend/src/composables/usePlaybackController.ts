import { onUnmounted, ref, type Ref } from "vue";
import type { RunStateDto } from "../origin-types";
import type { RunCommand } from "../run-command-eligibility";

export type PlaybackStatus = "idle" | "playing" | "paused";

const TERMINAL_RUN_STATES = new Set(["completed", "failed", "disposed"]);

/**
 * Replay-only scheduler. Every playback tick awaits the same single-Step
 * command used by manual stepping; it never starts a backend execution loop.
 */
export function usePlaybackController(
  runState: Readonly<Ref<RunStateDto | null>>,
  runBusy: Readonly<Ref<boolean>>,
  runError: Readonly<Ref<string>>,
  executeRunCommand: (command: RunCommand) => Promise<void>,
  refreshReplayInspector: () => Promise<void>,
) {
  const playbackStatus = ref<PlaybackStatus>("idle");
  const playbackDelayMs = ref(100);
  let loopPromise: Promise<void> | null = null;
  let delayTimer: ReturnType<typeof setTimeout> | null = null;
  let cancelDelay: (() => void) | null = null;
  let disposed = false;

  function waitBetweenSteps(): Promise<void> {
    if (playbackDelayMs.value <= 0) return Promise.resolve();
    return new Promise((resolve) => {
      cancelDelay = resolve;
      delayTimer = setTimeout(() => {
        delayTimer = null;
        cancelDelay = null;
        resolve();
      }, playbackDelayMs.value);
    });
  }

  function clearDelay(): void {
    if (delayTimer !== null) clearTimeout(delayTimer);
    delayTimer = null;
    const resolve = cancelDelay;
    cancelDelay = null;
    resolve?.();
  }

  async function runLoop(): Promise<void> {
    try {
      while (!disposed && playbackStatus.value === "playing") {
        if (runBusy.value) break;
        const before = runState.value;
        if (!before || !["ready", "paused"].includes(before.status)) break;

        await executeRunCommand("step");
        if (disposed || runError.value) break;
        await refreshReplayInspector();
        if (runError.value) break;

        const after = runState.value;
        if (!after || TERMINAL_RUN_STATES.has(after.status)) break;
        if (playbackStatus.value !== "playing") break;
        await waitBetweenSteps();
      }
    } finally {
      if (playbackStatus.value === "playing") {
        playbackStatus.value = "idle";
      }
    }
  }

  function play(): void {
    if (disposed || playbackStatus.value === "playing" || runBusy.value) return;
    if (!runState.value || !["ready", "paused"].includes(runState.value.status)) return;
    playbackStatus.value = "playing";
    if (loopPromise === null) {
      const task = runLoop();
      loopPromise = task;
      void task.finally(() => {
        if (loopPromise === task) loopPromise = null;
        // A resume requested while the previous loop was unwinding starts a
        // fresh loop only after the in-flight Step has fully settled.
        if (playbackStatus.value === "playing" && !disposed) play();
      });
    }
  }

  async function pauseAndWait(): Promise<void> {
    if (playbackStatus.value !== "idle") playbackStatus.value = "paused";
    clearDelay();
    await loopPromise;
  }

  async function stopAndWait(): Promise<void> {
    playbackStatus.value = "idle";
    clearDelay();
    await loopPromise;
  }

  function setPlaybackDelay(milliseconds: number): void {
    if (Number.isFinite(milliseconds)) {
      playbackDelayMs.value = Math.max(0, Math.min(2000, milliseconds));
    }
  }

  onUnmounted(() => {
    disposed = true;
    playbackStatus.value = "idle";
    clearDelay();
  });

  return {
    playbackStatus,
    playbackDelayMs,
    play,
    pauseAndWait,
    stopAndWait,
    setPlaybackDelay,
  };
}
