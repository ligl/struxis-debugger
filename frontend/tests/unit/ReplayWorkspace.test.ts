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
  props: {
    syncEnabled: { type: Boolean, default: false },
    syncRequest: { type: Object, default: null },
  },
  template: '<div data-testid="run-chart-stub" :data-sync-enabled="syncEnabled" :data-has-sync-request="syncRequest !== null" />',
});
const SnapshotReferencePanelStub = defineComponent({
  name: "SnapshotReferencePanel",
  props: {
    progressApplies: { type: Boolean, default: false },
    processedCount: { type: Number, default: 0 },
    syncRequest: { type: Object, default: null },
  },
  emits: ["syncEligibility", "viewportChange"],
  template: `
    <div data-testid="snapshot-reference-panel-stub" :data-progress-applies="progressApplies" :data-processed-count="processedCount" :data-has-sync-request="syncRequest !== null">
      <button data-testid="sync-enable" @click="$emit('syncEligibility', true, 1)">enable sync</button>
      <button data-testid="sync-disable" @click="$emit('syncEligibility', false, null)">disable sync</button>
      <button data-testid="snapshot-viewport-change" @click="$emit('viewportChange', { source: 'reference', from: 2, to: 5 })">change viewport</button>
    </div>
  `,
});

describe("ReplayWorkspace", () => {
  it("passes Live progress applicability and authoritative processed count to Snapshot Reference", () => {
    const Host = defineComponent({
      components: { ReplayWorkspace },
      setup() {
        return {
          active: true,
          origin: { originDatasetId: "origin-1", bars: [{ sbarId: "1" }, { sbarId: "2" }, { sbarId: "3" }, { sbarId: "4" }] },
          testDataset: { testDatasetId: "test-1", originDatasetId: "origin-1", instrumentId: "AUD/USD.SIM", barType: "AUD/USD.SIM-5-MINUTE-LAST-EXTERNAL", startSbarId: "1", endSbarId: "4", sbarCount: 4 },
          runState: { runId: "run-1", testDatasetId: "test-1", inputCount: 8, processedCount: 2, status: "paused" },
          playbackStatus: "paused",
        };
      },
      template: '<ReplayWorkspace :active="active" :origin="origin" :test-dataset="testDataset" :run-state="runState" :playback-status="playbackStatus" :structure="null" :selected-object="null" :snapshots="[]" />',
    });
    const wrapper = mount(Host, {
      global: { stubs: { DualChartStack: DualChartStackStub, RunChart: RunChartStub, SnapshotReferencePanel: SnapshotReferencePanelStub } },
    });
    const referencePanel = wrapper.get('[data-testid="snapshot-reference-panel-stub"]');
    expect(referencePanel.attributes("data-progress-applies")).toBe("true");
    expect(referencePanel.attributes("data-processed-count")).toBe("2");
  });
  it("isolates both chart viewports whenever synchronization eligibility is lost", async () => {
    const Host = defineComponent({
      components: { ReplayWorkspace },
      setup() {
        return {
          active: true,
          origin: { originDatasetId: "origin-1", bars: [{ sbarId: "1" }, { sbarId: "2" }, { sbarId: "3" }, { sbarId: "4" }] },
          testDataset: { testDatasetId: "test-1", originDatasetId: "origin-1", instrumentId: "AUD/USD.SIM", barType: "AUD/USD.SIM-5-MINUTE-LAST-EXTERNAL", startSbarId: "1", endSbarId: "4", sbarCount: 4 },
          runState: { runId: "run-1", testDatasetId: "test-1", inputCount: 4, processedCount: 1, status: "paused" },
        };
      },
      template: '<ReplayWorkspace :active="active" :origin="origin" :test-dataset="testDataset" :run-state="runState" :structure="null" :selected-object="null" :snapshots="[]" />',
    });
    const wrapper = mount(Host, {
      global: { stubs: { DualChartStack: DualChartStackStub, RunChart: RunChartStub, SnapshotReferencePanel: SnapshotReferencePanelStub } },
    });
    const live = wrapper.get('[data-testid="run-chart-stub"]');
    const snapshot = wrapper.get('[data-testid="snapshot-reference-panel-stub"]');

    expect(live.attributes("data-sync-enabled")).toBe("false");
    expect(live.attributes("data-has-sync-request")).toBe("false");
    await snapshot.get('[data-testid="snapshot-viewport-change"]').trigger("click");
    expect(live.attributes("data-has-sync-request")).toBe("false");

    await snapshot.get('[data-testid="sync-enable"]').trigger("click");
    await snapshot.get('[data-testid="snapshot-viewport-change"]').trigger("click");
    expect(live.attributes("data-sync-enabled")).toBe("true");
    expect(live.attributes("data-has-sync-request")).toBe("true");

    await snapshot.get('[data-testid="sync-disable"]').trigger("click");
    expect(live.attributes("data-sync-enabled")).toBe("false");
    expect(live.attributes("data-has-sync-request")).toBe("false");
    expect(snapshot.attributes("data-has-sync-request")).toBe("false");
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
    expect(wrapper.get('[data-testid="snapshot-reference-panel-stub"]').attributes("data-progress-applies")).toBe("false");
    expect(wrapper.get('[data-testid="snapshot-reference-panel-stub"]').attributes("data-processed-count")).toBe("0");

    active.value = true;
    await nextTick();

    expect(wrapper.get('[data-testid="replay-workspace"]').attributes("style") ?? "").not.toContain("display: none");
    expect(wrapper.find('[data-testid="run-chart-stub"]').exists()).toBe(true);
  });
});
