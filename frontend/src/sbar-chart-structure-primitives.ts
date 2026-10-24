import type {
  IChartApi,
  IPrimitivePaneRenderer,
  ISeriesApi,
  ISeriesPrimitive,
  ISeriesPrimitivePaneView,
  Time,
} from "lightweight-charts";
import type { ChartPrimitiveHost } from "./sbar-chart-primitive-host";
import type { ChartPrimitiveBinding } from "./sbar-chart-primitive-host";

export interface CBarPrimitiveDto {
  cbarId: string;
  sbarStartId: string;
  sbarEndId: string;
  high: string;
  low: string;
}

export interface SwingPrimitiveDto {
  swingId: string;
  sbarStartId: string;
  sbarEndId: string;
  high: string;
  low: string;
  direction: string;
  state: string;
}

export interface StructurePrimitiveProjection {
  readonly timeBySbarId: ReadonlyMap<string, Time>;
  readonly indexBySbarId: ReadonlyMap<string, number>;
}

export interface StructurePrimitiveController {
  setData(
    objects: readonly (CBarPrimitiveDto | SwingPrimitiveDto)[],
    projection: StructurePrimitiveProjection,
  ): void;
  setVisible(visible: boolean): void;
}

type PrimitiveDrawTarget = Parameters<IPrimitivePaneRenderer["draw"]>[0];
type PrimitiveAttachedParameter = Parameters<
  NonNullable<ISeriesPrimitive<Time>["attached"]>
>[0];

const SWING_STYLE_BY_STATE: Readonly<Record<string, { color: string; dash: readonly number[] }>> = {
  Confirmed: { color: "#B49ACD", dash: [] },
  Tentative: { color: "#D6A85D", dash: [6, 3] },
  Extending: { color: "#8FA9C4", dash: [2, 3] },
};
const FALLBACK_SWING_STYLE = { color: "#A0A7B0", dash: [4, 3] };
const VIEWPORT_OVERSCAN = 2;

interface CBarRectangle {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface SwingSegment {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  dash: readonly number[];
}

function finite(value: number | null | undefined): value is number {
  return value !== null && value !== undefined && Number.isFinite(value);
}

function isVisibleByIndex(
  startId: string,
  endId: string,
  indexBySbarId: ReadonlyMap<string, number>,
  range: { from: number; to: number } | null,
): boolean {
  if (!range) return true;
  const start = indexBySbarId.get(startId);
  const end = indexBySbarId.get(endId);
  if (start === undefined || end === undefined) return false;
  return Math.max(start, end) >= range.from - VIEWPORT_OVERSCAN &&
    Math.min(start, end) <= range.to + VIEWPORT_OVERSCAN;
}

abstract class StructureSeriesPrimitive<TObject> implements ISeriesPrimitive<Time> {
  protected chart: IChartApi | null = null;
  protected series: ISeriesApi<"Candlestick"> | null = null;
  private requestChartUpdate: (() => void) | null = null;
  protected objects: readonly TObject[] = [];
  protected projection: StructurePrimitiveProjection = {
    timeBySbarId: new Map(),
    indexBySbarId: new Map(),
  };
  protected visible = true;

  attached(param: PrimitiveAttachedParameter): void {
    this.chart = param.chart;
    this.series = param.series as ISeriesApi<"Candlestick">;
    this.requestChartUpdate = param.requestUpdate;
    this.updateAllViews();
  }

  detached(): void {
    this.chart = null;
    this.series = null;
    this.requestChartUpdate = null;
    this.clearGeometry();
  }

  updateAllViews(): void {
    this.project();
  }

  paneViews(): readonly ISeriesPrimitivePaneView[] {
    return [this];
  }

  renderer(): IPrimitivePaneRenderer | null {
    return this.visible && this.hasGeometry() ? this.createRenderer() : null;
  }

  zOrder(): "top" {
    return "top";
  }

