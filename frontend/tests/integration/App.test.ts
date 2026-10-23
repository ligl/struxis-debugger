import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../../src/App.vue";
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
          props: ["origin", "loadStatus", "loadError", "formatDomainTimestamp"],
        },
        OriginChart: {
          template: '<section data-testid="origin-chart-test-stub"><h3>Origin SBar chart</h3><button v-if="bars.length > 0" data-testid="origin-sbar-click-100" @click="$emit(\'sbar-click\', \'100\')">Select SBar 100</button><button v-if="bars.length > 1" data-testid="origin-sbar-click-200" @click="$emit(\'sbar-click\', \'200\')">Select SBar 200</button><button v-for="cbar in structure?.cbars ?? []" :key="cbar.cbarId" :data-testid="\'origin-cbar-click-\' + cbar.cbarId" @click="$emit(\'object-click\', { kind: \'cbar\', id: cbar.cbarId, originDatasetId })">Select CBar</button><button v-for="swing in structure?.swings ?? []" :key="swing.swingId" :data-testid="\'origin-swing-click-\' + swing.swingId" @click="$emit(\'object-click\', { kind: \'swing\', id: swing.swingId, originDatasetId })">Select Swing</button></section>',
          props: ["bars", "originDatasetId", "structure"],
        },
        RunChart: {
          template: '<section data-testid="run-chart-test-stub"><h3>Test Dataset SBar chart</h3></section>',
          props: ["origin", "testDataset"],
        },
      },
    },
  });
}

