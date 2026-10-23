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
  targetSbarId: Readonly<Ref<string | null>>,
  restartToTarget: () => Promise<void>,
  executeCommand: (command: RunCommand) => Promise<void>,
  canUseReplayShortcuts: Readonly<Ref<boolean>> = canControlPlayback,
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

    if (!canUseReplayShortcuts.value || runBusy.value) return;

    let command: RunCommand | null = null;
    if (!event.shiftKey && event.key.toLowerCase() === "n") command = "step";
    else if (event.key === "s" && event.shiftKey) command = "stop";
    else if (event.key === "s" && !event.shiftKey) command = "start";
    else if (!event.shiftKey && event.key.toLowerCase() === "r") {
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
