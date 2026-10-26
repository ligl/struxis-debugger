import { describe, expect, it, vi } from "vitest";
import { SBarMarkerPrimitive } from "../../src/sbar-marker-primitive";

function createDrawTarget() {
  const context = {
    save: vi.fn(),
    restore: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    set fillStyle(_value: string) {},
    set strokeStyle(_value: string) {},
    set lineWidth(_value: number) {},
  };
  const target = {
    useMediaCoordinateSpace: (callback: (scope: { context: typeof context; mediaSize: { width: number; height: number } }) => void) => {
      callback({ context, mediaSize: { width: 640, height: 360 } });
    },
  };
  return { context, target };
}

describe("SBarMarkerPrimitive", () => {
  it("draws selected fill and outline, then the hover outline", () => {
    const primitive = new SBarMarkerPrimitive();
    const { context, target } = createDrawTarget();
    const requestUpdate = vi.fn();
    primitive.attached({ requestUpdate } as never);
    primitive.update({
      hovered: { id: "hovered", x: 10, y: 20, width: 6, height: 30 },
      selected: { id: "selected", x: 30, y: 40, width: 6, height: 25 },
      selectedFill: "rgba(217, 154, 69, 0.10)",
      selectedStroke: "#D99A45",
      selectedWidth: 1.25,
    });

    primitive.renderer().draw(target as never);

    expect(requestUpdate).toHaveBeenCalledOnce();
    expect(context.fillRect).toHaveBeenCalledWith(30, 40, 6, 25);
    expect(context.strokeRect).toHaveBeenNthCalledWith(1, 30, 40, 6, 25);
    expect(context.strokeRect).toHaveBeenNthCalledWith(2, 10, 20, 6, 30);
    expect(context.save).toHaveBeenCalledOnce();
    expect(context.restore).toHaveBeenCalledOnce();
  });

  it("does not draw when neither marker is active", () => {
    const primitive = new SBarMarkerPrimitive();
    const { context, target } = createDrawTarget();

    primitive.renderer().draw(target as never);

    expect(context.fillRect).not.toHaveBeenCalled();
    expect(context.strokeRect).not.toHaveBeenCalled();
  });
});
