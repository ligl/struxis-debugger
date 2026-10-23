import { mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, ref } from "vue";
import type { RunStateDto } from "../../src/origin-types";
import { usePlaybackController } from "../../src/composables/usePlaybackController";

function readyState(): RunStateDto {
  return {
    runId: "run-1",
    testDatasetId: "test-1",
    inputFingerprint: "fingerprint",
    inputCount: 3,
    status: "ready",
    processedCount: 0,
    cursorSbarId: null,
    failureDiagnostic: null,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("usePlaybackController", () => {
  it("serializes one Step at a time and stops at Completed", async () => {
    vi.useFakeTimers();
    const state = ref<RunStateDto | null>(readyState());
    const busy = ref(false);
    const error = ref("");
    let activeSteps = 0;
    let maxActiveSteps = 0;
    const execute = vi.fn(async () => {
      activeSteps += 1;
      maxActiveSteps = Math.max(maxActiveSteps, activeSteps);
      await Promise.resolve();
      const current = state.value!;
      const processedCount = current.processedCount + 1;
      state.value = {
        ...current,
        processedCount,
        cursorSbarId: `sbar-${processedCount}`,
        status: processedCount === current.inputCount ? "completed" : "ready",
      };
      activeSteps -= 1;
    });
    let controller!: ReturnType<typeof usePlaybackController>;
    const wrapper = mount(defineComponent({
      setup() {
        controller = usePlaybackController(state, busy, error, execute);
        return () => h("div");
      },
    }));

    controller.play();
    await vi.advanceTimersByTimeAsync(1000);

    expect(execute).toHaveBeenCalledTimes(3);
    expect(maxActiveSteps).toBe(1);
    expect(controller.playbackStatus.value).toBe("idle");
    wrapper.unmount();
  });

  it("does not schedule another Step after Pause while one Step is in flight", async () => {
    const state = ref<RunStateDto | null>(readyState());
    const busy = ref(false);
    const error = ref("");
    let finishStep!: () => void;
    const execute = vi.fn(() => new Promise<void>((resolve) => {
      finishStep = () => {
        state.value = {
          ...state.value!,
          processedCount: 1,
          cursorSbarId: "sbar-1",
        };
        resolve();
      };
    }));
    let controller!: ReturnType<typeof usePlaybackController>;
    const wrapper = mount(defineComponent({
      setup() {
        controller = usePlaybackController(state, busy, error, execute);
        return () => h("div");
      },
    }));

    controller.play();
    expect(execute).toHaveBeenCalledTimes(1);
    const paused = controller.pauseAndWait();
    finishStep();
    await paused;

    expect(execute).toHaveBeenCalledTimes(1);
    expect(state.value?.processedCount).toBe(1);
    expect(controller.playbackStatus.value).toBe("paused");
    wrapper.unmount();
  });
});
