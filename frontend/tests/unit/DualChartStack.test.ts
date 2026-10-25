import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { nextTick } from "vue";
import DualChartStack from "../../src/components/DualChartStack.vue";

describe("DualChartStack", () => {
  it("keeps upper and lower chart roles explicit and supports keyboard resizing", async () => {
    const wrapper = mount(DualChartStack, {
      attachTo: document.body,
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
    // Replay defaults to the maximum upper-chart share, leaving the lower chart at its minimum share.
    expect(splitter.attributes("aria-valuenow")).toBe("75");

    // Hovering alone must not steal arrow keys from chart interactions.
    await splitter.trigger("mouseenter");
    expect(document.activeElement).not.toBe(splitter.element);

    // An explicit click gives the splitter keyboard-resize focus.
    await splitter.trigger("click");
    expect(document.activeElement).toBe(splitter.element);
    await splitter.trigger("keydown", { key: "ArrowUp" });
    expect(splitter.attributes("aria-valuenow")).toBe("73");

    await splitter.trigger("keydown", { key: "Home" });
    expect(splitter.attributes("aria-valuenow")).toBe("25");
    await splitter.trigger("keydown", { key: "ArrowDown" });
    expect(splitter.attributes("aria-valuenow")).toBe("27");

    // ArrowUp cannot reduce the upper share below its 25% minimum.
    await splitter.trigger("keydown", { key: "Home" });
    await splitter.trigger("keydown", { key: "ArrowUp" });
    expect(splitter.attributes("aria-valuenow")).toBe("25");

    await splitter.trigger("keydown", { key: "End" });
    expect(splitter.attributes("aria-valuenow")).toBe("75");
    wrapper.unmount();
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
    expect(splitter.attributes("aria-valuenow")).toBe("50");

    // jsdom may not expose PointerEvent; dispatch MouseEvents with the
    // pointer event names so button/clientY are present on the event object.
    splitter.element.dispatchEvent(
      new MouseEvent("pointerdown", {
        button: 0,
        clientY: 200,
        bubbles: true,
        cancelable: true,
      }),
    );
    window.dispatchEvent(new MouseEvent("pointermove", { clientY: 240 }));
    await nextTick();
    expect(splitter.attributes("aria-valuenow")).toBe("60");
    window.dispatchEvent(new MouseEvent("pointerup"));
    wrapper.unmount();
  });
});
