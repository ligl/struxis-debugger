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
    const wrapper = mount(SnapshotReferencePanel, {
      props: { snapshots, selectedSnapshotId: "snapshot-complete-01" },
    });

    expect(wrapper.get('[data-testid="snapshot-reference-selected"]').text()).toContain("snapshot-complete-01");
    expect(wrapper.text()).toContain("run-01");
    expect(wrapper.text()).toContain("historical SBar OHLCV sequence");
    expect(wrapper.find('[data-testid="snapshot-reference-chart-host"]').exists()).toBe(false);
  });

  it("does not offer non-complete artifacts as Replay references", () => {
    const wrapper = mount(SnapshotReferencePanel, {
      props: {
        snapshots: [{
          ...snapshots[0],
          kind: "failedTemporary",
          snapshotId: "snapshot-failed-01",
        }],
        selectedSnapshotId: "snapshot-failed-01",
      },
    });

    const select = wrapper.get('[data-testid="replay-reference-select"]');
    expect((select.element as HTMLSelectElement).disabled).toBe(true);
    expect(select.findAll("option")).toHaveLength(1);
    expect(wrapper.get('[data-testid="snapshot-reference-empty"]').text()).toContain("No completed Snapshot available");
    expect(wrapper.find('[data-testid="snapshot-reference-selected"]').exists()).toBe(false);
  });

  it("emits an explicit selection change", async () => {
    const wrapper = mount(SnapshotReferencePanel, {
      props: { snapshots, selectedSnapshotId: null },
    });

    await wrapper.get('[data-testid="replay-reference-select"]').setValue("snapshot-complete-01");
    expect(wrapper.emitted("update:selectedSnapshotId")).toEqual([["snapshot-complete-01"]]);
  });
});
