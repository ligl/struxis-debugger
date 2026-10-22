import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import SnapshotReferencePanel from "../../src/components/SnapshotReferencePanel.vue";
import type { SnapshotArtifactDto } from "../../src/origin-types";

const snapshots: SnapshotArtifactDto[] = [
  {
    fileName: "complete.snapshot",
    path: "/snapshots/complete.snapshot",
    kind: "complete",
    snapshotId: "snapshot-complete-01",
    runId: "run-01",
    stateKey: "state-key-01",
    generatedAt: "2026-10-20T10:00:00Z",
    checkpointCount: 12,
    diagnostic: null,
  },
];

describe("SnapshotReferencePanel", () => {
  it("shows a selected completed Snapshot without fabricating chart data", async () => {
    const wrapper = mount(SnapshotReferencePanel, { props: { snapshots } });

    await wrapper.get('[data-testid="replay-reference-select"]').setValue("snapshot-complete-01");
    expect(wrapper.get('[data-testid="snapshot-reference-selected"]').text()).toContain("snapshot-complete-01");
    expect(wrapper.text()).toContain("run-01");
    expect(wrapper.text()).toContain("authoritative SBar OHLCV sequence");
    expect(wrapper.find('[data-testid="snapshot-reference-chart-host"]').exists()).toBe(false);
  });

  it("does not offer non-complete artifacts as Replay references", () => {
    const wrapper = mount(SnapshotReferencePanel, {
      props: {
        snapshots: [{
          fileName: "failed.snapshot",
          path: "/snapshots/failed.snapshot",
          kind: "failedTemporary",
          snapshotId: "snapshot-failed-01",
          runId: "run-failed",
          stateKey: "state-key-failed",
          generatedAt: "2026-10-20T10:00:00Z",
          checkpointCount: 1,
          diagnostic: "failed",
        }],
      },
    });

    const select = wrapper.get('[data-testid="replay-reference-select"]');
    expect((select.element as HTMLSelectElement).disabled).toBe(true);
    expect(select.findAll("option")).toHaveLength(1);
    expect(wrapper.get('[data-testid="snapshot-reference-empty"]').text().toLowerCase()).toContain("no completed snapshot available");
    expect(wrapper.find('[data-testid="snapshot-reference-selected"]').exists()).toBe(false);
  });

  it("clears the local selection when the referenced Snapshot disappears", async () => {
    const wrapper = mount(SnapshotReferencePanel, { props: { snapshots } });
    await wrapper.get('[data-testid="replay-reference-select"]').setValue("snapshot-complete-01");
    expect(wrapper.find('[data-testid="snapshot-reference-selected"]').exists()).toBe(true);

    // Vue Test Utils' inferred public-instance type omits script-setup props here,
    // although setProps updates the component's runtime props correctly.
    await wrapper.setProps({ snapshots: [] } as never);
    expect(wrapper.find('[data-testid="snapshot-reference-selected"]').exists()).toBe(false);
    expect((wrapper.get('[data-testid="replay-reference-select"]').element as HTMLSelectElement).value).toBe("");
  });
});
