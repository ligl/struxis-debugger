import { describe, expect, it } from "vitest";
import { isSameLogicalRange, ReplayCrosshairSyncGate, ReplayViewportSyncGate, translateReplayViewportRange } from "../../src/replay-chart-sync";

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


describe("Replay viewport sync gate", () => {
  it("consumes matching peer echoes without publishing them", () => {
    const gate = new ReplayViewportSyncGate();
    gate.expectPeerRange({ from: 10, to: 20 });
    expect(gate.observeRange({ from: 10.004, to: 20.004 })).toBe("echo");
    expect(gate.observeRange({ from: 10, to: 20 })).toBe("publish");
  });

  it("routes mismatched ranges through suppression or local publishing", () => {
    const gate = new ReplayViewportSyncGate();
    gate.expectPeerRange({ from: 10, to: 20 });
    expect(gate.observeRange({ from: 11, to: 21 })).toBe("publish");
    const revision = gate.beginSuppression();
    expect(gate.observeRange({ from: 11, to: 21 })).toBe("suppressed");
    gate.endSuppression(revision);
    expect(gate.observeRange({ from: 11, to: 21 })).toBe("publish");
  });

  it("prevents an older release from ending a newer suppression window", () => {
    const gate = new ReplayViewportSyncGate();
    const oldRevision = gate.beginSuppression();
    const newRevision = gate.beginSuppression();
    gate.endSuppression(oldRevision);
    expect(gate.observeRange({ from: 1, to: 2 })).toBe("suppressed");
    gate.endSuppression(newRevision);
    expect(gate.observeRange({ from: 1, to: 2 })).toBe("publish");
  });

  it("reset invalidates expected echoes and pending suppression releases", () => {
    const gate = new ReplayViewportSyncGate();
    gate.expectPeerRange({ from: 10, to: 20 });
    const revision = gate.beginSuppression();
    gate.clear();
    gate.endSuppression(revision);
    expect(gate.observeRange({ from: 10, to: 20 })).toBe("publish");
  });
});


describe("Replay Crosshair sync gate", () => {
  it("tracks peer position independently from apply suppression", () => {
    const gate = new ReplayCrosshairSyncGate();
    gate.setPeerPositionActive(true);
    gate.beginApply();
    expect(gate.hasPeerPosition).toBe(true);
    expect(gate.isApplying).toBe(true);
    gate.setPeerPositionActive(false);
    expect(gate.hasPeerPosition).toBe(false);
  });
  it("clear invalidates pending releases and peer position state", () => {
    const gate = new ReplayCrosshairSyncGate();
    gate.setPeerPositionActive(true);
    gate.beginApply();
    gate.clear();
    expect(gate.isApplying).toBe(false);
    expect(gate.hasPeerPosition).toBe(false);
  });
});
