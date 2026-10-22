import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import CatalogPanel from "../../src/components/CatalogPanel.vue";
import DatasetWorkspace from "../../src/components/DatasetWorkspace.vue";
import OriginChart from "../../src/components/OriginChart.vue";
import TestDatasetPanel from "../../src/components/TestDatasetPanel.vue";
import type { OriginDatasetDto } from "../../src/origin-types";

const origin = {
  originDatasetId: "origin-1",
  bars: [],
  structure: null,
} as OriginDatasetDto;

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
        CatalogPanel: true,
        OriginChart: true,
        TestDatasetPanel: true,
      },
    },
  });
}

describe("DatasetWorkspace", () => {
  it("forwards catalog and Test Dataset actions to the composition root", () => {
    const wrapper = mountDatasetWorkspace();

    wrapper.findComponent(CatalogPanel).vm.$emit("refresh");
    wrapper.findComponent(CatalogPanel).vm.$emit("select-dataset", "catalog-1");
    wrapper.findComponent(CatalogPanel).vm.$emit("update:enableStructure", false);
    wrapper.findComponent(CatalogPanel).vm.$emit("load");
    wrapper.findComponent(TestDatasetPanel).vm.$emit("create");

    expect(wrapper.emitted("refreshCatalog")).toEqual([[]]);
    expect(wrapper.emitted("selectDataset")).toEqual([["catalog-1"]]);
    expect(wrapper.emitted("updateEnableStructure")).toEqual([[false]]);
    expect(wrapper.emitted("loadOrigin")).toEqual([[]]);
    expect(wrapper.emitted("createTestDataset")).toEqual([[]]);
  });

  it("preserves both arguments of the Origin range-boundary event", () => {
    const wrapper = mountDatasetWorkspace();

    wrapper.findComponent(OriginChart).vm.$emit("rangeBoundaryChange", "start", "sbar-1");

    expect(wrapper.emitted("rangeBoundaryChange")).toEqual([["start", "sbar-1"]]);
  });
});
