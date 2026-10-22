import { onMounted, onUnmounted, type Ref } from "vue";
import type { RunStateDto } from "../origin-types";
import type { RunCommand } from "../run-command-eligibility";

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
 * Owns the global Space shortcut for Replay transport.
 * Run state and command execution remain owned by the application workflow.
 */
export function useReplayKeyboardShortcut(
  runState: Readonly<Ref<RunStateDto | null>>,
  runBusy: Readonly<Ref<boolean>>,
  executeCommand: (command: RunCommand) => Promise<void>,
): void {
  function handleKeydown(event: KeyboardEvent): void {
    if (event.code !== "Space" || event.repeat) return;
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (
      isInteractiveKeyboardTarget(event.target) ||
      isInteractiveKeyboardTarget(document.activeElement) ||
      runBusy.value
    ) return;

    const command = runState.value?.status === "running"
      ? "pause"
      : runState.value?.status === "paused"
        ? "play"
        : null;
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
