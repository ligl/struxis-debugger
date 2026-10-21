import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../../src/App.vue";
import RunControlPanel from "../../src/components/RunControlPanel.vue";
import type { CatalogDatasetEntry, OriginDatasetDto, SnapshotArtifactDto, SnapshotCompareResultDto, TestDatasetDto } from "../../src/origin-types";

const ipc = vi.hoisted(() => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: ipc.invoke,
}));

// App integration tests exercise page-level coordination, not the browser-only chart lifecycle.
// Keep the chart stub local to this suite so Vue Test Utils global configuration cannot leak to other tests.
function mountApp() {
  return mount(App, {
    global: {
      stubs: {
        OriginPanel: {
          template: '<section data-testid="origin-panel-test-stub"><h3>Current Origin</h3><span>{{ origin?.originDatasetId ?? "No validated Origin Dataset" }}</span><span>{{ loadStatus }}</span><span v-if="origin">{{ origin.enableStructure ? "ENABLED" : "DISABLED" }}</span><span v-if="loadError">{{ loadError }}</span><small v-if="origin && loadError">The previous Origin remains available and unchanged.</small></section>',
          props: ["origin", "loadStatus", "loadError", "formatTimestamp"],
        },
        OriginChart: {
          template: '<section data-testid="origin-chart-test-stub"><h3>Origin SBar chart</h3><button v-if="bars.length > 0" data-testid="origin-sbar-click-100" @click="$emit(\'sbar-click\', \'100\')">Select SBar 100</button><button v-if="bars.length > 1" data-testid="origin-sbar-click-200" @click="$emit(\'sbar-click\', \'200\')">Select SBar 200</button></section>',
          props: ["bars", "originDatasetId"],
        },
        RunChart: {
          template: '<section data-testid="run-chart-test-stub"><h3>Test Dataset SBar chart</h3></section>',
          props: ["origin", "testDataset"],
        },
      },
    },
  });
}

async function selectOriginRange(wrapper: ReturnType<typeof mountApp>): Promise<void> {
  await wrapper.get('[data-testid="origin-sbar-click-100"]').trigger("click");
  await wrapper.get('[data-testid="origin-sbar-click-200"]').trigger("click");
}

const invokeMock = ipc.invoke;

