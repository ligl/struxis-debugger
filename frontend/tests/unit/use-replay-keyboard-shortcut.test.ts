import { mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, ref } from "vue";
import { useReplayKeyboardShortcut } from "../../src/composables/useReplayKeyboardShortcut";
import type { PlaybackStatus } from "../../src/composables/usePlaybackController";

let cleanup: (() => void)[] = [];

function mountShortcut(
  playback: PlaybackStatus = "idle",
  canControl = true,
  busy = false,
  target: string | null = null,
) {
  const playbackStatus = ref<PlaybackStatus>(playback);
  const canControlPlayback = ref(canControl);
  const runBusy = ref(busy);
  const targetSbarId = ref<string | null>(target);
  const restartToTarget = vi.fn(async () => undefined);
  const executeCommand = vi.fn(async () => undefined);
  const wrapper = mount(defineComponent({
    setup() {
      useReplayKeyboardShortcut(
        playbackStatus,
        canControlPlayback,
        runBusy,
        targetSbarId,
        restartToTarget,
        executeCommand,
      );
      return () => null;
    },
  }));
  cleanup.push(() => wrapper.unmount());
  return { playbackStatus, canControlPlayback, runBusy, targetSbarId, restartToTarget, executeCommand, wrapper };
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
  it("maps Space to frontend Pause while playing and Play while paused", () => {
    const state = mountShortcut("playing");
    const pauseEvent = pressSpace();
    expect(pauseEvent.defaultPrevented).toBe(true);
    expect(state.executeCommand).toHaveBeenCalledWith("pause");

    state.playbackStatus.value = "paused";
    const playEvent = pressSpace();
    expect(playEvent.defaultPrevented).toBe(true);
    expect(state.executeCommand).toHaveBeenLastCalledWith("play");
    expect(state.executeCommand).toHaveBeenCalledTimes(2);
  });

  it("prioritizes Restart to SBar over Play/Pause when a target exists", () => {
    const state = mountShortcut("idle", true, true, "1735689660000000000");
    const event = pressSpace();
    expect(event.defaultPrevented).toBe(true);
    expect(state.restartToTarget).toHaveBeenCalledTimes(1);
    expect(state.executeCommand).not.toHaveBeenCalled();
  });

  it("allows Play from an eligible ready Run", () => {
    const state = mountShortcut("idle", true);
    const event = pressSpace();
    expect(event.defaultPrevented).toBe(true);
    expect(state.executeCommand).toHaveBeenCalledWith("play");
  });

  it("does nothing outside Replay or without a controllable Run", () => {
    const state = mountShortcut("idle", false);
    const event = pressSpace();
    expect(event.defaultPrevented).toBe(false);
    expect(state.executeCommand).not.toHaveBeenCalled();
  });

  it("does not intercept Space from interactive controls", () => {
    const state = mountShortcut("playing");
    const input = document.createElement("input");
    document.body.append(input);
    const event = pressSpace(input);
    expect(event.defaultPrevented).toBe(false);
    expect(state.executeCommand).not.toHaveBeenCalled();
  });

  it("ignores repeated or modified Space presses and busy non-playback state", () => {
    const state = mountShortcut("idle", true, true);
    const repeated = new KeyboardEvent("keydown", { code: "Space", repeat: true, cancelable: true });
    document.dispatchEvent(repeated);
    const modified = new KeyboardEvent("keydown", { code: "Space", ctrlKey: true, cancelable: true });
    document.dispatchEvent(modified);
    const busyEvent = pressSpace();
    expect(repeated.defaultPrevented).toBe(false);
    expect(modified.defaultPrevented).toBe(false);
    expect(busyEvent.defaultPrevented).toBe(false);
    expect(state.executeCommand).not.toHaveBeenCalled();
  });

  it("still allows Pause while a Step is in flight", () => {
    const state = mountShortcut("playing", true, true);
    const event = pressSpace();
    expect(event.defaultPrevented).toBe(true);
    expect(state.executeCommand).toHaveBeenCalledWith("pause");
  });

  it("removes the global listener when the owner unmounts", () => {
    const state = mountShortcut("playing");
    cleanup.pop()?.();
    const event = pressSpace();
    expect(event.defaultPrevented).toBe(false);
    expect(state.executeCommand).not.toHaveBeenCalled();
  });
});
