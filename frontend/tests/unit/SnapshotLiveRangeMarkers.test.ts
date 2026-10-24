import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import SnapshotLiveRangeMarkers from "../../src/components/SnapshotLiveRangeMarkers.vue";

describe("SnapshotLiveRangeMarkers", () => {
  it("anchors both markers and arrows to the supplied projected coordinates", () => {
    const wrapper = mount(SnapshotLiveRangeMarkers, {
      props: { boundaries: { start: 21, end: 84 } },
    });

    expect(wrapper.get('[data-testid="snapshot-live-range-start"]').attributes("x1")).toBe("21");
    expect(wrapper.get('[data-testid="snapshot-live-range-end"]').attributes("x1")).toBe("84");
    expect(wrapper.get('[data-testid="snapshot-live-range-start-arrow"]').attributes("d"))
      .toContain("23");
    expect(wrapper.get('[data-testid="snapshot-live-range-end-arrow"]').attributes("d"))
      .toContain("82");
  });

  it("renders no boundaries when synchronization anchors are unavailable", () => {
    const wrapper = mount(SnapshotLiveRangeMarkers, { props: { boundaries: null } });
    expect(wrapper.find('[data-testid="snapshot-live-range-markers"]').exists()).toBe(false);
  });
});
