import { mount, enableAutoUnmount } from "@vue/test-utils";
import { nextTick } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ISeriesPrimitive, Time } from "lightweight-charts";
import { KeyZonePrimitive } from "../../src/keyzone-primitives";
import ChartSurface from "../../src/components/ChartSurface.vue";
import OriginChart from "../../src/components/OriginChart.vue";
import RunChart from "../../src/components/RunChart.vue";
import SnapshotReferenceChart from "../../src/components/SnapshotReferenceChart.vue";
import type { OriginDatasetDto, TestDatasetDto } from "../../src/origin-types";
import { keyzoneBars, keyzoneFixture } from "./keyzone-fixture";

type PointEvent = { point?: { x: number; y: number } };
type Runtime = { primitives: ISeriesPrimitive<Time>[]; move: (event: PointEvent) => void; click: (event: PointEvent) => void; rangeChanged: () => void };
const mocks = vi.hoisted(() => ({ runtimes: [] as Runtime[] }));

vi.mock("lightweight-charts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("lightweight-charts")>();
  return { ...actual, createChart: vi.fn(() => {
    const runtime: Runtime = { primitives: [], move: () => {}, click: () => {}, rangeChanged: () => {} };
    mocks.runtimes.push(runtime);
    const scale = {
      options: () => ({ barSpacing: 10 }), width: () => 700,
      getVisibleLogicalRange: () => ({ from: -4, to: 8 }),
      logicalToCoordinate: (index: number) => 100 + index * 10,
      coordinateToLogical: (x: number) => (x - 100) / 10,
      timeToCoordinate: (time: number) => 100 + (time - 1700000000) / 6,
      coordinateToTime: () => 1700000000,
      setVisibleLogicalRange: vi.fn(), fitContent: vi.fn(),
      subscribeVisibleLogicalRangeChange: (listener: () => void) => { runtime.rangeChanged = listener; }, unsubscribeVisibleLogicalRangeChange: vi.fn(),
    };
    const chart = {
      timeScale: () => scale, applyOptions: vi.fn(), remove: vi.fn(),
      addSeries: () => series, priceScale: () => ({ applyOptions: vi.fn() }),
      setCrosshairPosition: vi.fn(), clearCrosshairPosition: vi.fn(),
      subscribeCrosshairMove: (listener: Runtime["move"]) => { runtime.move = listener; },
      unsubscribeCrosshairMove: vi.fn(),
      subscribeClick: (listener: Runtime["click"]) => { runtime.click = listener; }, unsubscribeClick: vi.fn(),
    };
    const series = {
      setData: vi.fn(), update: vi.fn(), applyOptions: vi.fn(),
      priceToCoordinate: (price: number) => 200 - price * 10,
      coordinateToPrice: (y: number) => (200 - y) / 10,
      attachPrimitive: (primitive: ISeriesPrimitive<Time>) => {
        runtime.primitives.push(primitive);
        primitive.attached?.({ chart, series, requestUpdate: vi.fn(), horzScaleBehavior: {} } as unknown as Parameters<NonNullable<ISeriesPrimitive<Time>["attached"]>>[0]);
      },
      detachPrimitive: (primitive: ISeriesPrimitive<Time>) => primitive.detached?.(),
    };
    return chart;
  }) };
});

enableAutoUnmount(afterEach);
beforeEach(() => {
  mocks.runtimes.length = 0;
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  vi.stubGlobal("requestAnimationFrame", () => 1);
  vi.stubGlobal("cancelAnimationFrame", () => {});
});
afterEach(() => vi.unstubAllGlobals());

