import type {
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesApi,
  ISeriesPrimitive,
  Time,
} from "lightweight-charts";
import type { SBarDto, ReplayInspectorStructureDto } from "./origin-types";
import { projectCBarRectangles, projectSwingSegments } from "./sbar-chart-structure-geometry";
import { projectSnapshotBrightCandles, resolveSnapshotLiveRangeIndices, type SnapshotBrightCandleGeometry } from "./snapshot-playback-geometry";

type AttachedParameter = Parameters<NonNullable<ISeriesPrimitive<Time>["attached"]>>[0];
type DrawTarget = Parameters<IPrimitivePaneRenderer["draw"]>[0];
type Rect = { id: string; x: number; y: number; width: number; height: number };
type Segment = { id: string; x1: number; y1: number; x2: number; y2: number; color: string; dash: readonly number[] };

export interface SnapshotPrimitiveState {
  bars: readonly SBarDto[];
  structure: ReplayInspectorStructureDto | null;
  enabled: boolean;
  playbackEnabled: boolean;
  offset: number | null;
  liveCount: number;
  processedCount: number;
}

const swingStyles: Readonly<Record<string, { color: string; dash: readonly number[] }>> = {
  Confirmed: { color: "#B49ACD", dash: [] },
  Tentative: { color: "#D6A85D", dash: [6, 3] },
  Extending: { color: "#8FA9C4", dash: [2, 3] },
};

function finite(value: number | null | undefined): value is number {
  return value !== null && value !== undefined && Number.isFinite(value);
}

/**
 * Snapshot-only drawing Primitive. It owns no synchronization policy: its
 * consumer supplies already-resolved enablement, anchors and playback progress.
 */
export class SnapshotReferencePrimitive implements ISeriesPrimitive<Time> {
  private chart: AttachedParameter["chart"] | null = null;
  private series: ISeriesApi<"Candlestick"> | null = null;
  private requestUpdate: (() => void) | null = null;
  private state: SnapshotPrimitiveState = {
    bars: [], structure: null, enabled: false, playbackEnabled: false,
    offset: null, liveCount: 0, processedCount: 0,
  };
  private brightCandles: SnapshotBrightCandleGeometry[] = [];
  private cbars: Rect[] = [];
  private swings: Segment[] = [];
  private readonly views: readonly IPrimitivePaneView[] = [this];
  private readonly paneRenderer: IPrimitivePaneRenderer = { draw: (target) => this.draw(target) };

  attached(param: AttachedParameter): void {
    this.chart = param.chart;
    this.series = param.series as ISeriesApi<"Candlestick">;
    this.requestUpdate = param.requestUpdate;
    this.updateAllViews();
  }

  detached(): void {
    this.chart = null;
    this.series = null;
    this.requestUpdate = null;
    this.clearProjection();
  }

  paneViews(): readonly IPrimitivePaneView[] { return this.views; }
  renderer(): IPrimitivePaneRenderer { return this.paneRenderer; }
  zOrder(): "top" { return "top"; }

  update(state: SnapshotPrimitiveState): void {
    this.state = state;
    this.updateAllViews();
    this.requestUpdate?.();
  }

  updateAllViews(): void {
    this.project();
  }

  dispose(): void {
    this.state = {
      bars: [], structure: null, enabled: false, playbackEnabled: false,
      offset: null, liveCount: 0, processedCount: 0,
    };
    this.clearProjection();
    this.chart = null;
    this.series = null;
    this.requestUpdate = null;
  }

  private clearProjection(): void {
    this.brightCandles = [];
    this.cbars = [];
    this.swings = [];
  }

  private project(): void {
    this.clearProjection();
    const { bars, structure, enabled, playbackEnabled, offset, liveCount, processedCount } = this.state;
    if (!this.chart || !this.series || !enabled || offset === null || liveCount <= 0 || bars.length === 0) return;

    const timeById = new Map<string, Time>();
    const indexById = new Map<string, number>();
    for (let i = 0; i < bars.length; i += 1) {
      const bar = bars[i]!;
      const seconds = Number(BigInt(bar.tsEvent) / 1_000_000_000n);
      if (!Number.isSafeInteger(seconds)) continue;
      timeById.set(bar.sbarId, seconds as Time);
      indexById.set(bar.sbarId, i);
    }
    const timeScale = this.chart.timeScale();
    const coordinateForId = (id: string) => {
      const time = timeById.get(id);
      return time === undefined ? null : timeScale.timeToCoordinate(time);
    };
    const priceToCoordinate = (price: number) => this.series!.priceToCoordinate(price);
    const range = timeScale.getVisibleLogicalRange();
    if (structure) {
      this.cbars = projectCBarRectangles({
        cbars: structure.cbars,
        indexBySbarId: indexById,
        visibleRange: range,
        coordinateForSbarId: coordinateForId,
        priceToCoordinate,
      });
      this.swings = projectSwingSegments({
        swings: structure.swings,
        indexBySbarId: indexById,
        visibleRange: range,
        coordinateForSbarId: coordinateForId,
        priceToCoordinate,
      }).map(segment => ({
        id: segment.id, x1: segment.x1, y1: segment.y1, x2: segment.x2, y2: segment.y2,
        ...(swingStyles[segment.state] ?? { color: "#A0A7B0", dash: [4, 3] }),
      }));
    }

    if (playbackEnabled) {
      const visibleFrom = range ? range.from - 1 : Number.NEGATIVE_INFINITY;
      const visibleTo = range ? range.to + 1 : Number.POSITIVE_INFINITY;
      this.brightCandles = projectSnapshotBrightCandles({
        offset, liveCount, processedCount, bars, visibleFrom, visibleTo,
        coordinateForSbarId: coordinateForId,
        priceToCoordinate,
      });
    }
  }

