import { defineComponent } from "vue";
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import OriginChart from "../../src/components/OriginChart.vue";
import SnapshotReferenceChart from "../../src/components/SnapshotReferenceChart.vue";
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

const SurfaceStub = defineComponent({
  name: "SBarChartSurface",
  props: [
    "bars", "structure", "originDatasetId", "selectedObject",
    "selectionStartSbarId", "selectionEndSbarId", "selectionPending",
    "selectionEditable", "displayContext", "syncEnabled", "syncRequest",
    "crosshairSync", "syncLiveBarCount", "snapshotPlaybackEnabled",
    "snapshotPlaybackOffset", "snapshotProcessedCount",
  ],
  emits: ["sbarClick", "objectClick", "rangeBoundaryChange", "selectionError",
    "cancelRangeSelection", "viewportChange", "crosshairChange"],
  template: '<div data-testid="surface-stub"></div>',
});

describe("chart entry adapters", () => {
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
    expect(surface.props("syncEnabled")).toBe(true);
    expect(surface.props("syncLiveBarCount")).toBe(1);
    expect(surface.props("snapshotPlaybackEnabled")).toBe(true);
    expect(surface.props("snapshotPlaybackOffset")).toBe(0);
    expect(surface.props("snapshotProcessedCount")).toBe(0);
  });
});
