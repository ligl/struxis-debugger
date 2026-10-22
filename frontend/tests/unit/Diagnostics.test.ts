import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import Diagnostics from "../../src/components/Diagnostics.vue";

const baseProps = {
  dock: "bottom" as const,
  collapsed: true,
  width: 330,
  height: 164,
  widthLimit: () => 600,
  heightLimit: () => 400,
  discoveryError: "",
  loadError: "",
  testError: "",
  runError: "",
  snapshotsError: "",
};

describe("Diagnostics", () => {
  it("renders the diagnostics dock and reports layout interactions to its owner", async () => {
    const wrapper = mount(Diagnostics, { props: baseProps });

    expect(wrapper.get('[data-testid="diagnostics-dock"]').classes()).toContain("dock-bottom");
    expect(wrapper.get('[data-testid="diagnostics-dock"]').classes()).toContain("collapsed");
    expect(wrapper.get('[data-testid="diagnostics-resize-edge"]').attributes("aria-valuemax")).toBe("400");

    await wrapper.get('[data-testid="diagnostics-dock-right"]').trigger("click");
    expect(wrapper.emitted("set-dock")).toEqual([["right"]]);
    expect(wrapper.emitted("close-dock-menus")).toHaveLength(1);

    await wrapper.get('[data-testid="diagnostics-collapse-toggle"]').trigger("click");
    expect(wrapper.emitted("toggle-collapsed")).toHaveLength(1);

    await wrapper.get('[data-testid="diagnostics-heading"]').trigger("click");
    expect(wrapper.emitted("heading-click")).toHaveLength(1);
  });

  it("owns category selection and renders current diagnostics errors", async () => {
    const wrapper = mount(Diagnostics, {
      props: { ...baseProps, loadError: "Origin data mismatch" },
    });

    expect(wrapper.text()).toContain("Origin Load: Origin data mismatch");
    await wrapper.get('[data-testid="diagnostics-category-tabs"] button:nth-child(2)').trigger("click");
    expect(wrapper.get('[data-testid="diagnostics-category-tabs"] button:nth-child(2)').attributes("aria-pressed")).toBe("true");
    expect(wrapper.get('[data-testid="diagnostics-category-tabs"] button:first-child').attributes("aria-pressed")).toBe("false");
  });

  it("shows the empty state when there are no active errors", () => {
    const wrapper = mount(Diagnostics, { props: baseProps });
    expect(wrapper.text()).toContain("No active errors.");
  });
});