  private draw(target: DrawTarget): void {
    const { enabled, playbackEnabled, bars, offset, liveCount, processedCount } = this.state;
    if (!enabled || !this.chart || !this.series) return;
    target.useMediaCoordinateSpace(({ context, mediaSize }) => {
      context.save();
      try {
        if (playbackEnabled && offset !== null && liveCount > 0) {
          context.fillStyle = "rgba(5, 7, 9, 0.68)";
          context.fillRect(0, 0, mediaSize.width, mediaSize.height);

          // Repaint the processed candles in the foreground so they remain
          // readable above the dimming layer. The same fixed SBar identities
          // are used after every viewport projection.
          for (const bright of this.brightCandles) {
            const bar = bars.find(candidate => candidate.sbarId === bright.id);
            if (!bar) continue;
            const x = bright.x + bright.width / 2;
            const high = this.series.priceToCoordinate(Number(bar.high));
            const low = this.series.priceToCoordinate(Number(bar.low));
            const open = this.series.priceToCoordinate(Number(bar.open));
            const close = this.series.priceToCoordinate(Number(bar.close));
            if (![high, low, open, close].every(finite)) continue;
            const color = Number(bar.close) > Number(bar.open) ? "#79B58B" : Number(bar.close) < Number(bar.open) ? "#D98282" : "#858D97";
            context.strokeStyle = color;
            context.fillStyle = color;
            context.lineWidth = 1;
            context.beginPath();
            context.moveTo(x, high);
            context.lineTo(x, low);
            context.stroke();
            context.fillRect(x - bright.width / 2, Math.min(open, close), bright.width, Math.max(1, Math.abs(close - open)));
          }

          // Restore structure visibility over the darkened plot. These are
          // the same projected objects used by the shared structure layer.
          for (const rect of this.cbars) {
            context.strokeStyle = "#A0A7B0";
            context.lineWidth = 1;
            context.strokeRect(rect.x, rect.y, rect.width, rect.height);
          }
          for (const segment of this.swings) {
            context.strokeStyle = segment.color;
            context.lineWidth = 1.25;
            context.setLineDash([...segment.dash]);
            context.beginPath();
            context.moveTo(segment.x1, segment.y1);
            context.lineTo(segment.x2, segment.y2);
            context.stroke();
          }
          context.setLineDash([]);
        }

      } finally {
        context.restore();
      }
    });
  }
}

/**
 * Snapshot range guides are a separate background-layer Primitive. Keeping
 * them separate from playback dimming lets the dashed guides sit behind the
 * native candles instead of being painted over candle bodies and wicks.
 */
export interface SnapshotRangeMarkerState {
  bars: readonly SBarDto[];
  enabled: boolean;
  offset: number | null;
  liveCount: number;
  showArrows: boolean;
}

export class SnapshotRangeMarkerPrimitive implements ISeriesPrimitive<Time> {
  private chart: AttachedParameter["chart"] | null = null;
  private requestUpdate: (() => void) | null = null;
  private state: SnapshotRangeMarkerState = {
    bars: [], enabled: false, offset: null, liveCount: 0, showArrows: false,
  };
  private markers: { start: number; end: number } | null = null;
  private readonly views: readonly IPrimitivePaneView[] = [this];
  private readonly paneRenderer: IPrimitivePaneRenderer = { draw: (target) => this.draw(target) };

  attached(param: AttachedParameter): void {
    this.chart = param.chart;
    this.requestUpdate = param.requestUpdate;
    this.updateAllViews();
  }

  detached(): void {
    this.chart = null;
    this.requestUpdate = null;
    this.markers = null;
  }

  paneViews(): readonly IPrimitivePaneView[] { return this.views; }
  renderer(): IPrimitivePaneRenderer { return this.paneRenderer; }
  zOrder(): "bottom" { return "bottom"; }

  update(state: SnapshotRangeMarkerState): void {
    this.state = state;
    this.updateAllViews();
    this.requestUpdate?.();
  }

