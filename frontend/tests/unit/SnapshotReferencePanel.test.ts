import { config, enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SnapshotReferencePanel from "../../src/components/SnapshotReferencePanel.vue";

// This suite tests Snapshot selection / loading orchestration, not Lightweight Charts internals.
// Stub at the Vue Test Utils global level so every mount (including async loading tests)
// avoids creating real canvas observers and animation-frame callbacks in jsdom.
config.global.stubs = {
  ...config.global.stubs,
  SnapshotReferenceChart: {
    name: "SnapshotReferenceChart",
    props: [
      "bars",
      "structure",
      "keyzones",
      "keyzoneUntil",
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
import type { SnapshotArtifactDto, SnapshotReferenceDto, SnapshotStructureCheckpointDto, DiagnosticDto } from "../../src/origin-types";

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
  structure: { cbarCount: 0, cbars: [], swingCount: 0, swings: [], trendCount: 0, trends: [] },
  structureTimeline: [{
    sbarId: "100",
    structure: { cbarCount: 0, cbars: [], swingCount: 0, swings: [], trendCount: 0, trends: [] },
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
  it("resolves a selected Snapshot SBar to immutable Snapshot data", async () => {
    invokeMock.mockResolvedValueOnce(reference);
    const wrapper = mount(SnapshotReferencePanel, { props: { instrumentId: "AUD/USD.SIM", snapshots } });
    await wrapper.get('[data-testid="replay-reference-select"]').setValue("snapshot-complete-01");
    await flushPromises();
    const chart = wrapper.findComponent({ name: "SnapshotReferenceChart" });
    expect(chart.exists()).toBe(true);
    chart.vm.$emit("objectSelect", { kind: "sbar", id: "100", checkpointSbarId: "100" });
    const selections = wrapper.emitted("objectSelect");
    expect(selections?.[selections.length - 1]?.[0]).toMatchObject({
      snapshotId: "snapshot-complete-01",
      snapshotLabel: expect.stringContaining("5m · "),
      checkpointSbarId: "100",
      timeframe: "5m",
      kind: "sbar",
      object: { sbarId: "100", open: "10", close: "11" },
      bars: reference.bars,
      structure: reference.structureTimeline[0]?.structure,
    });
  });


  it("destroys only the chart runtime while inactive and recreates it without reloading the selected Snapshot", async () => {
    invokeMock.mockResolvedValueOnce(reference);
    const wrapper = mount(SnapshotReferencePanel, {
      props: { active: true, instrumentId: "AUD/USD.SIM", snapshots },
    });

    await wrapper.get('[data-testid="replay-reference-select"]').setValue("snapshot-complete-01");
    await flushPromises();
    expect(wrapper.findComponent({ name: "SnapshotReferenceChart" }).exists()).toBe(true);
    expect(invokeMock).toHaveBeenCalledTimes(1);

    await wrapper.setProps({ active: false } as never);
    expect(wrapper.findComponent({ name: "SnapshotReferenceChart" }).exists()).toBe(false);
    expect(wrapper.find('[data-testid="snapshot-reference-chart"]').exists()).toBe(true);
    expect((wrapper.get('[data-testid="replay-reference-select"]').element as HTMLSelectElement).value).toBe("snapshot-complete-01");

    await wrapper.setProps({ active: true } as never);
    expect(wrapper.findComponent({ name: "SnapshotReferenceChart" }).exists()).toBe(true);
    expect(invokeMock).toHaveBeenCalledTimes(1);
    expect(wrapper.get('[data-testid="snapshot-reference-metadata"]').text()).toContain("run-01");
  });

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

  it("re-publishes the loaded Snapshot sequence after Live identity changes", async () => {
    invokeMock.mockResolvedValueOnce(reference);
    const wrapper = mount(SnapshotReferencePanel, {
      props: { instrumentId: "AUD/USD.SIM", snapshots, syncIdentity: "test-1" },
    });

    await wrapper.get('[data-testid="replay-reference-select"]').setValue("snapshot-complete-01");
    await flushPromises();
    const initialEvents = wrapper.emitted("syncSequence") ?? [];
    expect(initialEvents).toHaveLength(2); // null on selection, then the loaded sequence
    const sequenceDescriptor = {
      snapshotId: reference.snapshotId,
      barType: reference.barType,
      sbarIds: ["100"],
    };
    const countPublished = (events: unknown[][]) =>
      events.filter(([event]) => JSON.stringify(event) === JSON.stringify(sequenceDescriptor)).length;
    const initialDescriptorCount = countPublished(initialEvents);
    expect(initialDescriptorCount).toBe(1);

    await wrapper.setProps({ syncIdentity: "test-2" } as never);
    await flushPromises();
    const events = wrapper.emitted("syncSequence") ?? [];
    // The qualification event may be accompanied by a null invalidation event
    // when Vue flushes the selection/availability watchers; the descriptor itself
    // must be republished exactly once for the new Live identity.
    expect(countPublished(events)).toBe(initialDescriptorCount + 1);
    expect(events.at(-1)?.[0]).toEqual(sequenceDescriptor);
    expect(wrapper.find('[data-testid="snapshot-reference-chart"]').exists()).toBe(true);
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


function partialReference(snapshotId = reference.snapshotId): SnapshotReferenceDto {
  return {
    ...reference, snapshotId,
    bars: ["100", "200", "300"].map((id) => ({ ...reference.bars[0]!, sbarId: id, tsEvent: id, tsInit: id })),
    structureTimeline: [{ sbarId: "300", structure: reference.structure }],
  };
}

const historicalCheckpoint: SnapshotStructureCheckpointDto = {
  sbarId: "100", structure: {
    cbarCount: 1,
    cbars: [{ cbarId: "old-cbar", high: "12", low: "9", sbarStartId: "100", sbarEndId: "100", spanSbars: 1, fractalType: null, createdAt: "100" }],
    swingCount: 0, swings: [], trendCount: 0, trends: [],
  },
};

function deferredCheckpoint() {
  let resolve!: (checkpoint: SnapshotStructureCheckpointDto) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<SnapshotStructureCheckpointDto>((accept, fail) => { resolve = accept; reject = fail; });
  return { promise, resolve, reject };
}

const playbackProps = {
  instrumentId: "AUD/USD.SIM", snapshots, liveSbarIds: ["100", "200", "300"],
  syncEligible: true, syncOffset: 0, progressApplies: true, processedCount: 0,
};

describe("Snapshot Reference on-demand checkpoints", () => {
  beforeEach(() => invokeMock.mockReset());

  it("displays a final-only response without requesting historical state", async () => {
    invokeMock.mockResolvedValueOnce(partialReference());
    const wrapper = mount(SnapshotReferencePanel, { props: { instrumentId: "AUD/USD.SIM", snapshots } });
    await wrapper.get('[data-testid="replay-reference-select"]').setValue(reference.snapshotId);
    await flushPromises();
    expect(wrapper.find('[data-testid="snapshot-reference-loading"]').exists()).toBe(false);
    expect(wrapper.findComponent({ name: "SnapshotReferenceChart" }).props("structure")).toEqual(reference.structure);
    expect(invokeMock).toHaveBeenCalledTimes(1);
  });

  it("requests only needed checkpoints, ignores older cursor responses and reuses cached history", async () => {
    const first = deferredCheckpoint();
    const second = deferredCheckpoint();
    invokeMock.mockResolvedValueOnce(partialReference()).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const wrapper = mount(SnapshotReferencePanel, { props: playbackProps });
    await wrapper.get('[data-testid="replay-reference-select"]').setValue(reference.snapshotId);
    await flushPromises();
    const chart = wrapper.findComponent({ name: "SnapshotReferenceChart" });
    expect(chart.props("structure")).toBeNull();
    expect(invokeMock).toHaveBeenCalledTimes(1);
    await wrapper.setProps({ processedCount: 1 } as never);
    expect(invokeMock).toHaveBeenLastCalledWith("get_snapshot_reference_checkpoint", { snapshotId: reference.snapshotId, sbarId: "100" });
    expect(chart.exists()).toBe(true);
    expect(chart.props("structure")).toBeNull();
    expect(wrapper.find('[data-testid="snapshot-checkpoint-loading"]').exists()).toBe(true);
    await wrapper.setProps({ processedCount: 2 } as never);
    const secondCheckpoint = { sbarId: "200", structure: reference.structure };
    second.resolve(secondCheckpoint);
    await flushPromises();
    expect(chart.props("structure")).toEqual(reference.structure);
    first.resolve(historicalCheckpoint);
    await flushPromises();
    expect(chart.props("structure")).toEqual(reference.structure);
    await wrapper.setProps({ processedCount: 1 } as never);
    expect(chart.props("structure")).toEqual(historicalCheckpoint.structure);
    await wrapper.setProps({ processedCount: 3 } as never);
    expect(chart.props("structure")).toEqual(reference.structure);
    expect(invokeMock).toHaveBeenCalledTimes(3);
  });

  it("shares one pending checkpoint read between playback and SBar inspection", async () => {
    const pending = deferredCheckpoint();
    invokeMock.mockResolvedValueOnce(partialReference()).mockReturnValueOnce(pending.promise);
    const wrapper = mount(SnapshotReferencePanel, { props: playbackProps });
    await wrapper.get('[data-testid="replay-reference-select"]').setValue(reference.snapshotId);
    await flushPromises();
    await wrapper.setProps({ processedCount: 1 } as never);
    wrapper.findComponent({ name: "SnapshotReferenceChart" }).vm.$emit("objectSelect", { kind: "sbar", id: "100", checkpointSbarId: "100" });
    expect(invokeMock).toHaveBeenCalledTimes(2);
    expect(wrapper.emitted("objectSelect")?.at(-1)?.[0]).toBeNull();
    pending.resolve(historicalCheckpoint);
    await flushPromises();
    expect(wrapper.emitted("objectSelect")?.at(-1)?.[0]).toMatchObject({ kind: "sbar", checkpointSbarId: "100", structure: historicalCheckpoint.structure });
  });

  it("does not apply a prior Snapshot checkpoint or Inspector response after switching", async () => {
    const pending = deferredCheckpoint();
    const secondPending = deferredCheckpoint();
    const secondId = "snapshot-complete-02";
    invokeMock.mockResolvedValueOnce(partialReference()).mockReturnValueOnce(pending.promise)
      .mockResolvedValueOnce(partialReference(secondId)).mockReturnValueOnce(secondPending.promise);
    const wrapper = mount(SnapshotReferencePanel, { props: { ...playbackProps,
      snapshots: [...snapshots, { ...snapshots[0]!, snapshotId: secondId }],
    } });
    const select = wrapper.get('[data-testid="replay-reference-select"]');
    await select.setValue(reference.snapshotId);
    await flushPromises();
    await wrapper.setProps({ processedCount: 1 } as never);
    wrapper.findComponent({ name: "SnapshotReferenceChart" }).vm.$emit("objectSelect", { kind: "sbar", id: "100" });
    await select.setValue(secondId);
    await flushPromises();
    pending.resolve(historicalCheckpoint);
    await flushPromises();
    const chart = wrapper.findComponent({ name: "SnapshotReferenceChart" });
    expect(chart.props("snapshotId")).toBe(secondId);
    expect(chart.props("structure")).toBeNull();
    expect(wrapper.emitted("objectSelect")?.at(-1)?.[0]).toBeNull();
    secondPending.resolve({ sbarId: "100", structure: reference.structure });
    await flushPromises();
    expect(chart.props("structure")).toEqual(reference.structure);
  });

  it("keeps candles visible and reports a failed historical read without showing final state", async () => {
    invokeMock.mockResolvedValueOnce(partialReference()).mockRejectedValueOnce({ message: "Checkpoint is unreadable" });
    const wrapper = mount(SnapshotReferencePanel, { props: playbackProps });
    await wrapper.get('[data-testid="replay-reference-select"]').setValue(reference.snapshotId);
    await flushPromises();
    await wrapper.setProps({ processedCount: 1 } as never);
    await flushPromises();
    const chart = wrapper.findComponent({ name: "SnapshotReferenceChart" });
    expect(chart.exists()).toBe(true);
    expect(chart.props("bars")).toHaveLength(3);
    expect(chart.props("structure")).toBeNull();
    expect(wrapper.get('[data-testid="snapshot-checkpoint-error"]').text()).toContain("Checkpoint is unreadable");
    expect(wrapper.find('[data-testid="snapshot-checkpoint-loading"]').exists()).toBe(false);
  });

  it("resolves an object that disappeared before the final checkpoint on demand", async () => {
    invokeMock.mockResolvedValueOnce(partialReference()).mockResolvedValueOnce(historicalCheckpoint);
    const wrapper = mount(SnapshotReferencePanel, { props: { instrumentId: "AUD/USD.SIM", snapshots } });
    await wrapper.get('[data-testid="replay-reference-select"]').setValue(reference.snapshotId);
    await flushPromises();
    wrapper.findComponent({ name: "SnapshotReferenceChart" }).vm.$emit("objectSelect", { kind: "cbar", id: "old-cbar", checkpointSbarId: "100" });
    await flushPromises();
    expect(invokeMock).toHaveBeenLastCalledWith("get_snapshot_reference_object", { snapshotId: reference.snapshotId, kind: "cbar", objectId: "old-cbar" });
    expect(wrapper.emitted("objectSelect")?.at(-1)?.[0]).toMatchObject({ kind: "cbar", checkpointSbarId: "100", object: { cbarId: "old-cbar" } });
    wrapper.findComponent({ name: "SnapshotReferenceChart" }).vm.$emit("objectSelect", { kind: "cbar", id: "old-cbar" });
    expect(invokeMock).toHaveBeenCalledTimes(2);
  });

  it("does not let a delayed object lookup replace a newer Inspector selection", async () => {
    const pending = deferredCheckpoint();
    invokeMock.mockResolvedValueOnce(partialReference()).mockReturnValueOnce(pending.promise);
    const wrapper = mount(SnapshotReferencePanel, { props: { instrumentId: "AUD/USD.SIM", snapshots } });
    await wrapper.get('[data-testid="replay-reference-select"]').setValue(reference.snapshotId);
    await flushPromises();
    const chart = wrapper.findComponent({ name: "SnapshotReferenceChart" });
    chart.vm.$emit("objectSelect", { kind: "cbar", id: "old-cbar" });
    chart.vm.$emit("objectSelect", { kind: "sbar", id: "300" });
    pending.resolve(historicalCheckpoint);
    await flushPromises();
    expect(wrapper.emitted("objectSelect")?.at(-1)?.[0]).toMatchObject({ kind: "sbar", checkpointSbarId: "300" });
  });
});


function recordedDiagnostic(severity: string, message: string): DiagnosticDto {
  return { source: "struxis", severity, category: "processing", objectType: null,
    objectId: null, sbarIds: ["300"], checkpointIndex: 2, message };
}

function referenceWithDiagnostics(diagnostics: DiagnosticDto[], snapshotId = reference.snapshotId): SnapshotReferenceDto {
  const result = partialReference(snapshotId);
  result.structureTimeline[0]!.diagnostics = diagnostics;
  return result;
}

describe("Snapshot footer diagnostics", () => {
  beforeEach(() => invokeMock.mockReset());

  it("shows recorded warnings in the footer while preserving the chart", async () => {
    invokeMock.mockResolvedValueOnce(referenceWithDiagnostics([recordedDiagnostic("warning", "Incomplete upstream structure")]));
    const wrapper = mount(SnapshotReferencePanel, { props: { instrumentId: "AUD/USD.SIM", snapshots } });
    await wrapper.get('[data-testid="replay-reference-select"]').setValue(reference.snapshotId);
    await flushPromises();
    const footer = wrapper.get('[data-testid="snapshot-reference-metadata"]');
    const message = footer.get('[data-testid="snapshot-reference-footer-message"]');
    expect(message.attributes("role")).toBe("alert");
    expect(message.text()).toBe("warning · struxis: Incomplete upstream structure");
    expect(message.attributes("title")).toBe("warning · struxis: Incomplete upstream structure");
    expect(wrapper.get('[data-testid="snapshot-reference-stage"]').text()).not.toContain("Incomplete upstream structure");
    expect(wrapper.findComponent({ name: "SnapshotReferenceChart" }).exists()).toBe(true);
    expect(invokeMock).toHaveBeenCalledTimes(1);
  });

  it("shows the count and full hover text for errors, warnings and unknown severities", async () => {
    const longMessage = "A recorded processing exception with additional context ".repeat(8);
    invokeMock.mockResolvedValueOnce(referenceWithDiagnostics([
      recordedDiagnostic("error", longMessage),
      recordedDiagnostic("warning", "Warning detail"),
      recordedDiagnostic("upstream-special", "Unclassified diagnostic"),
      recordedDiagnostic("info", "error words in an informational message"),
    ]));
    const wrapper = mount(SnapshotReferencePanel, { props: { instrumentId: "AUD/USD.SIM", snapshots } });
    await wrapper.get('[data-testid="replay-reference-select"]').setValue(reference.snapshotId);
    await flushPromises();
    const message = wrapper.get('[data-testid="snapshot-reference-footer-message"]');
    expect(message.text()).toContain("3 ·");
    expect(message.attributes("title")).toBe(`error · struxis: ${longMessage}\nwarning · struxis: Warning detail\nupstream-special · struxis: Unclassified diagnostic`);
    expect(message.attributes("title")).not.toContain("error words in an informational message");
  });

  it.each(["info", "debug", "trace", "INFO"])("retains metadata for %s diagnostics regardless of message wording", async (severity) => {
    invokeMock.mockResolvedValueOnce(referenceWithDiagnostics([recordedDiagnostic(severity, "error exception warning")]));
    const wrapper = mount(SnapshotReferencePanel, { props: { instrumentId: "AUD/USD.SIM", snapshots } });
    await wrapper.get('[data-testid="replay-reference-select"]').setValue(reference.snapshotId);
    await flushPromises();
    expect(wrapper.find('[data-testid="snapshot-reference-footer-message"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="snapshot-reference-metadata"]').text()).toContain("run-01");
  });

  it("keeps a footer for initial load errors even when no chart can be displayed", async () => {
    invokeMock.mockRejectedValueOnce({ message: "Snapshot cannot be read" });
    const wrapper = mount(SnapshotReferencePanel, { props: { instrumentId: "AUD/USD.SIM", snapshots } });
    await wrapper.get('[data-testid="replay-reference-select"]').setValue(reference.snapshotId);
    await flushPromises();
    expect(wrapper.get('[data-testid="snapshot-reference-metadata"]')
      .get('[data-testid="snapshot-reference-read-error"]').text()).toBe("Snapshot cannot be read");
    expect(wrapper.get('[data-testid="snapshot-reference-stage"]').text()).not.toContain("Snapshot cannot be read");
    expect(wrapper.find('[data-testid="snapshot-reference-error"]').exists()).toBe(true);
    expect(wrapper.findComponent({ name: "SnapshotReferenceChart" }).exists()).toBe(false);
  });

  it("puts a failed historical read below the chart without leaving final diagnostics at an older cursor", async () => {
    invokeMock.mockResolvedValueOnce(referenceWithDiagnostics([recordedDiagnostic("error", "Final checkpoint issue")]))
      .mockRejectedValueOnce({ message: "Historical checkpoint cannot be read" });
    const wrapper = mount(SnapshotReferencePanel, { props: playbackProps });
    await wrapper.get('[data-testid="replay-reference-select"]').setValue(reference.snapshotId);
    await flushPromises();
    await wrapper.setProps({ processedCount: 1 } as never);
    await flushPromises();
    const footer = wrapper.get('[data-testid="snapshot-reference-metadata"]');
    expect(footer.get('[data-testid="snapshot-checkpoint-error"]').text()).toBe("Historical checkpoint cannot be read");
    expect(footer.text()).not.toContain("Final checkpoint issue");
    expect(wrapper.get('[data-testid="snapshot-reference-stage"]').text()).not.toContain("Historical checkpoint cannot be read");
    expect(wrapper.findComponent({ name: "SnapshotReferenceChart" }).exists()).toBe(true);
  });

  it("keeps displayed diagnostics until the target checkpoint is ready", async () => {
    const pending = deferredCheckpoint();
    invokeMock.mockResolvedValueOnce(referenceWithDiagnostics([recordedDiagnostic("warning", "Final warning")])).mockReturnValueOnce(pending.promise);
    const wrapper = mount(SnapshotReferencePanel, { props: { ...playbackProps, progressApplies: false } });
    await wrapper.get('[data-testid="replay-reference-select"]').setValue(reference.snapshotId);
    await flushPromises();
    expect(wrapper.get('[data-testid="snapshot-reference-footer-message"]').text()).toContain("Final warning");
    await wrapper.setProps({ progressApplies: true, processedCount: 1 } as never);
    expect(wrapper.get('[data-testid="snapshot-reference-footer-message"]').text()).toContain("Final warning");
    pending.resolve({ ...historicalCheckpoint, diagnostics: [recordedDiagnostic("error", "Historical exception")] });
    await flushPromises();
    expect(wrapper.get('[data-testid="snapshot-reference-footer-message"]').text()).toContain("Historical exception");
    await wrapper.setProps({ processedCount: 3 } as never);
    expect(wrapper.get('[data-testid="snapshot-reference-footer-message"]').text()).toContain("Final warning");
    expect(wrapper.get('[data-testid="snapshot-reference-footer-message"]').text()).not.toContain("Historical exception");
  });

  it("combines Inspector read failures and current recorded warnings in the footer", async () => {
    invokeMock.mockResolvedValueOnce(referenceWithDiagnostics([recordedDiagnostic("warning", "Saved warning")]))
      .mockRejectedValueOnce({ message: "Object lookup failed" });
    const wrapper = mount(SnapshotReferencePanel, { props: { instrumentId: "AUD/USD.SIM", snapshots } });
    await wrapper.get('[data-testid="replay-reference-select"]').setValue(reference.snapshotId);
    await flushPromises();
    wrapper.findComponent({ name: "SnapshotReferenceChart" }).vm.$emit("objectSelect", { kind: "cbar", id: "missing" });
    await flushPromises();
    const footer = wrapper.get('[data-testid="snapshot-reference-metadata"]');
    expect(footer.get('[data-testid="snapshot-inspector-error"]').text()).toBe("Object lookup failed");
    const message = footer.get('[data-testid="snapshot-reference-footer-message"]');
    expect(message.text()).toContain("2 ·");
    expect(message.attributes("title")).toContain("Saved warning");
    expect(wrapper.get('[data-testid="snapshot-reference-stage"]').text()).not.toContain("Object lookup failed");
  });

  it("does not show delayed diagnostics from a previously selected Snapshot", async () => {
    const pending = deferredCheckpoint();
    const secondId = "snapshot-complete-02";
    invokeMock.mockResolvedValueOnce(partialReference()).mockReturnValueOnce(pending.promise)
      .mockResolvedValueOnce(referenceWithDiagnostics([recordedDiagnostic("warning", "New snapshot warning")], secondId));
    const wrapper = mount(SnapshotReferencePanel, { props: { ...playbackProps,
      snapshots: [...snapshots, { ...snapshots[0]!, snapshotId: secondId }],
    } });
    const select = wrapper.get('[data-testid="replay-reference-select"]');
    await select.setValue(reference.snapshotId);
    await flushPromises();
    await wrapper.setProps({ processedCount: 1 } as never);
    await wrapper.setProps({ progressApplies: false } as never);
    await select.setValue(secondId);
    await flushPromises();
    pending.resolve({ ...historicalCheckpoint, diagnostics: [recordedDiagnostic("error", "Old snapshot exception")] });
    await flushPromises();
    const message = wrapper.get('[data-testid="snapshot-reference-footer-message"]');
    expect(message.text()).toContain("New snapshot warning");
    expect(message.attributes("title")).not.toContain("Old snapshot exception");
  });
});


describe("Snapshot footer status hints", () => {
  beforeEach(() => invokeMock.mockReset());

  it("keeps the unrecorded KeyZone hint in the footer and out of the chart", async () => {
    invokeMock.mockResolvedValueOnce(partialReference());
    const wrapper = mount(SnapshotReferencePanel, { props: { instrumentId: "AUD/USD.SIM", snapshots } });
    await wrapper.get('[data-testid="replay-reference-select"]').setValue(reference.snapshotId);
    await flushPromises();
    const footer = wrapper.get('[data-testid="snapshot-reference-metadata"]');
    expect(footer.get('[data-testid="snapshot-keyzone-unrecorded"]').text()).toBe("KEYZONE NOT RECORDED");
    expect(footer.text()).toContain("run-01");
    expect(wrapper.get('[data-testid="snapshot-reference-stage"]').find('[data-testid="snapshot-keyzone-unrecorded"]').exists()).toBe(false);
  });

  it("moves the pending-checkpoint hint to the footer and preserves the playback visibility rule", async () => {
    const pending = deferredCheckpoint();
    invokeMock.mockResolvedValueOnce(partialReference()).mockReturnValueOnce(pending.promise);
    const wrapper = mount(SnapshotReferencePanel, { props: playbackProps });
    await wrapper.get('[data-testid="replay-reference-select"]').setValue(reference.snapshotId);
    await flushPromises();
    expect(wrapper.find('[data-testid="snapshot-keyzone-unrecorded"]').exists()).toBe(false);
    await wrapper.setProps({ processedCount: 1 } as never);
    expect(wrapper.get('[data-testid="snapshot-reference-metadata"]').get('[data-testid="snapshot-checkpoint-loading"]').text()).toBe("Loading checkpoint…");
    expect(wrapper.get('[data-testid="snapshot-reference-stage"]').find('[data-testid="snapshot-checkpoint-loading"]').exists()).toBe(false);
    pending.resolve(historicalCheckpoint);
    await flushPromises();
    expect(wrapper.find('[data-testid="snapshot-checkpoint-loading"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="snapshot-keyzone-unrecorded"]').exists()).toBe(false);
    await wrapper.setProps({ processedCount: 3 } as never);
    expect(wrapper.get('[data-testid="snapshot-reference-metadata"]').find('[data-testid="snapshot-keyzone-unrecorded"]').exists()).toBe(true);
  });
});


function displayCheckpointFixture(sbarId: string, objectId: string, message: string): SnapshotStructureCheckpointDto {
  return {
    sbarId,
    structure: { cbarCount: 1, cbars: [{ cbarId: objectId, high: "13", low: "9", sbarStartId: sbarId,
      sbarEndId: sbarId, spanSbars: 1, fractalType: null, createdAt: sbarId }],
      swingCount: 0, swings: [], trendCount: 0, trends: [] },
    keyzones: { instrumentId: "AUD/USD.SIM", observations: [], interactions: [], zones: [{
      keyzoneId: objectId, originKind: "FixedPriceRange", originId: null, timeframe: "5m", lower: "9", upper: "13",
      state: "Finalized", formedAt: sbarId, createdAt: sbarId, finalizedAt: sbarId,
      finalizedDetectedAt: sbarId, invalidatedAt: null, invalidatedDetectedAt: null,
    }] },
    diagnostics: [{ ...recordedDiagnostic("warning", message), sbarIds: [sbarId] }],
  };
}
const firstDisplayCheckpoint = displayCheckpointFixture("100", "first-object", "First frame warning");
const nextDisplayCheckpoint = displayCheckpointFixture("200", "next-object", "Next frame warning");

describe("Snapshot commits complete display frames", () => {
  beforeEach(() => invokeMock.mockReset());

  it("keeps structure, KeyZones, progress and diagnostics together until the next Play checkpoint is ready", async () => {
    const pending = deferredCheckpoint();
    invokeMock.mockResolvedValueOnce(partialReference()).mockResolvedValueOnce(firstDisplayCheckpoint).mockReturnValueOnce(pending.promise);
    const wrapper = mount(SnapshotReferencePanel, { props: playbackProps });
    await wrapper.get('[data-testid="replay-reference-select"]').setValue(reference.snapshotId);
    await flushPromises();
    await wrapper.setProps({ processedCount: 1 } as never);
    await flushPromises();
    const chart = wrapper.findComponent({ name: "SnapshotReferenceChart" });
    const previous = chart.props();
    const chartElement = chart.element;
    expect(previous).toMatchObject({ structure: firstDisplayCheckpoint.structure, keyzones: firstDisplayCheckpoint.keyzones,
      keyzoneUntil: "100", processedCount: 1, playbackEnabled: true });
    await wrapper.setProps({ processedCount: 2 } as never);
    expect(chart.props()).toEqual(previous);
    expect(chart.element).toBe(chartElement);
    expect(wrapper.get('[data-testid="snapshot-reference-footer-message"]').text()).toContain("First frame warning");
    expect(wrapper.find('[data-testid="snapshot-checkpoint-loading"]').exists()).toBe(true);
    pending.resolve(nextDisplayCheckpoint);
    await flushPromises();
    expect(chart.props()).toMatchObject({ structure: nextDisplayCheckpoint.structure, keyzones: nextDisplayCheckpoint.keyzones,
      keyzoneUntil: "200", processedCount: 2, playbackEnabled: true, playbackOffset: 0, liveBarCount: 3 });
    expect(chart.element).toBe(chartElement);
    expect(wrapper.get('[data-testid="snapshot-reference-footer-message"]').text()).toContain("Next frame warning");
    expect(wrapper.find('[data-testid="snapshot-checkpoint-loading"]').exists()).toBe(false);
  });

  it.each(["older-first", "latest-first"])("only commits the latest random location with %s responses", async (order) => {
    const older = deferredCheckpoint();
    const latest = deferredCheckpoint();
    const ids = ["100", "200", "300", "400", "500"];
    const head = { ...partialReference(), bars: ids.map((id) => ({ ...reference.bars[0]!, sbarId: id, tsEvent: id, tsInit: id })),
      structureTimeline: [{ sbarId: "500", structure: reference.structure }] };
    invokeMock.mockResolvedValueOnce(head).mockResolvedValueOnce(firstDisplayCheckpoint)
      .mockReturnValueOnce(older.promise).mockReturnValueOnce(latest.promise);
    const wrapper = mount(SnapshotReferencePanel, { props: { ...playbackProps, liveSbarIds: ids } });
    await wrapper.get('[data-testid="replay-reference-select"]').setValue(reference.snapshotId);
    await flushPromises();
    await wrapper.setProps({ processedCount: 1 } as never);
    await flushPromises();
    const chart = wrapper.findComponent({ name: "SnapshotReferenceChart" });
    const accepted = chart.props();
    await wrapper.setProps({ processedCount: 4 } as never);
    await wrapper.setProps({ processedCount: 2 } as never);
    expect(chart.props()).toEqual(accepted);
    const oldCheckpoint = displayCheckpointFixture("400", "old-location", "Old location warning");
    if (order === "older-first") {
      older.resolve(oldCheckpoint);
      await flushPromises();
      expect(chart.props()).toEqual(accepted);
      expect(wrapper.find('[data-testid="snapshot-checkpoint-loading"]').exists()).toBe(true);
    }
    latest.resolve(nextDisplayCheckpoint);
    await flushPromises();
    expect(chart.props()).toMatchObject({ structure: nextDisplayCheckpoint.structure, keyzoneUntil: "200", processedCount: 2 });
    if (order === "latest-first") {
      older.resolve(oldCheckpoint);
      await flushPromises();
      expect(chart.props()).toMatchObject({ structure: nextDisplayCheckpoint.structure, keyzoneUntil: "200", processedCount: 2 });
    }
    expect(wrapper.get('[data-testid="snapshot-reference-footer-message"]').attributes("title")).not.toContain("Old location warning");
    expect(wrapper.find('[data-testid="snapshot-checkpoint-loading"]').exists()).toBe(false);
    await wrapper.setProps({ processedCount: 4 } as never);
    expect(chart.props()).toMatchObject({ structure: oldCheckpoint.structure, keyzoneUntil: "400", processedCount: 4 });
    expect(invokeMock).toHaveBeenCalledTimes(4);
  });

  it("preserves the previous complete frame when the next read fails", async () => {
    invokeMock.mockResolvedValueOnce(partialReference()).mockResolvedValueOnce(firstDisplayCheckpoint)
      .mockRejectedValueOnce({ message: "Target cannot be read" });
    const wrapper = mount(SnapshotReferencePanel, { props: playbackProps });
    await wrapper.get('[data-testid="replay-reference-select"]').setValue(reference.snapshotId);
    await flushPromises();
    await wrapper.setProps({ processedCount: 1 } as never);
    await flushPromises();
    const chart = wrapper.findComponent({ name: "SnapshotReferenceChart" });
    const accepted = chart.props();
    await wrapper.setProps({ processedCount: 2 } as never);
    await flushPromises();
    expect(chart.props()).toEqual(accepted);
    const details = wrapper.get('[data-testid="snapshot-reference-footer-message"]').attributes("title");
    expect(details).toContain("Target cannot be read");
    expect(details).toContain("First frame warning");
    expect(wrapper.find('[data-testid="snapshot-checkpoint-loading"]').exists()).toBe(false);
  });

  it("does not restore a pending frame after reset to zero", async () => {
    const pending = deferredCheckpoint();
    invokeMock.mockResolvedValueOnce(partialReference()).mockResolvedValueOnce(firstDisplayCheckpoint).mockReturnValueOnce(pending.promise);
    const wrapper = mount(SnapshotReferencePanel, { props: playbackProps });
    await wrapper.get('[data-testid="replay-reference-select"]').setValue(reference.snapshotId);
    await flushPromises();
    await wrapper.setProps({ processedCount: 1 } as never);
    await flushPromises();
    await wrapper.setProps({ processedCount: 2 } as never);
    await wrapper.setProps({ processedCount: 0 } as never);
    pending.resolve(nextDisplayCheckpoint);
    await flushPromises();
    expect(wrapper.findComponent({ name: "SnapshotReferenceChart" }).props()).toMatchObject({
      structure: null, keyzones: null, keyzoneUntil: null, processedCount: 0, playbackEnabled: true });
    expect(wrapper.find('[data-testid="snapshot-checkpoint-loading"]').exists()).toBe(false);
  });

  it("discards the old display frame when switching Snapshot identity", async () => {
    const oldPending = deferredCheckpoint();
    const replacement = deferredCheckpoint();
    const secondId = "snapshot-complete-02";
    invokeMock.mockResolvedValueOnce(partialReference()).mockResolvedValueOnce(firstDisplayCheckpoint)
      .mockReturnValueOnce(oldPending.promise).mockResolvedValueOnce(partialReference(secondId)).mockReturnValueOnce(replacement.promise);
    const wrapper = mount(SnapshotReferencePanel, { props: { ...playbackProps,
      snapshots: [...snapshots, { ...snapshots[0]!, snapshotId: secondId }], } });
    const select = wrapper.get('[data-testid="replay-reference-select"]');
    await select.setValue(reference.snapshotId);
    await flushPromises();
    await wrapper.setProps({ processedCount: 1 } as never);
    await flushPromises();
    await wrapper.setProps({ processedCount: 2 } as never);
    await select.setValue(secondId);
    await flushPromises();
    oldPending.resolve(nextDisplayCheckpoint);
    await flushPromises();
    const chart = wrapper.findComponent({ name: "SnapshotReferenceChart" });
    expect(chart.props()).toMatchObject({ snapshotId: secondId, structure: null, processedCount: 0 });
    expect(wrapper.find('[data-testid="snapshot-reference-footer-message"]').exists()).toBe(false);
    replacement.resolve(displayCheckpointFixture("200", "replacement-object", "Replacement warning"));
    await flushPromises();
    expect(chart.props()).toMatchObject({ snapshotId: secondId, keyzoneUntil: "200", processedCount: 2 });
    expect(wrapper.get('[data-testid="snapshot-reference-footer-message"]').text()).toContain("Replacement warning");
  });
});


describe("Snapshot footer keeps metadata before status messages", () => {
  beforeEach(() => invokeMock.mockReset());

  it("keeps all metadata nodes mounted and in front of pending, recorded and failed-read messages", async () => {
    const pending = deferredCheckpoint();
    invokeMock.mockResolvedValueOnce(partialReference()).mockReturnValueOnce(pending.promise)
      .mockRejectedValueOnce({ message: "Next checkpoint failed" });
    const wrapper = mount(SnapshotReferencePanel, { props: playbackProps });
    await wrapper.get('[data-testid="replay-reference-select"]').setValue(reference.snapshotId);
    await flushPromises();
    const footer = wrapper.get('[data-testid="snapshot-reference-metadata"]');
    const fields = footer.get('[data-testid="snapshot-reference-footer-fields"]');
    const status = footer.get('[data-testid="snapshot-reference-footer-status"]');
    const fieldNodes = Array.from(fields.element.children);
    const originalText = fields.text();
    expect(fieldNodes).toHaveLength(4);
    expect(fields.text()).toContain("RUN run-01");
    expect(fields.text()).toContain("SBARS 3");
    expect(fields.text()).toContain("GENERATED");
    expect(fields.text()).toContain("FINGERPRINT aaaaaaaaaaaa");
    const assertStableMetadata = () => {
      const current = footer.get('[data-testid="snapshot-reference-footer-fields"]');
      expect(current.element).toBe(fields.element);
      expect(current.text()).toBe(originalText);
      fieldNodes.forEach((node, index) => expect(current.element.children[index]).toBe(node));
      expect(fields.element.compareDocumentPosition(status.element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    };
    await wrapper.setProps({ processedCount: 1 } as never);
    expect(status.find('[data-testid="snapshot-checkpoint-loading"]').exists()).toBe(true);
    assertStableMetadata();
    pending.resolve(firstDisplayCheckpoint);
    await flushPromises();
    expect(status.find('[data-testid="snapshot-checkpoint-loading"]').exists()).toBe(false);
    expect(status.get('[data-testid="snapshot-reference-footer-message"]').text()).toContain("First frame warning");
    assertStableMetadata();
    await wrapper.setProps({ processedCount: 2 } as never);
    await flushPromises();
    expect(status.get('[data-testid="snapshot-checkpoint-error"]').text()).toBe("Next checkpoint failed");
    assertStableMetadata();
  });

  it("appends KeyZone and long diagnostic messages after metadata without replacing its fields", async () => {
    const details = "A lengthy recorded warning ".repeat(16);
    invokeMock.mockResolvedValueOnce(referenceWithDiagnostics([recordedDiagnostic("warning", details)]));
    const wrapper = mount(SnapshotReferencePanel, { props: { instrumentId: "AUD/USD.SIM", snapshots } });
    await wrapper.get('[data-testid="replay-reference-select"]').setValue(reference.snapshotId);
    await flushPromises();
    const footer = wrapper.get('[data-testid="snapshot-reference-metadata"]');
    const fields = footer.get('[data-testid="snapshot-reference-footer-fields"]');
    const status = footer.get('[data-testid="snapshot-reference-footer-status"]');
    expect(fields.findAll("span")).toHaveLength(4);
    expect(fields.text()).toContain("RUN run-01");
    expect(fields.element.compareDocumentPosition(status.element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(status.get('[data-testid="snapshot-keyzone-unrecorded"]').text()).toBe("KEYZONE NOT RECORDED");
    expect(status.get('[data-testid="snapshot-reference-footer-message"]').attributes("title"))
      .toBe(`warning · struxis: ${details}`);
  });
});
