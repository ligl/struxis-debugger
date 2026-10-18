import { beforeEach, describe, expect, it, vi } from "vitest";
import { computed, ref } from "vue";
import { useTestDataset } from "../../src/composables/useTestDataset";
import type { OriginDatasetDto, TestDatasetDto } from "../../src/origin-types";

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

const origin = (id: string): OriginDatasetDto => ({
  originDatasetId: id,
  sourceCatalog: "/catalog",
  enableStructure: true,
  instrumentId: "AUD/USD.SIM",
  barType: "AUD/USD.SIM-5-MINUTE-LAST-EXTERNAL",
  timeframe: "300s",
  sbarSequenceFingerprint: `fingerprint-${id}`,
  sbarCount: 2,
  firstSbarId: "100",
  lastSbarId: "200",
  firstTsEvent: "100",
  lastTsEvent: "200",
  bars: [],
});

const testDataset = (id: string): TestDatasetDto => ({
  testDatasetId: id,
  originDatasetId: "origin-new",
  instrumentId: "AUD/USD.SIM",
  barType: "AUD/USD.SIM-5-MINUTE-LAST-EXTERNAL",
  timeframe: "300s",
  startSbarId: "120",
  endSbarId: "180",
  sbarCount: 2,
  sbarSequenceFingerprint: `fingerprint-${id}`,
});

describe("useTestDataset refresh ordering", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("does not let a pre-handoff refresh overwrite the current Test Dataset", async () => {
    let resolveStartup!: (value: TestDatasetDto | null) => void;
    const startupRead = new Promise<TestDatasetDto | null>((resolve) => { resolveStartup = resolve; });
    invokeMock
      .mockReturnValueOnce(startupRead)
      .mockResolvedValueOnce(testDataset("test-new"));

    const originRef = ref<OriginDatasetDto | null>(null);
    const { testDataset: current, startSbarId, endSbarId, refreshCurrentTestDataset, prepareForOrigin } =
      useTestDataset(originRef, computed(() => true));

    const staleRefresh = refreshCurrentTestDataset();
    originRef.value = origin("origin-new");
    prepareForOrigin(originRef.value);
    const currentRefresh = refreshCurrentTestDataset();

    await currentRefresh;
    resolveStartup(testDataset("test-old"));
    await staleRefresh;

    expect(current.value?.testDatasetId).toBe("test-new");
    expect(startSbarId.value).toBe("120");
    expect(endSbarId.value).toBe("180");
    expect(invokeMock).toHaveBeenCalledTimes(2);
  });

  it("does not let a stale refresh failure replace the current diagnostic", async () => {
    let rejectStartup!: (error: Error) => void;
    const startupRead = new Promise<TestDatasetDto | null>((_resolve, reject) => { rejectStartup = reject; });
    invokeMock
      .mockReturnValueOnce(startupRead)
      .mockResolvedValueOnce(null);

    const originRef = ref<OriginDatasetDto | null>(null);
    const { testError, refreshCurrentTestDataset, prepareForOrigin } =
      useTestDataset(originRef, computed(() => true));

    const staleRefresh = refreshCurrentTestDataset();
    originRef.value = origin("origin-new");
    prepareForOrigin(originRef.value);
    await refreshCurrentTestDataset();

    rejectStartup(new Error("stale startup failure"));
    await staleRefresh;

    expect(testError.value).toBe("");
  });
});
