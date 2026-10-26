import type {
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesPrimitive,
  Time,
} from "lightweight-charts";

type AttachedParameter = Parameters<NonNullable<ISeriesPrimitive<Time>["attached"]>>[0];
type DrawTarget = Parameters<IPrimitivePaneRenderer["draw"]>[0];

export interface ReplayTargetMarkerState {
  x: number | null;
  label: boolean;
  endpoint: boolean;
}

/**
 * Renders the Live Replay target guide inside one chart pane. RunChart owns
 * the target SBar identity and chooses which pane renders the label/endpoint.
 */
export class ReplayTargetMarkerPrimitive implements ISeriesPrimitive<Time> {
  private requestUpdate: (() => void) | null = null;
  private state: ReplayTargetMarkerState;
  private readonly views: readonly IPrimitivePaneView[] = [this];
  private readonly paneRenderer: IPrimitivePaneRenderer = { draw: (target) => this.draw(target) };

  constructor(state: ReplayTargetMarkerState) {
    this.state = state;
  }

  attached(param: AttachedParameter): void {
    this.requestUpdate = param.requestUpdate;
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

  update(state: ReplayTargetMarkerState): void {
    this.state = state;
    this.requestUpdate?.();
  }

  updateAllViews(): void {
    // RunChart supplies the projected X coordinate; this Primitive does not
    // own a second time-scale mapping or target-selection policy.
  }

  dispose(): void {
    this.state = { x: null, label: false, endpoint: false };
    this.requestUpdate = null;
  }

  private draw(target: DrawTarget): void {
    const { x, label, endpoint } = this.state;
    if (x === null || !Number.isFinite(x)) return;

    target.useMediaCoordinateSpace(({ context, mediaSize }) => {
      context.save();
      try {
        context.strokeStyle = "#C6A06B";
        context.lineWidth = 1.25;
        context.setLineDash([5, 4]);
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, mediaSize.height);
        context.stroke();
        context.setLineDash([]);

        if (label) {
          context.fillStyle = "#C6A06B";
          context.font = "600 9px ui-monospace, SFMono-Regular, Consolas, monospace";
          context.textBaseline = "alphabetic";
          context.fillText("TARGET", x + 5, 13);
        }

        if (endpoint) {
          context.fillStyle = "#C6A06B";
          context.beginPath();
          context.arc(x, mediaSize.height * 0.9, 3, 0, Math.PI * 2);
          context.fill();
        }
      } finally {
        context.restore();
      }
    });
  }
}
