import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../../src/App.vue";
import RunControlPanel from "../../src/components/RunControlPanel.vue";
import type { CatalogDatasetEntry, OriginDatasetDto, TestDatasetDto } from "../../src/origin-types";

const ipc = vi.hoisted(() => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: ipc.invoke,
}));

const invokeMock = ipc.invoke;

const dataset: CatalogDatasetEntry = {
  id: "BTCUSDT-PERP.BINANCE-5-MINUTE-LAST-EXTERNAL",
  barType: "BTCUSDT-PERP.BINANCE-5-MINUTE-LAST-EXTERNAL",
  instrumentId: "BTCUSDT-PERP.BINANCE",
  timeframe: "300s",
  available: true,
  diagnostic: null,
};

function makeOrigin(id: string, enableStructure = true): OriginDatasetDto {
  return {
    originDatasetId: id,
    sourceCatalog: "/workspace/test_data/catalog",
    enableStructure,
    instrumentId: dataset.instrumentId!,
    barType: dataset.barType!,
    timeframe: "300s",
    sbarSequenceFingerprint: "abc123",
    sbarCount: 2,
    firstSbarId: "100",
    lastSbarId: "200",
    firstTsEvent: "100",
    lastTsEvent: "200",
    bars: [
      {
        sbarId: "100",
        barType: dataset.barType!,
        tsEvent: "100",
        tsInit: "101",
        open: "10.00",
        high: "12.00",
        low: "9.00",
        close: "11.00",
        volume: "100",
      },
      {
        sbarId: "200",
        barType: dataset.barType!,
        tsEvent: "200",
        tsInit: "201",
        open: "11.00",
        high: "13.00",
        low: "10.00",
        close: "12.00",
        volume: "120",
      },
    ],
  };
}

function mockInitialIpc(origin: OriginDatasetDto | null = null): void {
  invokeMock.mockImplementation((command) => {
    if (command === "list_catalog_datasets") return Promise.resolve([dataset]);
    if (command === "get_current_origin") return Promise.resolve(origin);
    return Promise.reject(new Error(`Unexpected IPC command: ${command}`));
  });
}

