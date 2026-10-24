import { describe, expect, it } from "vitest";
import { isSameLogicalRange, translateReplayViewportRange } from "../../src/replay-chart-sync";

describe("Replay chart viewport protocol", () => {
  it("translates Live ranges into Snapshot logical coordinates by adding Offset", () => {
    expect(translateReplayViewportRange({ from: 2.25, to: 8.75, offset: 12 }, "live-to-reference"))
      .toEqual({ from: 14.25, to: 20.75 });
  });

  it("translates Snapshot ranges into Live coordinates by subtracting Offset", () => {
    expect(translateReplayViewportRange({ from: 14.25, to: 20.75, offset: 12 }, "reference-to-live"))
      .toEqual({ from: 2.25, to: 8.75 });
  });

  it("rejects invalid ranges and non-finite offsets", () => {
    expect(translateReplayViewportRange({ from: 2, to: 2, offset: 1 }, "live-to-reference")).toBeNull();
    expect(translateReplayViewportRange({ from: 3, to: 2, offset: 1 }, "reference-to-live")).toBeNull();
    expect(translateReplayViewportRange({ from: 1, to: 2, offset: Number.NaN }, "live-to-reference")).toBeNull();
    expect(translateReplayViewportRange({ from: Number.POSITIVE_INFINITY, to: 2, offset: 1 }, "live-to-reference")).toBeNull();
  });

  it("uses the shared tolerance for asynchronous range echoes", () => {
    expect(isSameLogicalRange({ from: 1.004, to: 9.004 }, { from: 1, to: 9 })).toBe(true);
    expect(isSameLogicalRange({ from: 1.02, to: 9 }, { from: 1, to: 9 })).toBe(false);
    expect(isSameLogicalRange({ from: Number.NaN, to: 9 }, { from: 1, to: 9 })).toBe(false);
  });
});
