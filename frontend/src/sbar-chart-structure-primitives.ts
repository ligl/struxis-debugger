import type {
  IPrimitivePaneRenderer,
  ISeriesApi,
  ISeriesPrimitive,
  IPrimitivePaneView,
  Time,
} from "lightweight-charts";
import type { ChartPrimitiveHost, ChartPrimitiveBinding } from "./sbar-chart-primitive-host";
import { projectCBarRectangles, projectSwingSegments } from "./sbar-chart-structure-geometry";

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

export type StructureObjectKind = "cbar" | "swing";

export interface StructurePrimitiveInteractionState {
  hoveredId: string | null;
  selectedId: string | null;
  selectedColor?: string;
  selectedWidth?: number;
}

export interface StructurePrimitiveController {
  setData(
    objects: readonly (CBarPrimitiveDto | SwingPrimitiveDto)[],
    projection: StructurePrimitiveProjection,
  ): void;
  setVisible(visible: boolean): void;
  setInteractionState(state: StructurePrimitiveInteractionState): void;
}

type PrimitiveDrawTarget = Parameters<IPrimitivePaneRenderer["draw"]>[0];
type PrimitiveAttachedParameter = Parameters<
  NonNullable<ISeriesPrimitive<Time>["attached"]>
>[0];
type PrimitiveChart = PrimitiveAttachedParameter["chart"];

const SWING_STYLE_BY_STATE: Readonly<Record<string, { color: string; dash: readonly number[] }>> = {
  Confirmed: { color: "#B49ACD", dash: [] },
  Tentative: { color: "#D6A85D", dash: [6, 3] },
  Extending: { color: "#8FA9C4", dash: [2, 3] },
};
const FALLBACK_SWING_STYLE = { color: "#A0A7B0", dash: [4, 3] };

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

abstract class StructureSeriesPrimitive<TObject> implements ISeriesPrimitive<Time> {
  protected chart: PrimitiveChart | null = null;
  protected series: ISeriesApi<"Candlestick"> | null = null;
  private requestChartUpdate: (() => void) | null = null;
  private readonly paneViewList: readonly IPrimitivePaneView[];
  protected objects: readonly TObject[] = [];
  protected projection: StructurePrimitiveProjection = {
    timeBySbarId: new Map(),
    indexBySbarId: new Map(),
  };
  protected visible = true;
  protected interactionState: StructurePrimitiveInteractionState = {
    hoveredId: null,
    selectedId: null,
    selectedColor: undefined,
    selectedWidth: undefined,
  };

  constructor() {
    this.paneViewList = [this];
  }

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

  paneViews(): readonly IPrimitivePaneView[] {
    return this.paneViewList;
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
    // setData is called only at explicit snapshot / sequence boundaries, not
    // during pan/zoom frames. Always re-read the full snapshot so in-place
    // reactive updates cannot leave same-reference objects stale.
    this.objects = objects;
    this.projection = projection;
    this.refresh();
  }

  setVisibility(visible: boolean): void {
    if (this.visible === visible) return;
    this.visible = visible;
    this.refresh();
  }

  setInteractionState(state: StructurePrimitiveInteractionState): void {
    if (
      this.interactionState.hoveredId === state.hoveredId &&
      this.interactionState.selectedId === state.selectedId &&
      this.interactionState.selectedColor === state.selectedColor &&
      this.interactionState.selectedWidth === state.selectedWidth
    ) return;
    this.interactionState = { ...state };
    this.requestChartUpdate?.();
  }

  invalidate(): void {
    this.refresh();
  }