enableAutoUnmount(afterEach);

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

    const wrapper = mountApp();
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
    expect(wrapper.text()).toContain("Origin SBar chart");
  });

  it("inspects exact SBar fields from the selected validated Origin bar", async () => {
    const origin = makeOrigin("origin-inspector");
    invokeMock.mockImplementation((command) => {
      if (command === "list_catalog_datasets") return Promise.resolve([dataset]);
      if (command === "get_current_origin") return Promise.resolve(origin);
      if (command === "get_current_test_dataset") return Promise.resolve(null);
      if (command === "list_snapshots") return Promise.resolve([]);
      return Promise.reject(new Error(`Unexpected IPC command: ${command}`));
    });

    const wrapper = mountApp();
    await vi.waitFor(() => expect(wrapper.text()).toContain("origin-inspector"));
    await wrapper.get('[data-testid="origin-sbar-click-200"]').trigger("click");

    expect(wrapper.get('[data-testid="inspector-sbar-id"]').text()).toBe("200");
    expect(wrapper.get('[data-testid="inspector-sbar-open"]').text()).toBe("11.00");
    expect(wrapper.get('[data-testid="inspector-sbar-high"]').text()).toBe("13.00");
    expect(wrapper.get('[data-testid="inspector-sbar-low"]').text()).toBe("10.00");
    expect(wrapper.get('[data-testid="inspector-sbar-close"]').text()).toBe("12.00");
    expect(wrapper.get('[data-testid="inspector-sbar-volume"]').text()).toBe("120");
    expect(wrapper.text()).toContain("Values shown verbatim from the validated Origin SBar projection");

    await wrapper.get('[data-testid="workspace-replay"]').trigger("click");
    expect(wrapper.get('[data-testid="inspector-empty"]').text()).toContain(
      "Step or Play a Run to inspect its first backend-confirmed Struxis checkpoint",
    );
    expect(wrapper.find('[data-testid="inspector-sbar-id"]').exists()).toBe(false);
  });


  it("loads the backend-confirmed Replay checkpoint and selects authoritative CBar and Swing objects", async () => {
    const readyRun = {
      runId: "run-replay-inspector",
      testDatasetId: "test-1",
      inputFingerprint: "test-fingerprint",
      inputCount: 2,
      status: "ready",
      processedCount: 0,
      cursorSbarId: null,
      failureDiagnostic: null,
    };
    const pausedRun = {
      ...readyRun,
      status: "paused",
      processedCount: 1,
      cursorSbarId: "100",
    };
    const replayInspector = {
      stateKey: "BTCUSDT-PERP.BINANCE",
      checkpointIndex: 0,
      sbarId: "100",
      sbar: {
        sbarId: "100",
        barType: dataset.barType!,
        tsEvent: "100",
        tsInit: "101",
        open: "10.00",
        high: "12.00",
        low: "9.00",
        close: "11.00",
        volume: "100",
        body: "1.00",
        upperShadow: "1.00",
        lowerShadow: "1.00",
        totalRange: "3.00",
        bodyRatio: 0.333,
        shadowRatio: 0.667,
        direction: "Bullish",
      },
      structure: {
        cbarCount: 1,
        cbars: [{
          cbarId: "100",
          high: "12.00",
          low: "9.00",
          sbarStartId: "100",
          sbarEndId: "100",
          spanSbars: 1,
          fractalType: null,
          createdAt: "1",
        }],
        swingCount: 1,
        swings: [{
          swingId: "100",
          direction: "Up",
          high: "12.00",
          low: "9.00",
          cbarStartId: "100",
          cbarEndId: "100",
          sbarStartId: "100",
          sbarEndId: "100",
          startOi: null,
          endOi: null,
          volume: "100",
          spanSbars: 1,
          state: "Extending",
          createdAt: "1",
          updatedAt: "1",
        }],
      },
    };
    invokeMock.mockImplementation((command) => {
      if (command === "list_catalog_datasets") return Promise.resolve([dataset]);
      if (command === "get_current_origin") return Promise.resolve(makeOrigin("origin-existing"));
      if (command === "get_current_test_dataset") return Promise.resolve(testDataset);
      if (command === "list_snapshots") return Promise.resolve([]);
      if (command === "get_run_state") return Promise.resolve(readyRun);
      if (command === "step_run") return Promise.resolve(pausedRun);
      if (command === "get_replay_inspector") return Promise.resolve(replayInspector);
      return Promise.reject(new Error(`Unexpected IPC command: ${command}`));
    });

    const wrapper = mountApp();
    await vi.waitFor(() => expect(wrapper.text()).toContain("test-1"));
    await wrapper.get('[data-testid="workspace-replay"]').trigger("click");
    await wrapper.get('[data-testid="run-refresh-state"]').trigger("click");
    await vi.waitFor(() => expect(wrapper.text()).toContain("READY"));
    await vi.waitFor(() => {
      expect((wrapper.get('[data-testid="run-step"]').element as HTMLButtonElement).disabled).toBe(false);
    });
    await wrapper.get('[data-testid="run-step"]').trigger("click");
    await vi.waitFor(() => expect(wrapper.get('[data-testid="inspector-replay-checkpoint"]').text()).toBe("0"));

    expect(wrapper.get('[data-testid="inspector-replay-sbar-id"]').text()).toBe("100");
    expect(wrapper.get('[data-testid="inspector-replay-cbars"]').text()).toContain("100");
    expect(wrapper.get('[data-testid="inspector-replay-swings"]').text()).toContain("Extending");
    expect(invokeMock).toHaveBeenCalledWith("get_replay_inspector");

    await wrapper.get('[data-testid="inspector-select-swing-100"]').trigger("click");
    expect(wrapper.get('[data-testid="inspector-replay-selected-swing"]').text()).toContain("Extending");
    expect(wrapper.get('[data-testid="inspector-replay-selected-swing"]').text()).toContain("12.00");

    await wrapper.get('[data-testid="inspector-select-cbar-100"]').trigger("click");
    expect(wrapper.get('[data-testid="inspector-replay-selected-cbar"]').text()).toContain("fractalType");
    expect(wrapper.get('[data-testid="inspector-replay-selected-cbar"]').text()).toContain("null");
    expect(wrapper.text()).toContain("copied from the latest backend-confirmed Struxis checkpoint");
  });

  it("links a selected Compare difference to the Inspector and clears it when leaving Compare", async () => {
    const snapshots: SnapshotArtifactDto[] = [
      {
        fileName: "baseline.snapshot.sqlite",
        path: "/snapshots/baseline.snapshot.sqlite",
        kind: "complete",
        snapshotId: "snapshot-baseline",
        runId: "run-baseline",
        stateKey: "state-key",
        generatedAt: "1000",
        checkpointCount: 2,
        diagnostic: null,
      },
      {
        fileName: "candidate.snapshot.sqlite",
        path: "/snapshots/candidate.snapshot.sqlite",
        kind: "complete",
        snapshotId: "snapshot-candidate",
        runId: "run-candidate",
        stateKey: "state-key",
        generatedAt: "2000",
        checkpointCount: 2,
        diagnostic: null,
      },
    ];
    const compareResult: SnapshotCompareResultDto = {
      baseline: {
        snapshotId: "snapshot-baseline",
        runId: "run-baseline",
        stateKey: "state-key",
        instrumentId: dataset.instrumentId!,
        barType: dataset.barType!,
        snapshotGeneratedAt: "1000",
        inputBarCount: 2,
        sbarSequenceFingerprint: "same-input",
        configFingerprint: "baseline-config",
        effectiveConfig: "{}",
      },
      candidate: {
        snapshotId: "snapshot-candidate",
        runId: "run-candidate",
        stateKey: "state-key",
        instrumentId: dataset.instrumentId!,
        barType: dataset.barType!,
        snapshotGeneratedAt: "2000",
        inputBarCount: 2,
        sbarSequenceFingerprint: "same-input",
        configFingerprint: "candidate-config",
        effectiveConfig: "{}",
      },
      checkpointCount: 2,
      checkpoints: [{ checkpointIndex: 1, sbarId: "200", tsEvent: "200", differenceCount: 1 }],
      differences: [{
        checkpointIndex: 1,
        sbarId: "200",
        objectType: "Swing",
        kind: "modified",
        objectId: "swing-123",
        properties: [{ field: "high", baselineValue: "13.00", candidateValue: "14.00" }],
      }],
      firstStructuralDivergence: { checkpointIndex: 1, sbarId: "200", tsEvent: "200", differenceCount: 1 },
      diagnosticsDifferences: [],
      firstDiagnosticsDivergence: null,
    };

    invokeMock.mockImplementation((command) => {
      if (command === "list_catalog_datasets") return Promise.resolve([dataset]);
      if (command === "get_current_origin") return Promise.resolve(null);
      if (command === "get_current_test_dataset") return Promise.resolve(null);
      if (command === "list_snapshots") return Promise.resolve(snapshots);
      if (command === "compare_snapshots") return Promise.resolve(compareResult);
      return Promise.reject(new Error(`Unexpected IPC command: ${command}`));
    });

    const wrapper = mountApp();
    await vi.waitFor(() => expect(wrapper.text()).toContain("snapshot-baseline"));
    await wrapper.get('[data-testid="workspace-compare"]').trigger("click");
    await wrapper.get(".compare-controls .primary-button").trigger("click");
    await vi.waitFor(() => expect(invokeMock).toHaveBeenCalledWith("compare_snapshots", {
      baselineSnapshotId: "snapshot-baseline",
      candidateSnapshotId: "snapshot-candidate",
    }));
    await vi.waitFor(() => expect(wrapper.find('[data-testid="compare-select-difference-0"]').exists()).toBe(true));

    await wrapper.get('[data-testid="compare-select-difference-0"]').trigger("click");
    expect(wrapper.get('[data-testid="inspector-difference-object-id"]').text()).toBe("swing-123");
    expect(wrapper.get('[data-testid="inspector-baseline-snapshot"]').text()).toBe("snapshot-baseline");
    expect(wrapper.get('[data-testid="inspector-candidate-snapshot"]').text()).toBe("snapshot-candidate");
    expect(wrapper.get('[data-testid="inspector-difference-checkpoint"]').text()).toBe("1");
    expect(wrapper.get('[data-testid="inspector-difference-sbar-id"]').text()).toBe("200");
    expect(wrapper.get('[data-testid="inspector-difference-properties"]').text()).toContain("13.00");
    expect(wrapper.get('[data-testid="inspector-difference-properties"]').text()).toContain("14.00");
    expect(wrapper.get('[data-testid="compare-difference-row-0"]').classes()).toContain("difference-row-selected");

    await wrapper.get('[data-testid="workspace-replay"]').trigger("click");
    await wrapper.get('[data-testid="workspace-compare"]').trigger("click");
    expect(wrapper.find('[data-testid="inspector-difference-object-id"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="inspector-empty"]').text()).toContain("Select an object difference");
  });

  it("maps a disabled structure checkbox to enableStructure=false and renders the returned mode", async () => {
    const origin = makeOrigin("origin-without-structure", false);
    invokeMock.mockImplementation((command) => {
      if (command === "list_catalog_datasets") return Promise.resolve([dataset]);
      if (command === "get_current_origin") return Promise.resolve(null);
      if (command === "load_origin") return Promise.resolve(origin);
      return Promise.reject(new Error(`Unexpected IPC command: ${command}`));
    });

    const wrapper = mountApp();
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

    const wrapper = mountApp();
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

    const wrapper = mountApp();
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

    const wrapper = mountApp();
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

  it("uses Dataset and Replay workspaces with independent Origin and Run charts", async () => {
    const origin = makeOrigin("origin-existing");
    invokeMock.mockImplementation((command) => {
      if (command === "list_catalog_datasets") return Promise.resolve([dataset]);
      if (command === "get_current_origin") return Promise.resolve(origin);
      if (command === "get_current_test_dataset") return Promise.resolve(null);
      if (command === "list_snapshots") return Promise.resolve([]);
      return Promise.reject(new Error(`Unexpected IPC command: ${command}`));
    });

    const wrapper = mountApp();
    await vi.waitFor(() => expect(wrapper.find('[data-testid="origin-chart-test-stub"]').exists()).toBe(true));
    expect(wrapper.findAll('[data-testid="origin-chart-test-stub"]')).toHaveLength(1);
    expect(wrapper.findAll(".workspace-tab").map((tab) => tab.text())).toEqual([
      "01 / Dataset",
      "02 / Replay",
      "03 / Compare",
    ]);
    expect(wrapper.find('[data-testid="catalog-rail"]').exists()).toBe(true);

    expect(wrapper.find('[data-testid="run-chart-test-stub"]').exists()).toBe(false);
    await wrapper.get('[data-testid="workspace-replay"]').trigger("click");
    expect(wrapper.find('[data-testid="catalog-rail"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="origin-chart-test-stub"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="run-chart-test-stub"]').exists()).toBe(true);
    expect(wrapper.findAll('[data-testid="run-chart-test-stub"]')).toHaveLength(1);
    expect(wrapper.get(".workflow-toolbar h2").text()).toBe("Run Replay");
  });

  it("supports keyboard resizing for the Inspector and Diagnostics docks", async () => {
    invokeMock.mockImplementation((command) => {
      if (command === "list_catalog_datasets") return Promise.resolve([dataset]);
      if (command === "get_current_origin") return Promise.resolve(null);
      if (command === "get_current_test_dataset") return Promise.resolve(null);
      if (command === "list_snapshots") return Promise.resolve([]);
      return Promise.reject(new Error(`Unexpected IPC command: ${command}`));
    });

    const wrapper = mountApp();
    await flushPromises();

    const inspectorSplitter = wrapper.get('[data-testid="inspector-resize-edge"]');
    expect(inspectorSplitter.attributes("tabindex")).toBe("0");
    expect(inspectorSplitter.attributes("aria-valuenow")).toBe("282");
    await inspectorSplitter.trigger("keydown", { key: "ArrowLeft" });
    expect(inspectorSplitter.attributes("aria-valuenow")).toBe("294");
    expect(wrapper.get('[data-testid="debugger-shell"]').attributes("style")).toContain("--inspector-width: 294px");

    const diagnosticsSplitter = wrapper.get('[data-testid="diagnostics-resize-edge"]');
    expect(diagnosticsSplitter.attributes("aria-valuenow")).toBe("164");
    await diagnosticsSplitter.trigger("keydown", { key: "ArrowUp" });
    expect(diagnosticsSplitter.attributes("aria-valuenow")).toBe("176");
    expect(wrapper.get('[data-testid="debugger-shell"]').attributes("style")).toContain("--diagnostics-height: 176px");
  });

  it("exposes explicit docking choices for both panels", async () => {
    invokeMock.mockImplementation((command) => {
      if (command === "list_catalog_datasets") return Promise.resolve([dataset]);
      if (command === "get_current_origin") return Promise.resolve(null);
      if (command === "get_current_test_dataset") return Promise.resolve(null);
      if (command === "list_snapshots") return Promise.resolve([]);
      return Promise.reject(new Error(`Unexpected IPC command: ${command}`));
    });
    const wrapper = mountApp();
    await flushPromises();
    for (const direction of ["left", "right", "top", "bottom"] as const) {
      await wrapper.get(`[data-testid="inspector-dock-${direction}"]`).trigger("click");
      expect(wrapper.get('[data-testid="inspector-panel"]').classes()).toContain(`inspector-dock-${direction}`);
    }
    for (const direction of ["left", "right", "top", "bottom"] as const) {
      await wrapper.get(`[data-testid="diagnostics-dock-${direction}"]`).trigger("click");
      expect(wrapper.get('[data-testid="workbench"]').classes()).toContain(`diagnostics-dock-${direction}`);
    }
  });

  it("supports dragging panel titlebars to the corresponding docking edge", async () => {
    invokeMock.mockImplementation((command) => {
      if (command === "list_catalog_datasets") return Promise.resolve([dataset]);
      if (command === "get_current_origin") return Promise.resolve(null);
      if (command === "get_current_test_dataset") return Promise.resolve(null);
      if (command === "list_snapshots") return Promise.resolve([]);
      return Promise.reject(new Error(`Unexpected IPC command: ${command}`));
    });
    const wrapper = mountApp();
    await flushPromises();

    let draggedPanel = "";
    const dataTransfer = {
      effectAllowed: "move",
      dropEffect: "none",
      setData: (_type: string, value: string) => { draggedPanel = value; },
      getData: (_type: string) => draggedPanel,
    };

    await wrapper.get('[data-testid="inspector-dock-drag-handle"]').trigger("dragstart", { dataTransfer });
    await wrapper.get('[data-testid="workbench"]').trigger("dragover", { dataTransfer });
    await wrapper.get('[data-testid="workbench"]').trigger("drop", { dataTransfer, clientX: -1 });
    expect(wrapper.get('[data-testid="inspector-panel"]').classes()).toContain("inspector-dock-left");

    await wrapper.get('[data-testid="diagnostics-dock-drag-handle"]').trigger("dragstart", { dataTransfer });
    await wrapper.get('[data-testid="workbench"]').trigger("dragover", { dataTransfer });
    await wrapper.get('[data-testid="workbench"]').trigger("drop", { dataTransfer, clientX: 0.5, clientY: -1 });
    expect(wrapper.get('[data-testid="workbench"]').classes()).toContain("diagnostics-dock-top");
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

    const wrapper = mountApp();
    await vi.waitFor(() => expect(wrapper.text()).toContain("origin-existing"));
    await selectOriginRange(wrapper);
    await vi.waitFor(() => expect(wrapper.text()).toContain("Selected 2 SBars: 100 → 200 (inclusive)."));

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

    const wrapper = mountApp();
    await vi.waitFor(() => expect(wrapper.text()).toContain("origin-existing"));
    const createButton = () => wrapper.get('[data-testid="test-dataset-create"]');
    await selectOriginRange(wrapper);
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

    const wrapper = mountApp();
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

    const wrapper = mountApp();
    await vi.waitFor(() => expect(wrapper.text()).toContain("test-1"));
    await wrapper.get('[data-testid="run-refresh-state"]').trigger("click");
    await vi.waitFor(() => expect(wrapper.text()).toContain("run-1"));
    const readySpaceEvent = new KeyboardEvent("keydown", {
      key: " ",
      code: "Space",
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(readySpaceEvent);
    expect(readySpaceEvent.defaultPrevented).toBe(false);
    const panel = wrapper.getComponent(RunControlPanel);
    panel.vm.$emit("command", "pause");
    await flushPromises();
    expect(invokeMock.mock.calls.filter(([command]) =>
      command === "pause_run" || command === "play_run",
    )).toHaveLength(0);
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

    const wrapper = mountApp();
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

  it("maps Space to Pause and Play using the backend-confirmed Run status", async () => {
    let status: "running" | "paused" = "running";
    const runState = () => ({
      runId: "run-space",
      testDatasetId: "test-1",
      inputFingerprint: "test-fingerprint",
      inputCount: 2,
      status,
      processedCount: 1,
      cursorSbarId: "100",
      failureDiagnostic: null,
    });
    invokeMock.mockImplementation((command) => {
      if (command === "list_catalog_datasets") return Promise.resolve([dataset]);
      if (command === "get_current_origin") return Promise.resolve(makeOrigin("origin-existing"));
      if (command === "get_current_test_dataset") return Promise.resolve(testDataset);
      if (command === "list_snapshots") return Promise.resolve([]);
      if (command === "get_run_state") return Promise.resolve(runState());
      if (command === "pause_run") {
        status = "paused";
        return Promise.resolve(runState());
      }
      if (command === "play_run") {
        status = "running";
        return Promise.resolve(runState());
      }
      return Promise.reject(new Error(`Unexpected IPC command: ${command}`));
    });

    const wrapper = mountApp();
    await vi.waitFor(() => expect(wrapper.text()).toContain("test-1"));
    await wrapper.get('[data-testid="run-refresh-state"]').trigger("click");
    await vi.waitFor(() => expect(wrapper.text()).toContain("RUNNING"));

    const pauseEvent = new KeyboardEvent("keydown", {
      key: " ",
      code: "Space",
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(pauseEvent);
    expect(pauseEvent.defaultPrevented).toBe(true);
    await vi.waitFor(() => expect(invokeMock).toHaveBeenCalledWith("pause_run"));
    await vi.waitFor(() => expect(wrapper.text()).toContain("PAUSED"));

    const playEvent = new KeyboardEvent("keydown", {
      key: " ",
      code: "Space",
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(playEvent);
    expect(playEvent.defaultPrevented).toBe(true);
    await vi.waitFor(() => expect(invokeMock).toHaveBeenCalledWith("play_run"));
    await vi.waitFor(() => expect(wrapper.text()).toContain("RUNNING"));
    expect(invokeMock.mock.calls.filter(([command]) =>
      command === "pause_run" || command === "play_run",
    )).toHaveLength(2);
  });

  it("ignores Space without an eligible Run, for repeat events, and from interactive controls", async () => {
    invokeMock.mockImplementation((command) => {
      if (command === "list_catalog_datasets") return Promise.resolve([dataset]);
      if (command === "get_current_origin") return Promise.resolve(makeOrigin("origin-existing"));
      if (command === "get_current_test_dataset") return Promise.resolve(testDataset);
      if (command === "list_snapshots") return Promise.resolve([]);
      if (command === "get_run_state") {
        return Promise.resolve({
          runId: "run-space",
          testDatasetId: "test-1",
          inputFingerprint: "test-fingerprint",
          inputCount: 2,
          status: "running",
          processedCount: 1,
          cursorSbarId: "100",
          failureDiagnostic: null,
        });
      }
      return Promise.reject(new Error(`Unexpected IPC command: ${command}`));
    });

    const wrapper = mountApp();
    await vi.waitFor(() => expect(wrapper.text()).toContain("test-1"));

    const noRunEvent = new KeyboardEvent("keydown", {
      key: " ",
      code: "Space",
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(noRunEvent);
    expect(noRunEvent.defaultPrevented).toBe(false);

    await wrapper.get('[data-testid="run-refresh-state"]').trigger("click");
    await vi.waitFor(() => expect(wrapper.text()).toContain("RUNNING"));

    const repeatedEvent = new KeyboardEvent("keydown", {
      key: " ",
      code: "Space",
      repeat: true,
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(repeatedEvent);
    expect(repeatedEvent.defaultPrevented).toBe(false);

    const input = wrapper.get("input");
    (input.element as HTMLInputElement).focus();
    const inputEvent = new KeyboardEvent("keydown", {
      key: " ",
      code: "Space",
      bubbles: true,
      cancelable: true,
    });
    input.element.dispatchEvent(inputEvent);
    expect(inputEvent.defaultPrevented).toBe(false);

    const button = wrapper.get("button.workspace-tab");
    (button.element as HTMLButtonElement).focus();
    const buttonEvent = new KeyboardEvent("keydown", {
      key: " ",
      code: "Space",
      bubbles: true,
      cancelable: true,
    });
    button.element.dispatchEvent(buttonEvent);
    expect(buttonEvent.defaultPrevented).toBe(false);

    expect(invokeMock.mock.calls.filter(([command]) =>
      command === "pause_run" || command === "play_run",
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

    const wrapper = mountApp();
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

    const wrapper = mountApp();
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

    const wrapper = mountApp();
    await vi.waitFor(() => expect(wrapper.find('[data-testid="catalog-dataset-row"]').exists()).toBe(true));

    await wrapper.get('[data-testid="catalog-load"]').trigger("click");
    await vi.waitFor(() => expect(wrapper.text()).toContain("origin-new"));
    await selectOriginRange(wrapper);
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

    const wrapper = mountApp();
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

    const wrapper = mountApp();
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

    const wrapper = mountApp();
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

    const wrapper = mountApp();
    await vi.waitFor(() => expect(wrapper.text()).toContain("test-1"));
    const replaceButton = wrapper.get('[data-testid="test-dataset-create"]');
    await selectOriginRange(wrapper);
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

    const wrapper = mountApp();
    await vi.waitFor(() => expect(wrapper.text()).toContain("test-1"));
    const replaceButton = wrapper.get('[data-testid="test-dataset-create"]');
    await selectOriginRange(wrapper);
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


describe("dual chart workspaces", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInitialIpc();
  });

  it("renders separate Replay and Compare chart roles with explicit projection gaps", async () => {
    const wrapper = mountApp();
    await flushPromises();

    await wrapper.get('[data-testid="workspace-replay"]').trigger("click");
    expect(wrapper.find('[data-testid="dual-chart-stack-replay"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="replay-upper-chart-track"]').find('[data-testid="run-chart-test-stub"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="snapshot-reference-panel"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="replay-chart-splitter"]').attributes("role")).toBe("separator");

    await wrapper.get('[data-testid="workspace-compare"]').trigger("click");
    expect(wrapper.find('[data-testid="dual-chart-stack-compare"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="compare-candidate-chart"]').text()).toContain("Candidate");
    expect(wrapper.get('[data-testid="compare-baseline-chart"]').text()).toContain("Baseline");
    expect(wrapper.get('[data-testid="compare-chart-splitter"]').attributes("role")).toBe("separator");
    expect(wrapper.text()).toContain("NO SYNTHETIC MARKET DATA");
  });
});
