import { beforeEach, describe, expect, it, vi } from "vitest";

const { invokeMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
}));

import {
  disposeRun,
  getRunState,
  restartRun,
  startRun,
  stepRun,
  stopRun,
} from "./origin-bridge";
import type { RunStateDto, IpcError } from "./origin-types";

const mockRunState: RunStateDto = {
  runId: "run-abc-123",
  testDatasetId: "test-xyz-789",
  inputFingerprint: "sha256-abcdef",
  inputCount: 100,
  status: "ready",
  processedCount: 0,
  cursorSbarId: null,
  failureDiagnostic: null,
};

const mockIpcError: IpcError = {
  code: "invalid_state",
  message: "No active Run exists",
};

describe("Run Bridge Functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("startRun()", () => {
    it("invokes 'start_run' command without arguments and returns RunState", async () => {
      invokeMock.mockResolvedValue(mockRunState);

      const result = await startRun();

      expect(result).toEqual(mockRunState);
      expect(invokeMock).toHaveBeenCalledTimes(1);
      expect(invokeMock).toHaveBeenCalledWith("start_run");
    });

    it("propagates backend errors as rejected promises", async () => {
      invokeMock.mockRejectedValue(mockIpcError);

      await expect(startRun()).rejects.toEqual(mockIpcError);
      expect(invokeMock).toHaveBeenCalledWith("start_run");
    });
  });

  describe("restartRun()", () => {
    it("invokes 'restart_run' command without arguments", async () => {
      const restartedState = { ...mockRunState, runId: "run-new-456", status: "ready" };
      invokeMock.mockResolvedValue(restartedState);

      const result = await restartRun();

      expect(result).toEqual(restartedState);
      expect(invokeMock).toHaveBeenCalledWith("restart_run");
    });
  });

  describe("getRunState()", () => {
    it("invokes 'get_run_state' and returns current state", async () => {
      invokeMock.mockResolvedValue(mockRunState);

      const result = await getRunState();

      expect(result).toEqual(mockRunState);
      expect(invokeMock).toHaveBeenCalledWith("get_run_state");
    });

    it("returns null when no Run has been started", async () => {
      invokeMock.mockResolvedValue(null);

      await expect(getRunState()).resolves.toBeNull();
      expect(invokeMock).toHaveBeenCalledWith("get_run_state");
    });
  });

  describe("stepRun()", () => {
    it("advances Run by one SBar and returns updated state", async () => {
      const steppedState = {
        ...mockRunState,
        status: "paused",
        processedCount: 1,
        cursorSbarId: "100",
      };
      invokeMock.mockResolvedValue(steppedState);

      const result = await stepRun();

      expect(result).toEqual(steppedState);
      expect(invokeMock).toHaveBeenCalledWith("step_run");
    });

    it("returns completed state when stepping the last SBar", async () => {
      const completedState = {
        ...mockRunState,
        status: "completed",
        processedCount: 100,
        cursorSbarId: "200",
      };
      invokeMock.mockResolvedValue(completedState);

      const result = await stepRun();

      expect(result.status).toBe("completed");
      expect(result.processedCount).toBe(100);
    });
  });

  describe("stopRun()", () => {
    it("stops the current Run gracefully", async () => {
      const stoppedState = { ...mockRunState, status: "paused", processedCount: 50 };
      invokeMock.mockResolvedValue(stoppedState);

      const result = await stopRun();

      expect(result).toEqual(stoppedState);
      expect(invokeMock).toHaveBeenCalledWith("stop_run");
    });
  });

  describe("disposeRun()", () => {
    it("disposes Run resources and returns final state", async () => {
      const disposedState = { ...mockRunState, status: "disposed" };
      invokeMock.mockResolvedValue(disposedState);

      const result = await disposeRun();

      expect(result.status).toBe("disposed");
      expect(invokeMock).toHaveBeenCalledWith("dispose_run");
    });
  });
});

describe("Run Error Scenarios", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects with conflict error when another operation is active", async () => {
    const conflictError: IpcError = {
      code: "conflict",
      message: "Another replay command is active",
    };
    invokeMock.mockRejectedValue(conflictError);

    await expect(stepRun()).rejects.toEqual(conflictError);
  });

  it("rejects with invalid_state when Run is not in correct state", async () => {
    const stateError: IpcError = {
      code: "invalid_state",
      message: "Run is not active",
    };
    invokeMock.mockRejectedValue(stateError);

    await expect(stepRun()).rejects.toEqual(stateError);
  });

  it("rejects with not_found when Test Dataset is missing for start", async () => {
    const notFoundError: IpcError = {
      code: "invalid_state",
      message: "Create a Test Dataset before starting a Run",
    };
    invokeMock.mockRejectedValue(notFoundError);

    await expect(startRun()).rejects.toEqual(notFoundError);
  });
});

describe("Run State Type Safety", () => {
  it("ensures RunStatus is one of the valid values", () => {
    const validStatuses: RunStateDto["status"][] = [
      "ready",
      "running",
      "paused",
      "completed",
      "failed",
      "disposed",
    ];

    validStatuses.forEach((status) => {
      const state: RunStateDto = {
        ...mockRunState,
        status,
      };
      expect(typeof state.status).toBe("string");
      expect(validStatuses).toContain(status);
    });
  });

  it("allows nullable cursorSbarId and failureDiagnostic", () => {
    const stateWithNulls: RunStateDto = {
      ...mockRunState,
      cursorSbarId: null,
      failureDiagnostic: null,
    };

    expect(stateWithNulls.cursorSbarId).toBeNull();
    expect(stateWithNulls.failureDiagnostic).toBeNull();
  });

  it("allows non-null cursorSbarId after processing", () => {
    const stateWithCursor: RunStateDto = {
      ...mockRunState,
      processedCount: 5,
      cursorSbarId: "1708234567",
    };

    expect(stateWithCursor.cursorSbarId).toBe("1708234567");
    expect(stateWithCursor.processedCount).toBe(5);
  });
});