async function enterReplayWorkspace(wrapper: ReturnType<typeof mountApp>): Promise<void> {
  // Run controls are rendered only in Replay. Determine the active workspace from a stable DOM attribute.
  const replayTab = wrapper.get('[data-testid="workspace-replay"]');
  if (replayTab.attributes("aria-current") !== "page") {
    await replayTab.trigger("click");
  }
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
  timeframe: "5m",
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
    timeframe: "5m",
    sbarSequenceFingerprint: "abc123",
    sbarCount: 2,
    firstSbarId: "100",
    lastSbarId: "200",
    firstTsEvent: "100",
    lastTsEvent: "200",
    structure: null,
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
    await vi.waitFor(() => expect((wrapper.get('[data-testid="catalog-dataset-select"]').element as HTMLSelectElement).value).toBe(dataset.id));
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
    expect(wrapper.get('[data-testid="inspector-sbar-ts-event"]').text()).toBe("1970-01-01 00:00");
    expect(wrapper.get('[data-testid="inspector-sbar-ts-init"]').text()).toBe("1970-01-01 00:00");
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


  it("copies raw Inspector field values on context menu and reports clipboard failures", async () => {
    const origin = makeOrigin("origin-inspector-copy");
    invokeMock.mockImplementation((command) => {
      if (command === "list_catalog_datasets") return Promise.resolve([dataset]);
      if (command === "get_current_origin") return Promise.resolve(origin);
      if (command === "get_current_test_dataset") return Promise.resolve(null);
      if (command === "list_snapshots") return Promise.resolve([]);
      return Promise.reject(new Error(`Unexpected IPC command: ${command}`));
    });

    const wrapper = mountApp();
    await vi.waitFor(() => expect(wrapper.text()).toContain("origin-inspector-copy"));
    await wrapper.get('[data-testid="origin-sbar-click-200"]').trigger("click");

    const writeText = vi.fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("clipboard unavailable"));
    const originalClipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, "clipboard");
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    try {
      const eventTime = wrapper.get('[data-testid="inspector-sbar-ts-event"]');
      expect(eventTime.text()).toBe("1970-01-01 00:00");
      await eventTime.trigger("contextmenu");
      await flushPromises();
      expect(writeText).toHaveBeenNthCalledWith(1, "200");
      expect(wrapper.get('[role="status"]').text()).toBe("COPIED");

      await wrapper.get('[data-testid="inspector-sbar-id"]').trigger("contextmenu");
      await flushPromises();
      expect(writeText).toHaveBeenNthCalledWith(2, "200");
      expect(wrapper.get('[role="status"]').text()).toBe("COPY FAILED · CLIPBOARD UNAVAILABLE");
    } finally {
      if (originalClipboardDescriptor) {
        Object.defineProperty(navigator, "clipboard", originalClipboardDescriptor);
      } else {
        Reflect.deleteProperty(navigator, "clipboard");
      }
    }
  });

  it("shows the exact Origin CBar and Swing selected through chart events", async () => {
    const origin = makeOrigin("origin-structure-inspector");
    origin.structure = {
      cbarCount: 1,
      cbars: [{
        cbarId: "cbar-100",
        high: "13.00",
        low: "9.00",
        sbarStartId: "100",
        sbarEndId: "200",
        spanSbars: 2,
        fractalType: "Top",
        createdAt: "100",
      }],
      swingCount: 1,
      swings: [{
        swingId: "swing-100",
        direction: "Up",
        high: "13.00",
        low: "9.00",
        cbarStartId: "cbar-100",
        cbarEndId: "cbar-100",
        sbarStartId: "100",
        sbarEndId: "200",
        startOi: null,
        endOi: null,
        volume: "220",
        spanSbars: 2,
        state: "Confirmed",
        createdAt: "100",
        updatedAt: "200",
      }],
    };
    invokeMock.mockImplementation((command) => {
      if (command === "list_catalog_datasets") return Promise.resolve([dataset]);
      if (command === "get_current_origin") return Promise.resolve(origin);
      if (command === "get_current_test_dataset") return Promise.resolve(null);
      if (command === "list_snapshots") return Promise.resolve([]);
      return Promise.reject(new Error(`Unexpected IPC command: ${command}`));
    });

    const wrapper = mountApp();
    await vi.waitFor(() => expect(wrapper.text()).toContain("origin-structure-inspector"));

    await wrapper.get('[data-testid="origin-cbar-click-cbar-100"]').trigger("click");
    expect(wrapper.get('[data-testid="inspector-runtime-context"]').text()).toContain("origin-structure-inspector");
    expect(wrapper.get('[data-testid="inspector-runtime-context"]').text()).toContain("5m");
    expect(wrapper.get('[data-testid="inspector-cbar-cbarId"]').text()).toBe("cbar-100");
    expect(wrapper.get('[data-testid="inspector-cbar-high"]').text()).toBe("13.00");
    expect(wrapper.get('[data-testid="inspector-cbar-fractalType"]').text()).toBe("Top");
    expect(wrapper.get('[data-testid="inspector-cbar-createdAt"]').attributes("data-copy-value")).toBe("100");
    expect(Array.from(wrapper.get('[data-testid="inspector-cbar-cbarId"]').element.closest(".inspector-fields")!.querySelectorAll("dt")).map((field) => field.textContent ?? "")).toEqual([
      "CBar ID", "High", "Low", "SBar Start ID", "SBar End ID", "Span SBars", "Fractal Type", "Created At",
    ]);

    await wrapper.get('[data-testid="origin-swing-click-swing-100"]').trigger("click");
    expect(wrapper.get('[data-testid="inspector-swing-swingId"]').text()).toBe("swing-100");
    expect(wrapper.get('[data-testid="inspector-swing-state"]').text()).toBe("Confirmed");
    expect(wrapper.get('[data-testid="inspector-swing-volume"]').text()).toBe("220");
    expect(wrapper.get('[data-testid="inspector-swing-startOi"]').text()).toBe("null");
    expect(wrapper.get('[data-testid="inspector-swing-endOi"]').text()).toBe("null");
    expect(wrapper.get('[data-testid="inspector-swing-updatedAt"]').attributes("data-copy-value")).toBe("200");
    expect(Array.from(wrapper.get('[data-testid="inspector-swing-swingId"]').element.closest(".inspector-fields")!.querySelectorAll("dt")).map((field) => field.textContent ?? "")).toEqual([
      "Swing ID", "Direction", "High", "Low", "CBar Start ID", "CBar End ID",
      "SBar Start ID", "SBar End ID", "Start OI", "End OI", "Volume", "Span SBars",
      "State", "Created At", "Updated At",
    ]);

    const initialRangeStatus = wrapper.get('[data-testid="origin-range-selection-status"]').text();
    const relatedCbar = wrapper.get('[data-testid="inspector-related-start-cbar"]');
    expect(relatedCbar.element.tagName).toBe("DETAILS");
    expect(relatedCbar.get("summary").text()).toContain("cbar-100");
    await relatedCbar.get("summary").trigger("click");
    expect(relatedCbar.text()).toContain("CBar ID");
    expect(relatedCbar.text()).toContain("cbar-100");

    const relatedSbar = wrapper.get('[data-testid="inspector-related-start-sbar"]');
    await relatedSbar.get("summary").trigger("click");
    expect(relatedSbar.text()).toContain("SBar ID");
    expect(relatedSbar.text()).toContain("100");

    // Expanding related details must not replace the current primary selection.
    expect(wrapper.get('[data-testid="inspector-swing-swingId"]').text()).toBe("swing-100");
    expect(wrapper.get('[data-testid="origin-range-selection-status"]').text()).toBe(initialRangeStatus);
  });

  it("shows backend-confirmed Replay object counts without Inspector-owned object selection", async () => {
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
      if (command === "step_run") {
        return Promise.resolve({
          runState: pausedRun,
          inspector: replayInspector,
        });
      }
      if (command === "get_replay_inspector") return Promise.resolve(replayInspector);
      return Promise.reject(new Error(`Unexpected IPC command: ${command}`));
    });

    const wrapper = mountApp();
    await vi.waitFor(() => expect(wrapper.text()).toContain("test-1"));
    await wrapper.get('[data-testid="workspace-replay"]').trigger("click");
    await enterReplayWorkspace(wrapper);
    await vi.waitFor(() => expect(wrapper.text()).toContain("READY"));
    await vi.waitFor(() => {
      expect((wrapper.get('[data-testid="run-step"]').element as HTMLButtonElement).disabled).toBe(false);
    });
    await wrapper.get('[data-testid="run-step"]').trigger("click");
    await vi.waitFor(() => expect(wrapper.get('[data-testid="inspector-replay-checkpoint"]').text()).toBe("0"));

    expect(wrapper.get('[data-testid="inspector-replay-sbar-id"]').text()).toBe("100");
    expect(wrapper.get('[data-testid="inspector-replay-ts-event"]').text()).toBe("1970-01-01 00:00");
    expect(wrapper.get('[data-testid="inspector-replay-ts-init"]').text()).toBe("1970-01-01 00:00");
    expect(wrapper.get('[data-testid="inspector-replay-cbar-count"]').text()).toBe("1");
    expect(wrapper.get('[data-testid="inspector-replay-swing-count"]').text()).toBe("1");
    expect(wrapper.find('[data-testid="inspector-select-swing-100"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="inspector-select-cbar-100"]').exists()).toBe(false);
    expect(invokeMock).toHaveBeenCalledWith("get_replay_inspector");
    expect(wrapper.text()).toContain("backend-confirmed checkpoint");
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
    await vi.waitFor(() => {
      expect((wrapper.get('[data-testid="compare-run"]').element as HTMLButtonElement).disabled).toBe(false);
    });
    await wrapper.get('[data-testid="compare-run"]').trigger("click");
    await vi.waitFor(() => expect(invokeMock).toHaveBeenCalledWith("compare_snapshots", {
      baselineSnapshotId: "snapshot-baseline",
      candidateSnapshotId: "snapshot-candidate",
    }));
    await wrapper.get('[data-testid="snapshot-store-toggle"]').trigger("click");
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
    await vi.waitFor(() => expect((wrapper.get('[data-testid="catalog-dataset-select"]').element as HTMLSelectElement).value).toBe(dataset.id));

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
        return Promise.resolve([dataset, dailyDataset, otherInstrumentDataset, unresolvedDataset]);
      }
      if (command === "get_current_origin") return Promise.resolve(null);
      if (command === "get_current_test_dataset") return Promise.resolve(null);
      if (command === "list_snapshots") return Promise.resolve([]);
      return Promise.reject(new Error(`Unexpected IPC command: ${command}`));
    });

    const wrapper = mountApp();
    await vi.waitFor(() => {
      expect((wrapper.get('[data-testid="catalog-dataset-select"]').element as HTMLSelectElement).value).toBe(dataset.id);
    });

    const select = wrapper.get('[data-testid="catalog-dataset-select"]');
    const groups = select.findAll("optgroup");
    expect(groups.map((group) => group.attributes("label"))).toEqual([
      "BTCUSDT-PERP.BINANCE",
      "ETHUSDT-PERP.BINANCE",
      "Unresolved / Unavailable",
    ]);
    expect(groups[0]!.findAll("option")).toHaveLength(2);
    expect(groups[1]!.findAll("option")).toHaveLength(1);
    expect(groups[2]!.find("option").text()).toContain("UNAVAILABLE");
    await select.setValue(unresolvedDataset.id);
    await vi.waitFor(() => expect(wrapper.text()).toContain("Instrument metadata is missing"));
    expect((wrapper.get('[data-testid="catalog-load"]').element as HTMLButtonElement).disabled).toBe(true);
    expect(invokeMock.mock.calls.some(([command]) => command === "load_origin")).toBe(false);
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
    await vi.waitFor(() => expect((wrapper.get('[data-testid="catalog-dataset-select"]').element as HTMLSelectElement).value).toBe(dataset.id));
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
  timeframe: "5m",
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
      if (command === "get_run_state") return Promise.resolve(null);
      return Promise.reject(new Error(`Unexpected IPC command: ${command}`));
    });

    const wrapper = mountApp();
    await vi.waitFor(() => expect(wrapper.find('[data-testid="origin-chart-test-stub"]').exists()).toBe(true));
    expect(wrapper.find(".toolbar-error").exists()).toBe(false);
    expect(wrapper.findAll('[data-testid="origin-chart-test-stub"]')).toHaveLength(1);
    expect(wrapper.findAll(".workspace-tab").map((tab) => tab.text())).toEqual([
      "01\u00a0 Dataset",
      "02\u00a0 Replay",
      "03\u00a0 Compare",
    ]);
    expect(wrapper.find('[data-testid="catalog-controls"]').exists()).toBe(true);

    expect(wrapper.find('[data-testid="run-chart-test-stub"]').exists()).toBe(false);
    await wrapper.get('[data-testid="workspace-replay"]').trigger("click");
    expect(wrapper.find('[data-testid="catalog-controls"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="origin-chart-test-stub"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="run-chart-test-stub"]').exists()).toBe(true);
    expect(wrapper.findAll('[data-testid="run-chart-test-stub"]')).toHaveLength(1);
    expect(wrapper.get('[data-testid="workspace-toolbar-title"]').text()).toBe("REPLAY");
    expect(wrapper.find(".toolbar-error").exists()).toBe(false);
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
    expect(inspectorSplitter.attributes("aria-valuenow")).toBe("300");
    await inspectorSplitter.trigger("keydown", { key: "ArrowLeft" });
    expect(inspectorSplitter.attributes("aria-valuenow")).toBe("312");
    expect(wrapper.get('[data-testid="debugger-shell"]').attributes("style")).toContain("--inspector-width: 312px");

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
      expect(wrapper.get('[data-testid="inspector-panel"]').classes()).toContain(`dock-${direction}`);
    }
    for (const direction of ["left", "right", "top", "bottom"] as const) {
      await wrapper.get(`[data-testid="diagnostics-dock-${direction}"]`).trigger("click");
      expect(wrapper.get('[data-testid="debugger-shell"]').classes()).toContain(`diagnostics-dock-${direction}`);
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
    await wrapper.get('[data-testid="debugger-shell"]').trigger("dragover", { dataTransfer });
    await wrapper.get('[data-testid="debugger-shell"]').trigger("drop", { dataTransfer, clientX: -1 });
    expect(wrapper.get('[data-testid="inspector-panel"]').classes()).toContain("dock-left");

    await wrapper.get('[data-testid="diagnostics-dock-drag-handle"]').trigger("dragstart", { dataTransfer });
    await wrapper.get('[data-testid="debugger-shell"]').trigger("dragover", { dataTransfer });
    await wrapper.get('[data-testid="debugger-shell"]').trigger("drop", { dataTransfer, clientX: 0.5, clientY: -1 });
    expect(wrapper.get('[data-testid="debugger-shell"]').classes()).toContain("diagnostics-dock-top");
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
      if (command === "get_run_state") return Promise.resolve(null);
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

    await enterReplayWorkspace(wrapper);
    const startButton = wrapper.get('[data-testid="run-start-stop"]');
    expect(startButton).toBeDefined();
    await startButton!.trigger("click");
    await vi.waitFor(() => expect(wrapper.get('[data-testid="run-toolbar-status"]').text()).toContain("READY"));
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
      if (command === "get_run_state") return Promise.resolve(null);
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
    await vi.waitFor(() => expect(wrapper.get('[data-testid="workspace-replay"]').attributes("aria-current")).toBe("page"));
    await wrapper.get('[data-testid="workspace-dataset"]').trigger("click");
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
    await enterReplayWorkspace(wrapper);
    await wrapper.get('[data-testid="run-step"]').trigger("click");
    await wrapper.get('[data-testid="run-play-pause"]').trigger("click");
    await wrapper.get('[data-testid="run-start-stop"]').trigger("click");
    await flushPromises();

    const runIpcCommands = [
      "step_run", "play_run", "pause_run", "stop_run", "dispose_run",
    ];
    expect(invokeMock.mock.calls.filter(([command]) =>
      runIpcCommands.includes(String(command)),
    )).toHaveLength(0);
  });

  it("clears a retained Run through Reset before starting the next Run", async () => {
    const completedRun = {
      runId: "run-completed",
      testDatasetId: "test-1",
      inputFingerprint: "test-fingerprint",
      inputCount: 2,
      status: "completed",
      processedCount: 2,
      cursorSbarId: "200",
      failureDiagnostic: null,
    };
    const nextRun = {
      ...completedRun,
      runId: "run-next",
      status: "ready",
      processedCount: 0,
      cursorSbarId: null,
    };
    let resetDone = false;
    invokeMock.mockImplementation((command) => {
      if (command === "list_catalog_datasets") return Promise.resolve([dataset]);
      if (command === "get_current_origin") return Promise.resolve(makeOrigin("origin-existing"));
      if (command === "get_current_test_dataset") return Promise.resolve(testDataset);
      if (command === "list_snapshots") return Promise.resolve([]);
      if (command === "get_replay_inspector") return Promise.resolve(null);
      if (command === "get_run_state") return Promise.resolve(resetDone ? null : completedRun);
      if (command === "reset_run") {
        resetDone = true;
        return Promise.resolve();
      }
      if (command === "start_run") return Promise.resolve(nextRun);
      return Promise.reject(new Error(`Unexpected IPC command: ${command}`));
    });

    const wrapper = mountApp();
    await vi.waitFor(() => expect(wrapper.text()).toContain("test-1"));
    await enterReplayWorkspace(wrapper);
    expect(wrapper.get('[data-testid="run-start-stop"]').text()).toContain("START");
    await wrapper.get('[data-testid="run-start-stop"]').trigger("click");

    await vi.waitFor(() => expect(invokeMock).toHaveBeenCalledWith("start_run"));
    const resetIndex = invokeMock.mock.calls.findIndex(([command]) => command === "reset_run");
    const startIndex = invokeMock.mock.calls.findIndex(([command]) => command === "start_run");
    expect(resetIndex).toBeGreaterThan(-1);
    expect(startIndex).toBeGreaterThan(resetIndex);
    expect(invokeMock).toHaveBeenCalledWith("get_run_state");
    await vi.waitFor(() => expect(wrapper.get('[data-testid="run-toolbar-status"]').text()).toContain("READY"));
  });

  it("uses frontend playback controls for a confirmed ready Run", async () => {
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
      if (command === "step_run") return Promise.resolve(readyRun);
      if (command === "get_replay_inspector") return Promise.resolve(null);
      return Promise.reject(new Error(`Unexpected IPC command: ${command}`));
    });

    const wrapper = mountApp();
    await vi.waitFor(() => expect(wrapper.text()).toContain("test-1"));
    await enterReplayWorkspace(wrapper);
    await vi.waitFor(() => expect(wrapper.get('[data-testid="run-toolbar-status"]').text()).toContain("READY"));
    const readySpaceEvent = new KeyboardEvent("keydown", {
      key: " ",
      code: "Space",
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(readySpaceEvent);
    expect(readySpaceEvent.defaultPrevented).toBe(true);
    await wrapper.get('[data-testid="run-play-pause"]').trigger("click");
    await flushPromises();
    expect(invokeMock.mock.calls.filter(([command]) =>
      command === "pause_run" || command === "play_run",
    )).toHaveLength(0);
    expect(invokeMock.mock.calls.some(([command]) => command === "step_run")).toBe(true);
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
    await enterReplayWorkspace(wrapper);
    await vi.waitFor(() => expect(wrapper.text()).toContain("RUNNING"));
    await wrapper.get('[data-testid="run-step"]').trigger("click");
    await wrapper.get('[data-testid="run-play-pause"]').trigger("click");
    await flushPromises();
    expect(invokeMock.mock.calls.filter(([command]) =>
      ["step_run", "play_run", "dispose_run"].includes(String(command)),
    )).toHaveLength(0);
  });

  it("maps Space to frontend Play/Pause without backend playback IPC", async () => {
    let processedCount = 0;
    const runState = () => ({
      runId: "run-space",
      testDatasetId: "test-1",
      inputFingerprint: "test-fingerprint",
      inputCount: 2,
      status: processedCount === 2 ? "completed" : "ready",
      processedCount,
      cursorSbarId: processedCount ? String(99 + processedCount) : null,
      failureDiagnostic: null,
    });
    invokeMock.mockImplementation((command) => {
      if (command === "list_catalog_datasets") return Promise.resolve([dataset]);
      if (command === "get_current_origin") return Promise.resolve(makeOrigin("origin-existing"));
      if (command === "get_current_test_dataset") return Promise.resolve(testDataset);
      if (command === "list_snapshots") return Promise.resolve([]);
      if (command === "get_run_state") return Promise.resolve(runState());
      if (command === "step_run") {
        processedCount += 1;
        return Promise.resolve(runState());
      }
      if (command === "get_replay_inspector") return Promise.resolve(null);
      return Promise.reject(new Error(`Unexpected IPC command: ${command}`));
    });

    const wrapper = mountApp();
    await vi.waitFor(() => expect(wrapper.text()).toContain("test-1"));
    await enterReplayWorkspace(wrapper);
    await vi.waitFor(() => expect(wrapper.get('[data-testid="run-toolbar-status"]').text()).toContain("READY"));

    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    document.body.focus();
    const playEvent = new KeyboardEvent("keydown", {
      key: " ",
      code: "Space",
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(playEvent);
    expect(playEvent.defaultPrevented).toBe(true);
    await vi.waitFor(() => expect(invokeMock.mock.calls.filter(([command]) => command === "step_run")).toHaveLength(1));

    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    document.body.focus();
    const pauseEvent = new KeyboardEvent("keydown", {
      key: " ",
      code: "Space",
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(pauseEvent);
    expect(pauseEvent.defaultPrevented).toBe(true);
    await flushPromises();

    expect(invokeMock.mock.calls.filter(([command]) =>
      command === "play_run" || command === "pause_run",
    )).toHaveLength(0);
    expect(invokeMock.mock.calls.filter(([command]) => command === "step_run")).toHaveLength(1);
    wrapper.unmount();
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

    await enterReplayWorkspace(wrapper);
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

    await wrapper.get('[data-testid="workspace-dataset"]').trigger("click");
    const input = wrapper.get('[data-testid="catalog-enable-structure"]');
    (input.element as HTMLInputElement).focus();
    const inputEvent = new KeyboardEvent("keydown", {
      key: " ",
      code: "Space",
      bubbles: true,
      cancelable: true,
    });
    input.element.dispatchEvent(inputEvent);
    expect(inputEvent.defaultPrevented).toBe(false);

    await wrapper.get('[data-testid="workspace-replay"]').trigger("click");
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
    await enterReplayWorkspace(wrapper);
    await vi.waitFor(() => expect(wrapper.get('[data-testid="run-toolbar-status"]').text()).toContain("READY"));
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
    await enterReplayWorkspace(wrapper);
    const startButton = wrapper.get('[data-testid="run-start-stop"]')!;
    await startButton.trigger("click");
    await startButton.trigger("click");
    expect(invokeMock.mock.calls.filter(([command]) => command === "start_run")).toHaveLength(1);
    resolveStart(readyRun);
    await vi.waitFor(() => expect(wrapper.get('[data-testid="run-toolbar-status"]').text()).toContain("READY"));
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
      if (command === "get_run_state") return Promise.resolve(null);
      if (command === "create_test_dataset") return Promise.resolve(createdTestDataset);
      return Promise.reject(new Error(`Unexpected IPC command: ${command}`));
    });

    const wrapper = mountApp();
    await vi.waitFor(() => expect((wrapper.get('[data-testid="catalog-dataset-select"]').element as HTMLSelectElement).value).toBe(dataset.id));

    await wrapper.get('[data-testid="catalog-load"]').trigger("click");
    await vi.waitFor(() => expect(wrapper.text()).toContain("origin-new"));
    await selectOriginRange(wrapper);
    const createButton = wrapper.get('[data-testid="test-dataset-create"]');
    await vi.waitFor(() => expect((createButton!.element as HTMLButtonElement).disabled).toBe(false));
    await createButton!.trigger("click");
    await vi.waitFor(() => expect(wrapper.get('[data-testid="workspace-replay"]').attributes("aria-current")).toBe("page"));

    // Let startup's slower Snapshot read finish only after the user mutation.
    resolveSnapshots([]);
    await flushPromises();

    await wrapper.get('[data-testid="workspace-dataset"]').trigger("click");
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
      if (command === "reset_run") return Promise.resolve(null);
      return Promise.reject(new Error(`Unexpected IPC command: ${command}`));
    });

    const wrapper = mountApp();
    await vi.waitFor(() => expect(wrapper.text()).toContain("test-1"));
    await wrapper.get('[data-testid="catalog-load"]').trigger("click");
    await vi.waitFor(() => expect(invokeMock).toHaveBeenCalledWith("load_origin", {
      datasetId: dataset.id,
      enableStructure: true,
    }));
    await enterReplayWorkspace(wrapper);
    const startButton = wrapper.get('[data-testid="run-start-stop"]')!;
    expect((startButton.element as HTMLButtonElement).disabled).toBe(true);

    await wrapper.get('[data-testid="run-start-stop"]').trigger("click");
    expect(wrapper.find('[data-testid="run-restart"]').exists()).toBe(false);
    expect(invokeMock.mock.calls.filter(([command]) =>
      command === "start_run" || command === "restart_run",
    )).toHaveLength(0);

    resolveLoad(makeOrigin("origin-reloaded"));
    await wrapper.get('[data-testid="workspace-dataset"]').trigger("click");
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
    await enterReplayWorkspace(wrapper);
    await vi.waitFor(() => expect(wrapper.get('[data-testid="run-toolbar-status"]').text()).toContain("READY"));
    await wrapper.get('[data-testid="workspace-dataset"]').trigger("click");
    const loadButton = wrapper.find('[data-testid="catalog-load"]');
    expect((loadButton.element as HTMLButtonElement).disabled).toBe(true);
    await loadButton.trigger("click");
    expect(invokeMock.mock.calls.filter(([command]) => command === "load_origin")).toHaveLength(0);
  });

  it("resets Replay before replacing Test Dataset regardless of Snapshot save state", async () => {
    let runStateReads = 0;
    const completedRun = {
      runId: "run-completed",
      testDatasetId: "test-1",
      inputFingerprint: "test-fingerprint",
      inputCount: 2,
      status: "completed",
      processedCount: 2,
      cursorSbarId: "200",
      failureDiagnostic: null,
    };
    const confirmSpy = vi.spyOn(window, "confirm");
    invokeMock.mockImplementation((command) => {
      if (command === "list_catalog_datasets") return Promise.resolve([dataset]);
      if (command === "get_current_origin") return Promise.resolve(makeOrigin("origin-existing"));
      if (command === "get_current_test_dataset") return Promise.resolve(testDataset);
      if (command === "list_snapshots") return Promise.resolve([]);
      if (command === "get_run_state") {
        runStateReads += 1;
        // Simulate stale local state at startup, then reveal the backend-owned completed Run.
        return Promise.resolve(runStateReads === 1 ? null : completedRun);
      }
      if (command === "reset_run") return Promise.resolve();
      if (command === "create_test_dataset") return Promise.resolve({ ...testDataset, testDatasetId: "test-replaced" });
      return Promise.reject(new Error(`Unexpected IPC command: ${command}`));
    });

    const wrapper = mountApp();
    await vi.waitFor(() => expect(wrapper.text()).toContain("test-1"));
    await selectOriginRange(wrapper);
    const replaceButton = wrapper.get('[data-testid="test-dataset-create"]');
    expect((replaceButton.element as HTMLButtonElement).disabled).toBe(false);

    await replaceButton.trigger("click");
    await vi.waitFor(() => expect(invokeMock.mock.calls.some(([command]) => command === "create_test_dataset")).toBe(true));

    expect(confirmSpy).not.toHaveBeenCalled();
    const resetIndex = invokeMock.mock.calls.findIndex(([command]) => command === "reset_run");
    const replaceIndex = invokeMock.mock.calls.findIndex(([command]) => command === "create_test_dataset");
    expect(resetIndex).toBeGreaterThanOrEqual(0);
    expect(resetIndex).toBeLessThan(replaceIndex);
    expect(wrapper.get(`[data-testid="workspace-replay"]`).attributes("aria-current")).toBe("page");
    await wrapper.get('[data-testid="workspace-dataset"]').trigger("click");
    await vi.waitFor(() => expect(wrapper.text()).toContain("test-replaced"));
    confirmSpy.mockRestore();
  });

  it("does not replace Test Dataset when Replay Reset fails", async () => {
    let runStateReads = 0;
    const completedRun = {
      runId: "run-completed",
      testDatasetId: "test-1",
      inputFingerprint: "test-fingerprint",
      inputCount: 2,
      status: "completed",
      processedCount: 2,
      cursorSbarId: "200",
      failureDiagnostic: null,
    };
    invokeMock.mockImplementation((command) => {
      if (command === "list_catalog_datasets") return Promise.resolve([dataset]);
      if (command === "get_current_origin") return Promise.resolve(makeOrigin("origin-existing"));
      if (command === "get_current_test_dataset") return Promise.resolve(testDataset);
      if (command === "get_run_state") {
        runStateReads += 1;
        return Promise.resolve(runStateReads === 1 ? null : completedRun);
      }
      if (command === "reset_run") return Promise.reject("runtime cleanup was not confirmed");
      return Promise.reject(new Error(`Unexpected IPC command: ${command}`));
    });

    const wrapper = mountApp();
    await vi.waitFor(() => expect(wrapper.text()).toContain("test-1"));
    await selectOriginRange(wrapper);
    await wrapper.get('[data-testid="test-dataset-create"]').trigger("click");
    await vi.waitFor(() => expect(wrapper.text()).toContain("runtime cleanup was not confirmed"));

    expect(invokeMock.mock.calls.some(([command]) => command === "reset_run")).toBe(true);
    expect(invokeMock.mock.calls.some(([command]) => command === "create_test_dataset")).toBe(false);
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
    await enterReplayWorkspace(wrapper);
    const startButton = wrapper.get('[data-testid="run-start-stop"]')!;
    await startButton.trigger("click");
    await vi.waitFor(() => expect(invokeMock).toHaveBeenCalledWith("start_run"));
    await wrapper.get('[data-testid="workspace-dataset"]').trigger("click");

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
    await wrapper.get('[data-testid="workspace-replay"]').trigger("click");
    await vi.waitFor(() => expect(wrapper.get('[data-testid="run-toolbar-status"]').text()).toContain("READY"));
  });

  it("blocks Origin Load while Test Dataset replacement is pending", async () => {
    let resolveCreate!: (value: TestDatasetDto) => void;
    const pendingCreate = new Promise<TestDatasetDto>((resolve) => { resolveCreate = resolve; });
    invokeMock.mockImplementation((command) => {
      if (command === "list_catalog_datasets") return Promise.resolve([dataset]);
      if (command === "get_current_origin") return Promise.resolve(makeOrigin("origin-existing"));
      if (command === "get_current_test_dataset") return Promise.resolve(testDataset);
      if (command === "get_run_state") return Promise.resolve(null);
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
    await vi.waitFor(() => expect(wrapper.get('[data-testid="workspace-replay"]').attributes("aria-current")).toBe("page"));
    await wrapper.get('[data-testid="workspace-dataset"]').trigger("click");
    await vi.waitFor(() => expect(wrapper.text()).toContain("test-replaced"));
  });

  it("blocks Run start while Test Dataset replacement is pending", async () => {
    let resolveCreate!: (value: TestDatasetDto) => void;
    const pendingCreate = new Promise<TestDatasetDto>((resolve) => { resolveCreate = resolve; });
    invokeMock.mockImplementation((command) => {
      if (command === "list_catalog_datasets") return Promise.resolve([dataset]);
      if (command === "get_current_origin") return Promise.resolve(makeOrigin("origin-existing"));
      if (command === "get_current_test_dataset") return Promise.resolve(testDataset);
      if (command === "get_run_state") return Promise.resolve(null);
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

    await enterReplayWorkspace(wrapper);
    const startButton = wrapper.get('[data-testid="run-start-stop"]')!;
    expect((startButton.element as HTMLButtonElement).disabled).toBe(true);

    await wrapper.get('[data-testid="run-start-stop"]').trigger("click");
    expect(wrapper.find('[data-testid="run-restart"]').exists()).toBe(false);
    expect(invokeMock.mock.calls.filter(([command]) =>
      command === "start_run" || command === "restart_run",
    )).toHaveLength(0);

    resolveCreate({ ...testDataset, testDatasetId: "test-replaced" });
    await vi.waitFor(() => expect(wrapper.get('[data-testid="workspace-replay"]').attributes("aria-current")).toBe("page"));
    await wrapper.get('[data-testid="workspace-dataset"]').trigger("click");
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
    expect(wrapper.get('[data-testid="replay-toolbar-context"]').text()).toContain("NO TEST DATASET");
    expect(wrapper.find('[data-testid="run-start-stop"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="run-step"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="run-play-pause"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="run-start-stop"]').attributes("title")).toContain("Start a new Run");
    expect(wrapper.find('[data-testid="run-restart"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="run-toolbar-status"]').exists()).toBe(true);
    expect(wrapper.find('[role="progressbar"][aria-label="Replay progress"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="snapshot-reference-panel"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="snapshot-reference-stage"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="snapshot-reference-empty"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="snapshot-reference-panel"]').text()).toContain("SNAPSHOT REFERENCE");
    expect(wrapper.get('[data-testid="replay-chart-splitter"]').attributes("role")).toBe("separator");

    await wrapper.get('[data-testid="workspace-compare"]').trigger("click");
    expect(wrapper.find('[data-testid="dual-chart-stack-compare"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="compare-candidate-chart"]').text()).toContain("Candidate");
    expect(wrapper.get('[data-testid="compare-baseline-chart"]').text()).toContain("Baseline");
    expect(wrapper.get('[data-testid="compare-chart-splitter"]').attributes("role")).toBe("separator");
    expect(wrapper.text()).toContain("NO SYNTHETIC MARKET DATA");
  });
});
