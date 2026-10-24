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
    "bars", "structure", "originDatasetId",
    "showHeader", "showFooter", "panelClass", "panelLabel", "chartLabel",
  ],
  emits: ["chartClick", "pointerPosition", "logicalRangeChange", "crosshairAnchorChange", "projectionFrame"],
  setup(_props, { expose }) {
    expose({
      getVisibleLogicalRange: () => ({ from: 0, to: 1 }),
      applyViewportRange: (range: { from: number; to: number }) => { surfacePortCalls.viewportRanges.push(range); return true; },
      applyCrosshairPosition: (sbarId: string, price: number) => { surfacePortCalls.crosshairs.push({ sbarId, price }); return true; },
      clearCrosshairPosition: () => { surfacePortCalls.clears += 1; },
      getSbarCoordinate: (sbarId: string) => sbarId === "sbar-1" ? 10 : null,
      getSbarMarker: (sbarId: string) => sbarId === "sbar-1" ? { id: sbarId, x: 5, y: 10, width: 6, height: 8 } : null,
      getStructureGeometry: () => ({ cbarRectangles: [], swingSegments: [] }),
      getLogicalCoordinate: (index: number) => index * 10,
      getPriceCoordinate: (price: number) => price * 2,
      getSbarIdAtCoordinate: (x: number, clampToSequence = false) => x >= 0 && x <= 10 || clampToSequence ? "sbar-1" : null,
      getSbarIdAtClientX: (clientX: number, clampToSequence = false) => clientX >= 0 && clientX <= 10 || clampToSequence ? "sbar-1" : null,
      hasSbarId: (sbarId: string) => sbarId === "sbar-1",
    });
    return {};
  },
  template: '<div data-testid="surface-stub"><slot name="chart-structure-overlays" :cbar-rectangles="[]" :swing-segments="[]" /><slot name="chart-interaction-overlay" /><slot name="footer-trailing" /></div>',
});

describe("chart entry adapters", () => {
  function clearSurfaceCalls(): void {
    surfacePortCalls.viewportRanges.length = 0;
    surfacePortCalls.crosshairs.length = 0;
    surfacePortCalls.clears = 0;
  }
  it("keeps Dataset range-selection props and presentation at the Origin adapter boundary", () => {
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
    expect(((surface.props() as Record<string, unknown>)["displayContext"])).toBeUndefined();
    expect(((surface.props() as Record<string, unknown>)["showHeader"])).toBe(true);
    expect(((surface.props() as Record<string, unknown>)["showFooter"])).toBe(true);
    expect(((surface.props() as Record<string, unknown>)["originDatasetId"])).toBe("origin-1");
    expect(((surface.props() as Record<string, unknown>)["selectedObject"])).toBeUndefined();
    expect((wrapper.props() as Record<string, unknown>)["selectionEditable"]).toBe(true);
    expect(((surface.props() as Record<string, unknown>)["selectionEditable"])).toBeUndefined();
    expect(((surface.props() as Record<string, unknown>)["selectionStartSbarId"])).toBeUndefined();
    expect(((surface.props() as Record<string, unknown>)["syncEnabled"])).toBeUndefined();
    expect(((surface.props() as Record<string, unknown>)["snapshotPlaybackEnabled"])).toBeUndefined();
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
    expect(((surface.props() as Record<string, unknown>)["displayContext"])).toBeUndefined();
    expect(((surface.props() as Record<string, unknown>)["showHeader"])).toBe(false);
    expect(((surface.props() as Record<string, unknown>)["showFooter"])).toBe(false);
    expect(((surface.props() as Record<string, unknown>)["panelClass"])).toBe("snapshot-reference-chart");
    expect(((surface.props() as Record<string, unknown>)["originDatasetId"])).toBe("snapshot-1");
    expect(((surface.props() as Record<string, unknown>)["selectedObject"])).toBeUndefined();
    expect(((surface.props() as Record<string, unknown>)["selectionEditable"])).toBeUndefined();
    expect(((surface.props() as Record<string, unknown>)["selectionStartSbarId"])).toBeUndefined();
    expect(((surface.props() as Record<string, unknown>)["syncEnabled"])).toBeUndefined();
    expect(((surface.props() as Record<string, unknown>)["syncRequest"])).toBeUndefined();
    expect(((surface.props() as Record<string, unknown>)["crosshairSync"])).toBeUndefined();
    expect(((surface.props() as Record<string, unknown>)["snapshotLiveBarCount"])).toBeUndefined();
    expect(((surface.props() as Record<string, unknown>)["snapshotPlaybackEnabled"])).toBeUndefined();
    expect(((surface.props() as Record<string, unknown>)["snapshotPlaybackOffset"])).toBeUndefined();
    expect(((surface.props() as Record<string, unknown>)["snapshotProcessedCount"])).toBeUndefined();
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


  it("projects Snapshot playback geometry in the Snapshot adapter", async () => {
    clearSurfaceCalls();
    const wrapper = mount(SnapshotReferenceChart, {
      props: {
        bars,
        structure: null,
        snapshotId: "snapshot-geometry",
        syncEnabled: true,
        syncRequest: null,
        crosshairSync: null,
        liveBarCount: 1,
        playbackEnabled: true,
        playbackOffset: 0,
        processedCount: 1,
      },
      global: { stubs: { SBarChartSurface: SurfaceStub } },
    });

    await Promise.resolve();
    const overlay = wrapper.getComponent(SnapshotPlaybackOverlay);
    expect(((overlay.props() as Record<string, unknown>)["enabled"])).toBe(true);
    expect(((overlay.props() as Record<string, unknown>)["brightCandles"])).toEqual([
      { id: "sbar-1", x: 6.8, y: 18, width: 6.4, height: 6 },
    ]);
    expect((wrapper.getComponent(SnapshotLiveRangeMarkers).props() as Record<string, unknown>)["boundaries"]).toEqual({
      start: 10,
      end: 10,
    });
    const surface = wrapper.getComponent(SurfaceStub);
    expect(((surface.props() as Record<string, unknown>)["snapshotPlaybackEnabled"])).toBeUndefined();
    expect(((surface.props() as Record<string, unknown>)["snapshotPlaybackOffset"])).toBeUndefined();
  });

});