  setObjects(
    objects: readonly TObject[],
    projection: StructurePrimitiveProjection,
  ): void {
    if (this.objects === objects &&
        this.projection.timeBySbarId === projection.timeBySbarId &&
        this.projection.indexBySbarId === projection.indexBySbarId) return;
    this.objects = objects;
    this.projection = projection;
    this.refresh();
  }

  setVisibility(visible: boolean): void {
    if (this.visible === visible) return;
    this.visible = visible;
    this.refresh();
  }

  invalidate(): void {
    this.refresh();
  }

  dispose(): void {
    this.objects = [];
    this.projection = { timeBySbarId: new Map(), indexBySbarId: new Map() };
    this.visible = false;
    this.clearGeometry();
    this.chart = null;
    this.series = null;
    this.requestChartUpdate = null;
  }

  protected abstract project(): void;
  protected abstract clearGeometry(): void;
  protected abstract hasGeometry(): boolean;
  protected abstract createRenderer(): IPrimitivePaneRenderer;

  protected refresh(): void {
    this.project();
    this.requestChartUpdate?.();
  }

  protected getVisibleLogicalRange(): { from: number; to: number } | null {
    const range = this.chart?.timeScale().getVisibleLogicalRange();
    return range && finite(range.from) && finite(range.to)
      ? { from: range.from, to: range.to }
      : null;
  }

  protected coordinateForSbarId(sbarId: string): number | null {
    const time = this.projection.timeBySbarId.get(sbarId);
    if (time === undefined || !this.chart) return null;
    const coordinate = this.chart.timeScale().timeToCoordinate(time);
    return finite(coordinate) ? coordinate : null;
  }

  protected priceToCoordinate(priceText: string): number | null {
    const price = Number(priceText);
    if (!finite(price) || !this.series) return null;
    const coordinate = this.series.priceToCoordinate(price);
    return finite(coordinate) ? coordinate : null;
  }
}

class CBarPaneRenderer implements IPrimitivePaneRenderer {
  constructor(private readonly getRectangles: () => readonly CBarRectangle[]) {}

  draw(target: PrimitiveDrawTarget): void {
    const rectangles = this.getRectangles();
    if (rectangles.length === 0) return;
    target.useMediaCoordinateSpace(({ context }) => {
      context.save();
      try {
        context.strokeStyle = "#A0A7B0";
        context.lineWidth = 1;
        context.setLineDash([]);
        for (const rectangle of rectangles) {
          context.strokeRect(rectangle.x, rectangle.y, rectangle.width, rectangle.height);
        }
      } finally {
        context.restore();
      }
    });
  }
}

class CBarSeriesPrimitive extends StructureSeriesPrimitive<CBarPrimitiveDto> {
  private rectangles: CBarRectangle[] = [];
  private readonly paneRenderer = new CBarPaneRenderer(() => this.rectangles);

  protected project(): void {
    if (!this.visible || !this.chart || !this.series) {
      this.rectangles = [];
      return;
    }
    const range = this.getVisibleLogicalRange();
    const rectangles: CBarRectangle[] = [];
    for (const cbar of this.objects) {
      if (!isVisibleByIndex(cbar.sbarStartId, cbar.sbarEndId, this.projection.indexBySbarId, range)) continue;
      const startX = this.coordinateForSbarId(cbar.sbarStartId);
      const endX = this.coordinateForSbarId(cbar.sbarEndId);
      const highY = this.priceToCoordinate(cbar.high);
      const lowY = this.priceToCoordinate(cbar.low);
      if (!finite(startX) || !finite(endX) || !finite(highY) || !finite(lowY)) continue;
      rectangles.push({
        id: cbar.cbarId,
        x: Math.min(startX, endX),
        y: Math.min(highY, lowY),
        width: Math.abs(endX - startX),
        height: Math.abs(lowY - highY),
      });
    }
    this.rectangles = rectangles;
  }

  protected clearGeometry(): void {
    this.rectangles = [];
  }

  protected hasGeometry(): boolean {
    return this.rectangles.length > 0;
  }

