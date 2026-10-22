import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCompareWorkspace } from "../../src/composables/useCompareWorkspace";

const { invokeMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
}));

describe("useCompareWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("owns the comparison command lifecycle and stores the returned result", async () => {
    const result = {
      baseline: { snapshotId: "baseline-1" },
      candidate: { snapshotId: "candidate-1" },
      checkpointCount: 2,
      checkpoints: [],
      differences: [],
      firstStructuralDivergence: null,
      diagnosticsDifferences: [],
      firstDiagnosticsDivergence: null,
    };
    invokeMock.mockResolvedValueOnce(result);

    const state = useCompareWorkspace();
    const pending = state.runCompare("baseline-1", "candidate-1");
    expect(state.compareLoading.value).toBe(true);
    await pending;

    expect(invokeMock).toHaveBeenCalledWith("compare_snapshots", {
      baselineSnapshotId: "baseline-1",
      candidateSnapshotId: "candidate-1",
    });
    expect(state.compareResult.value).toEqual(result);
    expect(state.compareError.value).toBe("");
    expect(state.compareLoading.value).toBe(false);
  });

  it("clears stale results before a comparison and reports IPC failures", async () => {
    const state = useCompareWorkspace();
    state.compareResult.value = {
      baseline: { snapshotId: "old-baseline" },
      candidate: { snapshotId: "old-candidate" },
      checkpointCount: 0,
      checkpoints: [],
      differences: [],
      firstStructuralDivergence: null,
      diagnosticsDifferences: [],
      firstDiagnosticsDivergence: null,
    } as never;
    invokeMock.mockRejectedValueOnce(new Error("comparison rejected"));

    await state.runCompare("baseline-2", "candidate-2");

    expect(state.compareResult.value).toBeNull();
    expect(state.compareError.value).toContain("comparison rejected");
    expect(state.compareLoading.value).toBe(false);
  });

  it("ignores duplicate compare commands while a comparison is active", async () => {
    let resolveCompare!: (value: never) => void;
    invokeMock.mockReturnValueOnce(new Promise((resolve) => {
      resolveCompare = resolve;
    }));

    const state = useCompareWorkspace();
    const first = state.runCompare("baseline-1", "candidate-1");
    await state.runCompare("baseline-2", "candidate-2");

    expect(invokeMock).toHaveBeenCalledTimes(1);
    resolveCompare({} as never);
    await first;
  });
});
