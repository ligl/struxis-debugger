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
  timeframe: "5m",
  sbarSequenceFingerprint: `fingerprint-${id}`,
  sbarCount: 2,
  firstSbarId: "100",
  lastSbarId: "200",
  firstTsEvent: "100",
  lastTsEvent: "200",
  structure: null,
  bars: [],
});

const testDataset = (id: string): TestDatasetDto => ({
  testDatasetId: id,
  originDatasetId: "origin-new",
  instrumentId: "AUD/USD.SIM",
  barType: "AUD/USD.SIM-5-MINUTE-LAST-EXTERNAL",
  timeframe: "5m",
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
    const { testDataset: current, refreshCurrentTestDataset, prepareForOrigin } =
      useTestDataset(originRef, computed(() => true));

    const staleRefresh = refreshCurrentTestDataset();
    originRef.value = origin("origin-new");
    prepareForOrigin(originRef.value);
    const currentRefresh = refreshCurrentTestDataset();

    await currentRefresh;
    resolveStartup(testDataset("test-old"));
    await staleRefresh;

    expect(current.value?.testDatasetId).toBe("test-new");
    expect(invokeMock).toHaveBeenCalledTimes(2);
  });

  it("invalidates only Test Dataset data on an Origin handoff", () => {
    const originRef = ref<OriginDatasetDto | null>(origin("origin-new"));
    const state = useTestDataset(originRef, computed(() => true));
    state.testDataset.value = testDataset("previous-test");

    state.prepareForOrigin(origin("origin-new"));

    expect(state.testDataset.value).toBeNull();
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

  it("does not let an in-flight refresh overwrite state while Test Dataset creation is pending", async () => {
    let resolveRefresh!: (value: TestDatasetDto | null) => void;
    let resolveCreate!: (value: TestDatasetDto) => void;
    const staleRead = new Promise<TestDatasetDto | null>((resolve) => { resolveRefresh = resolve; });
    const createRead = new Promise<TestDatasetDto>((resolve) => { resolveCreate = resolve; });
    invokeMock
      .mockReturnValueOnce(staleRead)
      .mockReturnValueOnce(createRead);

    const originRef = ref<OriginDatasetDto | null>(origin("origin-new"));
    const state = useTestDataset(originRef, computed(() => true));
    state.testDataset.value = testDataset("previous-test");

    const staleRefresh = state.refreshCurrentTestDataset();
    const creating = state.createTestDataset("120", "180");
    resolveRefresh(null);
    await staleRefresh;

    expect(state.testDataset.value?.testDatasetId).toBe("previous-test");

    resolveCreate(testDataset("created-test"));
    await creating;
    expect(state.testDataset.value?.testDatasetId).toBe("created-test");
  });

});