describe("Origin Load workbench", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInitialIpc();
  });

  it("discovers datasets and sends the selected full-stream load request", async () => {
    const origin = makeOrigin("origin-new");
    invokeMock.mockImplementation((command) => {
      if (command === "list_catalog_datasets") return Promise.resolve([dataset]);
      if (command === "get_current_origin") return Promise.resolve(null);
      if (command === "load_origin") return Promise.resolve(origin);
      return Promise.reject(new Error(`Unexpected IPC command: ${command}`));
    });

    const wrapper = mount(App);
    await vi.waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith("list_catalog_datasets"),
    );
    // Wait for the async discovery result to be rendered and selected before Load.
    await vi.waitFor(() => expect(wrapper.find('[data-testid="catalog-dataset-row"]').exists()).toBe(true));
    await wrapper.get('[data-testid="catalog-load"]').trigger("click");
    await vi.waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith("load_origin", {
        datasetId: dataset.id,
        enableStructure: true,
      }),
    );
    await vi.waitFor(() => expect(wrapper.text()).toContain("origin-new"));
    expect(wrapper.text()).toContain("2");
    expect(wrapper.text()).toContain("Oldest-first SBar sample");
  });

  it("maps a disabled structure checkbox to enableStructure=false and renders the returned mode", async () => {
    const origin = makeOrigin("origin-without-structure", false);
    invokeMock.mockImplementation((command) => {
      if (command === "list_catalog_datasets") return Promise.resolve([dataset]);
      if (command === "get_current_origin") return Promise.resolve(null);
      if (command === "load_origin") return Promise.resolve(origin);
      return Promise.reject(new Error(`Unexpected IPC command: ${command}`));
    });

    const wrapper = mount(App);
    await vi.waitFor(() => expect(wrapper.find('[data-testid="catalog-dataset-row"]').exists()).toBe(true));

    const structureCheckbox = wrapper.get('[data-testid="catalog-enable-structure"]');
    expect((structureCheckbox.element as HTMLInputElement).checked).toBe(true);
    await structureCheckbox.setValue(false);
    await wrapper.get('[data-testid="catalog-load"]').trigger("click");

    await vi.waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith("load_origin", {
        datasetId: dataset.id,
        enableStructure: false,
      }),
    );
    await vi.waitFor(() => expect(wrapper.text()).toContain("origin-without-structure"));
    expect(wrapper.text()).toContain("DISABLED");
  });

  it("groups datasets by Instrument and keeps unresolved entries visible but unloadable", async () => {
    const dailyDataset: CatalogDatasetEntry = {
      ...dataset,
      id: "BTCUSDT-PERP.BINANCE-1-DAY-LAST-EXTERNAL",
      barType: "BTCUSDT-PERP.BINANCE-1-DAY-LAST-EXTERNAL",
      timeframe: "1d",
    };
    const otherInstrumentDataset: CatalogDatasetEntry = {
      ...dataset,
      id: "ETHUSDT-PERP.BINANCE-5-MINUTE-LAST-EXTERNAL",
      barType: "ETHUSDT-PERP.BINANCE-5-MINUTE-LAST-EXTERNAL",
      instrumentId: "ETHUSDT-PERP.BINANCE",
    };
    const unresolvedDataset: CatalogDatasetEntry = {
      id: "UNRESOLVED-BAR-STREAM",
      barType: null,
      instrumentId: null,
      timeframe: null,
      available: false,
      diagnostic: "Instrument metadata is missing",
    };
    invokeMock.mockImplementation((command) => {
      if (command === "list_catalog_datasets") {
        return Promise.resolve([
          dataset,
          dailyDataset,
          otherInstrumentDataset,
          unresolvedDataset,
        ]);
      }
      if (command === "get_current_origin") return Promise.resolve(null);
      return Promise.reject(new Error(`Unexpected IPC command: ${command}`));
    });

    const wrapper = mount(App);
    await vi.waitFor(() => expect(wrapper.findAll('[data-testid="catalog-instrument-group"]')).toHaveLength(3));
    expect(wrapper.text()).toContain("BTCUSDT-PERP.BINANCE");
    expect(wrapper.text()).toContain("2 DATASETS");
    expect(wrapper.text()).toContain("ETHUSDT-PERP.BINANCE");
    expect(wrapper.text()).toContain("Unresolved / Unavailable");
    expect(wrapper.text()).toContain("Instrument metadata is missing");

    const btcGroup = wrapper
      .findAll('[data-testid="catalog-instrument-group"]')
      .find((row) => row.attributes("data-instrument-key") === "BTCUSDT-PERP.BINANCE")!;
    await btcGroup.trigger("click");
    expect(
      wrapper.findAll('[data-testid="catalog-dataset-row"]').some((row) =>
        row.attributes("data-dataset-id") === dataset.id,
      ),
    ).toBe(false);
    expect(
      invokeMock.mock.calls.some(([command]) => command === "load_origin"),
    ).toBe(false);

    const reopenedBtcGroup = wrapper
      .findAll('[data-testid="catalog-instrument-group"]')
      .find((row) => row.attributes("data-instrument-key") === "BTCUSDT-PERP.BINANCE")!;
    await reopenedBtcGroup.trigger("click");
    const unresolvedRow = wrapper
      .findAll('[data-testid="catalog-dataset-row"]')
      .find((row) => row.attributes("data-dataset-id") === unresolvedDataset.id);
    expect(unresolvedRow).toBeDefined();
    await unresolvedRow!.trigger("click");
    expect((wrapper.get('[data-testid="catalog-load"]').element as HTMLButtonElement).disabled).toBe(true);
    expect(
      invokeMock.mock.calls.some(([command]) => command === "load_origin"),
    ).toBe(false);
  });

  it("retains the previously published Origin when a replacement load fails", async () => {
    const previous = makeOrigin("origin-existing");
    invokeMock.mockImplementation((command) => {
      if (command === "list_catalog_datasets") return Promise.resolve([dataset]);
      if (command === "get_current_origin") return Promise.resolve(previous);
      if (command === "load_origin") return Promise.reject("replacement failed");
      return Promise.reject(new Error(`Unexpected IPC command: ${command}`));
    });

    const wrapper = mount(App);
    await vi.waitFor(() => expect(wrapper.text()).toContain("origin-existing"));
    await wrapper.get('[data-testid="catalog-load"]').trigger("click");
    await vi.waitFor(() => expect(wrapper.text()).toContain("replacement failed"));
    expect(wrapper.text()).toContain("origin-existing");
    expect(wrapper.text()).toContain("previous Origin remains available");
  });

  it("prevents rapid repeated clicks from overlapping Load commands", async () => {
    let resolveLoad!: (value: OriginDatasetDto) => void;
    invokeMock.mockImplementation((command) => {
      if (command === "list_catalog_datasets") return Promise.resolve([dataset]);
      if (command === "get_current_origin") return Promise.resolve(null);
      if (command === "load_origin") {
        return new Promise<OriginDatasetDto>((resolve) => {
          resolveLoad = resolve;
        });
      }
      return Promise.reject(new Error(`Unexpected IPC command: ${command}`));
    });

    const wrapper = mount(App);
    await vi.waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith("list_catalog_datasets"),
    );
    await vi.waitFor(() => expect(wrapper.find('[data-testid="catalog-dataset-row"]').exists()).toBe(true));
    const button = wrapper.get('[data-testid="catalog-load"]');
    await button.trigger("click");
    await button.trigger("click");
    expect(
      invokeMock.mock.calls.filter(([command]) => command === "load_origin"),
    ).toHaveLength(1);

    resolveLoad(makeOrigin("origin-new"));
    await vi.waitFor(() => expect(wrapper.text()).toContain("origin-new"));
  });
});


