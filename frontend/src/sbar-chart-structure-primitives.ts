import type {
  IPrimitivePaneRenderer,
  ISeriesApi,
  ISeriesPrimitive,
  IPrimitivePaneView,
  Time,
} from "lightweight-charts";
import type { ChartPrimitiveHost, ChartPrimitiveBinding } from "./sbar-chart-primitive-host";
import { alignStrokeCoordinate } from "./chart-canvas-pixel-alignment";
import { candlestickBodyWidth, projectCBarRectangles, projectSwingSegments } from "./sbar-chart-structure-geometry";

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

export interface StructurePrimitiveInteractionState {
  hoveredId: string | null;
  selectedId: string | null;
  selectedColor?: string;
  selectedWidth?: number;
}

export interface StructurePrimitivePlaybackState {
  enabled: boolean;
  offset: number | null;
  processedCount: number;
  liveCount: number;
}

export interface StructurePrimitiveController {
  setData(
    objects: readonly (CBarPrimitiveDto | SwingPrimitiveDto)[],
    projection: StructurePrimitiveProjection,
  ): void;
  setVisible(visible: boolean): void;
  setInteractionState(state: StructurePrimitiveInteractionState): void;
  setPlaybackState(state: StructurePrimitivePlaybackState): void;
}

type PrimitiveDrawTarget = Parameters<IPrimitivePaneRenderer["draw"]>[0];
type PrimitiveAttachedParameter = Parameters<
  NonNullable<ISeriesPrimitive<Time>["attached"]>
>[0];
type PrimitiveChart = PrimitiveAttachedParameter["chart"];

const SWING_STYLE_BY_STATE: Readonly<Record<string, { color: string; dash: readonly number[] }>> = {
  Confirmed: { color: "#C6A06B", dash: [] },
  Tentative: { color: "#D6A85D", dash: [6, 3] },
  Extending: { color: "#e3e8eb", dash: [2, 3] },
};
const FALLBACK_SWING_STYLE = { color: "#A0A7B0", dash: [4, 3] };

interface CBarRectangle {
  id: string;
  dimmed: boolean;
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
  extending: boolean;
  dimmed: boolean;
}

const STRUCTURE_DIM_BACKGROUND = "#121619";
const STRUCTURE_DIM_WEIGHT = 0.42;

