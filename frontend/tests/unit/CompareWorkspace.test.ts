import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { nextTick } from "vue";
import CompareWorkspace from "../../src/components/CompareWorkspace.vue";
import SnapshotPanel from "../../src/components/SnapshotPanel.vue";
import type { ObjectDifferenceDto } from "../../src/origin-types";

const difference: ObjectDifferenceDto = {
  checkpointIndex: 2,
  sbarId: "sbar-2",
  objectType: "Swing",
  kind: "modified",
  objectId: "swing-7",
  properties: [],
};

function mountWorkspace(active = true) {
  return mount(CompareWorkspace, {
    props: {
      active,
      snapshots: [],
      snapshotsLoading: false,
      snapshotsError: "",
      compareResult: null,
      compareLoading: false,
      compareError: "",
      formatLifecycleTimestamp: (value: string | null | undefined) => value ?? "—",
    },
  });
}

describe("CompareWorkspace", () => {
  it("owns difference selection and forwards the selected domain difference", async () => {
    const wrapper = mountWorkspace();
    wrapper.findComponent(SnapshotPanel).vm.$emit("select-difference", difference);
    await nextTick();

    expect(wrapper.emitted("selectDifference")).toEqual([[difference]]);
    expect(wrapper.findComponent(SnapshotPanel).props("selectedDifferenceKey"))
      .toBe("2|sbar-2|Swing|swing-7|modified");
  });

  it("clears the selection when leaving Compare", async () => {
    const wrapper = mountWorkspace();
    wrapper.findComponent(SnapshotPanel).vm.$emit("select-difference", difference);
    await wrapper.setProps({ active: false });
    await nextTick();

    const selectionEvents = wrapper.emitted("selectDifference") ?? [];
    expect(selectionEvents[selectionEvents.length - 1]).toEqual([null]);
    expect(wrapper.findComponent(SnapshotPanel).props("selectedDifferenceKey")).toBeNull();
  });
});
