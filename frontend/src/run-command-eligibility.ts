import type { RunStatus } from "./origin-types";

export type RunCommand =
  | "start"
  | "restart"
  | "step"
  | "play"
  | "pause"
  | "stop"
  | "dispose";

/**
 * Shared Run command eligibility for UI affordances and the App command boundary.
 * Start / Restart additionally depend on cross-domain prerequisites computed by App.
 */
export function isRunCommandEligible(
  command: RunCommand,
  status: RunStatus | null,
  runBusy: boolean,
  canStartRun: boolean,
  canRestartRun: boolean,
): boolean {
  if (runBusy) return false;

  switch (command) {
    case "start":
      return canStartRun;
    case "restart":
      return canRestartRun;
    case "step":
      return status === "ready" || status === "paused";
    // Playback controls are frontend scheduler state, not Run lifecycle commands.
    case "play":
    case "pause":
      return false;
    case "stop":
      return status === "ready" || status === "running" || status === "paused";
    case "dispose":
      return status !== null && status !== "running";
  }
}
