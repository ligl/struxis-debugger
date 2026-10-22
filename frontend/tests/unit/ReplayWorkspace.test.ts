import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import ReplayWorkspace from "../../src/components/ReplayWorkspace.vue";
import RunChart from "../../src/components/RunChart.vue";

describe("ReplayWorkspace", () => {
  it("keeps the workspace composition mounted while gating the live chart by active mode", async () => {
    const wrapper = mount(ReplayWorkspace, {
      props: {
        active: false,
        origin: null,
        testDataset: null,
        runState: null,
        snapshots: [],
      },
      global: {
        stubs: {
          DualChartStack: true,
          RunChart: true,
          SnapshotReferencePanel: true,
        },
      },
    });

    expect(wrapper.get('[data-testid="replay-workspace"]').isVisible()).toBe(false);
    expect(wrapper.findComponent(RunChart).exists()).toBe(false);
    expect(wrapper.findComponent({ name: "SnapshotReferencePanel" }).exists()).toBe(true);

    await wrapper.setProps({ active: true });

    expect(wrapper.get('[data-testid="replay-workspace"]').isVisible()).toBe(true);
    expect(wrapper.findComponent(RunChart).exists()).toBe(true);
  });
});