  protected createRenderer(): IPrimitivePaneRenderer {
    return this.paneRenderer;
  }
}

class SwingPaneRenderer implements IPrimitivePaneRenderer {
  constructor(private readonly getSegments: () => readonly SwingSegment[]) {}

  draw(target: PrimitiveDrawTarget): void {
    const segments = this.getSegments();
    if (segments.length === 0) return;
    target.useMediaCoordinateSpace(({ context }) => {
      context.save();
      try {
        context.lineWidth = 1.25;
        context.lineCap = "round";
        for (const segment of segments) {
          context.strokeStyle = segment.color;
          context.setLineDash([...segment.dash]);
          context.beginPath();
          context.moveTo(segment.x1, segment.y1);
          context.lineTo(segment.x2, segment.y2);
          context.stroke();
        }
      } finally {
        context.setLineDash([]);
        context.restore();
      }
    });
  }
}

class SwingSeriesPrimitive extends StructureSeriesPrimitive<SwingPrimitiveDto> {
  private segments: SwingSegment[] = [];
  private readonly paneRenderer = new SwingPaneRenderer(() => this.segments);

  protected project(): void {
    if (!this.visible || !this.chart || !this.series) {
      this.segments = [];
      return;
    }
    const range = this.getVisibleLogicalRange();
    const segments: SwingSegment[] = [];
    for (const swing of this.objects) {
      if (!isVisibleByIndex(swing.sbarStartId, swing.sbarEndId, this.projection.indexBySbarId, range)) continue;
      const x1 = this.coordinateForSbarId(swing.sbarStartId);
      const x2 = this.coordinateForSbarId(swing.sbarEndId);
      const startsAtLow = swing.direction === "Up";
      const y1 = this.priceToCoordinate(startsAtLow ? swing.low : swing.high);
      const y2 = this.priceToCoordinate(startsAtLow ? swing.high : swing.low);
      if (!finite(x1) || !finite(x2) || !finite(y1) || !finite(y2)) continue;
      const style = SWING_STYLE_BY_STATE[swing.state] ?? FALLBACK_SWING_STYLE;
      segments.push({ id: swing.swingId, x1, y1, x2, y2, color: style.color, dash: style.dash });
    }
    this.segments = segments;
  }

  protected clearGeometry(): void {
    this.segments = [];
  }

  protected hasGeometry(): boolean {
    return this.segments.length > 0;
  }

  protected createRenderer(): IPrimitivePaneRenderer {
    return this.paneRenderer;
  }
}

function registerSeriesPrimitive<TPrimitive extends StructureSeriesPrimitive<never>>(
  host: ChartPrimitiveHost,
  id: string,
  series: ISeriesApi<"Candlestick">,
  primitive: TPrimitive,
): StructurePrimitiveController {
  let attached = false;
  const binding: ChartPrimitiveBinding = {
    id,
    attach() {
      if (attached) return;
      series.attachPrimitive(primitive as ISeriesPrimitive<Time>);
      attached = true;
    },
    detach() {
      if (!attached) return;
      attached = false;
      series.detachPrimitive(primitive as ISeriesPrimitive<Time>);
    },
    invalidate() {
      primitive.invalidate();
    },
    dispose() {
      primitive.dispose();
    },
  };
  host.register(binding);
  return {
    setData(objects, projection) {
      primitive.setObjects(objects as never[], projection);
    },
    setVisible(visible) {
      primitive.setVisibility(visible);
    },
  };
}

export function registerCBarPrimitive(
  host: ChartPrimitiveHost,
  series: ISeriesApi<"Candlestick">,
): StructurePrimitiveController {
  return registerSeriesPrimitive(host, "structure.cbar", series, new CBarSeriesPrimitive());
}

export function registerSwingPrimitive(
  host: ChartPrimitiveHost,
  series: ISeriesApi<"Candlestick">,
): StructurePrimitiveController {
  return registerSeriesPrimitive(host, "structure.swing", series, new SwingSeriesPrimitive());
}
