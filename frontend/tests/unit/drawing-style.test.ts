import { afterEach, describe, expect, it } from "vitest";
import {
  defaultStyleFor,
  OVERLAY_SPECS,
  setDefaultStyleOverride,
  type DrawingKind,
} from "lightweight-charts-drawing";
import { configureDrawingStyleDefaults } from "../../src/drawing-style";

describe("drawing style defaults", () => {
  afterEach(() => {
    setDefaultStyleOverride(() => undefined);
  });

  it("uses a 1px stroke for every drawing tool before placement", () => {
    configureDrawingStyleDefaults();

    for (const kind of Object.keys(OVERLAY_SPECS) as DrawingKind[]) {
      expect(defaultStyleFor(kind).width, `${kind} stroke`).toBe(1);
      expect(defaultStyleFor(kind).borderWidth, `${kind} border`).toBe(1);
    }
  });

  it("normalizes independent widths used by compound drawing tools", () => {
    configureDrawingStyleDefaults();

    const fib = defaultStyleFor("fib-retracement");
    expect(fib.levels?.every((level) => level.width === 1)).toBe(true);

    const gann = defaultStyleFor("gann-box");
    expect(gann.levels?.every((level) => level.width === 1)).toBe(true);
    expect(gann.vLevels?.every((level) => level.width === 1)).toBe(true);

    const regression = defaultStyleFor("regression-trend");
    expect(regression.regressionLines?.base.width).toBe(1);
    expect(regression.regressionLines?.up.width).toBe(1);
    expect(regression.regressionLines?.down.width).toBe(1);
  });
});
