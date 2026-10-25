import { mount } from "@vue/test-utils";
import { defineComponent } from "vue";
import { describe, expect, it } from "vitest";
import DatasetWorkspace from "../../src/components/DatasetWorkspace.vue";
import type { OriginDatasetDto } from "../../src/origin-types";

const origin: OriginDatasetDto = {
  originDatasetId: "origin-1",
  sourceCatalog: "catalog-1",
  enableStructure: true,
  instrumentId: "BTCUSDT",
  barType: "BTCUSDT-1-MINUTE-LAST-EXTERNAL",
  timeframe: "m",
  sbarSequenceFingerprint: "fingerprint-1",
  sbarCount: 0,
  firstSbarId: "",
  lastSbarId: "",
  firstTsEvent: "",
  lastTsEvent: "",
  bars: [],
  structure: null,
};

const CatalogPanelStub = defineComponent({
  name: "CatalogPanel",
  emits: ["refresh", "selectDataset", "update:enableStructure", "load"],
  template: "<div data-testid=\"catalog-panel-stub\" />",
});
const TestDatasetPanelStub = defineComponent({
  name: "TestDatasetPanel",
  emits: ["create"],
  template: "<div data-testid=\"test-dataset-panel-stub\"><slot name=\"source\" /></div>",
});
const OriginChartStub = defineComponent({
  name: "OriginChart",
  emits: ["rangeBoundaryChange"],
  template: "<div data-testid=\"origin-chart-stub\" />",
});

function mountDatasetWorkspace(originValue: OriginDatasetDto | null = origin, loadStatus: "idle" | "loading" | "loaded" | "failed" = "loaded", active = true) {
  return mount(DatasetWorkspace, {
    props: {
      active,
      datasets: [],
      selectedId: "",
      selectedDataset: null,
      instrumentGroups: [],
      refreshing: false,
      loading: false,
      mutationBusy: false,
      discoveryError: "",
      enableStructure: true,
      origin: originValue,
      loadStatus,
      loadError: "",
      formatDomainTimestamp: (value: string | null) => value ?? "—",
      testDataset: null,
      startSbarId: "",
      endSbarId: "",
      rangeSelectionReady: false,
      rangeSelectionPending: false,
      selectedRangeCount: 0,
      rangeSelectionStatus: "",
      testLoading: false,
      canMutateTest: true,
      testError: "",
      testStatus: "",
      selectedObject: null,
      selectionStartSbarId: null,
      selectionEndSbarId: null,
      selectionPending: false,
      selectionEditable: true,
    },
    global: {
      stubs: {
        CatalogPanel: CatalogPanelStub,
        OriginChart: OriginChartStub,
        TestDatasetPanel: TestDatasetPanelStub,
      },
    },
  });
}

describe("DatasetWorkspace", () => {
  it("shows a designed default chart state before Origin data is loaded", () => {
    const wrapper = mountDatasetWorkspace(null, "idle");

    expect(wrapper.get('[data-testid="dataset-chart-empty"]').text()).toContain("ORIGIN DATA NOT LOADED");
    expect(wrapper.text()).toContain("Select a dataset in Catalog");
    expect(wrapper.text()).toContain("LOAD");
    expect(wrapper.find('[data-testid="origin-chart-stub"]').exists()).toBe(false);
  });

  it("shows a loading state instead of the idle prompt while Origin is loading", () => {
    const wrapper = mountDatasetWorkspace(null, "loading");

    expect(wrapper.get('[data-testid="dataset-chart-empty"]').attributes("data-load-status")).toBe("loading");
    expect(wrapper.text()).toContain("LOADING ORIGIN DATA");
    expect(wrapper.text()).toContain("validating the selected SBar sequence");
  });

  it("renders the real chart after Origin data is available", () => {
    const wrapper = mountDatasetWorkspace(origin, "loaded");

    expect(wrapper.find('[data-testid="dataset-chart-empty"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="origin-chart-stub"]').exists()).toBe(true);
  });

  it("keeps the Origin chart mounted while Dataset is inactive", async () => {
    const wrapper = mountDatasetWorkspace(origin, "loaded", false);
    const chart = wrapper.get('[data-testid="origin-chart-stub"]');

    expect(wrapper.find('[data-testid="origin-chart-stub"]').exists()).toBe(true);
    expect((chart.element as HTMLElement).style.display).toBe("none");

    await wrapper.setProps({ active: true } as never);

    // Assert the component's own v-show state rather than computed visibility,
    // which can be affected by unrelated wrapper styles in the test DOM.
    expect((chart.element as HTMLElement).style.display).not.toBe("none");
  });

  it("forwards catalog and Test Dataset actions to the composition root", () => {
    const wrapper = mountDatasetWorkspace();

    wrapper.getComponent(CatalogPanelStub).vm.$emit("refresh");
    wrapper.getComponent(CatalogPanelStub).vm.$emit("selectDataset", "catalog-1");
    wrapper.getComponent(CatalogPanelStub).vm.$emit("update:enableStructure", false);
    wrapper.getComponent(CatalogPanelStub).vm.$emit("load");
    wrapper.getComponent(TestDatasetPanelStub).vm.$emit("create");

    expect(wrapper.emitted("refreshCatalog")).toEqual([[]]);
    expect(wrapper.emitted("selectDataset")).toEqual([["catalog-1"]]);
    expect(wrapper.emitted("updateEnableStructure")).toEqual([[false]]);
    expect(wrapper.emitted("loadOrigin")).toEqual([[]]);
    expect(wrapper.emitted("createTestDataset")).toEqual([[]]);
  });

  it("preserves both arguments of the Origin range-boundary event", () => {
    const wrapper = mountDatasetWorkspace();

    wrapper.getComponent(OriginChartStub).vm.$emit("rangeBoundaryChange", "start", "sbar-1");

    expect(wrapper.emitted("rangeBoundaryChange")).toEqual([["start", "sbar-1"]]);
  });
});
