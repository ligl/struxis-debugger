import { flushPromises, mount } from "@vue/test-utils";
import { reactive, nextTick } from "vue";
import { describe, expect, it, vi } from "vitest";
import KeyZoneFixedPriceRangeControls from "../../src/components/KeyZoneFixedPriceRangeControls.vue";
import type { FixedPriceRangeResultDto, ObservationControlsContext } from "../../src/origin-types";
import { keyzoneBars } from "./keyzone-fixture";

function fixture() {
  const context: ObservationControlsContext = { runId: "run-a", cursorSbarId: "1700000120000000000", timeframe: "1m", bars: keyzoneBars(), enabled: true, disabledReason: "" };
  const create = vi.fn().mockResolvedValue({ keyzoneId: "9007199254740994" });
  const wrapper = mount(KeyZoneFixedPriceRangeControls, { props: { context, create } });
  return { wrapper, create, context };
}
async function fill(wrapper: ReturnType<typeof fixture>["wrapper"], lower: string, upper: string) {
  await wrapper.get('[aria-label="FixedPriceRange Lower"]').setValue(lower);
  await wrapper.get('[aria-label="FixedPriceRange Upper"]').setValue(upper);
}

describe("FixedPriceRange creation controls", () => {
  it("starts with empty prices and sends exact decimal strings with the Run cursor", async () => {
    const { wrapper, create, context } = fixture();
    await wrapper.get('button[aria-expanded]').trigger("click");
    expect(wrapper.get('[aria-label="FixedPriceRange Lower"]').element).toHaveProperty("value", "");
    expect(wrapper.get('[aria-label="FixedPriceRange Upper"]').element).toHaveProperty("value", "");
    expect(wrapper.get('button[type="submit"]').attributes("disabled")).toBeDefined();
    await fill(wrapper, "9007199254740993.00001", "9007199254740993.00002");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(create).toHaveBeenCalledExactlyOnceWith({ context: { runId: context.runId, expectedSbarId: context.cursorSbarId }, lower: "9007199254740993.00001", upper: "9007199254740993.00002" });
    expect(wrapper.get('[role="status"]').text()).toContain("Use New observation");
    expect(wrapper.find("form").exists()).toBe(false);
    await wrapper.get('button[aria-expanded]').trigger("click");
    expect(wrapper.get('[aria-label="FixedPriceRange Lower"]').element).toHaveProperty("value", "");
  });

  it("rejects malformed, equal and reversed decimal bounds without submitting", async () => {
    const { wrapper, create } = fixture();
    await wrapper.get('button[aria-expanded]').trigger("click");
    for (const [lower, upper] of [["NaN", "2"], ["1", "Infinity"], ["1", "1.00"], ["2", "1"], ["-1", "-2"]]) {
      await fill(wrapper, lower!, upper!);
      await wrapper.get("form").trigger("submit");
      expect(wrapper.get('button[type="submit"]').attributes("disabled")).toBeDefined();
    }
    expect(create).not.toHaveBeenCalled();
    await fill(wrapper, "-2.5", "-1");
    expect(wrapper.get('button[type="submit"]').attributes("disabled")).toBeUndefined();
  });

  it("blocks duplicate submissions and retains entered prices on backend failure", async () => {
    const { wrapper, create } = fixture();
    let reject!: (reason: Error) => void;
    create.mockImplementationOnce(() => new Promise<FixedPriceRangeResultDto>((_, failure) => { reject = failure; }));
    await wrapper.get('button[aria-expanded]').trigger("click");
    await fill(wrapper, "1", "2");
    await wrapper.get("form").trigger("submit");
    await wrapper.get("form").trigger("submit");
    expect(create).toHaveBeenCalledTimes(1);
    expect(wrapper.get("fieldset").attributes("disabled")).toBeDefined();
    reject(new Error("Run changed"));
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toBe("Run changed");
    expect(wrapper.get('[aria-label="FixedPriceRange Lower"]').element).toHaveProperty("value", "1");
  });

  it("disables creation outside a paused Run and clears the form on Run change", async () => {
    const f = fixture();
    const context = reactive(f.context);
    const wrapper = mount(KeyZoneFixedPriceRangeControls, { props: { context, create: f.create } });
    await wrapper.get('button[aria-expanded]').trigger("click");
    await fill(wrapper, "1", "2");
    context.runId = "run-b";
    await nextTick();
    expect(wrapper.find("form").exists()).toBe(false);
    await wrapper.get('button[aria-expanded]').trigger("click");
    expect(wrapper.get('[aria-label="FixedPriceRange Lower"]').element).toHaveProperty("value", "");
    context.enabled = false;
    context.disabledReason = "Pause playback";
    await nextTick();
    expect(wrapper.get('button[aria-expanded]').attributes("disabled")).toBeDefined();
    expect(wrapper.text()).toContain("Pause playback");
    const empty = mount(KeyZoneFixedPriceRangeControls, { props: { create: f.create } });
    expect(empty.get('button[aria-expanded]').attributes("disabled")).toBeDefined();
  });
});