const testDataset: TestDatasetDto = {
  testDatasetId: "test-1",
  originDatasetId: "origin-existing",
  instrumentId: dataset.instrumentId!,
  barType: dataset.barType!,
  timeframe: "300s",
  startSbarId: "100",
  endSbarId: "200",
  sbarCount: 2,
  sbarSequenceFingerprint: "test-fingerprint",
};

describe("Test, Run and Snapshot workbench", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a backend-validated Test Dataset and exposes Run controls", async () => {
    const origin = makeOrigin("origin-existing");
    const runState = {
      runId: "run-1",
      testDatasetId: "test-1",
      inputFingerprint: "test-fingerprint",
      inputCount: 2,
      status: "ready",
      processedCount: 0,
      cursorSbarId: null,
      failureDiagnostic: null,
    };
    const snapshot = {
      fileName: "snapshot-1.snapshot.sqlite",
      path: "/snapshots/snapshot-1.snapshot.sqlite",
      kind: "complete",
      snapshotId: "snapshot-1",
      runId: "run-1",
      stateKey: "BTCUSDT-PERP.BINANCE",
      generatedAt: "1780000000000000000",
      checkpointCount: 2,
      diagnostic: null,
    };
    invokeMock.mockImplementation((command) => {
      if (command === "list_catalog_datasets") return Promise.resolve([dataset]);
      if (command === "get_current_origin") return Promise.resolve(origin);
      if (command === "get_current_test_dataset") return Promise.resolve(null);
      if (command === "list_snapshots") return Promise.resolve([snapshot]);
      if (command === "create_test_dataset") return Promise.resolve(testDataset);
      if (command === "start_run") return Promise.resolve(runState);
      return Promise.reject(new Error(`Unexpected IPC command: ${command}`));
    });

    const wrapper = mount(App);
    await vi.waitFor(() => expect(wrapper.text()).toContain("origin-existing"));
    await vi.waitFor(() => expect(wrapper.findAll('[data-testid^="test-dataset-"][data-testid$="-sbar-id"]')).toHaveLength(2));
    const rangeInputs = wrapper.findAll('[data-testid^="test-dataset-"][data-testid$="-sbar-id"]');
    expect((rangeInputs[0].element as HTMLInputElement).value).toBe("100");
    expect((rangeInputs[1].element as HTMLInputElement).value).toBe("200");

    const createButton = wrapper.get('[data-testid="test-dataset-create"]');
    await vi.waitFor(() =>
      expect((createButton!.element as HTMLButtonElement).disabled).toBe(false),
    );
    await createButton!.trigger("click");
    await vi.waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith("create_test_dataset", {
        startSbarId: "100",
        endSbarId: "200",
      }),
    );
    await vi.waitFor(() => expect(wrapper.text()).toContain("test-1"));

    const startButton = wrapper.get('[data-testid="run-start"]');
    expect(startButton).toBeDefined();
    await startButton!.trigger("click");
    await vi.waitFor(() => expect(wrapper.text()).toContain("run-1"));
    await vi.waitFor(() => expect(wrapper.text()).toContain("COMPLETE / VERIFIED"));
    expect(invokeMock).toHaveBeenCalledWith("start_run");
    expect(invokeMock).toHaveBeenCalledWith("list_snapshots");
    expect(wrapper.text()).toContain("0 / 2");
  });

  it("keeps the previously created Test Dataset visible when replacement fails", async () => {
    const origin = makeOrigin("origin-existing");
    let createAttempts = 0;
    invokeMock.mockImplementation((command) => {
      if (command === "list_catalog_datasets") return Promise.resolve([dataset]);
      if (command === "get_current_origin") return Promise.resolve(origin);
      if (command === "get_current_test_dataset") return Promise.resolve(null);
      if (command === "list_snapshots") return Promise.resolve([]);
      if (command === "create_test_dataset") {
        createAttempts += 1;
        return createAttempts === 1
          ? Promise.resolve(testDataset)
          : Promise.reject("replacement interval rejected");
      }
      return Promise.reject(new Error(`Unexpected IPC command: ${command}`));
    });

    const wrapper = mount(App);
    await vi.waitFor(() => expect(wrapper.text()).toContain("origin-existing"));
    const createButton = () => wrapper.get('[data-testid="test-dataset-create"]');
    await createButton()!.trigger("click");
    await vi.waitFor(() => expect(wrapper.text()).toContain("test-1"));
    await createButton()!.trigger("click");
    await vi.waitFor(() => expect(wrapper.text()).toContain("replacement interval rejected"));
    expect(wrapper.text()).toContain("test-1");
  });

  it("rejects Run commands at the page boundary when no Run exists", async () => {
    invokeMock.mockImplementation((command) => {
      if (command === "list_catalog_datasets") return Promise.resolve([dataset]);
      if (command === "get_current_origin") return Promise.resolve(makeOrigin("origin-existing"));
      if (command === "get_current_test_dataset") return Promise.resolve(testDataset);
      if (command === "list_snapshots") return Promise.resolve([]);
      return Promise.reject(new Error(`Unexpected IPC command: ${command}`));
    });

    const wrapper = mount(App);
    await vi.waitFor(() => expect(wrapper.text()).toContain("test-1"));
    const panel = wrapper.getComponent(RunControlPanel);
    for (const command of ["step", "play", "pause", "stop", "dispose"] as const) {
      panel.vm.$emit("command", command);
    }
    await flushPromises();

    const runIpcCommands = [
      "step_run", "play_run", "pause_run", "stop_run", "dispose_run",
    ];
    expect(invokeMock.mock.calls.filter(([command]) =>
      runIpcCommands.includes(String(command)),
    )).toHaveLength(0);
  });

  it("rejects Run commands that are invalid for the confirmed Run status", async () => {
    const readyRun = {
      runId: "run-1",
      testDatasetId: "test-1",
      inputFingerprint: "test-fingerprint",
      inputCount: 2,
      status: "ready",
      processedCount: 0,
      cursorSbarId: null,
      failureDiagnostic: null,
    };
    invokeMock.mockImplementation((command) => {
      if (command === "list_catalog_datasets") return Promise.resolve([dataset]);
      if (command === "get_current_origin") return Promise.resolve(makeOrigin("origin-existing"));
      if (command === "get_current_test_dataset") return Promise.resolve(testDataset);
      if (command === "list_snapshots") return Promise.resolve([]);
      if (command === "get_run_state") return Promise.resolve(readyRun);
      return Promise.reject(new Error(`Unexpected IPC command: ${command}`));
    });

    const wrapper = mount(App);
    await vi.waitFor(() => expect(wrapper.text()).toContain("test-1"));
    await wrapper.get('[data-testid="run-refresh-state"]').trigger("click");
    await vi.waitFor(() => expect(wrapper.text()).toContain("run-1"));
    const panel = wrapper.getComponent(RunControlPanel);
    panel.vm.$emit("command", "pause");
    await flushPromises();
    expect(invokeMock.mock.calls.filter(([command]) => command === "pause_run")).toHaveLength(0);
  });

  it("rejects Step, Play and Dispose while the confirmed Run is running", async () => {
    const runningRun = {
      runId: "run-1",
      testDatasetId: "test-1",
      inputFingerprint: "test-fingerprint",
      inputCount: 2,
      status: "running",
      processedCount: 1,
      cursorSbarId: "100",
      failureDiagnostic: null,
    };
    invokeMock.mockImplementation((command) => {
      if (command === "list_catalog_datasets") return Promise.resolve([dataset]);
      if (command === "get_current_origin") return Promise.resolve(makeOrigin("origin-existing"));
      if (command === "get_current_test_dataset") return Promise.resolve(testDataset);
      if (command === "list_snapshots") return Promise.resolve([]);
      if (command === "get_run_state") return Promise.resolve(runningRun);
      return Promise.reject(new Error(`Unexpected IPC command: ${command}`));
    });

    const wrapper = mount(App);
    await vi.waitFor(() => expect(wrapper.text()).toContain("test-1"));
    await wrapper.get('[data-testid="run-refresh-state"]').trigger("click");
    await vi.waitFor(() => expect(wrapper.text()).toContain("RUNNING"));
    const panel = wrapper.getComponent(RunControlPanel);
    for (const command of ["step", "play", "dispose"] as const) {
      panel.vm.$emit("command", command);
    }
    await flushPromises();
    expect(invokeMock.mock.calls.filter(([command]) =>
      ["step_run", "play_run", "dispose_run"].includes(String(command)),
    )).toHaveLength(0);
  });

  it("reports Run command failures without replacing the last confirmed Run state", async () => {
    const origin = makeOrigin("origin-existing");
    const readyRun = {
      runId: "run-1",
      testDatasetId: "test-1",
      inputFingerprint: "test-fingerprint",
      inputCount: 2,
      status: "ready",
      processedCount: 0,
      cursorSbarId: null,
      failureDiagnostic: null,
    };
    invokeMock.mockImplementation((command) => {
      if (command === "list_catalog_datasets") return Promise.resolve([dataset]);
      if (command === "get_current_origin") return Promise.resolve(origin);
      if (command === "get_current_test_dataset") return Promise.resolve(testDataset);
      if (command === "list_snapshots") return Promise.resolve([]);
      if (command === "get_run_state") return Promise.resolve(readyRun);
      if (command === "step_run") return Promise.reject("step rejected by backend");
      return Promise.reject(new Error(`Unexpected IPC command: ${command}`));
    });

    const wrapper = mount(App);
    await vi.waitFor(() => expect(wrapper.text()).toContain("test-1"));
    const refreshButton = wrapper.get('[data-testid="run-refresh-state"]');
    expect((refreshButton.element as HTMLButtonElement).disabled).toBe(false);
    await refreshButton.trigger("click");
    await vi.waitFor(() => expect(wrapper.text()).toContain("run-1"));
    await wrapper.get('[data-testid="run-step"]').trigger("click");
    await vi.waitFor(() => expect(wrapper.text()).toContain("step rejected by backend"));
    expect(wrapper.text()).toContain("READY");
    expect(invokeMock.mock.calls.filter(([command]) => command === "list_snapshots")).toHaveLength(1);
  });

  it("prevents overlapping Run commands while a command is pending", async () => {
    const origin = makeOrigin("origin-existing");
    let resolveStart!: (value: typeof readyRun) => void;
    const readyRun = {
      runId: "run-1",
      testDatasetId: "test-1",
      inputFingerprint: "test-fingerprint",
      inputCount: 2,
      status: "ready",
      processedCount: 0,
      cursorSbarId: null,
      failureDiagnostic: null,
    };
    invokeMock.mockImplementation((command) => {
      if (command === "list_catalog_datasets") return Promise.resolve([dataset]);
      if (command === "get_current_origin") return Promise.resolve(origin);
      if (command === "get_current_test_dataset") return Promise.resolve(testDataset);
      if (command === "list_snapshots") return Promise.resolve([]);
      if (command === "start_run") return new Promise<typeof readyRun>((resolve) => { resolveStart = resolve; });
      return Promise.reject(new Error(`Unexpected IPC command: ${command}`));
    });

    const wrapper = mount(App);
    await vi.waitFor(() => expect(wrapper.text()).toContain("test-1"));
    const startButton = wrapper.get('[data-testid="run-start"]')!;
    await startButton.trigger("click");
    await startButton.trigger("click");
    expect(invokeMock.mock.calls.filter(([command]) => command === "start_run")).toHaveLength(1);
    resolveStart(readyRun);
    await vi.waitFor(() => expect(wrapper.text()).toContain("run-1"));
  });

});

