import { describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import InspectorDomainId from "../../src/components/InspectorDomainId.vue";
import { inspectorChartHoverKey } from "../../src/inspector-chart-hover";

describe("InspectorDomainId", () => {
  it("groups long IDs from the right without changing their characters", () => {
    const wrapper = mount(InspectorDomainId, {
      props: { value: "1719024300000123456" },
    });

    expect(wrapper.findAll(".inspector-domain-id-group").map((group) => group.text()))
      .toEqual(["171", "9024", "3000", "0012", "3456"]);
    expect(wrapper.get("code").attributes("data-copy-value")).toBe("1719024300000123456");
  });

  it("preserves short and non-numeric IDs without padding or conversion", () => {
    const short = mount(InspectorDomainId, { props: { value: "abc" } });
    expect(short.findAll(".inspector-domain-id-group").map((group) => group.text())).toEqual(["abc"]);

    const nonNumeric = mount(InspectorDomainId, { props: { value: "ab-cd" } });
    expect(nonNumeric.findAll(".inspector-domain-id-group").map((group) => group.text()))
      .toEqual(["a", "b-cd"]);
    expect(nonNumeric.get("code").attributes("data-copy-value")).toBe("ab-cd");
  });

  it("keeps the raw copy value independent from the displayed ID", () => {
    const wrapper = mount(InspectorDomainId, {
      props: { value: "123456789", copyValue: "123456789", testId: "domain-id" },
    });

    expect(wrapper.get('[data-testid="domain-id"]').attributes("data-copy-value")).toBe("123456789");
    expect(wrapper.text()).toContain("123456789");
  });

  it("sends an exact typed reference for hover and focus while preserving copy", async () => {
    const update = vi.fn();
    const id = "1719024300000123456";
    const wrapper = mount(InspectorDomainId, {
      props: { value: id, copyValue: "raw-copy", referenceKind: "sbar" },
      global: { provide: { [inspectorChartHoverKey]: update } },
    });
    const code = wrapper.get("code");
    expect(code.attributes("tabindex")).toBe("0");
    expect(code.attributes("data-copy-value")).toBe("raw-copy");
    await code.trigger("mouseenter");
    const source = update.mock.calls[0]![0];
    expect(update).toHaveBeenLastCalledWith(source, "pointer", { kind: "sbar", id });
    await code.trigger("focus");
    expect(update).toHaveBeenLastCalledWith(source, "focus", { kind: "sbar", id });
    await code.trigger("mouseleave");
    expect(update).toHaveBeenLastCalledWith(source, "pointer", null);
    wrapper.unmount();
    expect(update).toHaveBeenLastCalledWith(source, "focus", null);
  });

  it("keeps non-chart IDs out of the focus order", async () => {
    const update = vi.fn();
    const wrapper = mount(InspectorDomainId, {
      props: { value: "run-01" },
      global: { provide: { [inspectorChartHoverKey]: update } },
    });
    const code = wrapper.get("code");
    expect(code.attributes("tabindex")).toBeUndefined();
    await code.trigger("mouseenter");
    expect(update.mock.calls.every(([, , target]) => target === null)).toBe(true);
  });
});
