/**
 * Neutral imperative port exposed by ChartSurface to its business adapters.
 *
 * The port contains chart capabilities and projected geometry only. It does
 * not expose the Lightweight Charts instance or own Dataset / Replay state.
 */
export interface ChartSurfaceLogicalRange {
  from: number;
  to: number;
}

export interface ChartSurfaceSBarMarker {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ChartSurfaceCBarRectangle {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ChartSurfaceSwingSegment {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  state: string;
  color: string;
  dasharray: string;
}

export interface ChartSurfaceStructureGeometry {
  cbarRectangles: ChartSurfaceCBarRectangle[];
  swingSegments: ChartSurfaceSwingSegment[];
}

export interface ChartSurfaceStructureInteraction {
  kind: "cbar" | "swing";
  id: string;
}

export interface ChartSurfacePort {
  getVisibleLogicalRange(): ChartSurfaceLogicalRange | null;
  applyViewportRange(range: ChartSurfaceLogicalRange): boolean;
  applyCrosshairPosition(sbarId: string, price: number): boolean;
  clearCrosshairPosition(): void;
  getSbarCoordinate(sbarId: string): number | null;
  getLogicalCoordinate(index: number): number | null;
  getPriceCoordinate(price: number): number | null;
  getSbarIdAtCoordinate(x: number, clampToSequence?: boolean): string | null;
  getSbarIdAtClientX(clientX: number, clampToSequence?: boolean): string | null;
  hasSbarId(sbarId: string): boolean;
  getSbarMarker(sbarId: string): ChartSurfaceSBarMarker | null;
  getSbarRangeHighlight(sbarId: string): ChartSurfaceSBarMarker | null;
  revealSbarRange(anchorIds: string[]): boolean;
  getStructureGeometry(): ChartSurfaceStructureGeometry;
  setStructureInteractionState(
    hovered: ChartSurfaceStructureInteraction | null,
    selected: ChartSurfaceStructureInteraction | null,
  ): void;
}
