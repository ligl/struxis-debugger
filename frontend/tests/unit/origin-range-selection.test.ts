import { describe, expect, it } from "vitest";
import { resolveOriginRangeClick } from "../../src/origin-range-selection";
import type { SBarDto } from "../../src/origin-types";

const bars: SBarDto[] = [
  {
    sbarId: "1700000000000000000",
    barType: "TEST-1-MINUTE-LAST-EXTERNAL",
    tsEvent: "1700000000000000000",
    tsInit: "1700000000000000001",
    open: "10",
    high: "12",
    low: "9",
    close: "11",
    volume: "100",
  },
  {
    sbarId: "1700000060000000000",
    barType: "TEST-1-MINUTE-LAST-EXTERNAL",
    tsEvent: "1700000060000000000",
    tsInit: "1700000060000000001",
    open: "11",
    high: "13",
    low: "10",
    close: "12",
    volume: "101",
  },
  {
    sbarId: "1700000120000000000",
    barType: "TEST-1-MINUTE-LAST-EXTERNAL",
    tsEvent: "1700000120000000000",
    tsInit: "1700000120000000001",
    open: "12",
    high: "14",
    low: "11",
    close: "13",
    volume: "102",
  },
];

describe("Origin two-click range selection", () => {
  it("uses the first exact SBar ID as the pending start", () => {
    expect(resolveOriginRangeClick(bars, null, bars[1]!.sbarId)).toEqual({
      kind: "start",
      sbarId: "1700000060000000000",
    });
  });

  it("returns an inclusive contiguous interval between two clicks", () => {
    expect(resolveOriginRangeClick(bars, bars[0]!.sbarId, bars[2]!.sbarId)).toEqual({
      kind: "complete",
      startSbarId: "1700000000000000000",
      endSbarId: "1700000120000000000",
      count: 3,
    });
  });

  it("normalizes reverse clicks to Origin sequence order", () => {
    expect(resolveOriginRangeClick(bars, bars[2]!.sbarId, bars[0]!.sbarId)).toEqual({
      kind: "complete",
      startSbarId: "1700000000000000000",
      endSbarId: "1700000120000000000",
      count: 3,
    });
  });

  it("allows a single-SBar inclusive interval", () => {
    expect(resolveOriginRangeClick(bars, bars[1]!.sbarId, bars[1]!.sbarId)).toEqual({
      kind: "complete",
      startSbarId: "1700000060000000000",
      endSbarId: "1700000060000000000",
      count: 1,
    });
  });

  it("rejects a clicked ID that is not in Origin", () => {
    expect(resolveOriginRangeClick(bars, null, "9999999999999999999")).toEqual({
      kind: "invalid",
      message: "The selected SBar is not part of the current Origin. No selection was changed.",
    });
  });

  it("rejects a pending start ID that no longer belongs to Origin", () => {
    expect(resolveOriginRangeClick(bars, "9999999999999999999", bars[0]!.sbarId)).toEqual({
      kind: "invalid",
      message: "The pending start SBar is no longer part of this Origin. Select the range again.",
    });
  });

  it("preserves SBar IDs as exact decimal strings", () => {
    const result = resolveOriginRangeClick(bars, bars[0]!.sbarId, bars[1]!.sbarId);
    expect(result).toMatchObject({
      kind: "complete",
      startSbarId: "1700000000000000000",
      endSbarId: "1700000060000000000",
    });
    if (result.kind === "complete") {
      expect(typeof result.startSbarId).toBe("string");
      expect(typeof result.endSbarId).toBe("string");
    }
  });
});
