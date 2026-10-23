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

function mountControls(overrides: Partial<{
  runState: RunStateDto | null;
  runBusy: boolean;
  runError: string;
  snapshotSaveBusy: boolean;
  playbackStatus: "idle" | "playing" | "paused";
  playbackDelayMs: number;
  canStartRun: boolean;
  canRestartRun: boolean;
}> = {}) {
  return mount(ReplayToolbarControls, {
    props: {
      runState: readyRun,
      runBusy: false,
      runError: "",
      snapshotSaveBusy: false,
      playbackStatus: "idle",
      playbackDelayMs: 200,
      canStartRun: false,
      canRestartRun: true,
      ...overrides,
    },
  });
}

describe("ReplayToolbarControls", () => {
  it("forwards Step, Stop, and Reset without a manual refresh control", async () => {
    const wrapper = mountControls();

    await wrapper.get('[data-testid="run-step"]').trigger("click");
    expect(wrapper.get('[data-testid="run-start-stop"]').text()).toBe("STOP");
    await wrapper.get('[data-testid="run-start-stop"]').trigger("click");
    await wrapper.get('[data-testid="run-restart"]').trigger("click");

    expect(wrapper.emitted("command")).toEqual([["step"], ["stop"], ["reset"]]);
    expect(wrapper.find('[data-testid="run-refresh-state"]').exists()).toBe(false);
  });


  it("switches the combined Run control between START and STOP by Run lifecycle state", async () => {
    const ready = mountControls();
    const control = ready.get('[data-testid="run-start-stop"]');
    expect(control.text()).toBe("STOP");
    await control.trigger("click");
    expect(ready.emitted("command")).toEqual([["stop"]]);

    const completed = mountControls({
      runState: { ...readyRun, status: "completed", processedCount: 10 },
      canStartRun: true,
    });
    expect(completed.get('[data-testid="run-start-stop"]').text()).toBe("START");
    await completed.get('[data-testid="run-start-stop"]').trigger("click");
    expect(completed.emitted("command")).toEqual([["start"]]);

    const noRun = mountControls({ runState: null, canStartRun: true });
    expect(noRun.get('[data-testid="run-start-stop"]').text()).toBe("START");
  });

  it("maps Play/Pause to frontend playback state, independent of RunState", async () => {
    const ready = mountControls();
    await ready.get('[data-testid="run-play-pause"]').trigger("click");
    expect(ready.emitted("command")).toEqual([["play"]]);

    const playing = mountControls({
      runBusy: true,
      playbackStatus: "playing",
    });
    expect(playing.get('[data-testid="run-play-pause"]').attributes("disabled")).toBeUndefined();
    await playing.get('[data-testid="run-play-pause"]').trigger("click");
    expect(playing.emitted("command")).toEqual([["pause"]]);
    expect(playing.get('[data-testid="run-play-pause"]').text()).toContain("PAUSE");
  });

  it("keeps STOP enabled while each playback Step is busy", async () => {
    const wrapper = mountControls({ runBusy: true, playbackStatus: "playing" });
    const stop = wrapper.get('[data-testid="run-start-stop"]');

    expect(stop.text()).toBe("STOP");
    expect(stop.attributes("disabled")).toBeUndefined();
    await stop.trigger("click");
    expect(wrapper.emitted("command")).toEqual([["stop"]]);
  });

  it("allows explicit Snapshot save only for a completed Run", async () => {
    const ready = mountControls();
    expect(ready.get('[data-testid="run-save-snapshot"]').attributes("disabled")).toBeDefined();

    const completed = mountControls({
      runState: { ...readyRun, status: "completed", processedCount: 10 },
    });
    expect(completed.get('[data-testid="run-save-snapshot"]').attributes("disabled")).toBeUndefined();
    await completed.get('[data-testid="run-save-snapshot"]').trigger("click");
    expect(completed.emitted("saveSnapshot")).toHaveLength(1);

    const saving = mountControls({
      runState: { ...readyRun, status: "completed", processedCount: 10 },
      snapshotSaveBusy: true,
    });
    expect(saving.get('[data-testid="run-save-snapshot"]').attributes("disabled")).toBeDefined();
    expect(saving.get('[data-testid="run-save-snapshot"]').text()).toContain("SAVING");
  });

  it("shows a downward speed menu on hover and closes it after selection or pointer exit", async () => {
    const wrapper = mountControls();
    const control = wrapper.get('[data-testid="replay-speed-control"]');
    expect(wrapper.get('[data-testid="replay-speed"]').text()).toBe("倍速");
    expect(wrapper.text()).not.toContain("SPEED");
    expect(wrapper.find('[data-speed-delay="300"]').exists()).toBe(false);
    expect(wrapper.find('[data-speed-delay="160"]').exists()).toBe(false);
    expect(wrapper.find('[data-speed-delay="135"]').exists()).toBe(false);
    expect(wrapper.find('[data-speed-delay="50"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="replay-speed-menu"]').exists()).toBe(false);

    await control.trigger("mouseenter");
    const menu = wrapper.get('[data-testid="replay-speed-menu"]');
    expect(menu.attributes("role")).toBe("menu");
    expect(wrapper.get('[data-speed-delay="200"]').attributes("aria-checked")).toBe("true");
    await wrapper.get('[data-speed-delay="100"]').trigger("click");

    expect(wrapper.emitted("setPlaybackDelay")).toEqual([[100]]);
    expect(wrapper.emitted("command")).toBeUndefined();
    expect(wrapper.get('[data-testid="replay-speed"]').text()).toBe("2x");
    expect(wrapper.find('[data-testid="replay-speed-menu"]').exists()).toBe(false);

    await control.trigger("mouseenter");
    expect(wrapper.find('[data-testid="replay-speed-menu"]').exists()).toBe(true);
    await control.trigger("mouseleave");
    expect(wrapper.find('[data-testid="replay-speed-menu"]').exists()).toBe(false);
  });

  it("keeps speed selection enabled while a Run command is busy and playback is active", async () => {
    const wrapper = mountControls({ runBusy: true, playbackStatus: "playing" });
    const trigger = wrapper.get('[data-testid="replay-speed"]');
    const control = wrapper.get('[data-testid="replay-speed-control"]');
    expect(trigger.attributes("disabled")).toBeUndefined();
    await control.trigger("mouseenter");
    const fasterOption = wrapper.get('[data-speed-delay="65"]');
    expect(fasterOption.attributes("disabled")).toBeUndefined();
    await fasterOption.trigger("click");
    expect(wrapper.emitted("setPlaybackDelay")).toEqual([[65]]);
    expect(wrapper.get('[data-testid="replay-speed"]').text()).toBe("3x");
  });

  it("preserves command gating, progress, status and error presentation", () => {
    const wrapper = mountControls({
      runBusy: true,
      runError: "Run operation failed",
      runState: { ...readyRun, processedCount: 4 },
    });

    expect(wrapper.get('[data-testid="run-start-stop"]').attributes("disabled")).toBeDefined();
    expect(wrapper.get('[data-testid="run-step"]').attributes("disabled")).toBeDefined();
    expect(wrapper.find('[data-testid="run-refresh-state"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="run-toolbar-status"]').text()).toContain("READY");
    expect(wrapper.get('[role="progressbar"]').attributes("aria-valuenow")).toBe("4");
    expect(wrapper.get('[role="progressbar"] i').attributes("style")).toContain("40%");
    expect(wrapper.get('[role="alert"]').text()).toBe("Run operation failed");
  });
});
