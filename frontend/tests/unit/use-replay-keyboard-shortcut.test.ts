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
  canUseShortcuts = canControl,
) {
  const playbackStatus = ref<PlaybackStatus>(playback);
  const canControlPlayback = ref(canControl);
  const runBusy = ref(busy);
  const playbackDelayMs = ref(200);
  const setPlaybackDelay = vi.fn((delayMs: number) => { playbackDelayMs.value = delayMs; });
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
        ref(canUseShortcuts),
        playbackDelayMs,
        setPlaybackDelay,
      );
      return () => null;
    },
  }));
  cleanup.push(() => wrapper.unmount());
  return { playbackStatus, canControlPlayback, runBusy, playbackDelayMs, setPlaybackDelay, targetSbarId, restartToTarget, executeCommand, wrapper };
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

function pressKey(key: string, target: EventTarget = document): KeyboardEvent {
  const event = new KeyboardEvent("keydown", {
    key,
    code: key === " " ? "Space" : "",
    shiftKey: key === "S",
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

  it("maps N, S, Shift+S, and R to Step, Start, Stop, and Stop then Start", async () => {
    const state = mountShortcut("idle", true, false, null, true);

    expect(pressKey("n").defaultPrevented).toBe(true);
    expect(state.executeCommand).toHaveBeenLastCalledWith("step");

    expect(pressKey("s").defaultPrevented).toBe(true);
    expect(state.executeCommand).toHaveBeenLastCalledWith("start");

    expect(pressKey("S").defaultPrevented).toBe(true);
    expect(state.executeCommand).toHaveBeenLastCalledWith("stop");

    state.executeCommand.mockClear();
    expect(pressKey("r").defaultPrevented).toBe(true);
    await Promise.resolve();
    expect(state.executeCommand.mock.calls).toEqual([["stop"], ["start"]]);
  });

  it("changes playback speed with - and = without wrapping at either endpoint", () => {
    const state = mountShortcut("playing", true, true, null, true);

    const slower = pressKey("-");
    expect(slower.defaultPrevented).toBe(true);
    expect(state.setPlaybackDelay).toHaveBeenCalledWith(500);
    expect(state.playbackDelayMs.value).toBe(500);

    state.setPlaybackDelay.mockClear();
    const slowBoundary = pressKey("-");
    expect(slowBoundary.defaultPrevented).toBe(true);
    expect(state.setPlaybackDelay).not.toHaveBeenCalled();
    expect(state.playbackDelayMs.value).toBe(500);

    state.playbackDelayMs.value = 65;
    const faster = pressKey("=");
    expect(faster.defaultPrevented).toBe(true);
    expect(state.setPlaybackDelay).toHaveBeenCalledWith(0);
    expect(state.playbackDelayMs.value).toBe(0);

    state.setPlaybackDelay.mockClear();
    const fastBoundary = pressKey("=");
    expect(fastBoundary.defaultPrevented).toBe(true);
    expect(state.setPlaybackDelay).not.toHaveBeenCalled();
    expect(state.playbackDelayMs.value).toBe(0);
  });

  it("allows Stop to interrupt active playback while a Step is in flight", () => {
    const state = mountShortcut("playing", true, true, null, true);
    const event = pressKey("S");
    expect(event.defaultPrevented).toBe(true);
    expect(state.executeCommand).toHaveBeenCalledWith("stop");
  });

  it("does not run transport shortcuts outside Replay or from interactive controls", () => {
    const outsideReplay = mountShortcut("idle", false, false, null, false);
    const ignored = pressKey("n");
    expect(ignored.defaultPrevented).toBe(false);
    expect(outsideReplay.executeCommand).not.toHaveBeenCalled();

    const state = mountShortcut("idle", true, false, null, true);
    const button = document.createElement("button");
    document.body.append(button);
    const event = pressKey("s", button);
    expect(event.defaultPrevented).toBe(false);
    expect(state.executeCommand).not.toHaveBeenCalled();
  });

  it("removes the global listener when the owner unmounts", () => {
    const state = mountShortcut("playing");
    cleanup.pop()?.();
    const event = pressSpace();
    expect(event.defaultPrevented).toBe(false);
    expect(state.executeCommand).not.toHaveBeenCalled();
  });
});
