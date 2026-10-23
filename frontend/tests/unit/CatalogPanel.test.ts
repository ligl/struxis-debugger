import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import CatalogPanel from "../../src/components/CatalogPanel.vue";

describe("CatalogPanel", () => {
  it("keeps Catalog refresh available when unrelated mutations are blocked", async () => {
    const props = {
      datasets: [],
      selectedId: "",
      selectedDataset: null,
      instrumentGroups: [],
      refreshing: false,
      loading: false,
      mutationBusy: true,
      discoveryError: "",
      enableStructure: true,
      origin: null,
      loadStatus: "idle" as const,
      loadError: "",
      formatDomainTimestamp: (value: string | null) => value ?? "—",
    };
    const mountPanel = (overrides: Partial<typeof props> = {}) => mount(CatalogPanel, {
      props: { ...props, ...overrides },
      global: { stubs: { OriginPanel: true } },
    });
    let wrapper = mountPanel();

    const refresh = wrapper.get('[data-testid="catalog-refresh"]');
    expect((refresh.element as HTMLButtonElement).disabled).toBe(false);

    await refresh.trigger("click");
    expect(wrapper.emitted("refresh")).toHaveLength(1);

    wrapper.unmount();
    wrapper = mountPanel({ refreshing: true });
    expect((wrapper.get('[data-testid="catalog-refresh"]').element as HTMLButtonElement).disabled).toBe(true);

    wrapper.unmount();
    wrapper = mountPanel({ loading: true });
    expect((wrapper.get('[data-testid="catalog-refresh"]').element as HTMLButtonElement).disabled).toBe(true);
    wrapper.unmount();
  });

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

  it("closes the status popover when pointering outside it", async () => {
    const wrapper = mount(CatalogPanel, {
      props: {
        datasets: [],
        selectedId: "",
        selectedDataset: null,
        instrumentGroups: [],
        refreshing: false,
        loading: false,
        mutationBusy: false,
        discoveryError: "",
        enableStructure: true,
        origin: null,
        loadStatus: "idle",
        loadError: "",
        formatDomainTimestamp: (value: string | null) => value ?? "—",
      },
      global: {
        stubs: { OriginPanel: true },
      },
      attachTo: document.body,
    });

    const details = wrapper.get(".catalog-source-details").element as HTMLDetailsElement;
    details.open = true;
    await wrapper.vm.$nextTick();
    expect(details.open).toBe(true);

    document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    expect(details.open).toBe(false);

    details.open = true;
    await wrapper.vm.$nextTick();
    wrapper.get(".catalog-source-popover").element.dispatchEvent(
      new Event("pointerdown", { bubbles: true }),
    );
    expect(details.open).toBe(true);

    wrapper.unmount();
  });
});
