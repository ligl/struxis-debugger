import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import SnapshotPlaybackOverlay from "../../src/components/SnapshotPlaybackOverlay.vue";

describe("SnapshotPlaybackOverlay", () => {
  it("renders the dimming mask and domain-object cutouts when playback is active", () => {
    const wrapper = mount(SnapshotPlaybackOverlay, {
      props: {
        enabled: true,
        brightCandles: [{ id: "sbar-2", x: 10, y: 20, width: 4, height: 12 }],
        cbarRectangles: [{ id: "cbar-1", x: 8, y: 18, width: 8, height: 16 }],
        swingSegments: [{
          id: "swing-1",
          x1: 4,
          y1: 10,
          x2: 16,
          y2: 24,
          state: "Confirmed",
          color: "#B49ACD",
          dasharray: "",
        }],
      },
    });

    expect(wrapper.get('[data-testid="snapshot-playback-dimming"]').attributes("mask"))
      .toBe("url(#snapshot-playback-brightness-mask)");
    expect(wrapper.get('[data-testid="snapshot-bright-candle-cutout"]').attributes("data-sbar-id"))
      .toBe("sbar-2");
    expect(wrapper.get('[data-testid="snapshot-bright-cbar-cutout"]').attributes("data-cbar-id"))
      .toBe("cbar-1");
    expect(wrapper.get('[data-testid="snapshot-bright-swing-cutout"]').attributes("data-swing-id"))
      .toBe("swing-1");
  });

  it("renders no playback SVG when disabled", () => {
    const wrapper = mount(SnapshotPlaybackOverlay, {
      props: {
        enabled: false,
        brightCandles: [],
        cbarRectangles: [],
        swingSegments: [],
      },
    });

    expect(wrapper.find('[data-testid="snapshot-playback-dimming"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="snapshot-bright-candle-cutout"]').exists()).toBe(false);
  });
});
