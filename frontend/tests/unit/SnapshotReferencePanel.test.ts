import { config, enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import SnapshotReferencePanel from "../../src/components/SnapshotReferencePanel.vue";

// This suite tests Snapshot selection / loading orchestration, not Lightweight Charts internals.
// Stub at the Vue Test Utils global level so every mount (including async loading tests)
// avoids creating real canvas observers and animation-frame callbacks in jsdom.
config.global.stubs = {
  ...config.global.stubs,
  SnapshotReferenceChart: {
    props: [
      "bars",
      "structure",
      "snapshotId",
      "syncEnabled",
      "syncRequest",
      "crosshairSync",
      "liveBarCount",
      "playbackEnabled",
      "playbackOffset",
      "processedCount",
    ],
    template: `<div
      data-testid="snapshot-reference-chart-host"
      :snapshot-playback-enabled="playbackEnabled"
      :snapshot-playback-offset="playbackOffset"
      :snapshot-processed-count="processedCount"
    ></div>`,
  },
};
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
  structureTimeline: [{
    sbarId: "100",
    structure: { cbarCount: 0, cbars: [], swingCount: 0, swings: [] },
  }],
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

enableAutoUnmount(afterEach);

describe("SnapshotReferencePanel", () => {
  it("renders the verified historical chart for a selected completed Snapshot", async () => {
    invokeMock.mockResolvedValueOnce(reference);
    const wrapper = mount(SnapshotReferencePanel, {
      props: { instrumentId: "AUD/USD.SIM", snapshots },
    });

    expect(wrapper.get(".snapshot-reference-instrument").text()).toBe("AUD/USD.SIM");
    const control = wrapper.get(".snapshot-reference-control");
    const initialLabelLength = wrapper.get(".snapshot-reference-selected-label").text().length;
    expect(control.attributes("style")).toContain(`calc(${initialLabelLength}ch + 23px)`);
    expect(control.attributes("style")).not.toContain("32vw");
    const select = wrapper.get('[data-testid="replay-reference-select"]');
    expect(select.find('option[value="snapshot-complete-01"]').text()).toContain("2026-10-20T10:00:00Z");
    await select.setValue("snapshot-complete-01");
    await flushPromises();
    expect(wrapper.get(".snapshot-reference-instrument").text()).toBe("AUD/USD.SIM");
    expect(wrapper.get(".snapshot-reference-selected-label").text()).not.toContain("2026-10-20T10:00:00Z");
    expect(wrapper.get(".snapshot-reference-selected-label").text()).toContain("5m");
    const selectedLabelLength = wrapper.get(".snapshot-reference-selected-label").text().length;
    expect(control.attributes("style")).toContain(`calc(${selectedLabelLength}ch + 23px)`);
    expect(selectedLabelLength).toBeGreaterThan(initialLabelLength);
    expect(wrapper.find('[data-testid="snapshot-reference-chart"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="snapshot-reference-chart-host"]').exists()).toBe(true);
    expect(wrapper.text()).toContain("run-01");
    expect(wrapper.get('[data-testid="snapshot-reference-metadata"]').text()).toContain("2026-05-28 20:26:40");
    expect(wrapper.text()).toContain("aaaaaaaaaaaa");
    expect(invokeMock).toHaveBeenCalledWith("get_snapshot_reference", { snapshotId: "snapshot-complete-01" });
  });

  it("keeps Snapshot brightness aligned with Live progress when continuous Play is inactive", async () => {
    invokeMock.mockResolvedValueOnce(reference);
    const wrapper = mount(SnapshotReferencePanel, {
      props: {
        instrumentId: "AUD/USD.SIM",
        snapshots,
        liveSbarIds: ["100"],
        syncEligible: true,
        syncOffset: 0,
        progressApplies: true,
        processedCount: 0,
      },
    });

    await wrapper.get('[data-testid="replay-reference-select"]').setValue("snapshot-complete-01");
    await flushPromises();
    const chart = wrapper.get('[data-testid="snapshot-reference-chart"]');
    expect(chart.attributes("data-sync-eligible")).toBe("true");
    expect(wrapper.get('[data-testid="snapshot-reference-sync-indicator"]').attributes("aria-label"))
      .toBe("Viewport synchronization available");
    expect(chart.attributes("data-progress-active")).toBe("true");
    expect(chart.attributes("style") ?? "").not.toContain("brightness(");
    const chartStub = wrapper.get('[data-testid="snapshot-reference-chart-host"]');
    expect(chartStub.attributes("snapshot-playback-enabled")).toBe("true");
    expect(chartStub.attributes("snapshot-playback-offset")).toBe("0");
    expect(chartStub.attributes("snapshot-processed-count")).toBe("0");

    await wrapper.setProps({ processedCount: 1 } as never);
    expect(wrapper.get('[data-testid="snapshot-reference-chart-host"]').attributes("snapshot-processed-count")).toBe("1");
    expect(wrapper.get('[data-testid="snapshot-reference-chart-host"]').attributes("snapshot-playback-enabled")).toBe("false");
    expect(chart.attributes("data-progress-active")).toBe("false");
  });

  it("keeps Snapshot Reference independent when the Replay coordinator marks sync ineligible", async () => {
    invokeMock.mockResolvedValueOnce(reference);
    const wrapper = mount(SnapshotReferencePanel, {
      props: {
        instrumentId: "AUD/USD.SIM",
        snapshots,
        liveSbarIds: ["100"],
        syncEligible: false,
        syncOffset: null,
        progressApplies: true,
        processedCount: 0,
      },
    });

    await wrapper.get('[data-testid="replay-reference-select"]').setValue("snapshot-complete-01");
    await flushPromises();
    expect(wrapper.get('[data-testid="snapshot-reference-chart"]').attributes("data-sync-eligible")).toBe("false");
    expect(wrapper.find('[data-testid="snapshot-reference-sync-indicator"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="snapshot-reference-chart-host"]').attributes("snapshot-playback-enabled")).toBe("false");
    expect(wrapper.get('[data-testid="snapshot-reference-chart"]').attributes("style") ?? "").not.toContain("brightness(");

    await wrapper.setProps({ syncEligible: false, syncOffset: null } as never);
    expect(wrapper.get('[data-testid="snapshot-reference-chart"]').attributes("data-sync-eligible")).toBe("false");
    expect(wrapper.find('[data-testid="snapshot-reference-sync-indicator"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="snapshot-reference-chart"]').attributes("style") ?? "").not.toContain("brightness(");
  });

  it("ignores a stale async result when Snapshot selection changes rapidly", async () => {
    let resolveFirst!: (value: SnapshotReferenceDto) => void;
    let resolveSecond!: (value: SnapshotReferenceDto) => void;
    invokeMock
      .mockReturnValueOnce(new Promise<SnapshotReferenceDto>((resolve) => { resolveFirst = resolve; }))
      .mockReturnValueOnce(new Promise<SnapshotReferenceDto>((resolve) => { resolveSecond = resolve; }));
    const secondSnapshotId = "snapshot-complete-02";
    const wrapper = mount(SnapshotReferencePanel, {
      props: {
        instrumentId: "AUD/USD.SIM",
        snapshots: [
          ...snapshots,
          { ...snapshots[0]!, fileName: "second.snapshot", path: "/snapshots/second.snapshot", snapshotId: secondSnapshotId, runId: "run-02" },
        ],
      },
    });

    const select = wrapper.get('[data-testid="replay-reference-select"]');
    await select.setValue("snapshot-complete-01");
    await select.setValue(secondSnapshotId);

    resolveFirst({ ...reference, snapshotId: "snapshot-complete-01" });
    await flushPromises();
    expect(wrapper.find('[data-testid="snapshot-reference-chart"]').exists()).toBe(false);
    expect(wrapper.emitted("syncSequence")?.flat()).not.toContainEqual(expect.objectContaining({ snapshotId: "snapshot-complete-01" }));

    resolveSecond({ ...reference, snapshotId: secondSnapshotId, runId: "run-02" });
    await flushPromises();
    expect(wrapper.find('[data-testid="snapshot-reference-chart"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="snapshot-reference-metadata"]').text()).toContain("run-02");
    expect(wrapper.emitted("syncSequence")?.flat()).toContainEqual(expect.objectContaining({ snapshotId: secondSnapshotId }));
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
    expect(wrapper.find('[data-testid="snapshot-reference-loading"]').exists()).toBe(true);
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
      global: { stubs: { SnapshotReferenceChart: { template: '<div data-testid="snapshot-reference-chart-host"></div>' } } },
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
