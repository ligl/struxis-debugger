import { mount } from "@vue/test-utils";
import { defineComponent, ref } from "vue";
import { describe, expect, it } from "vitest";
import KeyZoneDetails from "../../src/components/KeyZoneDetails.vue";
import OriginChart from "../../src/components/OriginChart.vue";
import ObjectInspector from "../../src/components/ObjectInspector.vue";
import { useInspectorSelection } from "../../src/composables/useInspectorSelection";
import type { OriginDatasetDto } from "../../src/origin-types";
import { keyzoneFixture, keyzoneBars } from "./keyzone-fixture";

describe("KeyZone selection and Inspector", () => {
  it("preserves exact prices, IDs, source and interaction configuration", () => {
    const registry = keyzoneFixture();
    const wrapper = mount(KeyZoneDetails, { props: { zone: registry.zones[0]!, registry } });
    expect(wrapper.text()).toContain("9007199254740993");
    expect(wrapper.text()).toContain("9.00001");
    expect(wrapper.text()).toContain("12.00002");
    expect(wrapper.text()).toContain("Swing");
    expect(wrapper.get('[data-testid="keyzone-interaction"]').text()).toContain("AUD/USD.SIM · 1m");
  });
  it("routes a chart border selection by stable domain ID", async () => {
    const registry = keyzoneFixture();
    const wrapper = mount(OriginChart, { props: { bars: keyzoneBars(), structure: null, keyzones: registry, originDatasetId: "origin-keyzone" },
      global: { stubs: { ChartSurface: defineComponent({ name: "ChartSurface", setup(_, { expose }) {
        expose({ registerPrimitive: () => () => {}, getSbarCoordinate: () => null,
          getStructureGeometry: () => ({ cbarRectangles: [], swingSegments: [], trendSegments: [] }),
          setStructureInteractionState: () => {} }); return {}; }, template: '<div />' }) } } });
    wrapper.findComponent({ name: "ChartSurface" }).vm.$emit("keyzoneSelect", "9007199254740993");
    expect(wrapper.emitted("objectClick")).toEqual([[{ kind: "keyzone", id: "9007199254740993", originDatasetId: "origin-keyzone" }]]);
  });
  it("resolves dataset selection without requiring Structure and rejects stale origins", () => {
    const origin = ref({ originDatasetId: "origin-keyzone", bars: keyzoneBars(), structure: null, keyzones: keyzoneFixture() } as OriginDatasetDto);
    const selection = useInspectorSelection(origin, ref("dataset"));
    selection.selectStructureObject({ kind: "keyzone", id: "9007199254740993", originDatasetId: "stale" });
    expect(selection.selectedInspectorKeyzone.value).toBeNull();
    selection.selectStructureObject({ kind: "keyzone", id: "9007199254740993", originDatasetId: "origin-keyzone" });
    expect(selection.selectedInspectorKeyzone.value?.lower).toBe("9.00001");
  });
  it("renders the selected zone in the Replay Inspector", () => {
    const registry = keyzoneFixture();
    const wrapper = mount(ObjectInspector, { props: { origin: null, originBars: [], originStructure: null,
      context: { workspace: "replay", timeframe: "1m", checkpoint: null, selectedObject: { kind: "keyzone", object: registry.zones[0]!, registry },
        snapshotId: null, snapshotBars: [], snapshotStructure: null, error: "" } } });
    expect(wrapper.get('[data-testid="keyzone-details"]').text()).toContain("12.00002");
  });
});


it("groups observations and shows the recorded-empty state", () => {
  const registry = keyzoneFixture();
  const wrapper = mount(KeyZoneDetails, { props: { zone: registry.zones[0]!, registry } });
  expect(wrapper.findAll('[data-testid="keyzone-observation"]')).toHaveLength(1);
  expect(wrapper.text()).toContain("strategy-a");
  expect(wrapper.text()).toContain("request-a");
  const empty = mount(KeyZoneDetails, { props: { zone: registry.zones[0]!, registry: { ...registry, observations: [], interactions: [] } } });
  expect(empty.find('[data-testid="keyzone-observations-empty"]').exists()).toBe(true);

});
