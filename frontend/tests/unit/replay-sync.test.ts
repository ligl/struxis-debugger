import { describe, expect, it } from "vitest";
import { resolveReplaySyncOffset, type ReplaySyncSequenceDescriptor } from "../../src/replay-sync";

const fiveMinute = "AUD/USD.SIM-5-MINUTE-LAST-EXTERNAL";
const reference: ReplaySyncSequenceDescriptor = {
  snapshotId: "snapshot-1",
  barType: fiveMinute,
  sbarIds: ["a", "b", "c", "d", "e"],
};

describe("resolveReplaySyncOffset", () => {
  it("resolves the fixed offset when timeframe and full contiguous identity sequence match", () => {
    expect(resolveReplaySyncOffset(fiveMinute, ["b", "c", "d"], reference)).toBe(1);
  });

  it("rejects a timeframe mismatch", () => {
    expect(resolveReplaySyncOffset("AUD/USD.SIM-1-MINUTE-LAST-EXTERNAL", ["b"], reference)).toBeNull();
  });

  it("rejects a gap or reordered SBar identity", () => {
    expect(resolveReplaySyncOffset(fiveMinute, ["b", "d"], reference)).toBeNull();
    expect(resolveReplaySyncOffset(fiveMinute, ["c", "b"], reference)).toBeNull();
  });

  it("rejects duplicate IDs in the Snapshot sequence", () => {
    expect(resolveReplaySyncOffset(fiveMinute, ["b"], {
      ...reference,
      sbarIds: ["a", "b", "b", "c"],
    })).toBeNull();
  });

  it("rejects missing or empty sequence descriptions", () => {
    expect(resolveReplaySyncOffset(fiveMinute, ["a"], null)).toBeNull();
    expect(resolveReplaySyncOffset(fiveMinute, [], reference)).toBeNull();
  });
});
