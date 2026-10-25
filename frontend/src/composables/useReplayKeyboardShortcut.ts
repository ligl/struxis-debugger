import { onMounted, onUnmounted, type Ref } from "vue";
import type { RunCommand } from "../run-command-eligibility";
import type { PlaybackStatus } from "./usePlaybackController";

function isInteractiveKeyboardTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return target.closest(
    [
      "input",
      "textarea",
      "select",
      "button",
      "a[href]",
      "summary",
      "[contenteditable]:not([contenteditable='false'])",
      "[role='button']",
      "[role='link']",
      "[role='checkbox']",
      "[role='radio']",
      "[role='switch']",
      "[role='tab']",
      "[role='menuitem']",
      "[role='slider']",
      "[role='spinbutton']",
      "[role='textbox']",
      "[role='combobox']",
      "[tabindex]:not([tabindex='-1'])",
    ].join(","),
  ) !== null;
}

/**
 * Owns Replay's global transport shortcuts. Run state and command execution
 * remain owned by the application workflow; Space keeps its existing
 * target-first Play/Pause semantics.
 */
export function useReplayKeyboardShortcut(
  playbackStatus: Readonly<Ref<PlaybackStatus>>,
  canControlPlayback: Readonly<Ref<boolean>>,
  runBusy: Readonly<Ref<boolean>>,
  playbackDelayMs: Readonly<Ref<number>>,
  targetSbarId: Readonly<Ref<string | null>>,
  restartToTarget: () => Promise<void>,
  executeCommand: (command: RunCommand) => Promise<void>,
  canUseReplayShortcuts: Readonly<Ref<boolean>> = canControlPlayback,
  setPlaybackDelay: (milliseconds: number) => void = () => undefined,
): void {
  function handleKeydown(event: KeyboardEvent): void {
    if (event.repeat) return;
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (
      isInteractiveKeyboardTarget(event.target) ||
      isInteractiveKeyboardTarget(document.activeElement)
    ) return;

    if (event.code === "Space") {
      if (!canControlPlayback.value || event.shiftKey) return;

      if (targetSbarId.value) {
        event.preventDefault();
        void restartToTarget();
        return;
      }
      if (runBusy.value && playbackStatus.value !== "playing") return;

      const command = playbackStatus.value === "playing"
        ? "pause"
        : playbackStatus.value === "paused" || playbackStatus.value === "idle"
          ? "play"
          : null;
      if (!command) return;

      event.preventDefault();
      void executeCommand(command);
      return;
    }

    if (!canUseReplayShortcuts.value) return;

    // Playback speeds are ordered slowest to fastest. The endpoints are
    // stable: pressing beyond either end does not wrap around.
    const speedDelays = [500, 200, 100, 65, 0];
    if (!event.shiftKey && (event.key === "-" || event.code === "Minus")) {
      const currentIndex = speedDelays.indexOf(playbackDelayMs.value);
      if (currentIndex > 0) setPlaybackDelay(speedDelays[currentIndex - 1]!);
      event.preventDefault();
      return;
    }
    if (!event.shiftKey && (event.key === "=" || event.code === "Equal")) {
      const currentIndex = speedDelays.indexOf(playbackDelayMs.value);
      if (currentIndex >= 0 && currentIndex < speedDelays.length - 1) {
        setPlaybackDelay(speedDelays[currentIndex + 1]!);
      }
      event.preventDefault();
      return;
    }

    const isStopShortcut = event.key.toLowerCase() === "s" && event.shiftKey;
    const isStopStartShortcut = !event.shiftKey && event.key.toLowerCase() === "r";
    if (runBusy.value && (
      playbackStatus.value !== "playing" ||
      (!isStopShortcut && !isStopStartShortcut)
    )) return;

    let command: RunCommand | null = null;
    if (!event.shiftKey && event.key.toLowerCase() === "n") command = "step";
    else if (isStopShortcut) command = "stop";
    else if (event.key.toLowerCase() === "s" && !event.shiftKey) command = "start";
    else if (isStopStartShortcut) {
      // The R shortcut is deliberately the same lifecycle sequence as Stop,
      // then Start, rather than a separate backend Restart command.
      event.preventDefault();
      void executeCommand("stop").then(() => executeCommand("start"));
      return;
    }

    if (!command) return;
    event.preventDefault();
    void executeCommand(command);
  }

  onMounted(() => {
    document.addEventListener("keydown", handleKeydown);
  });

  onUnmounted(() => {
    document.removeEventListener("keydown", handleKeydown);
  });
}
