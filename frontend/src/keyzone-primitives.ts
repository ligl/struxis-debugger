import type { ISeriesPrimitive, IPrimitivePaneView, IPrimitivePaneRenderer, Time, Logical } from "lightweight-charts";
import type { KeyZoneCheckpointDto, KeyZoneDto, KeyZoneInteractionDto, SBarDto } from "./origin-types";

import { candlestickBodyWidth } from "./sbar-chart-structure-geometry";

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

export interface KeyZoneInteractionRange {
  interactionId: string;
  sequence: number;
  state: KeyZoneInteractionDto["state"];
  start: number;
  end: number;
  low: number;
  high: number;
}

/** Selected observer's non-overlapping episodes; price extents are cached once per data/selection change. */
export class KeyZoneInteractionIndex {
  private ranges: KeyZoneInteractionRange[] = [];
  constructor(checkpoint: KeyZoneCheckpointDto | null, bars: readonly SBarDto[], until: string | null, selected: string | null) {
    if (!checkpoint || !selected || !bars.length || until === null
      || !checkpoint.zones.some((zone) => zone.keyzoneId === selected)) return;
    const cursor = BigInt(until);
    const first = BigInt(bars[0]!.tsEvent), last = BigInt(bars[bars.length - 1]!.tsEvent);
    const episodes = checkpoint.interactions.filter((item) => item.keyzoneId === selected && item.observerBarType === bars[0]!.barType)
      .sort((a, b) => BigInt(a.startedAt) < BigInt(b.startedAt) ? -1 : BigInt(a.startedAt) > BigInt(b.startedAt) ? 1 : 0);
    for (let sequence = 0; sequence < episodes.length; sequence++) {
      const episode = episodes[sequence]!;
      if (episode.lastProcessedAt === null) continue;
      const started = BigInt(episode.startedAt), processed = BigInt(episode.lastProcessedAt);
      if (started < first || started > cursor || started > last || processed < started) continue;
      // Exact observer anchors are required; never relocate unavailable history.
      const start = lowerBound(bars, started), observedEnd = lowerBound(bars, processed);
      if (bars[start]?.tsEvent !== episode.startedAt || bars[observedEnd]?.tsEvent !== episode.lastProcessedAt) continue;
      let end = observedEnd;
      if (processed > cursor) {
        end = lowerBound(bars, cursor);
        if (end >= bars.length || BigInt(bars[end]!.tsEvent) > cursor) end--;
      }
      if (end < start) continue;
      let low = Infinity, high = -Infinity;
      for (let index = start; index <= end; index++) {
        low = Math.min(low, Number(bars[index]!.low));
        high = Math.max(high, Number(bars[index]!.high));
      }
      if (!Number.isFinite(low) || !Number.isFinite(high)) continue;
      this.ranges.push({ interactionId: episode.interactionId, sequence: sequence + 1, state: episode.state, start, end, low, high });
    }
  }
  visible(from: number, to: number): readonly KeyZoneInteractionRange[] {
    // One KeyZone x exact observer stream has non-overlapping episodes.
    let lo = 0, hi = this.ranges.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (this.ranges[mid]!.end < from - 0.5) lo = mid + 1;
      else hi = mid;
    }
    const result: KeyZoneInteractionRange[] = [];
    for (let index = lo; index < this.ranges.length; index++) {
      const item = this.ranges[index]!;
      if (item.start > to + 0.5) break;
      result.push(item);
    }
    return result;
  }
}

type InteractionRectangle = Omit<KeyZoneRectangle, "state"> & { label: string; interactionState: KeyZoneInteractionDto["state"] };
const INTERACTION_COLORS = { Active: "#79b58b", Ended: "#82a8c9", Invalidated: "#8d949b" } as const;

/** Chart-local rendering and cached hit geometry; never reads a domain Registry. */
export class KeyZonePrimitive implements ISeriesPrimitive<Time>, IPrimitivePaneView {
  private attachedTo: Attached | null = null;
  private index = new KeyZoneIndex(null, [], null);
  private rectangles: KeyZoneRectangle[] = [];
  private interactionRectangles: InteractionRectangle[] = [];
  private interactions = new KeyZoneInteractionIndex(null, [], null, null);
  private checkpoint: KeyZoneCheckpointDto | null = null;
  private bars: readonly SBarDto[] = [];
  private until: string | null = null;
  private views: readonly IPrimitivePaneView[] = [this];
  private visible = true;
  private selected: string | null = null;
  private hovered: string | null = null;
  attached(param: Attached): void { this.attachedTo = param; this.updateAllViews(); }
  detached(): void { this.attachedTo = null; this.rectangles = []; this.interactionRectangles = []; this.hovered = null; }
  setData(checkpoint: KeyZoneCheckpointDto | null, bars: readonly SBarDto[], until: string | null): void {
    this.hovered = null;
    this.checkpoint = checkpoint; this.bars = bars; this.until = until;
    this.index = new KeyZoneIndex(checkpoint, bars, until);
    this.interactions = new KeyZoneInteractionIndex(checkpoint, bars, until, this.selected);
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
  setSelected(id: string | null): void {
    if (this.selected === id) return;
    this.selected = id;
    this.interactions = new KeyZoneInteractionIndex(this.checkpoint, this.bars, this.until, id);
    this.updateAllViews();
    this.attachedTo?.requestUpdate();
  }
  paneViews(): readonly IPrimitivePaneView[] { return this.views; }
  zOrder(): "normal" { return "normal"; }
  updateAllViews(): void {
    this.rectangles = [];
    this.interactionRectangles = [];
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
    const episodes = this.interactions.visible(range.from, range.to);
    if (!episodes.length) return;
    const pixelRatio = typeof window !== "undefined" && Number.isFinite(window.devicePixelRatio) ? Math.max(1, window.devicePixelRatio) : 1;
    const halfBody = candlestickBodyWidth(Number(owner.chart.timeScale().options().barSpacing), pixelRatio) / 2;
    if (!Number.isFinite(halfBody)) return;
    for (const episode of episodes) {
      const x1 = owner.chart.timeScale().logicalToCoordinate(episode.start as Logical);
      const x2 = owner.chart.timeScale().logicalToCoordinate(episode.end as Logical);
      const y1 = owner.series.priceToCoordinate(episode.high), y2 = owner.series.priceToCoordinate(episode.low);
      if (x1 === null || x2 === null || y1 === null || y2 === null || ![x1, x2, y1, y2].every(Number.isFinite)) continue;
      this.interactionRectangles.push({ id: episode.interactionId, label: `I${episode.sequence} ${episode.state}`,
        interactionState: episode.state, x: Math.min(x1, x2) - halfBody, y: Math.min(y1, y2),
        width: Math.abs(x2 - x1) + halfBody * 2, height: Math.abs(y2 - y1) });
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
      for (const episode of this.interactionRectangles) {
        ctx.save();
        ctx.strokeStyle = INTERACTION_COLORS[episode.interactionState];
        ctx.fillStyle = INTERACTION_COLORS[episode.interactionState];
        ctx.lineWidth = 1;
        ctx.setLineDash(episode.interactionState === "Active" ? [3, 3] : episode.interactionState === "Invalidated" ? [2, 4] : []);
        ctx.strokeRect(episode.x, episode.y, episode.width, episode.height);
        ctx.font = "10px monospace";
        ctx.textBaseline = "top";
        ctx.fillText(episode.label, episode.x + 3, episode.y + 2);
        ctx.restore();
      }
      // Keep the selected source marker on top, distinct from observed-price episode boxes.
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
