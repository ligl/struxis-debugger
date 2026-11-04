import { afterEach, describe, expect, it } from "vitest";
import { defaultStyleFor, setDefaultStyleOverride } from "lightweight-charts-drawing";
import { configureDrawingStyleDefaults } from "../../src/drawing-style";

describe("drawing style defaults", () => {
  afterEach(() => {
    setDefaultStyleOverride(() => undefined);
  });

  it("applies the configured stroke width before a drawing is placed", () => {
    configureDrawingStyleDefaults();

    expect(defaultStyleFor("trend-line").width).toBe(1);
    expect(defaultStyleFor("rectangle").width).toBe(1);
    expect(defaultStyleFor("circle").width).toBe(1);
    expect(defaultStyleFor("brush").width).toBe(1);
    // Highlighter's factory width is 20px, so this also proves the override
    // replaces a non-1px tool default rather than merely preserving it.
    expect(defaultStyleFor("highlighter").width).toBe(1);
  });
});