describe("startup and user-operation coordination", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not let delayed startup initialization overwrite a Test Dataset created after Load", async () => {
    let resolveSnapshots!: (value: unknown[]) => void;
    const pendingSnapshots = new Promise<unknown[]>((resolve) => {
      resolveSnapshots = resolve;
    });
    const loadedOrigin = makeOrigin("origin-new");
    const createdTestDataset: TestDatasetDto = {
      ...testDataset,
      originDatasetId: "origin-new",
    };

    invokeMock.mockImplementation((command) => {
      if (command === "list_catalog_datasets") return Promise.resolve([dataset]);
      if (command === "get_current_origin") return Promise.resolve(null);
      if (command === "list_snapshots") return pendingSnapshots;
      if (command === "load_origin") return Promise.resolve(loadedOrigin);
      if (command === "get_current_test_dataset") return Promise.resolve(null);
      if (command === "create_test_dataset") return Promise.resolve(createdTestDataset);
      return Promise.reject(new Error(`Unexpected IPC command: ${command}`));
    });

    const wrapper = mount(App);
    await vi.waitFor(() => expect(wrapper.find('[data-testid="catalog-dataset-row"]').exists()).toBe(true));

    await wrapper.get('[data-testid="catalog-load"]').trigger("click");
    await vi.waitFor(() => expect(wrapper.text()).toContain("origin-new"));
    const createButton = wrapper.get('[data-testid="test-dataset-create"]');
    await vi.waitFor(() => expect((createButton!.element as HTMLButtonElement).disabled).toBe(false));
    await createButton!.trigger("click");
    await vi.waitFor(() => expect(wrapper.text()).toContain("test-1"));

    // Let startup's slower Snapshot read finish only after the user mutation.
    resolveSnapshots([]);
    await flushPromises();

    expect(wrapper.text()).toContain("test-1");
    expect(
      invokeMock.mock.calls.filter(([command]) => command === "get_current_test_dataset"),
    ).toHaveLength(1);
  });

  it("blocks Run start while Origin Load is pending", async () => {
    let resolveLoad!: (value: OriginDatasetDto) => void;
    const pendingLoad = new Promise<OriginDatasetDto>((resolve) => { resolveLoad = resolve; });
    invokeMock.mockImplementation((command) => {
      if (command === "list_catalog_datasets") return Promise.resolve([dataset]);
      if (command === "get_current_origin") return Promise.resolve(makeOrigin("origin-existing"));
      if (command === "get_current_test_dataset") return Promise.resolve(testDataset);
      if (command === "list_snapshots") return Promise.resolve([]);
      if (command === "load_origin") return pendingLoad;
      return Promise.reject(new Error(`Unexpected IPC command: ${command}`));
    });

    const wrapper = mount(App);
    await vi.waitFor(() => expect(wrapper.text()).toContain("test-1"));
    await wrapper.get('[data-testid="catalog-load"]').trigger("click");
    await vi.waitFor(() => expect(invokeMock).toHaveBeenCalledWith("load_origin", {
      datasetId: dataset.id,
      enableStructure: true,
    }));
    const startButton = wrapper.get('[data-testid="run-start"]')!;
    expect((startButton.element as HTMLButtonElement).disabled).toBe(true);

    wrapper.getComponent(RunControlPanel).vm.$emit("command", "start");
    wrapper.getComponent(RunControlPanel).vm.$emit("command", "restart");
    expect(invokeMock.mock.calls.filter(([command]) =>
      command === "start_run" || command === "restart_run",
    )).toHaveLength(0);

    resolveLoad(makeOrigin("origin-reloaded"));
    await vi.waitFor(() => expect(wrapper.text()).toContain("origin-reloaded"));
  });

  it("blocks Origin Load while a non-disposed Run exists", async () => {
    const readyRun = {
      runId: "run-1",
      testDatasetId: "test-1",
      inputFingerprint: "test-fingerprint",
      inputCount: 2,
      status: "ready",
      processedCount: 0,
      cursorSbarId: null,
      failureDiagnostic: null,
    };
    invokeMock.mockImplementation((command) => {
      if (command === "list_catalog_datasets") return Promise.resolve([dataset]);
      if (command === "get_current_origin") return Promise.resolve(makeOrigin("origin-existing"));
      if (command === "get_current_test_dataset") return Promise.resolve(testDataset);
      if (command === "list_snapshots") return Promise.resolve([]);
      if (command === "get_run_state") return Promise.resolve(readyRun);
      return Promise.reject(new Error(`Unexpected IPC command: ${command}`));
    });

    const wrapper = mount(App);
    await vi.waitFor(() => expect(wrapper.text()).toContain("test-1"));
    await wrapper.get('[data-testid="run-refresh-state"]').trigger("click");
    await vi.waitFor(() => expect(wrapper.text()).toContain("run-1"));
    const loadButton = wrapper.find('[data-testid="catalog-load"]');
    expect((loadButton.element as HTMLButtonElement).disabled).toBe(true);
    await loadButton.trigger("click");
    expect(invokeMock.mock.calls.filter(([command]) => command === "load_origin")).toHaveLength(0);
  });

  it("blocks Test Dataset replacement while a Run command is pending", async () => {
    let resolveStart!: (value: unknown) => void;
    const pendingStart = new Promise((resolve) => { resolveStart = resolve; });
    invokeMock.mockImplementation((command) => {
      if (command === "list_catalog_datasets") return Promise.resolve([dataset]);
      if (command === "get_current_origin") return Promise.resolve(makeOrigin("origin-existing"));
      if (command === "get_current_test_dataset") return Promise.resolve(testDataset);
      if (command === "list_snapshots") return Promise.resolve([]);
      if (command === "start_run") return pendingStart;
      return Promise.reject(new Error(`Unexpected IPC command: ${command}`));
    });

    const wrapper = mount(App);
    await vi.waitFor(() => expect(wrapper.text()).toContain("test-1"));
    const startButton = wrapper.get('[data-testid="run-start"]')!;
    await startButton.trigger("click");
    await vi.waitFor(() => expect(invokeMock).toHaveBeenCalledWith("start_run"));

    const replaceButton = wrapper.get('[data-testid="test-dataset-create"]');
    expect((replaceButton.element as HTMLButtonElement).disabled).toBe(true);
    expect(invokeMock.mock.calls.filter(([command]) => command === "create_test_dataset")).toHaveLength(0);

    resolveStart({
      runId: "run-1",
      testDatasetId: "test-1",
      inputFingerprint: "test-fingerprint",
      inputCount: 2,
      status: "ready",
      processedCount: 0,
      cursorSbarId: null,
      failureDiagnostic: null,
    });
    await vi.waitFor(() => expect(wrapper.text()).toContain("run-1"));
  });

  it("blocks Origin Load while Test Dataset replacement is pending", async () => {
    let resolveCreate!: (value: TestDatasetDto) => void;
    const pendingCreate = new Promise<TestDatasetDto>((resolve) => { resolveCreate = resolve; });
    invokeMock.mockImplementation((command) => {
      if (command === "list_catalog_datasets") return Promise.resolve([dataset]);
      if (command === "get_current_origin") return Promise.resolve(makeOrigin("origin-existing"));
      if (command === "get_current_test_dataset") return Promise.resolve(testDataset);
      if (command === "list_snapshots") return Promise.resolve([]);
      if (command === "create_test_dataset") return pendingCreate;
      return Promise.reject(new Error(`Unexpected IPC command: ${command}`));
    });

    const wrapper = mount(App);
    await vi.waitFor(() => expect(wrapper.text()).toContain("test-1"));
    const replaceButton = wrapper.get('[data-testid="test-dataset-create"]');
    await replaceButton.trigger("click");
    await vi.waitFor(() => expect(invokeMock).toHaveBeenCalledWith("create_test_dataset", {
      startSbarId: "100",
      endSbarId: "200",
    }));

    const loadButton = wrapper.find('[data-testid="catalog-load"]');
    expect((loadButton.element as HTMLButtonElement).disabled).toBe(true);
    await loadButton.trigger("click");
    expect(invokeMock.mock.calls.filter(([command]) => command === "load_origin")).toHaveLength(0);

    resolveCreate({ ...testDataset, testDatasetId: "test-replaced" });
    await vi.waitFor(() => expect(wrapper.text()).toContain("test-replaced"));
  });

  it("blocks Run start while Test Dataset replacement is pending", async () => {
    let resolveCreate!: (value: TestDatasetDto) => void;
    const pendingCreate = new Promise<TestDatasetDto>((resolve) => { resolveCreate = resolve; });
    invokeMock.mockImplementation((command) => {
      if (command === "list_catalog_datasets") return Promise.resolve([dataset]);
      if (command === "get_current_origin") return Promise.resolve(makeOrigin("origin-existing"));
      if (command === "get_current_test_dataset") return Promise.resolve(testDataset);
      if (command === "list_snapshots") return Promise.resolve([]);
      if (command === "create_test_dataset") return pendingCreate;
      return Promise.reject(new Error(`Unexpected IPC command: ${command}`));
    });

    const wrapper = mount(App);
    await vi.waitFor(() => expect(wrapper.text()).toContain("test-1"));
    const replaceButton = wrapper.get('[data-testid="test-dataset-create"]');
    await replaceButton.trigger("click");
    await vi.waitFor(() => expect(invokeMock).toHaveBeenCalledWith("create_test_dataset", {
      startSbarId: "100",
      endSbarId: "200",
    }));

    const startButton = wrapper.get('[data-testid="run-start"]')!;
    expect((startButton.element as HTMLButtonElement).disabled).toBe(true);

    wrapper.getComponent(RunControlPanel).vm.$emit("command", "start");
    wrapper.getComponent(RunControlPanel).vm.$emit("command", "restart");
    expect(invokeMock.mock.calls.filter(([command]) =>
      command === "start_run" || command === "restart_run",
    )).toHaveLength(0);

    resolveCreate({ ...testDataset, testDatasetId: "test-replaced" });
    await vi.waitFor(() => expect(wrapper.text()).toContain("test-replaced"));
  });
});
