import { describe, expect, it } from "vitest";
import { isRunCommandEligible, type RunCommand } from "../../src/run-command-eligibility";
import type { RunStatus } from "../../src/origin-types";

const statuses: Array<RunStatus | null> = [
  null, "ready", "running", "paused", "completed", "failed", "disposed",
];

describe("isRunCommandEligible", () => {
  it("matches the lifecycle eligibility matrix for each Run status", () => {
    const expected: Record<RunCommand, Array<RunStatus | null>> = {
      start: [],
      restart: [],
      step: ["ready", "paused"],
      play: [],
      pause: [],
      stop: ["ready", "running", "paused"],
      reset: statuses,
    };

    for (const command of Object.keys(expected) as RunCommand[]) {
      for (const status of statuses) {
        const eligible = isRunCommandEligible(command, status, false, false, false);
        if (command === "start" || command === "restart") {
          expect(eligible, `${command} with status ${status}`).toBe(false);
        } else {
          expect(eligible, `${command} with status ${status}`).toBe(
            expected[command].includes(status),
          );
        }
      }
    }
  });

  it("applies Start and legacy Restart cross-domain prerequisites", () => {
    expect(isRunCommandEligible("start", null, false, true, false)).toBe(true);
    expect(isRunCommandEligible("start", null, false, false, false)).toBe(false);
    expect(isRunCommandEligible("restart", "ready", false, false, true)).toBe(true);
    expect(isRunCommandEligible("restart", "running", false, false, false)).toBe(false);
  });

  it("rejects every command, including Reset, while a Run operation is busy", () => {
    const commands: RunCommand[] = [
      "start", "restart", "step", "play", "pause", "stop", "reset",
    ];
    for (const command of commands) {
      expect(isRunCommandEligible(command, "ready", true, true, true)).toBe(false);
    }
  });
});
