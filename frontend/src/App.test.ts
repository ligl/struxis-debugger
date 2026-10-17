import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App.vue";
import type { CatalogDatasetEntry, OriginDatasetDto } from "./origin-types";

const bridge = vi.hoisted(() => ({
  describeIpcError: vi.fn((error: unknown) =>
    typeof error === "string" ? error : "IPC operation failed",
  ),
  getCurrentOrigin: vi.fn(),
  listCatalogDatasets: vi.fn(),
  loadOrigin: vi.fn(),
}));

vi.mock("./origin-bridge", () => bridge);

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

describe("Origin Load workbench", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    bridge.listCatalogDatasets.mockResolvedValue([dataset]);
    bridge.getCurrentOrigin.mockResolvedValue(null);
  });

  it("discovers datasets and sends the selected full-stream load request", async () => {
    const origin = makeOrigin("origin-new");
    bridge.loadOrigin.mockResolvedValue(origin);
    const wrapper = mount(App);
    await vi.waitFor(() => expect(bridge.listCatalogDatasets).toHaveBeenCalledOnce());
    await wrapper.get(".primary-button").trigger("click");
    await vi.waitFor(() => expect(bridge.loadOrigin).toHaveBeenCalledWith(dataset.id, true));
    await vi.waitFor(() => expect(wrapper.text()).toContain("origin-new"));
    expect(wrapper.text()).toContain("2");
    expect(wrapper.text()).toContain("Oldest-first SBar sample");
  });

  it("retains the previously published Origin when a replacement load fails", async () => {
    const previous = makeOrigin("origin-existing");
    bridge.getCurrentOrigin.mockResolvedValue(previous);
    bridge.loadOrigin.mockRejectedValue("replacement failed");
    const wrapper = mount(App);
    await vi.waitFor(() => expect(wrapper.text()).toContain("origin-existing"));
    await wrapper.get(".primary-button").trigger("click");
    await vi.waitFor(() => expect(wrapper.text()).toContain("replacement failed"));
    expect(wrapper.text()).toContain("origin-existing");
    expect(wrapper.text()).toContain("previous Origin remains available");
  });

  it("prevents rapid repeated clicks from overlapping Load commands", async () => {
    let resolveLoad!: (value: OriginDatasetDto) => void;
    bridge.loadOrigin.mockImplementation(
      () => new Promise<OriginDatasetDto>((resolve) => { resolveLoad = resolve; }),
    );
    const wrapper = mount(App);
    await vi.waitFor(() => expect(bridge.listCatalogDatasets).toHaveBeenCalledOnce());
    const button = wrapper.get(".primary-button");
    await button.trigger("click");
    await button.trigger("click");
    expect(bridge.loadOrigin).toHaveBeenCalledTimes(1);
    resolveLoad(makeOrigin("origin-new"));
    await vi.waitFor(() => expect(wrapper.text()).toContain("origin-new"));
  });
});