function fixture() {
  const bars = keyzoneBars(), keyzones = keyzoneFixture();
  const origin: OriginDatasetDto = { originDatasetId: "origin-keyzone", sourceCatalog: "fixture", enableStructure: true,
    instrumentId: "AUD/USD.SIM", barType: bars[0]!.barType, timeframe: "1m", sbarSequenceFingerprint: "fixture",
    sbarCount: 4, firstSbarId: bars[0]!.sbarId, lastSbarId: bars[3]!.sbarId,
    firstTsEvent: bars[0]!.tsEvent, lastTsEvent: bars[3]!.tsEvent, bars, structure: null, keyzones };
  const test: TestDatasetDto = { testDatasetId: "test-keyzone", originDatasetId: origin.originDatasetId,
    instrumentId: origin.instrumentId, barType: origin.barType, timeframe: "1m", startSbarId: origin.firstSbarId,
    endSbarId: origin.lastSbarId, sbarCount: 4, sbarSequenceFingerprint: "fixture" };
  return { bars, keyzones, origin, test };
}
function style(primitive: KeyZonePrimitive) {
  const context = { strokeStyle: "", lineWidth: 0, save: vi.fn(), restore: vi.fn(), setLineDash: vi.fn(), strokeRect: vi.fn(), fillText: vi.fn() };
  primitive.renderer()!.draw({ useMediaCoordinateSpace: (callback: (scope: { context: typeof context }) => void) => callback({ context }) } as unknown as Parameters<NonNullable<ReturnType<KeyZonePrimitive["renderer"]>>["draw"]>[0]);
  return { color: context.strokeStyle, width: context.lineWidth };
}
function episodeLabels(primitive: KeyZonePrimitive) {
  const fillText = vi.fn();
  const context = { save: vi.fn(), restore: vi.fn(), setLineDash: vi.fn(), strokeRect: vi.fn(), fillText };
  primitive.renderer()!.draw({ useMediaCoordinateSpace: (callback: (scope: { context: typeof context }) => void) => callback({ context }) } as unknown as Parameters<NonNullable<ReturnType<KeyZonePrimitive["renderer"]>>["draw"]>[0]);
  return fillText.mock.calls.map((call) => call[0]);
}
const hit = { point: { x: 100, y: 80 } };

