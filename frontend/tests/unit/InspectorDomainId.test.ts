import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import InspectorDomainId from "../../src/components/InspectorDomainId.vue";

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
});
