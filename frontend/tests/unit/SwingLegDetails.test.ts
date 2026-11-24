import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import SwingLegDetails from "../../src/components/SwingLegDetails.vue";
import type { LegDto } from "../../src/origin-types";

const observation: LegDto = {
  direction: "Down", endKind: "Observation",
  cbarStartId: "9007199254740993", cbarEndId: "9007199254741000",
  sbarStartId: "9007199254740994", sbarEndId: "9007199254741000",
  startPrice: "36.001", endPrice: "29.002", high: "37.000", low: "28.000",
  highSbarId: "9007199254740994", lowSbarId: "9007199254740999",
  volume: "5.10", spanSbars: 3,
};

describe("Swing Leg disclosure", () => {
  it("opens both disclosure levels and retains them as the same Leg is revised", async () => {
    const wrapper = mount(SwingLegDetails, { props: { swingId: "20", legs: [observation] } });
    const outer = wrapper.get("button[aria-expanded]");
    expect(outer.text()).toContain("Legs (1)");
    expect(outer.attributes("aria-expanded")).toBe("false");
    await outer.trigger("click");
    const row = wrapper.get("li button[aria-expanded]");
    expect(row.text()).toContain("Observation");
    expect(row.text()).toContain("36.001 → 29.002");
    await row.trigger("click");
    expect(row.attributes("aria-expanded")).toBe("true");
    expect(wrapper.get("li dl").text()).toContain("5.10");

    await wrapper.setProps({ legs: [{ ...observation, endKind: "Fractal", endPrice: "28.000" }] } as never);
    expect(outer.attributes("aria-expanded")).toBe("true");
    expect(row.attributes("aria-expanded")).toBe("true");
    expect(row.text()).toContain("Fractal");
    expect(row.text()).toContain("36.001 → 28.000");

    await wrapper.setProps({ legs: [{ ...observation, cbarStartId: "9007199254740996" }] } as never);
    expect(wrapper.get("li button").attributes("aria-expanded")).toBe("false");
  });

  it("highlights by domain anchors and clears the highlight when the section closes", async () => {
    const wrapper = mount(SwingLegDetails, { props: { swingId: "20", legs: [observation] } });
    const outer = wrapper.get("button");
    await outer.trigger("click");
    await wrapper.get("li").trigger("mouseenter");
    const reference = { swingId: "20", cbarStartId: observation.cbarStartId, sbarStartId: observation.sbarStartId };
    expect(wrapper.emitted("legHighlight")?.at(-1)).toEqual([reference]);
    await wrapper.get("li").trigger("mouseleave");
    expect(wrapper.emitted("legHighlight")?.at(-1)).toEqual([null]);
    await wrapper.get("li button").trigger("focusin");
    expect(wrapper.emitted("legHighlight")?.at(-1)).toEqual([reference]);
    await outer.trigger("click");
    expect(outer.attributes("aria-expanded")).toBe("false");
    expect(wrapper.emitted("legHighlight")?.at(-1)).toEqual([null]);
  });

  it("marks a legacy Swing whose Leg composition was not recorded", () => {
    const wrapper = mount(SwingLegDetails, { props: { swingId: "20" } });
    expect(wrapper.text()).toContain("Legs not recorded");
    expect(wrapper.find("button").exists()).toBe(false);
  });
});
