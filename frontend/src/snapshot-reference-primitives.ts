import type {
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesApi,
  ISeriesPrimitive,
  Time,
} from "lightweight-charts";
import type { SBarDto } from "./origin-types";
import { resolveSnapshotLiveRangeIndices } from "./snapshot-playback-geometry";

type AttachedParameter = Parameters<NonNullable<ISeriesPrimitive<Time>["attached"]>>[0];
type DrawTarget = Parameters<IPrimitivePaneRenderer["draw"]>[0];

function finite(value: number | null | undefined): value is number {
  return value !== null && value !== undefined && Number.isFinite(value);
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

