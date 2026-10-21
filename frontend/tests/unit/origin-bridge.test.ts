import { beforeEach, describe, expect, it, vi } from "vitest";

const { invokeMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
}));

import {
  createTestDataset,
  disposeRun,
  getCurrentTestDataset,
  getRunState,
  listSnapshots,
  pauseRun,
  playRun,
  restartRun,
  startRun,
  stepRun,
  stopRun,
} from "../../src/origin-bridge";
import type { TestDatasetDto } from "../../src/origin-types";

const testDataset: TestDatasetDto = {
  testDatasetId: "test-1",
  originDatasetId: "origin-1",
  instrumentId: "AUD/USD.SIM",
  barType: "AUD/USD.SIM-5-MINUTE-LAST-EXTERNAL",
  timeframe: "5m",
  startSbarId: "100",
  endSbarId: "200",
  sbarCount: 2,
  sbarSequenceFingerprint: "fingerprint",
};

describe("Test Dataset IPC bridge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends exact SBar ID boundaries as strings", async () => {
    invokeMock.mockResolvedValue(testDataset);

    await expect(createTestDataset("100", "200")).resolves.toEqual(testDataset);
    expect(invokeMock).toHaveBeenCalledWith("create_test_dataset", {
      startSbarId: "100",
      endSbarId: "200",
    });
  });

  it("reads the current session Test Dataset without inventing one", async () => {
    invokeMock.mockResolvedValue(null);

    await expect(getCurrentTestDataset()).resolves.toBeNull();
    expect(invokeMock).toHaveBeenCalledWith("get_current_test_dataset");
  });
});


describe("Run and Snapshot IPC bridge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps Run controls to their exact Tauri command names without inventing arguments", async () => {
    const state = {
      runId: "run-1",
      testDatasetId: "test-1",
      inputFingerprint: "fingerprint",
      inputCount: 2,
      status: "paused",
      processedCount: 1,
      cursorSbarId: "100",
      failureDiagnostic: null,
    };
    invokeMock.mockResolvedValue(state);

    await expect(startRun()).resolves.toEqual(state);
    await expect(restartRun()).resolves.toEqual(state);
    await expect(getRunState()).resolves.toEqual(state);
    await expect(stepRun()).resolves.toEqual(state);
    await expect(playRun()).resolves.toEqual(state);
    await expect(pauseRun()).resolves.toEqual(state);
    await expect(stopRun()).resolves.toEqual(state);
    await expect(disposeRun()).resolves.toEqual(state);

    expect(invokeMock.mock.calls).toEqual([
      ["start_run"],
      ["restart_run"],
      ["get_run_state"],
      ["step_run"],
      ["play_run"],
      ["pause_run"],
      ["stop_run"],
      ["dispose_run"],
    ]);
  });

  it("lists Snapshot artifacts using the read-only discovery command", async () => {
    const artifacts = [{
      fileName: "snapshot-1.snapshot.sqlite",
      path: "/snapshots/snapshot-1.snapshot.sqlite",
      kind: "complete",
      snapshotId: "snapshot-1",
      runId: "run-1",
      stateKey: "BTCUSDT-PERP.BINANCE",
      generatedAt: "1780000000000000000",
      checkpointCount: 2,
      diagnostic: null,
    }];
    invokeMock.mockResolvedValue(artifacts);

    await expect(listSnapshots()).resolves.toEqual(artifacts);
    expect(invokeMock).toHaveBeenCalledWith("list_snapshots");
  });
});
