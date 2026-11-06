import type { ISeriesPrimitive, IPrimitivePaneView, IPrimitivePaneRenderer, Time, Logical } from "lightweight-charts";
import type { KeyZoneCheckpointDto, KeyZoneDto, SBarDto } from "./origin-types";

type Attached = Parameters<NonNullable<ISeriesPrimitive<Time>["attached"]>>[0];
// Local marker width in chart logical units: three SBars on either side.
const KEYZONE_HALF_WIDTH = 3;

type Interval = { zone: KeyZoneDto; start: number; end: number };
type Node = { item: Interval; maxEnd: number; left: Node | null; right: Node | null };
export type KeyZoneRectangle = { id: string; state: KeyZoneDto["state"]; x: number; y: number; width: number; height: number };

function tree(items: Interval[], start = 0, end = items.length): Node | null {
  if (start >= end) return null;
  const mid = (start + end) >>> 1;
  const item = items[mid]!;
  const left = tree(items, start, mid), right = tree(items, mid + 1, end);
  return { item, left, right, maxEnd: Math.max(item.end, left?.maxEnd ?? -Infinity, right?.maxEnd ?? -Infinity) };
}
function query(node: Node | null, from: number, to: number, result: Interval[]): void {
  if (!node || node.maxEnd < from) return;
  query(node.left, from, to, result);
  if (node.item.start > to) return;
  if (node.item.end >= from) result.push(node.item);
  query(node.right, from, to, result);
}
function lowerBound(bars: readonly SBarDto[], time: bigint): number {
  let lo = 0, hi = bars.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (BigInt(bars[mid]!.tsEvent) < time) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function logicalAt(bars: readonly SBarDto[], time: bigint): number {
  const right = lowerBound(bars, time);
  if (right === 0) return 0;
  if (right >= bars.length) return bars.length - 1;
  const leftTime = BigInt(bars[right - 1]!.tsEvent);
  const rightTime = BigInt(bars[right]!.tsEvent);
  return right - 1 + Number(time - leftTime) / Number(rightTime - leftTime);
}

/** Built only when a checkpoint changes; viewport queries use an interval tree. */
export class KeyZoneIndex {
  private root: Node | null = null;
  constructor(checkpoint: KeyZoneCheckpointDto | null, bars: readonly SBarDto[], until: string | null) {
    if (!checkpoint || !bars.length || until === null) return;
    const cursor = BigInt(until);
    const first = BigInt(bars[0]!.tsEvent), last = BigInt(bars[bars.length - 1]!.tsEvent);
    const intervals: Interval[] = [];
    for (const zone of checkpoint.zones) {
      const formed = BigInt(zone.formedAt);
      // The cursor controls visibility only. Lifecycle end times never size the marker.
      // An unavailable anchor must not be relocated to the first or last loaded SBar.
      if (formed > cursor || formed < first || formed > last) continue;
      const anchor = logicalAt(bars, formed);
      intervals.push({ zone, start: anchor - KEYZONE_HALF_WIDTH, end: anchor + KEYZONE_HALF_WIDTH });
    }
    intervals.sort((a, b) => a.start - b.start);
    this.root = tree(intervals);
  }
  visible(from: number, to: number): Interval[] {
    const result: Interval[] = [];
    query(this.root, from, to, result);
    return result;
  }
}

/** Chart-local rendering and cached hit geometry; never reads a domain Registry. */
export class KeyZonePrimitive implements ISeriesPrimitive<Time>, IPrimitivePaneView {
  private attachedTo: Attached | null = null;
  private index = new KeyZoneIndex(null, [], null);
  private rectangles: KeyZoneRectangle[] = [];
  private views: readonly IPrimitivePaneView[] = [this];
  private visible = true;
  private selected: string | null = null;
  private hovered: string | null = null;
  attached(param: Attached): void { this.attachedTo = param; this.updateAllViews(); }
  detached(): void { this.attachedTo = null; this.rectangles = []; this.hovered = null; }
  setData(checkpoint: KeyZoneCheckpointDto | null, bars: readonly SBarDto[], until: string | null): void {
    this.hovered = null;
    this.index = new KeyZoneIndex(checkpoint, bars, until);
    this.updateAllViews(); this.attachedTo?.requestUpdate();
  }
  setVisible(visible: boolean): void {
    if (this.visible === visible) return;
    this.visible = visible;
    if (!visible) this.hovered = null;
    this.attachedTo?.requestUpdate();
  }
  setHovered(id: string | null): void {
    if (this.hovered === id) return;
    this.hovered = id;
    this.attachedTo?.requestUpdate();
  }
  setSelected(id: string | null): void { this.selected = id; this.attachedTo?.requestUpdate(); }
  paneViews(): readonly IPrimitivePaneView[] { return this.views; }
  zOrder(): "normal" { return "normal"; }
  updateAllViews(): void {
    this.rectangles = [];
    const owner = this.attachedTo;
    const range = owner?.chart.timeScale().getVisibleLogicalRange();
    if (!owner || !range) return;
    for (const { zone, start, end } of this.index.visible(range.from, range.to)) {
      const x1 = owner.chart.timeScale().logicalToCoordinate(start as Logical);
      const x2 = owner.chart.timeScale().logicalToCoordinate(end as Logical);
      const y1 = owner.series.priceToCoordinate(Number(zone.upper));
      const y2 = owner.series.priceToCoordinate(Number(zone.lower));
      if (x1 === null || x2 === null || y1 === null || y2 === null) continue;
      if (![x1, x2, y1, y2].every(Number.isFinite)) continue;
      this.rectangles.push({ id: zone.keyzoneId, state: zone.state, x: Math.min(x1, x2), y: Math.min(y1, y2),
        width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) });
    }
  }
  hitTestZone(x: number, y: number): string | null {
    if (!this.visible) return null;
    // Hit-test cached marker borders; candles inside the rectangle remain selectable.
    for (let i = this.rectangles.length - 1; i >= 0; i--) {
      const r = this.rectangles[i]!;
      if (x < r.x - 4 || x > r.x + r.width + 4 || y < r.y - 4 || y > r.y + r.height + 4) continue;
      if (Math.min(Math.abs(y-r.y), Math.abs(y-r.y-r.height), Math.abs(x-r.x), Math.abs(x-r.x-r.width)) <= 4) return r.id;
    }
    return null;
  }
  renderer(): IPrimitivePaneRenderer | null {
    if (!this.visible) return null;
    return { draw: (target) => target.useMediaCoordinateSpace(({ context: ctx }) => {
      for (const r of this.rectangles) {
        ctx.save();
        const selected = r.id === this.selected;
        const hovered = r.id === this.hovered;
        ctx.strokeStyle = selected ? "#f0cb87" : hovered ? "#e3bd80" : r.state === "Invalidated" ? "#7d858c" : "#b49a75";
        ctx.lineWidth = selected ? 2 : hovered ? 1.5 : 1;
        ctx.setLineDash([5,3]);
        ctx.strokeRect(r.x, r.y, r.width, r.height);
        ctx.restore();
      }
    }) };
  }
}
