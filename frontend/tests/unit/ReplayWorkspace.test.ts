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
  props: {
    isPlaying: { type: Boolean, default: false },
    replayProgress: { type: Number, default: 0 },
  },
  template: '<div data-testid="snapshot-reference-panel-stub" :data-is-playing="isPlaying" :data-replay-progress="replayProgress" />',
});

describe("ReplayWorkspace", () => {
  it("passes frontend playback state and authoritative Run progress to Snapshot Reference", () => {
    const Host = defineComponent({
      components: { ReplayWorkspace },
      setup() {
        return {
          active: true,
          origin: { originDatasetId: "origin-1", bars: [{ sbarId: "1" }, { sbarId: "2" }, { sbarId: "3" }, { sbarId: "4" }] },
          testDataset: { testDatasetId: "test-1", originDatasetId: "origin-1", instrumentId: "AUD/USD.SIM", barType: "AUD/USD.SIM-5-MINUTE-LAST-EXTERNAL", startSbarId: "1", endSbarId: "4", sbarCount: 4 },
          runState: { runId: "run-1", testDatasetId: "test-1", inputCount: 8, processedCount: 2, status: "paused" },
          playbackStatus: "playing",
        };
      },
      template: '<ReplayWorkspace :active="active" :origin="origin" :test-dataset="testDataset" :run-state="runState" :playback-status="playbackStatus" :structure="null" :selected-object="null" :snapshots="[]" />',
    });
    const wrapper = mount(Host, {
      global: { stubs: { DualChartStack: DualChartStackStub, RunChart: RunChartStub, SnapshotReferencePanel: SnapshotReferencePanelStub } },
    });
    const referencePanel = wrapper.get('[data-testid="snapshot-reference-panel-stub"]');
    expect(referencePanel.attributes("data-is-playing")).toBe("true");
    expect(referencePanel.attributes("data-replay-progress")).toBe("0.25");
  });
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
          :structure="null"
          :selected-object="null"
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
    expect(wrapper.get('[data-testid="snapshot-reference-panel-stub"]').attributes("data-is-playing")).toBe("false");
    expect(wrapper.get('[data-testid="snapshot-reference-panel-stub"]').attributes("data-replay-progress")).toBe("0");

    active.value = true;
    await nextTick();

    expect(wrapper.get('[data-testid="replay-workspace"]').attributes("style") ?? "").not.toContain("display: none");
    expect(wrapper.find('[data-testid="run-chart-stub"]').exists()).toBe(true);
  });
});
