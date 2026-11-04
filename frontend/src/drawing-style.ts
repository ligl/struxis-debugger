import { setDefaultStyleOverride, type DrawingKind } from "lightweight-charts-drawing";

// These tools share the debugger's 1px annotation stroke. The drawing package
// resolves this override both when rendering the live placement preview and
// when it creates the final Drawing model.
const ONE_PIXEL_DRAWING_KINDS = new Set<DrawingKind>([
  "trend-line", "ray", "info-line", "extended-line", "trend-angle",
  "horizontal-line", "horizontal-ray", "vertical-line", "cross-line",
  "rectangle", "rotated-rectangle", "brush", "highlighter", "arrow-marker",
  "arrow", "arrow-mark-up", "arrow-mark-down", "path", "circle", "ellipse",
  "polyline", "triangle", "arc", "curve", "double-curve",
]);

export function configureDrawingStyleDefaults(): void {
  setDefaultStyleOverride((kind) =>
    ONE_PIXEL_DRAWING_KINDS.has(kind as DrawingKind) ? { width: 1 } : undefined,
  );
}
