import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import ReplayToolbarControls from "../../src/components/ReplayToolbarControls.vue";
import type { RunStateDto } from "../../src/origin-types";

const readyRun: RunStateDto = {
  runId: "run-1",
  testDatasetId: "test-1",
  inputFingerprint: "fingerprint-1",
  inputCount: 10,
  status: "ready",
  processedCount: 0,
  cursorSbarId: null,
  failureDiagnostic: null,
};

function mountControls(overrides: Record<string, unknown> = {}) {
  return mount(ReplayToolbarControls, {
    props: {
      runState: readyRun,
      runBusy: false,
      runError: "",
      canStartRun: false,
      canRestartRun: true,
      ...overrides,
    },
  });
}

describe("ReplayToolbarControls", () => {
  it("forwards eligible Run commands and manual refresh intents", async () => {
    const wrapper = mountControls();

    await wrapper.get('[data-testid="run-step"]').trigger("click");
    await wrapper.get('[data-testid="run-stop"]').trigger("click");
    await wrapper.get('[data-testid="run-restart"]').trigger("click");
    await wrapper.get('[data-testid="run-refresh-state"]').trigger("click");

    expect(wrapper.emitted("command")).toEqual([["step"], ["stop"], ["restart"]]);
    expect(wrapper.emitted("refresh")).toHaveLength(1);
  });

  it("maps the Play/Pause control to the current Run status", async () => {
    const paused = mountControls({ runState: { ...readyRun, status: "paused" } });
    await paused.get('[data-testid="run-play-pause"]').trigger("click");
    expect(paused.emitted("command")).toEqual([["play"]]);
    expect(paused.get('[data-testid="run-play-pause"]').text()).toContain("PLAY");

    const running = mountControls({ runState: { ...readyRun, status: "running" } });
    await running.get('[data-testid="run-play-pause"]').trigger("click");
    expect(running.emitted("command")).toEqual([["pause"]]);
    expect(running.get('[data-testid="run-play-pause"]').text()).toContain("PAUSE");
  });

  it("preserves command gating, progress, status and error presentation", () => {
    const wrapper = mountControls({
      runBusy: true,
      runError: "Run operation failed",
      runState: { ...readyRun, processedCount: 4 },
    });

    expect(wrapper.get('[data-testid="run-start"]').attributes("disabled")).toBeDefined();
    expect(wrapper.get('[data-testid="run-step"]').attributes("disabled")).toBeDefined();
    expect(wrapper.get('[data-testid="run-refresh-state"]').attributes("disabled")).toBeDefined();
    expect(wrapper.get('[data-testid="run-toolbar-status"]').text()).toContain("READY");
    expect(wrapper.get('[role="progressbar"]').attributes("aria-valuenow")).toBe("4");
    expect(wrapper.get('[role="progressbar"] i').attributes("style")).toContain("40%");
    expect(wrapper.get('[role="alert"]').text()).toBe("Run operation failed");
  });
});
