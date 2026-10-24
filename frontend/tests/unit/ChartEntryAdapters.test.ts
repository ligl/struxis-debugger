import { defineComponent } from "vue";
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import OriginChart from "../../src/components/OriginChart.vue";
import SnapshotReferenceChart from "../../src/components/SnapshotReferenceChart.vue";
import SnapshotPlaybackOverlay from "../../src/components/SnapshotPlaybackOverlay.vue";
import SnapshotLiveRangeMarkers from "../../src/components/SnapshotLiveRangeMarkers.vue";
import type { SBarDto } from "../../src/origin-types";

const bars: SBarDto[] = [{
  sbarId: "sbar-1",
  barType: "TEST-1-MINUTE-LAST-EXTERNAL",
  tsEvent: "1700000000000000000",
  tsInit: "1700000000000000001",
  open: "10",
  high: "12",
  low: "9",
  close: "11",
  volume: "100",
}];

const surfacePortCalls = {
  viewportRanges: [] as Array<{ from: number; to: number }>,
  crosshairs: [] as Array<{ sbarId: string; price: number }>,
  clears: 0,
};

const SurfaceStub = defineComponent({
  name: "SBarChartSurface",
  props: [
    "bars", "structure", "originDatasetId", "selectedObject",
    "selectionStartSbarId", "selectionEndSbarId", "selectionPending",
    "selectionEditable", "displayContext", "snapshotLiveBarCount", "snapshotPlaybackEnabled",
    "snapshotPlaybackOffset", "snapshotProcessedCount",
  ],
  emits: ["sbarClick", "objectClick", "rangeBoundaryChange", "selectionError",
    "cancelRangeSelection", "logicalRangeChange", "crosshairAnchorChange"],
  setup(_props, { expose }) {
    expose({
      getVisibleLogicalRange: () => null,
      applyViewportRange: (range: { from: number; to: number }) => { surfacePortCalls.viewportRanges.push(range); return true; },
      applyCrosshairPosition: (sbarId: string, price: number) => { surfacePortCalls.crosshairs.push({ sbarId, price }); return true; },
      clearCrosshairPosition: () => { surfacePortCalls.clears += 1; },
    });
    return {};
  },
  template: '<div data-testid="surface-stub"><slot name="snapshot-overlays" :enabled="true" :bright-candles="[]" :cbar-rectangles="[]" :swing-segments="[]" :boundaries="null" /></div>',
});

describe("chart entry adapters", () => {
  function clearSurfaceCalls(): void {
    surfacePortCalls.viewportRanges.length = 0;
    surfacePortCalls.crosshairs.length = 0;
    surfacePortCalls.clears = 0;
  }
  it("keeps the Dataset Origin entry limited to Dataset selection props", () => {
    const wrapper = mount(OriginChart, {
      props: {
        bars,
        structure: null,
        originDatasetId: "origin-1",
        selectionEditable: true,
      },
      global: { stubs: { SBarChartSurface: SurfaceStub } },
    });

    const surface = wrapper.getComponent(SurfaceStub);
    expect(surface.props("displayContext")).toBe("origin");
    expect(surface.props("originDatasetId")).toBe("origin-1");
    expect(surface.props("selectionEditable")).toBe(true);
    expect(surface.props("syncEnabled")).toBeUndefined();
    expect(surface.props("snapshotPlaybackEnabled")).toBeUndefined();
  });

  it("maps Snapshot Reference semantics through its own entry", () => {
    clearSurfaceCalls();
    const wrapper = mount(SnapshotReferenceChart, {
      props: {
        bars,
        structure: null,
        snapshotId: "snapshot-1",
        syncEnabled: true,
        syncRequest: null,
        crosshairSync: null,
        liveBarCount: 1,
        playbackEnabled: true,
        playbackOffset: 0,
        processedCount: 0,
      },
      global: { stubs: { SBarChartSurface: SurfaceStub } },
    });

    const surface = wrapper.getComponent(SurfaceStub);
    expect(surface.props("displayContext")).toBe("snapshot-reference");
    expect(surface.props("originDatasetId")).toBe("snapshot-1");
    expect(surface.props("syncEnabled")).toBeUndefined();
    expect(surface.props("syncRequest")).toBeUndefined();
    expect(surface.props("crosshairSync")).toBeUndefined();
    expect(surface.props("snapshotLiveBarCount")).toBe(1);
    expect(surface.props("snapshotPlaybackEnabled")).toBe(true);
    expect(surface.props("snapshotPlaybackOffset")).toBe(0);
    expect(surface.props("snapshotProcessedCount")).toBe(0);
    expect(wrapper.findComponent(SnapshotPlaybackOverlay).exists()).toBe(true);
    expect(wrapper.findComponent(SnapshotLiveRangeMarkers).exists()).toBe(true);
  });

  it("applies Live viewport requests through the adapter port", async () => {
    clearSurfaceCalls();
    mount(SnapshotReferenceChart, {
      props: {
        bars,
        structure: null,
        snapshotId: "snapshot-1",
        syncEnabled: true,
        syncRequest: { source: "live", from: 10, to: 20, offset: 2, revision: 1 },
        crosshairSync: null,
        liveBarCount: 1,
        playbackEnabled: true,
        playbackOffset: 2,
        processedCount: 0,
      },
      global: { stubs: { SBarChartSurface: SurfaceStub } },
    });

    await Promise.resolve();
    expect(surfacePortCalls.viewportRanges).toEqual([{ from: 12, to: 22 }]);
  });

  it("maps peer Crosshair positions by exact SBar ID", async () => {
    clearSurfaceCalls();
    mount(SnapshotReferenceChart, {
      props: {
        bars,
        structure: null,
        snapshotId: "snapshot-1",
        syncEnabled: true,
        syncRequest: null,
        crosshairSync: { source: "live", sbarId: "sbar-1", price: 11, revision: 1 },
        liveBarCount: 1,
        playbackEnabled: true,
        playbackOffset: 0,
        processedCount: 0,
      },
      global: { stubs: { SBarChartSurface: SurfaceStub } },
    });

    await Promise.resolve();
    expect(surfacePortCalls.crosshairs).toEqual([{ sbarId: "sbar-1", price: 11 }]);
  });

  it("does not clear a local Crosshair for an unmappable peer anchor", async () => {
    clearSurfaceCalls();
    mount(SnapshotReferenceChart, {
      props: {
        bars,
        structure: null,
        snapshotId: "snapshot-1",
        syncEnabled: true,
        syncRequest: null,
        crosshairSync: { source: "live", sbarId: "missing-sbar", price: 11, revision: 1 },
        liveBarCount: 1,
        playbackEnabled: true,
        playbackOffset: 0,
        processedCount: 0,
      },
      global: { stubs: { SBarChartSurface: SurfaceStub } },
    });

    await Promise.resolve();
    expect(surfacePortCalls.clears).toBe(0);
  });

});
