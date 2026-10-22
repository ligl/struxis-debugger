import { mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, ref } from "vue";
import { useReplayKeyboardShortcut } from "../../src/composables/useReplayKeyboardShortcut";
import type { RunStateDto } from "../../src/origin-types";

const runStateFixture = (status: RunStateDto["status"]): RunStateDto => ({
  runId: "run-1",
  testDatasetId: "test-1",
  inputFingerprint: "fingerprint-1",
  inputCount: 10,
  status,
  processedCount: 3,
  cursorSbarId: "sbar-3",
  failureDiagnostic: null,
});

let cleanup: (() => void)[] = [];

function mountShortcut(status: RunStateDto["status"] | null, busy = false) {
  const runState = ref<RunStateDto | null>(status ? runStateFixture(status) : null);
  const runBusy = ref(busy);
  const executeCommand = vi.fn(async () => undefined);
  const wrapper = mount(defineComponent({
    setup() {
      useReplayKeyboardShortcut(runState, runBusy, executeCommand);
      return () => null;
    },
  }));
  cleanup.push(() => wrapper.unmount());
  return { runState, runBusy, executeCommand, wrapper };
}

function pressSpace(target: EventTarget = document): KeyboardEvent {
  const event = new KeyboardEvent("keydown", {
    code: "Space",
    bubbles: true,
    cancelable: true,
  });
  target.dispatchEvent(event);
  return event;
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup.forEach((unmount) => unmount());
  cleanup = [];
  document.body.innerHTML = "";
});

describe("useReplayKeyboardShortcut", () => {
  it("maps Space to pause while running and play while paused", () => {
    const running = mountShortcut("running");
    const pauseEvent = pressSpace();
    expect(pauseEvent.defaultPrevented).toBe(true);
    expect(running.executeCommand).toHaveBeenCalledWith("pause");

    running.runState.value = runStateFixture("paused");
    const playEvent = pressSpace();
    expect(playEvent.defaultPrevented).toBe(true);
    expect(running.executeCommand).toHaveBeenLastCalledWith("play");
    expect(running.executeCommand).toHaveBeenCalledTimes(2);
  });

  it("does nothing when Run is not running or paused", () => {
    const state = mountShortcut("ready");
    const event = pressSpace();

    expect(event.defaultPrevented).toBe(false);
    expect(state.executeCommand).not.toHaveBeenCalled();
  });

  it("does not intercept Space from interactive controls", () => {
    const state = mountShortcut("running");
    const input = document.createElement("input");
    document.body.append(input);

    const event = pressSpace(input);

    expect(event.defaultPrevented).toBe(false);
    expect(state.executeCommand).not.toHaveBeenCalled();
  });

  it("ignores repeated or modified Space presses and a busy Run", () => {
    const state = mountShortcut("running");

    const repeated = new KeyboardEvent("keydown", {
      code: "Space", repeat: true, cancelable: true,
    });
    document.dispatchEvent(repeated);
    const modified = new KeyboardEvent("keydown", {
      code: "Space", ctrlKey: true, cancelable: true,
    });
    document.dispatchEvent(modified);

    state.runBusy.value = true;
    const busyEvent = pressSpace();

    expect(repeated.defaultPrevented).toBe(false);
    expect(modified.defaultPrevented).toBe(false);
    expect(busyEvent.defaultPrevented).toBe(false);
    expect(state.executeCommand).not.toHaveBeenCalled();
  });

  it("removes the global listener when the owner unmounts", () => {
    const state = mountShortcut("running");
    state.wrapper.unmount();
    const event = pressSpace();

    expect(event.defaultPrevented).toBe(false);
    expect(state.executeCommand).not.toHaveBeenCalled();
  });
});
