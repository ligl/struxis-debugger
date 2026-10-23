import { enableAutoUnmount, mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { afterEach, describe, expect, it } from "vitest";
import TestDatasetPanel from "../../src/components/TestDatasetPanel.vue";
import type { OriginDatasetDto, TestDatasetDto } from "../../src/origin-types";

enableAutoUnmount(afterEach);

const origin: OriginDatasetDto = {
  originDatasetId: "origin-1",
  sourceCatalog: "/workspace/catalog",
  enableStructure: true,
  instrumentId: "BTCUSDT-PERP.BINANCE",
  barType: "BTCUSDT-PERP.BINANCE-1-DAY-LAST-EXTERNAL",
  timeframe: "1D",
  sbarSequenceFingerprint: "origin-fingerprint",
  sbarCount: 3,
  firstSbarId: "1766275199999000000",
  lastSbarId: "1786147199999000000",
  firstTsEvent: "1766275199999000000",
  lastTsEvent: "1786147199999000000",
  structure: null,
  bars: [
    {
      sbarId: "1766275199999000000",
      barType: "BTCUSDT-PERP.BINANCE-1-DAY-LAST-EXTERNAL",
      tsEvent: "1766275199999000000",
      tsInit: "1766275200000000000",
      open: "1",
      high: "2",
      low: "0.5",
      close: "1.5",
      volume: "10",
    },
    {
      sbarId: "1786147199999000000",
      barType: "BTCUSDT-PERP.BINANCE-1-DAY-LAST-EXTERNAL",
      tsEvent: "1786147199999000000",
      tsInit: "1786147200000000000",
      open: "1.5",
      high: "3",
      low: "1",
      close: "2.5",
      volume: "12",
    },
  ],
};

const testDataset: TestDatasetDto = {
  testDatasetId: "test-1",
  originDatasetId: "origin-1",
  instrumentId: origin.instrumentId,
  barType: origin.barType,
  timeframe: origin.timeframe,
  startSbarId: origin.firstSbarId,
  endSbarId: origin.lastSbarId,
  sbarCount: 2,
  sbarSequenceFingerprint: "0123456789abcdef0123456789abcdef",
};

function mountPanel() {
  return mount(TestDatasetPanel, {
    props: {
      origin,
      testDataset,
      startSbarId: origin.firstSbarId,
      endSbarId: origin.lastSbarId,
      rangeSelectionReady: true,
      rangeSelectionPending: false,
      selectedRangeCount: 2,
      rangeSelectionStatus: "",
      testLoading: false,
      canMutateTest: true,
      testError: "",
      testStatus: "",
    },
  });
}

describe("TestDatasetPanel details popover", () => {
  it("always renders TEST DETAILS and disables it when no Test Dataset is available", async () => {
    const wrapper = mount(TestDatasetPanel, {
      props: {
        origin,
        testDataset: null,
        startSbarId: origin.firstSbarId,
        endSbarId: origin.lastSbarId,
        rangeSelectionReady: false,
        rangeSelectionPending: false,
        selectedRangeCount: 0,
        rangeSelectionStatus: "",
        testLoading: false,
        canMutateTest: true,
        testError: "",
        testStatus: "",
      },
    });

    const trigger = wrapper.get('[data-testid="test-dataset-details-toggle"]');
    expect(trigger.text()).toBe("TEST DETAILS");
    expect(trigger.attributes("disabled")).toBeDefined();
    expect(wrapper.find('[data-testid="test-dataset-details-popover"]').exists()).toBe(false);
  });

  it("keeps the TEST DETAILS trigger visible while the popover is open", async () => {
    const wrapper = mountPanel();

    const trigger = wrapper.get('[data-testid="test-dataset-details-toggle"]');
    expect(trigger.attributes("aria-expanded")).toBe("false");

    await trigger.trigger("click");

    expect(wrapper.get('[data-testid="test-dataset-details-toggle"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="test-dataset-details-toggle"]').attributes("aria-expanded")).toBe("true");
    expect(wrapper.get('[data-testid="test-dataset-details-popover"]').exists()).toBe(true);
    const detailsText = wrapper.get('[data-testid="test-dataset-details-popover"]').text();
    expect(detailsText).toContain("INCLUSIVE INTERVAL");
    expect(detailsText).toContain("INSTRUMENT");
    expect(detailsText).toContain("BTCUSDT-PERP.BINANCE");
    expect(detailsText).toContain("TIMEFRAME");
    expect(detailsText).toContain("1D");
    expect(detailsText).toContain("SEQUENCE FINGERPRINT");
    expect(trigger.text()).toBe("TEST DETAILS");
    expect(trigger.find("svg, img").exists()).toBe(false);
  });

  it("closes the popover when pointer input occurs outside the controls", async () => {
    const wrapper = mountPanel();
    await wrapper.get('[data-testid="test-dataset-details-toggle"]').trigger("click");
    expect(wrapper.get('[data-testid="test-dataset-details-popover"]').exists()).toBe(true);

    document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    await nextTick();

    expect(wrapper.find('[data-testid="test-dataset-details-popover"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="test-dataset-details-toggle"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="test-dataset-details-toggle"]').attributes("aria-expanded")).toBe("false");
  });

  it("closes the popover on Escape", async () => {
    const wrapper = mountPanel();
    await wrapper.get('[data-testid="test-dataset-details-toggle"]').trigger("click");

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await nextTick();

    expect(wrapper.find('[data-testid="test-dataset-details-popover"]').exists()).toBe(false);
  });
});
