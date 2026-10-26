/**
 * Align a stroke's outer edge to the physical-pixel grid.
 *
 * Primitive coordinates are expressed in media (CSS-pixel) space. A centered
 * Canvas stroke can otherwise cover different fractions of edge pixels as the
 * chart zooms, making nominally identical edges appear to change brightness.
 * Use the active stroke width so normal, hover, and selected states share the
 * same rasterization rule.
 */
export function alignStrokeCoordinate(
  coordinate: number,
  lineWidth: number,
  pixelRatio: number,
): number {
  if (
    !Number.isFinite(coordinate) ||
    !Number.isFinite(lineWidth) ||
    lineWidth <= 0 ||
    !Number.isFinite(pixelRatio) ||
    pixelRatio <= 0
  ) return coordinate;
  const physicalLineWidth = lineWidth * pixelRatio;
  return (
    Math.round(coordinate * pixelRatio - physicalLineWidth / 2) +
    physicalLineWidth / 2
  ) / pixelRatio;
}