  dispose(): void {
    this.objects = [];
    this.projection = { timeBySbarId: new Map(), indexBySbarId: new Map() };
    this.visible = false;
    this.interactionState = { hoveredId: null, selectedId: null, selectedColor: undefined, selectedWidth: undefined };
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
  constructor(
    private readonly getRectangles: () => readonly CBarRectangle[],
    private readonly getInteractionState: () => StructurePrimitiveInteractionState,
  ) {}

  draw(target: PrimitiveDrawTarget): void {
    const rectangles = this.getRectangles();
    if (rectangles.length === 0) return;
    const interaction = this.getInteractionState();
    target.useMediaCoordinateSpace(({ context }) => {
      context.save();
      try {
        context.setLineDash([]);
        for (const rectangle of rectangles) {
          const selected = rectangle.id === interaction.selectedId;
          const hovered = rectangle.id === interaction.hoveredId;
          context.strokeStyle = selected ? interaction.selectedColor ?? "#D99A45" : hovered ? "#C3CBD1" : "#A0A7B0";
          context.lineWidth = selected ? interaction.selectedWidth ?? 2 : hovered ? 1.75 : 1;
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
  private readonly paneRenderer = new CBarPaneRenderer(
    () => this.rectangles,
    () => this.interactionState,
  );

  protected project(): void {
    if (!this.visible || !this.chart || !this.series) {
      this.rectangles = [];
      return;
    }
    this.rectangles = projectCBarRectangles({
      cbars: this.objects,
      indexBySbarId: this.projection.indexBySbarId,
      visibleRange: this.getVisibleLogicalRange(),
      coordinateForSbarId: (sbarId) => this.coordinateForSbarId(sbarId),
      priceToCoordinate: (price) => this.priceToCoordinate(String(price)),
    });
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
  constructor(
    private readonly getSegments: () => readonly SwingSegment[],
    private readonly getInteractionState: () => StructurePrimitiveInteractionState,
  ) {}

  draw(target: PrimitiveDrawTarget): void {
    const segments = this.getSegments();
    if (segments.length === 0) return;
    const interaction = this.getInteractionState();
    target.useMediaCoordinateSpace(({ context }) => {
      context.save();
      try {
        context.lineCap = "round";
        for (const segment of segments) {
          const selected = segment.id === interaction.selectedId;
          const hovered = segment.id === interaction.hoveredId;
          context.strokeStyle = selected ? interaction.selectedColor ?? "#D99A45" : hovered ? "#C3CBD1" : segment.color;
          context.lineWidth = selected ? interaction.selectedWidth ?? 2.5 : hovered ? 2 : 1.25;
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
  private readonly paneRenderer = new SwingPaneRenderer(
    () => this.segments,
    () => this.interactionState,
  );

  protected project(): void {
    if (!this.visible || !this.chart || !this.series) {
      this.segments = [];
      return;
    }
    this.segments = projectSwingSegments({
      swings: this.objects,
      indexBySbarId: this.projection.indexBySbarId,
      visibleRange: this.getVisibleLogicalRange(),
      coordinateForSbarId: (sbarId) => this.coordinateForSbarId(sbarId),
      priceToCoordinate: (price) => this.priceToCoordinate(String(price)),
    }).map((segment) => {
      const style = SWING_STYLE_BY_STATE[segment.state] ?? FALLBACK_SWING_STYLE;
      return {
        id: segment.id,
        x1: segment.x1,
        y1: segment.y1,
        x2: segment.x2,
        y2: segment.y2,
        color: style.color,
        dash: style.dash,
      };
    });
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

function registerSeriesPrimitive<TObject, TPrimitive extends StructureSeriesPrimitive<TObject>>(
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
      // Mark the attempt first so Host rollback can detach even if the chart
      // partially attaches the Primitive and then throws.
      attached = true;
      series.attachPrimitive(primitive as ISeriesPrimitive<Time>);
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
      primitive.setObjects(objects as readonly TObject[], projection);
    },
    setVisible(visible) {
      primitive.setVisibility(visible);
    },
    setInteractionState(state) {
      primitive.setInteractionState(state);
    },
  };
}

export function registerCBarPrimitive(
  host: ChartPrimitiveHost,
  series: ISeriesApi<"Candlestick">,
): StructurePrimitiveController {
  return registerSeriesPrimitive<CBarPrimitiveDto, CBarSeriesPrimitive>(host, "structure.cbar", series, new CBarSeriesPrimitive());
}

export function registerSwingPrimitive(
  host: ChartPrimitiveHost,
  series: ISeriesApi<"Candlestick">,
): StructurePrimitiveController {
  return registerSeriesPrimitive<SwingPrimitiveDto, SwingSeriesPrimitive>(host, "structure.swing", series, new SwingSeriesPrimitive());
}
