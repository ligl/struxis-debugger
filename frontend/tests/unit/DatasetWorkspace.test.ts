import { mount } from "@vue/test-utils";
import { defineComponent } from "vue";
import { describe, expect, it } from "vitest";
import DatasetWorkspace from "../../src/components/DatasetWorkspace.vue";
import type { OriginDatasetDto } from "../../src/origin-types";

const origin = {
  originDatasetId: "origin-1",
  bars: [],
  structure: null,
} as OriginDatasetDto;

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

function mountDatasetWorkspace() {
  return mount(DatasetWorkspace, {
    props: {
      active: true,
      datasets: [],
      selectedId: "",
      selectedDataset: null,
      instrumentGroups: [],
      refreshing: false,
      loading: false,
      mutationBusy: false,
      discoveryError: "",
      enableStructure: true,
      origin,
      loadStatus: "loaded",
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
