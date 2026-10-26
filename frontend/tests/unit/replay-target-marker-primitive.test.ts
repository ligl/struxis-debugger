import { describe, expect, it, vi } from "vitest";
import { ReplayTargetMarkerPrimitive } from "../../src/replay-target-marker-primitive";

function createDrawTarget() {
  const context = {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    setLineDash: vi.fn(),
    fillText: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    set strokeStyle(_value: string) {},
    set fillStyle(_value: string) {},
    set lineWidth(_value: number) {},
    set font(_value: string) {},
    set textBaseline(_value: string) {},
  };
  const target = {
    useMediaCoordinateSpace: (callback: (scope: { context: typeof context; mediaSize: { width: number; height: number } }) => void) => {
      callback({ context, mediaSize: { width: 500, height: 200 } });
    },
  };
  return { context, target };
}

describe("ReplayTargetMarkerPrimitive", () => {
  it("draws a dashed guide and only the requested pane decorations", () => {
    const primitive = new ReplayTargetMarkerPrimitive({ x: 42, label: true, endpoint: false });
    const { context, target } = createDrawTarget();

    primitive.renderer().draw(target as never);

    expect(context.moveTo).toHaveBeenCalledWith(42, 0);
    expect(context.lineTo).toHaveBeenCalledWith(42, 200);
    expect(context.setLineDash).toHaveBeenNthCalledWith(1, [5, 4]);
    expect(context.fillText).toHaveBeenCalledWith("TARGET", 47, 13);
    expect(context.arc).not.toHaveBeenCalled();
  });

  it("draws no target when the target coordinate is unavailable", () => {
    const primitive = new ReplayTargetMarkerPrimitive({ x: null, label: true, endpoint: true });
    const { context, target } = createDrawTarget();

    primitive.renderer().draw(target as never);

    expect(context.beginPath).not.toHaveBeenCalled();
    expect(context.fillText).not.toHaveBeenCalled();
  });
});
