import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSnapshots } from "../../src/composables/useSnapshots";
import type { SnapshotArtifactDto } from "../../src/origin-types";

const { listSnapshotsMock } = vi.hoisted(() => ({
  listSnapshotsMock: vi.fn(),
}));

vi.mock("../../src/origin-bridge", () => ({
  describeIpcError: (error: unknown) => String(error),
  listSnapshots: listSnapshotsMock,
}));

const artifact = (snapshotId: string): SnapshotArtifactDto => ({
  fileName: `${snapshotId}.snapshot.sqlite`,
  path: `/snapshots/${snapshotId}.snapshot.sqlite`,
  kind: "complete",
  snapshotId,
  runId: "run-1",
  stateKey: "BTCUSDT-PERP.BINANCE",
  generatedAt: "1780000000000000000",
  checkpointCount: 2,
  diagnostic: null,
});

describe("useSnapshots", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("performs a follow-up read when refresh is requested during an active read", async () => {
    let resolveFirst!: (value: SnapshotArtifactDto[]) => void;
    const firstRead = new Promise<SnapshotArtifactDto[]>((resolve) => {
      resolveFirst = resolve;
    });
    listSnapshotsMock
      .mockReturnValueOnce(firstRead)
      .mockResolvedValueOnce([artifact("snapshot-new")]);

    const {
      snapshots,
      snapshotsLoading,
      refreshSnapshots,
    } = useSnapshots();

    const activeRefresh = refreshSnapshots();
    const overlappingRefresh = refreshSnapshots();

    expect(overlappingRefresh).toBe(activeRefresh);
    expect(listSnapshotsMock).toHaveBeenCalledTimes(1);
    expect(snapshotsLoading.value).toBe(true);

    resolveFirst([artifact("snapshot-old")]);
    await Promise.all([activeRefresh, overlappingRefresh]);

    expect(listSnapshotsMock).toHaveBeenCalledTimes(2);
    expect(snapshots.value.map((item) => item.snapshotId)).toEqual([
      "snapshot-new",
    ]);
    expect(snapshotsLoading.value).toBe(false);
  });

  it("preserves the last successful list when a refresh fails", async () => {
    listSnapshotsMock
      .mockResolvedValueOnce([artifact("snapshot-kept")])
      .mockRejectedValueOnce(new Error("snapshot discovery failed"));

    const { snapshots, snapshotsError, refreshSnapshots } = useSnapshots();

    await refreshSnapshots();
    await refreshSnapshots();

    expect(snapshots.value.map((item) => item.snapshotId)).toEqual([
      "snapshot-kept",
    ]);
    expect(snapshotsError.value).toBe("Error: snapshot discovery failed");
  });
});
