import { beforeEach, describe, expect, it, vi } from "vitest";
import { useReplayInspector } from "../../src/composables/useReplayInspector";
import type { ReplayInspectorDto } from "../../src/origin-types";

const { getReplayInspector } = vi.hoisted(() => ({
  getReplayInspector: vi.fn(),
}));

vi.mock("../../src/origin-bridge", () => ({ getReplayInspector }));

const checkpoint: ReplayInspectorDto = {
  stateKey: "state-1",
  checkpointIndex: 2,
  sbarId: "sbar-2",
  sbar: {
    sbarId: "sbar-2", barType: "TEST-1-MINUTE-LAST-EXTERNAL",
    tsEvent: "1", tsInit: "2", open: "10", high: "12", low: "9",
    close: "11", volume: "100", body: "1", upperShadow: "1",
    lowerShadow: "1", totalRange: "3", bodyRatio: 0.33,
    shadowRatio: 0.67, direction: "up",
  },
  structure: null,
};

describe("useReplayInspector", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("loads the backend checkpoint and clears the previous error", async () => {
    const state = useReplayInspector();
    getReplayInspector.mockResolvedValue(checkpoint);

    await state.refresh(true);

    expect(getReplayInspector).toHaveBeenCalledOnce();
    expect(state.replayInspector.value).toEqual(checkpoint);
    expect(state.replayInspectorError.value).toBe("");
  });

  it("clears checkpoint and error when no Run exists", async () => {
    const state = useReplayInspector();
    state.replayInspector.value = checkpoint;
    state.replayInspectorError.value = "old error";

    await state.refresh(false);

    expect(getReplayInspector).not.toHaveBeenCalled();
    expect(state.replayInspector.value).toBeNull();
    expect(state.replayInspectorError.value).toBe("");
  });

  it("surfaces backend errors as readable state and allows a later retry", async () => {
    const state = useReplayInspector();
    getReplayInspector.mockRejectedValueOnce(new Error("backend unavailable"))
      .mockResolvedValueOnce(checkpoint);

    await state.refresh(true);
    expect(state.replayInspectorError.value).toBe("backend unavailable");
    expect(state.replayInspector.value).toBeNull();

    await state.refresh(true);
    expect(state.replayInspector.value).toEqual(checkpoint);
    expect(state.replayInspectorError.value).toBe("");
  });

  it("does not issue overlapping reads while a read is in flight", async () => {
    const state = useReplayInspector();
    let resolveRead!: (value: ReplayInspectorDto) => void;
    getReplayInspector.mockReturnValueOnce(new Promise<ReplayInspectorDto>((resolve) => {
      resolveRead = resolve;
    }));

    const first = state.refresh(true);
    await state.refresh(true);
    expect(getReplayInspector).toHaveBeenCalledOnce();

    resolveRead(checkpoint);
    await first;
    expect(state.replayInspector.value).toEqual(checkpoint);
  });
});
