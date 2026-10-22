import { mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, ref } from "vue";
import { useRunPolling } from "../../src/composables/useRunPolling";
import type { RunStateDto } from "../../src/origin-types";

const runningState: RunStateDto = {
  runId: "run-1",
  testDatasetId: "test-1",
  inputFingerprint: "fingerprint-1",
  inputCount: 10,
  status: "running",
  processedCount: 3,
  cursorSbarId: "sbar-3",
  failureDiagnostic: null,
};

let wrapper: ReturnType<typeof mount> | null = null;

function mountPolling(status: RunStateDto["status"] | null, busy = false) {
  const runState = ref<RunStateDto | null>(status ? { ...runningState, status } : null);
  const runBusy = ref(busy);
  const refreshRunState = vi.fn(async () => undefined);
  const refreshReplayInspector = vi.fn(async () => undefined);

  wrapper = mount(defineComponent({
    setup() {
      useRunPolling(runState, runBusy, refreshRunState, refreshReplayInspector);
      return () => null;
    },
  }));

  return { runState, runBusy, refreshRunState, refreshReplayInspector };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe("useRunPolling", () => {
  it("refreshes Run state then Replay Inspector only while running and idle", async () => {
    const state = mountPolling("paused");
    await vi.advanceTimersByTimeAsync(250);
    expect(state.refreshRunState).not.toHaveBeenCalled();
    expect(state.refreshReplayInspector).not.toHaveBeenCalled();

    state.runState.value = { ...runningState };
    state.runBusy.value = true;
    await vi.advanceTimersByTimeAsync(250);
    expect(state.refreshRunState).not.toHaveBeenCalled();

    state.runBusy.value = false;
    await vi.advanceTimersByTimeAsync(250);
    expect(state.refreshRunState).toHaveBeenCalledOnce();
    expect(state.refreshRunState).toHaveBeenCalledWith(true);
    expect(state.refreshReplayInspector).toHaveBeenCalledOnce();
    expect(state.refreshRunState.mock.invocationCallOrder[0])
      .toBeLessThan(state.refreshReplayInspector.mock.invocationCallOrder[0]);
  });

  it("clears the polling interval when the owner unmounts", async () => {
    const state = mountPolling("running");
    wrapper?.unmount();
    wrapper = null;

    await vi.advanceTimersByTimeAsync(1000);
    expect(state.refreshRunState).not.toHaveBeenCalled();
    expect(state.refreshReplayInspector).not.toHaveBeenCalled();
  });
});
