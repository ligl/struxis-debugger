import { mount } from "@vue/test-utils";
import { defineComponent, nextTick, ref } from "vue";
import { describe, expect, it } from "vitest";
import ReplayWorkspace from "../../src/components/ReplayWorkspace.vue";

const DualChartStackStub = defineComponent({
  name: "DualChartStack",
  template: "<section><slot name=\"upper\" /><slot name=\"lower\" /></section>",
});
const RunChartStub = defineComponent({
  name: "RunChart",
  template: "<div data-testid=\"run-chart-stub\" />",
});
const SnapshotReferencePanelStub = defineComponent({
  name: "SnapshotReferencePanel",
  template: "<div data-testid=\"snapshot-reference-panel-stub\" />",
});

describe("ReplayWorkspace", () => {
  it("keeps the workspace composition mounted while gating the live chart by active mode", async () => {
    const active = ref(false);
    const Host = defineComponent({
      components: { ReplayWorkspace },
      setup() {
        return { active };
      },
      template: `
        <ReplayWorkspace
          :active="active"
          :origin="null"
          :test-dataset="null"
          :run-state="null"
          :snapshots="[]"
        />
      `,
    });
    const wrapper = mount(Host, {
      global: {
        stubs: {
          DualChartStack: DualChartStackStub,
          RunChart: RunChartStub,
          SnapshotReferencePanel: SnapshotReferencePanelStub,
        },
      },
    });

    expect(wrapper.get('[data-testid="replay-workspace"]').isVisible()).toBe(false);
    expect(wrapper.find('[data-testid="run-chart-stub"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="snapshot-reference-panel-stub"]').exists()).toBe(true);

    active.value = true;
    await nextTick();

    expect(wrapper.get('[data-testid="replay-workspace"]').attributes("style") ?? "").not.toContain("display: none");
    expect(wrapper.find('[data-testid="run-chart-stub"]').exists()).toBe(true);
  });
});