describe.each(["Origin", "Live Replay", "Snapshot Reference"] as const)("%s KeyZone interactions", (kind) => {
  function setup() {
    const data = fixture();
    const wrapper = kind === "Origin"
      ? mount(OriginChart, { props: { bars: data.bars, structure: null, keyzones: data.keyzones, originDatasetId: "origin-keyzone" } })
      : kind === "Live Replay"
        ? mount(RunChart, { props: { origin: data.origin, testDataset: data.test, keyzones: data.keyzones,
          runState: { runId: "run-keyzone", testDatasetId: data.test.testDatasetId, inputFingerprint: "fixture", inputCount: 4,
            processedCount: 4, status: "completed", cursorSbarId: data.bars[3]!.sbarId, failureDiagnostic: null } } })
        : mount(SnapshotReferenceChart, { props: { bars: data.bars, structure: null, keyzones: data.keyzones,
          keyzoneUntil: data.bars[3]!.sbarId, snapshotId: "snapshot-keyzone", syncEnabled: false,
          liveBarCount: 4, playbackEnabled: false, playbackOffset: null, processedCount: 4 } });
    const runtime = mocks.runtimes.at(-1)!;
    const primitive = runtime.primitives.find((item): item is KeyZonePrimitive => item instanceof KeyZonePrimitive)!;
    return { wrapper, runtime, primitive, data, surface: wrapper.getComponent(ChartSurface) };
  }

  it("shares hover highlighting and keeps selection in its own chart context", async () => {
    const { wrapper, runtime, primitive, surface, data } = setup();
    expect(style(primitive)).toEqual({ color: "#b49a75", width: 1 });
    const setData = vi.spyOn(primitive, "setData");
    runtime.move(hit);
    expect(style(primitive)).toEqual({ color: "#e3bd80", width: 1.5 });
    expect(surface.emitted("pointerPosition")?.at(-1)).toEqual([hit.point]);
    for (let i = 0; i < 5; i++) runtime.move(hit);
    expect(setData).not.toHaveBeenCalled();
    await surface.get('[data-testid="origin-chart-canvas"], [data-testid="run-chart-canvas"]').trigger("pointerleave");
    expect(style(primitive)).toEqual({ color: "#b49a75", width: 1 });
    runtime.move(hit); runtime.click(hit);
    const expected = kind === "Origin"
      ? { kind: "keyzone", id: "9007199254740993", originDatasetId: "origin-keyzone" }
      : { kind: "keyzone", id: "9007199254740993", checkpointSbarId: data.bars[3]!.sbarId };
    expect(wrapper.emitted(kind === "Origin" ? "objectClick" : "objectSelect")?.at(-1)).toEqual([expected]);
    if (kind !== "Snapshot Reference") await wrapper.setProps({ selectedObject: expected } as never);
    await nextTick();
    expect(style(primitive)).toEqual({ color: "#f0cb87", width: 2 });
    runtime.move({});
    expect(style(primitive)).toEqual({ color: "#f0cb87", width: 2 });
  });

  it("clears stale hover when hiding the layer or replacing checkpoint data", async () => {
    const { wrapper, runtime, primitive, surface, data } = setup();
    const port = surface.vm as unknown as { setLayerVisibility: (value: Record<string, boolean>) => void };
    runtime.move(hit);
    port.setLayerVisibility({ sbar: true, volume: true, cbar: true, swing: true, trend: true, keyzone: false });
    expect(primitive.renderer()).toBeNull();
    port.setLayerVisibility({ sbar: true, volume: true, cbar: true, swing: true, trend: true, keyzone: true });
    expect(style(primitive)).toEqual({ color: "#b49a75", width: 1 });
    runtime.move(hit);
    await wrapper.setProps({ keyzones: keyzoneFixture() } as never);
    expect(style(primitive)).toEqual({ color: "#b49a75", width: 1 });
    runtime.move(hit);
    runtime.rangeChanged();
    expect(style(primitive)).toEqual({ color: "#b49a75", width: 1 });
    runtime.move(hit);
    if (kind === "Origin") await wrapper.setProps({ originDatasetId: "another-origin" } as never);
    else if (kind === "Live Replay") await wrapper.setProps({ testDataset: { ...data.test, testDatasetId: "another-test" } } as never);
    else await wrapper.setProps({ snapshotId: "another-snapshot" } as never);
    expect(style(primitive)).toEqual({ color: "#b49a75", width: 1 });
    runtime.move(hit);
    runtime.move({});
    expect(style(primitive)).toEqual({ color: "#b49a75", width: 1 });
  });

  it("draws each selected observation episode and removes them when another object is selected", async () => {
    const { wrapper, runtime, primitive, data } = setup();
    expect(episodeLabels(primitive)).toEqual([]);
    runtime.move(hit);
    expect(episodeLabels(primitive)).toEqual([]);
    runtime.click(hit);
    if (kind !== "Snapshot Reference") await wrapper.setProps({ selectedObject: kind === "Origin"
      ? { kind: "keyzone", id: "9007199254740993", originDatasetId: "origin-keyzone" }
      : { kind: "keyzone", id: "9007199254740993", checkpointSbarId: data.bars[3]!.sbarId } } as never);
    await nextTick();
    expect(episodeLabels(primitive)).toEqual(["I1 Active"]);
    const registry = keyzoneFixture();
    const base = registry.interactions[0]!;
    registry.interactions = [
      { ...base, state: "Ended", lastProcessedAt: data.bars[1]!.tsEvent, endedAt: data.bars[1]!.tsEvent },
      { ...base, interactionId: "9007199254740996", startedAt: data.bars[2]!.tsEvent },
    ];
    await wrapper.setProps({ keyzones: registry } as never);
    expect(episodeLabels(primitive)).toEqual(["I1 Ended", "I2 Active"]);
    if (kind === "Snapshot Reference") runtime.click({ point: { x: 110, y: 95 } });
    else await wrapper.setProps({ selectedObject: null } as never);
    await nextTick();
    expect(episodeLabels(primitive)).toEqual([]);
  });

  if (kind === "Origin") it("honors explicit range-selection mode instead of selecting a KeyZone", async () => {
    const { wrapper, runtime, primitive } = setup();
    runtime.move(hit);
    await wrapper.setProps({ selectionPending: true } as never);
    expect(style(primitive)).toEqual({ color: "#b49a75", width: 1 });
    runtime.move(hit); runtime.click(hit);
    expect(style(primitive)).toEqual({ color: "#b49a75", width: 1 });
    expect(wrapper.emitted("objectClick")).toBeUndefined();
  });
});
