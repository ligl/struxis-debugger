import { flushPromises, mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import SnapshotReferencePanel from "../../src/components/SnapshotReferencePanel.vue";
import type { SnapshotArtifactDto, SnapshotReferenceDto } from "../../src/origin-types";

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

const reference = {
  snapshotId: "snapshot-complete-01",
  runId: "run-01",
  instrumentId: "AUD/USD.SIM",
  barType: "AUD/USD.SIM-5-MINUTE-LAST-EXTERNAL",
  timeframe: "5m",
  snapshotGeneratedAt: "1780000000000000000",
  sbarSequenceFingerprint: "a".repeat(64),
  bars: [{
    sbarId: "100", barType: "AUD/USD.SIM-5-MINUTE-LAST-EXTERNAL",
    tsEvent: "100", tsInit: "100", open: "10", high: "12", low: "9", close: "11", volume: "100",
  }],
  structure: { cbarCount: 0, cbars: [], swingCount: 0, swings: [] },
} as SnapshotReferenceDto;

const snapshots: SnapshotArtifactDto[] = [
  {
    fileName: "complete.snapshot",
    path: "/snapshots/complete.snapshot",
    kind: "complete",
    snapshotId: "snapshot-complete-01",
    runId: "run-01",
    stateKey: "state-key-01",
    instrumentId: "AUD/USD.SIM",
    barType: "AUD/USD.SIM-5-MINUTE-LAST-EXTERNAL",
    inputStartTsEvent: "100",
    inputEndTsEvent: "120",
    generatedAt: "2026-10-20T10:00:00Z",
    checkpointCount: 12,
    diagnostic: null,
  },
];

describe("SnapshotReferencePanel", () => {
  it("renders the verified historical chart for a selected completed Snapshot", async () => {
    invokeMock.mockResolvedValueOnce(reference);
    const wrapper = mount(SnapshotReferencePanel, {
      props: { instrumentId: "AUD/USD.SIM", snapshots },
      global: { stubs: { OriginChart: { template: '<div data-testid="snapshot-reference-chart-host"></div>' } } },
    });

    expect(wrapper.get(".snapshot-reference-instrument").text()).toBe("AUD/USD.SIM");
    const select = wrapper.get('[data-testid="replay-reference-select"]');
    expect(select.find('option[value="snapshot-complete-01"]').text()).toContain("2026-10-20T10:00:00Z");
    await select.setValue("snapshot-complete-01");
    await flushPromises();
    expect(wrapper.get(".snapshot-reference-instrument").text()).toBe("AUD/USD.SIM");
    expect(wrapper.get(".snapshot-reference-selected-label").text()).not.toContain("2026-10-20T10:00:00Z");
    expect(wrapper.get(".snapshot-reference-selected-label").text()).toContain("5m");
    expect(wrapper.get('[data-testid="snapshot-reference-chart"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="snapshot-reference-chart-host"]').exists()).toBe(true);
    expect(wrapper.text()).toContain("run-01");
    expect(wrapper.text()).toContain("aaaaaaaaaaaa");
    expect(invokeMock).toHaveBeenCalledWith("get_snapshot_reference", { snapshotId: "snapshot-complete-01" });
  });

  it("shows an embedded loading animation while resolving a selected Snapshot", async () => {
    let resolveReference!: (value: SnapshotReferenceDto) => void;
    invokeMock.mockReturnValueOnce(new Promise<SnapshotReferenceDto>((resolve) => {
      resolveReference = resolve;
    }));
    const wrapper = mount(SnapshotReferencePanel, {
      props: { instrumentId: "AUD/USD.SIM", snapshots },
    });

    await wrapper.get('[data-testid="replay-reference-select"]').setValue("snapshot-complete-01");
    expect(wrapper.get('[data-testid="snapshot-reference-loading"]').exists()).toBe(true);
    expect(wrapper.get(".snapshot-reference-loading-spinner").attributes("aria-hidden")).toBe("true");
    expect(wrapper.find('[data-testid="snapshot-reference-chart"]').exists()).toBe(false);

    resolveReference(reference);
    await flushPromises();
    expect(wrapper.find('[data-testid="snapshot-reference-loading"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="snapshot-reference-chart"]').exists()).toBe(true);
  });

  it("shows only completed Snapshots for the Live Replay instrument across timeframes", () => {
    const wrapper = mount(SnapshotReferencePanel, {
      props: {
        instrumentId: "AUD/USD.SIM",
        snapshots: [
          ...snapshots,
          {
            ...snapshots[0]!,
            fileName: "same-instrument-1m.snapshot",
            path: "/snapshots/same-instrument-1m.snapshot",
            snapshotId: "snapshot-same-instrument-1m",
            barType: "AUD/USD.SIM-1-MINUTE-LAST-EXTERNAL",
            generatedAt: "2026-10-21T10:00:00Z",
          },
          {
            ...snapshots[0]!,
            fileName: "other-instrument.snapshot",
            path: "/snapshots/other-instrument.snapshot",
            snapshotId: "snapshot-other-instrument",
            instrumentId: "BTCUSDT.BINANCE",
            barType: "BTCUSDT.BINANCE-5-MINUTE-LAST-EXTERNAL",
            generatedAt: "2026-10-22T10:00:00Z",
          },
        ],
      },
    });

    const select = wrapper.get('[data-testid="replay-reference-select"]');
    expect(wrapper.get(".snapshot-reference-select > span").text()).toBe("AUD/USD.SIM");
    expect(select.findAll("option")).toHaveLength(3);
    expect(select.text()).toContain("1m");
    expect(select.text()).toContain("5m");
    expect(select.find('option[value="snapshot-other-instrument"]').exists()).toBe(false);
  });

  it("does not offer non-complete artifacts as Replay references", () => {
    const wrapper = mount(SnapshotReferencePanel, {
      props: {
        instrumentId: "AUD/USD.SIM",
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
    expect(wrapper.find('[data-testid="snapshot-reference-chart"]').exists()).toBe(false);
  });

  it("clears the local selection when the referenced Snapshot disappears", async () => {
    const wrapper = mount(SnapshotReferencePanel, {
      props: { instrumentId: "AUD/USD.SIM", snapshots },
      global: { stubs: { OriginChart: { template: '<div data-testid="snapshot-reference-chart-host"></div>' } } },
    });
    invokeMock.mockResolvedValueOnce(reference);
    await wrapper.get('[data-testid="replay-reference-select"]').setValue("snapshot-complete-01");
    await flushPromises();
    expect(wrapper.find('[data-testid="snapshot-reference-chart"]').exists()).toBe(true);

    // Vue Test Utils' inferred public-instance type omits script-setup props here,
    // although setProps updates the component's runtime props correctly.
    await wrapper.setProps({ snapshots: [] } as never);
    expect(wrapper.find('[data-testid="snapshot-reference-chart"]').exists()).toBe(false);
    expect((wrapper.get('[data-testid="replay-reference-select"]').element as HTMLSelectElement).value).toBe("");
  });
});
