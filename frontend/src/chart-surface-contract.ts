import type { CandlestickData, HistogramData, ISeriesPrimitive, Time, UTCTimestamp } from "lightweight-charts";

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

export interface ChartSurfaceTrendSegment {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  state: string;
}

export interface ChartSurfaceStructureGeometry {
  cbarRectangles: ChartSurfaceCBarRectangle[];
  swingSegments: ChartSurfaceSwingSegment[];
  trendSegments: ChartSurfaceTrendSegment[];
}

export interface ChartSurfaceLayerVisibility {
  sbar: boolean;
  volume: boolean;
  cbar: boolean;
  swing: boolean;
  trend: boolean;
  feature: boolean;
}

export interface ChartSurfaceStructureInteraction {
  kind: "cbar" | "swing" | "trend";
  id: string;
}

export interface ChartSurfaceStructurePlaybackState {
  enabled: boolean;
  offset: number | null;
  processedCount: number;
  liveCount: number;
}

export interface ChartSurfacePrimitiveOptions {
  /** Series pane to which the consumer-owned Primitive is attached. */
  target?: "candles" | "volume";
  /** Called once when the registration is unregistered or the Surface is disposed. */
  dispose?: () => void;
}

export interface ChartSurfacePort {
  /**
   * Injects a chart-local Series Primitive without exposing the chart or series.
   * The Surface owns attachment and teardown; the caller owns the Primitive's
   * implementation and domain-specific state. IDs must be unique per Surface.
   */
  registerPrimitive(
    id: string,
    primitive: ISeriesPrimitive<Time>,
    options?: ChartSurfacePrimitiveOptions | (() => void),
  ): () => void;
  /**
   * Policy-free series operations. The caller chooses full replacement versus
   * incremental update; the Surface owns the actual chart series.
   */
  replaceSeriesData(
    candles: readonly CandlestickData<UTCTimestamp>[],
    volume: readonly HistogramData<UTCTimestamp>[],
  ): boolean;
  updateSeriesData(
    candle: CandlestickData<UTCTimestamp>,
    volume: HistogramData<UTCTimestamp>,
    historicalUpdate?: boolean,
  ): boolean;
  fitContent(): boolean;
  getTimeCoordinate(time: UTCTimestamp): number | null;
  getTimeAtCoordinate(x: number): UTCTimestamp | null;
  getLogicalIndexAtCoordinate(x: number): number | null;
  getPriceAtCoordinate(y: number): number | null;
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
  setLayerVisibility(visibility: ChartSurfaceLayerVisibility): void;
  setStructureInteractionState(
    hovered: ChartSurfaceStructureInteraction | null,
    selected: ChartSurfaceStructureInteraction | null,
    hoveredCbarIds?: readonly string[],
    selectedCbarIds?: readonly string[],
  ): void;
  setStructurePlaybackState(state: ChartSurfaceStructurePlaybackState): void;
}
