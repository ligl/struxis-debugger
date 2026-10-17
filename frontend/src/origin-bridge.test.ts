import { beforeEach, describe, expect, it, vi } from "vitest";

const { invokeMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
}));

import { createTestDataset, getCurrentTestDataset } from "./origin-bridge";
import type { TestDatasetDto } from "./origin-types";

const testDataset: TestDatasetDto = {
  testDatasetId: "test-1",
  originDatasetId: "origin-1",
  instrumentId: "AUD/USD.SIM",
  barType: "AUD/USD.SIM-5-MINUTE-LAST-EXTERNAL",
  timeframe: "300s",
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
