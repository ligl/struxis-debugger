import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import DualChartStack from "../../src/components/DualChartStack.vue";

describe("DualChartStack", () => {
  it("keeps upper and lower chart roles explicit and supports keyboard resizing", async () => {
    const wrapper = mount(DualChartStack, {
      props: { workspace: "replay" },
      slots: {
        upper: '<div data-testid="live-chart-slot">Live Replay</div>',
        lower: '<div data-testid="reference-chart-slot">Snapshot Reference</div>',
      },
    });

    expect(wrapper.get('[data-testid="live-chart-slot"]').text()).toBe("Live Replay");
    expect(wrapper.get('[data-testid="reference-chart-slot"]').text()).toBe("Snapshot Reference");

    const splitter = wrapper.get('[data-testid="replay-chart-splitter"]');
    expect(splitter.attributes("role")).toBe("separator");
    expect(splitter.attributes("aria-valuenow")).toBe("50");

    await splitter.trigger("keydown", { key: "ArrowDown" });
    expect(splitter.attributes("aria-valuenow")).toBe("52");

    await splitter.trigger("keydown", { key: "Home" });
    expect(splitter.attributes("aria-valuenow")).toBe("25");

    await splitter.trigger("keydown", { key: "ArrowUp" });
    expect(splitter.attributes("aria-valuenow")).toBe("25");

    await splitter.trigger("keydown", { key: "End" });
    expect(splitter.attributes("aria-valuenow")).toBe("75");
  });

  it("resizes the chart tracks from pointer movement within the stack", async () => {
    const wrapper = mount(DualChartStack, {
      props: { workspace: "compare" },
      slots: { upper: "Candidate", lower: "Baseline" },
    });
    const stack = wrapper.get('[data-testid="dual-chart-stack-compare"]').element;
    Object.defineProperty(stack, "getBoundingClientRect", {
      configurable: true,
      value: () => ({
        x: 0, y: 0, left: 0, top: 0, right: 800, bottom: 400,
        width: 800, height: 400, toJSON: () => ({}),
      }),
    });

    const splitter = wrapper.get('[data-testid="compare-chart-splitter"]');
    await splitter.trigger("pointerdown", { button: 0, clientY: 200 });
    window.dispatchEvent(new MouseEvent("pointermove", { clientY: 240 }));
    expect(splitter.attributes("aria-valuenow")).toBe("60");
    window.dispatchEvent(new MouseEvent("pointerup"));
    wrapper.unmount();
  });
});