  updateAllViews(): void {
    this.markers = null;
    const { bars, enabled, offset, liveCount } = this.state;
    if (!this.chart || !enabled || offset === null || liveCount <= 0) return;
    const anchors = resolveSnapshotLiveRangeIndices(offset, liveCount, bars.length);
    if (!anchors) return;
    const timeScale = this.chart.timeScale();
    const coordinateFor = (bar: SBarDto | undefined): number | null => {
      if (!bar) return null;
      const seconds = Number(BigInt(bar.tsEvent) / 1_000_000_000n);
      if (!Number.isSafeInteger(seconds)) return null;
      const coordinate = timeScale.timeToCoordinate(seconds as Time);
      return finite(coordinate) ? coordinate : null;
    };
    const start = coordinateFor(bars[anchors.start]);
    const end = coordinateFor(bars[anchors.end]);
    if (finite(start) && finite(end)) this.markers = { start, end };
  }

  dispose(): void {
    this.state = { bars: [], enabled: false, offset: null, liveCount: 0, showArrows: false };
    this.markers = null;
    this.chart = null;
    this.requestUpdate = null;
  }

  private draw(target: DrawTarget): void {
    if (!this.state.enabled || !this.markers) return;
    target.useMediaCoordinateSpace(({ context, mediaSize }) => {
      context.save();
      try {
        const { start, end } = this.markers!;
        context.strokeStyle = "rgba(119, 131, 140, 0.42)";
        context.lineWidth = 0.9;
        context.setLineDash([3, 5]);
        for (const x of [start, end]) {
          context.beginPath();
          context.moveTo(x, 0);
          context.lineTo(x, mediaSize.height);
          context.stroke();
        }
        context.setLineDash([]);
        if (this.state.showArrows) {
          context.strokeStyle = "rgba(119, 131, 140, 0.55)";
          context.lineWidth = 0.9;
          context.lineCap = "round";
          context.lineJoin = "round";
          context.beginPath();
          context.moveTo(start + 2, 7); context.lineTo(start + 8, 7);
          context.moveTo(start + 5, 4); context.lineTo(start + 8, 7); context.lineTo(start + 5, 10);
          context.moveTo(end - 2, 7); context.lineTo(end - 8, 7);
          context.moveTo(end - 5, 4); context.lineTo(end - 8, 7); context.lineTo(end - 5, 10);
          context.stroke();
        }
      } finally {
        context.restore();
      }
    });
  }
}

/**
 * Snapshot-only companion Primitive for the independent Volume pane.
 * It mirrors the same SBar-identity anchors as the candle-pane Primitive,
 * but only dims volume and draws the continuation of the range guides.
 */
export interface SnapshotVolumePrimitiveState {
  bars: readonly SBarDto[];
  enabled: boolean;
  playbackEnabled: boolean;
  offset: number | null;
  liveCount: number;
}

export class SnapshotVolumePrimitive implements ISeriesPrimitive<Time> {
  private chart: AttachedParameter["chart"] | null = null;
  private requestUpdate: (() => void) | null = null;
  private state: SnapshotVolumePrimitiveState = {
    bars: [], enabled: false, playbackEnabled: false, offset: null, liveCount: 0,
  };
  private readonly views: readonly IPrimitivePaneView[] = [this];
  private readonly paneRenderer: IPrimitivePaneRenderer = { draw: (target) => this.draw(target) };

  attached(param: AttachedParameter): void {
    this.chart = param.chart;
    this.requestUpdate = param.requestUpdate;
    this.updateAllViews();
  }

  detached(): void {
    this.chart = null;
    this.requestUpdate = null;
  }

  paneViews(): readonly IPrimitivePaneView[] { return this.views; }
  renderer(): IPrimitivePaneRenderer { return this.paneRenderer; }
  zOrder(): "top" { return "top"; }

  update(state: SnapshotVolumePrimitiveState): void {
    this.state = state;
    this.updateAllViews();
    this.requestUpdate?.();
  }

  updateAllViews(): void {
    this.markers = null;
    const { bars, enabled, offset, liveCount } = this.state;
    if (!this.chart || !enabled || offset === null || liveCount <= 0) return;
  }

  dispose(): void {
    this.state = { bars: [], enabled: false, playbackEnabled: false, offset: null, liveCount: 0 };
    this.markers = null;
    this.chart = null;
    this.requestUpdate = null;
  }

  private draw(target: DrawTarget): void {
    const { enabled, playbackEnabled } = this.state;
    if (!enabled || !this.chart) return;
    target.useMediaCoordinateSpace(({ context, mediaSize }) => {
      context.save();
      try {
        if (playbackEnabled) {
          context.fillStyle = "rgba(5, 7, 9, 0.68)";
          context.fillRect(0, 0, mediaSize.width, mediaSize.height);
        }
      } finally {
        context.restore();
      }
    });
  }
}

