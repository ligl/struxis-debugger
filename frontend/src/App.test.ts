import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App.vue";
import type { CatalogDatasetEntry, OriginDatasetDto } from "./origin-types";

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
    await vi.waitFor(() => expect(wrapper.find(".dataset-row").exists()).toBe(true));
    await wrapper.get(".primary-button").trigger("click");
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
    await vi.waitFor(() => expect(wrapper.find(".dataset-row").exists()).toBe(true));

    const structureCheckbox = wrapper.get('input[type="checkbox"]');
    expect((structureCheckbox.element as HTMLInputElement).checked).toBe(true);
    await structureCheckbox.setValue(false);
    await wrapper.get(".primary-button").trigger("click");

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
    await vi.waitFor(() => expect(wrapper.findAll(".instrument-group-row")).toHaveLength(3));
    expect(wrapper.text()).toContain("BTCUSDT-PERP.BINANCE");
    expect(wrapper.text()).toContain("2 DATASETS");
    expect(wrapper.text()).toContain("ETHUSDT-PERP.BINANCE");
    expect(wrapper.text()).toContain("Unresolved / Unavailable");
    expect(wrapper.text()).toContain("Instrument metadata is missing");

    const btcGroup = wrapper
      .findAll(".instrument-group-row")
      .find((row) => row.text().includes("BTCUSDT-PERP.BINANCE"))!;
    await btcGroup.trigger("click");
    expect(
      wrapper.findAll(".dataset-row").some((row) =>
        row.text().includes(dataset.id),
      ),
    ).toBe(false);
    expect(
      invokeMock.mock.calls.some(([command]) => command === "load_origin"),
    ).toBe(false);

    const reopenedBtcGroup = wrapper
      .findAll(".instrument-group-row")
      .find((row) => row.text().includes("BTCUSDT-PERP.BINANCE"))!;
    await reopenedBtcGroup.trigger("click");
    const unresolvedRow = wrapper
      .findAll(".dataset-row")
      .find((row) => row.text().includes(unresolvedDataset.id));
    expect(unresolvedRow).toBeDefined();
    await unresolvedRow!.trigger("click");
    expect((wrapper.get(".primary-button").element as HTMLButtonElement).disabled).toBe(true);
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
    await wrapper.get(".primary-button").trigger("click");
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
    await vi.waitFor(() => expect(wrapper.find(".dataset-row").exists()).toBe(true));
    const button = wrapper.get(".primary-button");
    await button.trigger("click");
    await button.trigger("click");
    expect(
      invokeMock.mock.calls.filter(([command]) => command === "load_origin"),
    ).toHaveLength(1);

    resolveLoad(makeOrigin("origin-new"));
    await vi.waitFor(() => expect(wrapper.text()).toContain("origin-new"));
  });
});
