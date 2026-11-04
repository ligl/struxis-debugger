import {
  factoryStyleFor,
  setDefaultStyleOverride,
  type DrawingKind,
  type DrawingStyle,
} from "lightweight-charts-drawing";

function normalizeLineWidths(style: DrawingStyle): DrawingStyle {
  const normalized: DrawingStyle = {
    ...style,
    width: 1,
    ...(style.borderWidth === undefined ? {} : { borderWidth: 1 }),
  };

  if (style.levels) normalized.levels = style.levels.map((line) => ({ ...line, width: 1 }));
  if (style.vLevels) normalized.vLevels = style.vLevels.map((line) => ({ ...line, width: 1 }));
  if (style.rectMiddleLine) normalized.rectMiddleLine = { ...style.rectMiddleLine, width: 1 };
  if (style.fibTrendLine) normalized.fibTrendLine = { ...style.fibTrendLine, width: 1 };
  if (style.gannLevels) normalized.gannLevels = style.gannLevels.map((line) => ({ ...line, width: 1 }));
  if (style.gannFans) normalized.gannFans = style.gannFans.map((line) => ({ ...line, width: 1 }));
  if (style.gannArcs) normalized.gannArcs = style.gannArcs.map((line) => ({ ...line, width: 1 }));
  if (style.fanGrid) normalized.fanGrid = { ...style.fanGrid, width: 1 };

  if (style.regressionLines) {
    normalized.regressionLines = {
      base: { ...style.regressionLines.base, width: 1 },
      up: { ...style.regressionLines.up, width: 1 },
      down: { ...style.regressionLines.down, width: 1 },
    };
  }

  if (style.vwapUpper) normalized.vwapUpper = style.vwapUpper.map((line) => ({ ...line, width: 1 }));
  if (style.vwapLower) normalized.vwapLower = style.vwapLower.map((line) => ({ ...line, width: 1 }));

  if (style.vp) {
    normalized.vp = {
      ...style.vp,
      vah: { ...style.vp.vah, width: 1 },
      val: { ...style.vp.val, width: 1 },
      poc: { ...style.vp.poc, width: 1 },
      developingPoc: { ...style.vp.developingPoc, width: 1 },
      developingVah: { ...style.vp.developingVah, width: 1 },
      developingVal: { ...style.vp.developingVal, width: 1 },
    };
  }

  return normalized;
}

// Apply one consistent 1px stroke to every drawing tool. Normalize nested
// level/study lines too; they carry independent widths and otherwise bypass
// DrawingStyle.width.
export function configureDrawingStyleDefaults(): void {
  setDefaultStyleOverride((kind) => normalizeLineWidths(factoryStyleFor(kind as DrawingKind)));
}
