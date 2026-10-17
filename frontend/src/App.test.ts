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

function makeOrigin(id: string): OriginDatasetDto {
  return {
    originDatasetId: id,
    sourceCatalog: "/workspace/test_data/catalog",
    enableStructure: true,
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
