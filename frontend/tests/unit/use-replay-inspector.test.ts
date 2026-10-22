import { beforeEach, describe, expect, it, vi } from "vitest";
import { useReplayInspector } from "../../src/composables/useReplayInspector";
import type { ReplayInspectorDto } from "../../src/origin-types";

const { invoke } = vi.hoisted(() => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({ invoke }));

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
    invoke.mockResolvedValue(checkpoint);

    await state.refresh(true);

    expect(invoke).toHaveBeenCalledOnce();
    expect(invoke).toHaveBeenCalledWith("get_replay_inspector");
    expect(state.replayInspector.value).toEqual(checkpoint);
    expect(state.replayInspectorError.value).toBe("");
  });

  it("clears checkpoint and error when no Run exists", async () => {
    const state = useReplayInspector();
    state.replayInspector.value = checkpoint;
    state.replayInspectorError.value = "old error";

    await state.refresh(false);

    expect(invoke).not.toHaveBeenCalled();
    expect(state.replayInspector.value).toBeNull();
    expect(state.replayInspectorError.value).toBe("");
  });

  it("surfaces backend errors as readable state and allows a later retry", async () => {
    const state = useReplayInspector();
    invoke.mockRejectedValueOnce(new Error("backend unavailable"))
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
    invoke.mockReturnValueOnce(new Promise<ReplayInspectorDto>((resolve) => {
      resolveRead = resolve;
    }));

    const first = state.refresh(true);
    await state.refresh(true);
    expect(invoke).toHaveBeenCalledOnce();
    expect(invoke).toHaveBeenCalledWith("get_replay_inspector");

    resolveRead(checkpoint);
    await first;
    expect(state.replayInspector.value).toEqual(checkpoint);
  });

  it("ignores an outstanding response after the Run is cleared", async () => {
    const state = useReplayInspector();
    let resolveRead!: (value: ReplayInspectorDto) => void;
    invoke.mockReturnValueOnce(new Promise<ReplayInspectorDto>((resolve) => {
      resolveRead = resolve;
    }));

    const pendingRead = state.refresh(true);
    await state.refresh(false);

    expect(state.replayInspector.value).toBeNull();
    expect(state.replayInspectorError.value).toBe("");

    resolveRead(checkpoint);
    await pendingRead;

    expect(state.replayInspector.value).toBeNull();
    expect(state.replayInspectorError.value).toBe("");
  });

  it("keeps the new read guard when an obsolete read finishes", async () => {
    const state = useReplayInspector();
    let resolveOldRead!: (value: ReplayInspectorDto) => void;
    let resolveNewRead!: (value: ReplayInspectorDto) => void;
    invoke
      .mockReturnValueOnce(new Promise<ReplayInspectorDto>((resolve) => {
        resolveOldRead = resolve;
      }))
      .mockReturnValueOnce(new Promise<ReplayInspectorDto>((resolve) => {
        resolveNewRead = resolve;
      }));

    const oldRead = state.refresh(true);
    await state.refresh(false);
    const newRead = state.refresh(true);

    resolveOldRead(checkpoint);
    await oldRead;

    // The obsolete request must not release the guard for the current read.
    await state.refresh(true);
    expect(invoke).toHaveBeenCalledTimes(2);

    resolveNewRead(checkpoint);
    await newRead;
    expect(state.replayInspector.value).toEqual(checkpoint);
  });
});
