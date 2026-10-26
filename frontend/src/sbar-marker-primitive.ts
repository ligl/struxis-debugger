import type {
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesPrimitive,
  Time,
} from "lightweight-charts";

type AttachedParameter = Parameters<NonNullable<ISeriesPrimitive<Time>["attached"]>>[0];
type DrawTarget = Parameters<IPrimitivePaneRenderer["draw"]>[0];

export interface SBarMarkerGeometry {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SBarMarkerPrimitiveState {
  hovered: SBarMarkerGeometry | null;
  selected: SBarMarkerGeometry | null;
  selectedFill: string;
  selectedStroke: string;
  selectedWidth: number;
}

/**
 * Draws adapter-owned hover / selection outlines over the candle pane.
 * The adapter supplies projected geometry and decides which SBar is hovered
 * or selected; this Primitive has no Dataset / Replay business semantics.
 */
export class SBarMarkerPrimitive implements ISeriesPrimitive<Time> {
  private requestUpdate: (() => void) | null = null;
  private state: SBarMarkerPrimitiveState = {
    hovered: null,
    selected: null,
    selectedFill: "rgba(0, 0, 0, 0)",
    selectedStroke: "#D99A45",
    selectedWidth: 1.25,
  };
  private readonly views: readonly IPrimitivePaneView[] = [this];
  private readonly paneRenderer: IPrimitivePaneRenderer = {
    draw: (target) => this.draw(target),
  };

  attached(param: AttachedParameter): void {
    this.requestUpdate = param.requestUpdate;
    this.updateAllViews();
  }

  detached(): void {
    this.requestUpdate = null;
  }

  paneViews(): readonly IPrimitivePaneView[] {
    return this.views;
  }

  renderer(): IPrimitivePaneRenderer {
    return this.paneRenderer;
  }

  zOrder(): "top" {
    return "top";
  }

  update(state: SBarMarkerPrimitiveState): void {
    this.state = state;
    this.updateAllViews();
    this.requestUpdate?.();
  }

  updateAllViews(): void {
    // Geometry is projected by ChartSurface and refreshed by its projection
    // frame event. Requesting a repaint here is enough; no second coordinate
    // model should be introduced in this drawing-only Primitive.
  }

  dispose(): void {
    this.state = {
      hovered: null,
      selected: null,
      selectedFill: "rgba(0, 0, 0, 0)",
      selectedStroke: "#D99A45",
      selectedWidth: 1.25,
    };
    this.requestUpdate = null;
  }

  private draw(target: DrawTarget): void {
    const { hovered, selected } = this.state;
    if (!hovered && !selected) return;

    target.useMediaCoordinateSpace(({ context }) => {
      context.save();
      try {
        if (hovered) {
          context.strokeStyle = "#C3CBD1";
          context.lineWidth = 1.25;
          context.strokeRect(hovered.x, hovered.y, hovered.width, hovered.height);
        }
        if (selected) {
          context.fillStyle = this.state.selectedFill;
          context.strokeStyle = this.state.selectedStroke;
          context.lineWidth = this.state.selectedWidth;
          context.fillRect(selected.x, selected.y, selected.width, selected.height);
          context.strokeRect(selected.x, selected.y, selected.width, selected.height);
        }
      } finally {
        context.restore();
      }
    });
  }
}
