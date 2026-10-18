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
    case "play":
      return status === "ready" || status === "paused";
    case "pause":
      return status === "running";
    case "stop":
      return status === "ready" || status === "running" || status === "paused";
    case "dispose":
      return status !== null && status !== "running";
  }
}