function dimStructureColor(color: string): string {
  const match = /^#([0-9a-f]{6})$/i.exec(color);
  if (!match) return color;
  const foreground = match[1]!;
  const background = STRUCTURE_DIM_BACKGROUND.slice(1);
  const channels = [0, 2, 4].map((offset) => {
    const fg = Number.parseInt(foreground.slice(offset, offset + 2), 16);
    const bg = Number.parseInt(background.slice(offset, offset + 2), 16);
    return Math.round(fg * STRUCTURE_DIM_WEIGHT + bg * (1 - STRUCTURE_DIM_WEIGHT));
  });
  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
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
  protected playbackState: StructurePrimitivePlaybackState = {
    enabled: false, offset: null, processedCount: 0, liveCount: 0,
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

  setPlaybackState(state: StructurePrimitivePlaybackState): void {
    const next = {
      enabled: state.enabled,
      offset: state.offset,
      processedCount: Number.isFinite(state.processedCount) ? Math.max(0, Math.floor(state.processedCount)) : 0,
      liveCount: Number.isFinite(state.liveCount) ? Math.max(0, Math.floor(state.liveCount)) : 0,
    };
    if (this.playbackState.enabled === next.enabled && this.playbackState.offset === next.offset &&
      this.playbackState.processedCount === next.processedCount && this.playbackState.liveCount === next.liveCount) return;
    this.playbackState = next;
    this.refresh();
  }

  protected isDimmedAtSbar(sbarId: string | undefined): boolean {
    const state = this.playbackState;
    if (!state.enabled) return false;
    if (state.offset === null || !Number.isInteger(state.offset) || state.offset < 0) return true;
    const index = sbarId === undefined ? undefined : this.projection.indexBySbarId.get(sbarId);
    if (index === undefined) return true;
    const count = Math.min(state.liveCount, state.processedCount);
    const endExclusive = Math.min(this.projection.indexBySbarId.size, state.offset + count);
    return index < state.offset || index >= endExclusive;
  }

  invalidate(): void {
    this.refresh();
  }

  dispose(): void {
    this.objects = [];
    this.projection = { timeBySbarId: new Map(), indexBySbarId: new Map() };
    this.visible = false;
    this.interactionState = { hoveredId: null, selectedId: null, selectedColor: undefined, selectedWidth: undefined };
    this.playbackState = { enabled: false, offset: null, processedCount: 0, liveCount: 0 };
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
          const baseColor = selected ? interaction.selectedColor ?? "#D99A45" : hovered ? "#C3CBD1" : "#858D97";
          context.strokeStyle = selected || hovered || !rectangle.dimmed ? baseColor : dimStructureColor(baseColor);
          context.lineWidth = selected ? interaction.selectedWidth ?? 2 : hovered ? 1.75 : 1;
          const pixelRatio = typeof window !== "undefined" && finite(window.devicePixelRatio)
            ? Math.max(1, window.devicePixelRatio)
            : 1;
          const left = alignStrokeCoordinate(rectangle.x, context.lineWidth, pixelRatio);
          const top = alignStrokeCoordinate(rectangle.y, context.lineWidth, pixelRatio);
          const right = alignStrokeCoordinate(rectangle.x + rectangle.width, context.lineWidth, pixelRatio);
          const bottom = alignStrokeCoordinate(rectangle.y + rectangle.height, context.lineWidth, pixelRatio);
          context.strokeRect(left, top, right - left, bottom - top);
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
    const timeScale = this.chart.timeScale();
    const pixelRatio = typeof window !== "undefined" && Number.isFinite(window.devicePixelRatio)
      ? Math.max(1, window.devicePixelRatio)
      : 1;
    const rectangles = projectCBarRectangles({
      cbars: this.objects,
      sbarBodyWidth: candlestickBodyWidth(Number(timeScale.options().barSpacing), pixelRatio),
      indexBySbarId: this.projection.indexBySbarId,
      visibleRange: this.getVisibleLogicalRange(),
      coordinateForSbarId: (sbarId) => this.coordinateForSbarId(sbarId),
      priceToCoordinate: (price) => this.priceToCoordinate(String(price)),
    });
    const endSbarByCBarId = new Map(this.objects.map((object) => [object.cbarId, object.sbarEndId]));
    this.rectangles = rectangles.map((rectangle) => ({
      ...rectangle, dimmed: this.isDimmedAtSbar(endSbarByCBarId.get(rectangle.id)),
    }));
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
  private readonly supersampleScale = 2;
  private supersampleCanvas: HTMLCanvasElement | null = null;

  constructor(
    private readonly getSegments: () => readonly SwingSegment[],
    private readonly getInteractionState: () => StructurePrimitiveInteractionState,
  ) {}

  draw(target: PrimitiveDrawTarget): void {
    const segments = this.getSegments();
    if (segments.length === 0) return;
    const interaction = this.getInteractionState();
    target.useMediaCoordinateSpace(({ context, mediaSize }) => {
      context.save();
      try {
        const offscreen = this.getSupersampleContext(mediaSize.width, mediaSize.height);
        if (offscreen) {
          const { canvas, context: highResolutionContext } = offscreen;
          highResolutionContext.clearRect(0, 0, canvas.width, canvas.height);
          this.drawSegments(highResolutionContext, segments, interaction, this.supersampleScale);
          context.imageSmoothingEnabled = true;
          context.imageSmoothingQuality = "high";
          context.drawImage(
            canvas,
            0, 0, canvas.width, canvas.height,
            0, 0, mediaSize.width, mediaSize.height,
          );
        } else {
          // Keep the Primitive usable in environments without an offscreen
          // canvas (for example, lightweight test harnesses).
          this.drawSegments(context, segments, interaction, 1);
        }
      } finally {
        context.setLineDash([]);
        context.restore();
      }
    });
  }

  private getSupersampleContext(
    width: number,
    height: number,
  ): { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D } | null {
    if (typeof document === "undefined") return null;
    try {
      if (!this.supersampleCanvas) this.supersampleCanvas = document.createElement("canvas");
      const canvas = this.supersampleCanvas;
      const pixelWidth = Math.max(1, Math.ceil(width * this.supersampleScale));
      const pixelHeight = Math.max(1, Math.ceil(height * this.supersampleScale));
      if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
      if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
      const context = canvas.getContext("2d");
      return context ? { canvas, context } : null;
    } catch {
      return null;
    }
  }

  private drawSegments(
    context: CanvasRenderingContext2D,
    segments: readonly SwingSegment[],
    interaction: StructurePrimitiveInteractionState,
    scale: number,
  ): void {
    context.save();
    try {
      context.lineCap = "round";
      context.lineJoin = "round";
      for (const segment of segments) {
        const selected = segment.id === interaction.selectedId;
        const hovered = segment.id === interaction.hoveredId;
        const baseColor = selected ? interaction.selectedColor ?? "#D99A45" : hovered ? "#C3CBD1" : segment.color;
        context.strokeStyle = selected || hovered || !segment.dimmed ? baseColor : dimStructureColor(baseColor);
        context.lineWidth = (selected ? interaction.selectedWidth ?? 2.5 : hovered ? 2 : 1.5) * scale;
        context.setLineDash(segment.dash.map((dashLength) => dashLength * scale));
        context.beginPath();
        context.moveTo(segment.x1 * scale, segment.y1 * scale);
        context.lineTo(segment.x2 * scale, segment.y2 * scale);

        // Extending Swing continues beyond its latest endpoint in the same
        // projected direction. The arrowhead is solid so direction remains
        // legible even though the state stroke itself is dashed.
        const dx = segment.x2 - segment.x1;
        const dy = segment.y2 - segment.y1;
        const length = Math.hypot(dx, dy);
        if (segment.extending && length > 0) {
          const ux = dx / length;
          const uy = dy / length;
          const rayLength = 22;
          const tipX = segment.x2 + ux * rayLength;
          const tipY = segment.y2 + uy * rayLength;
          context.lineTo(tipX * scale, tipY * scale);
          context.stroke();

          const arrowLength = 7;
          const arrowHalfWidth = 3.5;
          const baseX = tipX - ux * arrowLength;
          const baseY = tipY - uy * arrowLength;
          context.setLineDash([]);
          context.beginPath();
          context.moveTo(tipX * scale, tipY * scale);
          context.lineTo((baseX - uy * arrowHalfWidth) * scale, (baseY + ux * arrowHalfWidth) * scale);
          context.moveTo(tipX * scale, tipY * scale);
          context.lineTo((baseX + uy * arrowHalfWidth) * scale, (baseY - ux * arrowHalfWidth) * scale);
          context.stroke();
        } else {
          context.stroke();
        }
      }
    } finally {
      context.setLineDash([]);
      context.restore();
    }
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
        extending: segment.state === "Extending",
        dimmed: this.isDimmedAtSbar(this.objects.find((object) => object.swingId === segment.id)?.sbarEndId),
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
    setPlaybackState(state) {
      primitive.setPlaybackState(state);
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

export interface StructurePrimitiveObjectReference {
  kind: "cbar" | "swing";
  id: string;
}

export interface StructurePrimitiveInteractionOptions {
  hovered?: StructurePrimitiveObjectReference | null;
  selected?: StructurePrimitiveObjectReference | null;
  selectedColor?: string;
  cbarSelectedWidth?: number;
  swingSelectedWidth?: number;
}

export interface StructurePrimitiveSyncOptions {
  cbar: StructurePrimitiveController | null | undefined;
  swing: StructurePrimitiveController | null | undefined;
  cbars: readonly CBarPrimitiveDto[];
  swings: readonly SwingPrimitiveDto[];
  projection: StructurePrimitiveProjection;
  cbarVisible: boolean;
  playbackState?: StructurePrimitivePlaybackState;
  swingVisible: boolean;
  interaction?: StructurePrimitiveInteractionOptions;
}

/**
 * Apply one complete structure snapshot to the chart-local Primitive pair.
 *
 * This always replaces both object lists, rather than trying to infer changes
 * from object counts or array identity. That is required because Struxis
 * structure can backtrack, remove objects, and update an existing ID in place.
 * Visibility and optional interaction state are applied in the same pass.
 */
export function syncStructurePrimitiveControllers(
  options: StructurePrimitiveSyncOptions,
): void {
  const {
    cbar,
    swing,
    cbars,
    swings,
    projection,
    cbarVisible,
    swingVisible,
    playbackState = { enabled: false, offset: null, processedCount: 0, liveCount: 0 },
    interaction,
  } = options;

  cbar?.setData(cbars, projection);
  swing?.setData(swings, projection);
  cbar?.setVisible(cbarVisible);
  swing?.setVisible(swingVisible);
  cbar?.setPlaybackState(playbackState);
  swing?.setPlaybackState(playbackState);
  if (interaction) {
    setStructurePrimitiveInteractionState({ cbar, swing, ...interaction });
  }
}

export function setStructurePrimitiveInteractionState(
  options: Pick<StructurePrimitiveSyncOptions, "cbar" | "swing"> & StructurePrimitiveInteractionOptions,
): void {
  const {
    cbar,
    swing,
    hovered = null,
    selected = null,
    selectedColor = "#D6A85D",
    cbarSelectedWidth = 2,
    swingSelectedWidth = 2.25,
  } = options;

  cbar?.setInteractionState({
    hoveredId: hovered?.kind === "cbar" ? hovered.id : null,
    selectedId: selected?.kind === "cbar" ? selected.id : null,
    selectedColor,
    selectedWidth: cbarSelectedWidth,
  });
  swing?.setInteractionState({
    hoveredId: hovered?.kind === "swing" ? hovered.id : null,
    selectedId: selected?.kind === "swing" ? selected.id : null,
    selectedColor,
    selectedWidth: swingSelectedWidth,
  });
}
