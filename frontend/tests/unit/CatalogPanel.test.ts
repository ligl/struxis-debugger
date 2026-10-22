import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import CatalogPanel from "../../src/components/CatalogPanel.vue";

describe("CatalogPanel", () => {
  it("keeps popover interactions inside the Catalog and Origin status control", async () => {
    const onParentClick = vi.fn();
    const onParentPointerDown = vi.fn();
    const wrapper = mount(CatalogPanel, {
      attrs: { onClick: onParentClick, onPointerdown: onParentPointerDown },
      props: {
        datasets: [],
        selectedId: "",
        selectedDataset: null,
        instrumentGroups: [],
        refreshing: false,
        loading: false,
        mutationBusy: false,
        discoveryError: "Catalog unavailable",
        enableStructure: true,
        origin: null,
        loadStatus: "failed",
        loadError: "",
        formatDomainTimestamp: (value: string | null) => value ?? "—",
      },
      global: {
        stubs: { OriginPanel: true },
      },
    });

    const details = wrapper.get(".catalog-source-details");
    const popover = wrapper.get(".catalog-source-popover");
    expect(details.attributes("open")).toBeDefined();

    await popover.trigger("click");
    expect(onParentClick).not.toHaveBeenCalled();

    await popover.trigger("pointerdown");
    expect(onParentClick).not.toHaveBeenCalled();
    expect(onParentPointerDown).not.toHaveBeenCalled();
    wrapper.unmount();
  });
});
