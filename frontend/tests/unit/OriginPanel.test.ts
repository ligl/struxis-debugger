import { enableAutoUnmount, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it } from "vitest";
import OriginPanel from "../../src/components/OriginPanel.vue";
import type { OriginDatasetDto } from "../../src/origin-types";

enableAutoUnmount(afterEach);

const origin: OriginDatasetDto = {
  originDatasetId: "origin-1",
  sourceCatalog: "/workspace/catalog",
  enableStructure: true,
  instrumentId: "BTCUSDT-PERP.BINANCE",
  barType: "BTCUSDT-PERP.BINANCE-1-HOUR-LAST-EXTERNAL",
  timeframe: "1H",
  sbarSequenceFingerprint: "fingerprint",
  sbarCount: 1234,
  firstSbarId: "100",
  lastSbarId: "200",
  firstTsEvent: "100",
  lastTsEvent: "200",
  bars: [],
  structure: {
    cbarCount: 123,
    cbars: [],
    swingCount: 45,
    swings: [],
    trendCount: 6,
    trends: [],
  },
};

function mountPanel(overrides: Partial<OriginDatasetDto> = {}) {
  return mount(OriginPanel, {
    props: {
      origin: { ...origin, ...overrides },
      loadStatus: "loaded",
      loadError: "",
      formatDomainTimestamp: (value: string | null) => value ?? "—",
    },
  });
}

describe("OriginPanel structure counts", () => {
  it("shows CBar, Swing, and Trend counts from the Origin structure projection", () => {
    const wrapper = mountPanel();

    expect(wrapper.get('[data-testid="origin-cbar-count"]').text()).toBe("123");
    expect(wrapper.get('[data-testid="origin-swing-count"]').text()).toBe("45");
    expect(wrapper.get('[data-testid="origin-trend-count"]').text()).toBe("6");
  });

  it("shows DISABLED when structure calculation was disabled for the Origin", () => {
    const wrapper = mountPanel({ enableStructure: false, structure: null });

    expect(wrapper.get('[data-testid="origin-cbar-count"]').text()).toBe("DISABLED");
    expect(wrapper.get('[data-testid="origin-swing-count"]').text()).toBe("DISABLED");
    expect(wrapper.get('[data-testid="origin-trend-count"]').text()).toBe("DISABLED");
  });

  it("shows UNAVAILABLE when structure is enabled but its projection is absent", () => {
    const wrapper = mountPanel({ structure: null });

    expect(wrapper.get('[data-testid="origin-cbar-count"]').text()).toBe("UNAVAILABLE");
    expect(wrapper.get('[data-testid="origin-swing-count"]').text()).toBe("UNAVAILABLE");
    expect(wrapper.get('[data-testid="origin-trend-count"]').text()).toBe("UNAVAILABLE");
  });
});
