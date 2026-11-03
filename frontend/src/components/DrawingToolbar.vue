<script setup lang="ts">
import { ref } from "vue";
import type { DrawingKind } from "lightweight-charts-drawing";

const props = defineProps<{ activeTool: DrawingKind | null; expanded: boolean; drawingCount: number; selectedCount: number }>();
const emit = defineEmits<{
  select: [tool: DrawingKind | null];
  toggle: [];
}>();

const groups: { label: string; tools: { label: string; kind: DrawingKind }[] }[] = [
  { label: "Lines", tools: [
    { label: "Trend line", kind: "trend-line" }, { label: "Ray", kind: "ray" },
    { label: "Info line", kind: "info-line" }, { label: "Extended line", kind: "extended-line" },
    { label: "Trend angle", kind: "trend-angle" }, { label: "Horizontal line", kind: "horizontal-line" },
    { label: "Horizontal ray", kind: "horizontal-ray" }, { label: "Vertical line", kind: "vertical-line" },
    { label: "Cross line", kind: "cross-line" },
  ] },
  { label: "Channels & pitchforks", tools: [
    { label: "Parallel channel", kind: "parallel-channel" }, { label: "Regression trend", kind: "regression-trend" },
    { label: "Flat top / bottom", kind: "flat-top-bottom" }, { label: "Disjoint channel", kind: "disjoint-channel" },
    { label: "Pitchfork", kind: "pitchfork" }, { label: "Schiff pitchfork", kind: "schiff-pitchfork" },
    { label: "Modified Schiff", kind: "modified-schiff-pitchfork" }, { label: "Inside pitchfork", kind: "inside-pitchfork" },
  ] },
  { label: "Fibonacci & Gann", tools: [
    { label: "Fib retracement", kind: "fib-retracement" }, { label: "Fib extension", kind: "trend-based-fib-extension" },
    { label: "Fib channel", kind: "fib-channel" }, { label: "Fib time zone", kind: "fib-time-zone" },
    { label: "Fib fan", kind: "fib-speed-resistance-fan" }, { label: "Trend-based fib time", kind: "trend-based-fib-time" },
    { label: "Fib circles", kind: "fib-circles" }, { label: "Fib spiral", kind: "fib-spiral" },
    { label: "Fib arcs", kind: "fib-speed-resistance-arcs" }, { label: "Fib wedge", kind: "fib-wedge" },
    { label: "Pitchfan", kind: "pitchfan" }, { label: "Gann box", kind: "gann-box" },
    { label: "Gann square fixed", kind: "gann-square-fixed" }, { label: "Gann square", kind: "gann-square" },
    { label: "Gann fan", kind: "gann-fan" },
  ] },
  { label: "Patterns & waves", tools: [
    { label: "XABCD pattern", kind: "xabcd-pattern" }, { label: "Cypher pattern", kind: "cypher-pattern" },
    { label: "Head and shoulders", kind: "head-and-shoulders" }, { label: "ABCD pattern", kind: "abcd-pattern" },
    { label: "Triangle pattern", kind: "triangle-pattern" }, { label: "Three drives", kind: "three-drives-pattern" },
    { label: "Elliott impulse", kind: "elliott-impulse" }, { label: "Elliott correction", kind: "elliott-correction" },
    { label: "Elliott triangle", kind: "elliott-triangle" }, { label: "Elliott double combo", kind: "elliott-double-combo" },
    { label: "Elliott triple combo", kind: "elliott-triple-combo" }, { label: "Cyclic lines", kind: "cyclic-lines" },
    { label: "Time cycles", kind: "time-cycles" }, { label: "Sine line", kind: "sine-line" },
  ] },
  { label: "Forecast & measurement", tools: [
    { label: "Long position", kind: "long-position" }, { label: "Short position", kind: "short-position" },
    { label: "Position forecast", kind: "position-forecast" }, { label: "Bars pattern", kind: "bar-pattern" },
    { label: "Ghost feed", kind: "ghost-feed" }, { label: "Sector", kind: "sector" },
    { label: "Anchored VWAP", kind: "anchored-vwap" }, { label: "Fixed range volume profile", kind: "fixed-range-volume-profile" },
    { label: "Anchored volume profile", kind: "anchored-volume-profile" }, { label: "Price range", kind: "price-range" },
    { label: "Date range", kind: "date-range" }, { label: "Date & price range", kind: "date-and-price-range" },
  ] },
  { label: "Brushes & shapes", tools: [
    { label: "Brush", kind: "brush" }, { label: "Highlighter", kind: "highlighter" },
    { label: "Arrow marker", kind: "arrow-marker" }, { label: "Arrow", kind: "arrow" },
    { label: "Arrow up", kind: "arrow-mark-up" }, { label: "Arrow down", kind: "arrow-mark-down" },
    { label: "Rectangle", kind: "rectangle" }, { label: "Rotated rectangle", kind: "rotated-rectangle" },
    { label: "Path", kind: "path" }, { label: "Circle", kind: "circle" }, { label: "Ellipse", kind: "ellipse" },
    { label: "Polyline", kind: "polyline" }, { label: "Triangle", kind: "triangle" },
    { label: "Arc", kind: "arc" }, { label: "Curve", kind: "curve" }, { label: "Double curve", kind: "double-curve" },
  ] },
  { label: "Text & annotations", tools: [
    { label: "Text", kind: "text" }, { label: "Note", kind: "note" }, { label: "Price note", kind: "price-note" },
    { label: "Pin", kind: "pin" }, { label: "Table", kind: "table" }, { label: "Callout", kind: "callout" },
    { label: "Comment", kind: "comment" }, { label: "Price label", kind: "price-label" },
    { label: "Signpost", kind: "signpost" }, { label: "Flag mark", kind: "flag-mark" },
  ] },
];


const activeGroup = ref<string | null>(groups[0]?.label ?? null);

function choose(kind: DrawingKind, group: string): void {
  activeGroup.value = group;
  emit("select", kind);
}

function toggleGroup(label: string): void {
  activeGroup.value = activeGroup.value === label ? null : label;
}

function selectGroupForTool(kind: DrawingKind): string | null {
  return groups.find((group) => group.tools.some((tool) => tool.kind === kind))?.label ?? null;
}
</script>

<template>
  <aside
    class="drawing-toolbar"
    :class="{ 'is-collapsed': !props.expanded, 'has-flyout': props.expanded && activeGroup !== null }"
    aria-label="Drawing tools"
    data-testid="drawing-toolbar"
  >
    <nav class="drawing-rail" aria-label="Drawing tool categories">
      <div class="drawing-rail-top">
        <button
          class="drawing-rail-button drawing-select-button"
          type="button"
          :class="{ active: props.activeTool === null }"
          :aria-pressed="props.activeTool === null"
          title="Select / cancel drawing tool"
          aria-label="Select / cancel drawing tool"
          data-testid="drawing-tool-select"
          @click="emit('select', null)"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3.5 18.5 14l-6.1 1.1-2.8 5.2L5 3.5Z" /></svg>
        </button>
        <span class="drawing-rail-separator"></span>
      </div>

      <button
        v-for="(group, index) in groups"
        :key="group.label"
        class="drawing-rail-button drawing-category-button"
        :class="{ active: props.expanded && activeGroup === group.label, 'has-active-tool': group.tools.some((tool) => tool.kind === props.activeTool) }"
        type="button"
        :aria-label="group.label"
        :aria-expanded="props.expanded && activeGroup === group.label"
        :title="group.label"
        :data-testid="'drawing-category-' + index"
        @click="toggleGroup(group.label)"
      >
        <span class="drawing-category-glyph" aria-hidden="true">{{ ["↗", "⌁", "ƒ", "△", "↕", "◇", "T"][index] }}</span>
        <span v-if="group.tools.some((tool) => tool.kind === props.activeTool)" class="drawing-category-indicator"></span>
      </button>

      <div class="drawing-rail-spacer"></div>
      <div class="drawing-rail-bottom">
        <span class="drawing-count" data-testid="drawing-count" :title="drawingCount + ' drawings · ' + selectedCount + ' selected">{{ drawingCount }}</span>
        <button
          class="drawing-rail-button drawing-collapse-button"
          type="button"
          :aria-expanded="props.expanded"
          :aria-label="props.expanded ? 'Collapse drawing toolbar' : 'Expand drawing toolbar'"
          :title="props.expanded ? 'Collapse drawing toolbar' : 'Expand drawing toolbar'"
          data-testid="drawing-toolbar-toggle"
          @click="emit('toggle')"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path :d="props.expanded ? 'm14 5-7 7 7 7' : 'm10 5 7 7-7 7'" /></svg>
        </button>
      </div>
    </nav>

    <section v-if="props.expanded && activeGroup" class="drawing-flyout" aria-label="Drawing tools">
      <header class="drawing-flyout-header">
        <div>
          <span class="drawing-flyout-eyebrow">DRAWING TOOLS</span>
          <h3>{{ activeGroup }}</h3>
        </div>
        <button class="drawing-flyout-close" type="button" aria-label="Close tool panel" title="Close tool panel" @click="activeGroup = null">×</button>
      </header>
      <div class="drawing-flyout-tools">
        <button
          v-for="tool in groups.find((group) => group.label === activeGroup)?.tools ?? []"
          :key="tool.kind"
          type="button"
          class="drawing-tool-item"
          :class="{ active: props.activeTool === tool.kind }"
          :aria-pressed="props.activeTool === tool.kind"
          :title="tool.label"
          :data-tool-kind="tool.kind"
          @click="choose(tool.kind, activeGroup!)"
        >
          <span class="drawing-tool-glyph" aria-hidden="true">{{ tool.label.slice(0, 1).toUpperCase() }}</span>
          <span>{{ tool.label }}</span>
          <svg v-if="props.activeTool === tool.kind" class="drawing-tool-check" viewBox="0 0 16 16" aria-hidden="true"><path d="m3 8 3 3 7-7" /></svg>
        </button>
      </div>
      <footer class="drawing-flyout-footer">
        <span>{{ groups.find((group) => group.label === activeGroup)?.tools.length ?? 0 }} TOOLS</span>
        <span v-if="props.activeTool">{{ selectGroupForTool(props.activeTool) === activeGroup ? "ACTIVE TOOL" : "" }}</span>
      </footer>
    </section>
  </aside>
</template>

<style scoped>
.drawing-toolbar {
  position: absolute;
  z-index: 8;
  top: 38px;
  bottom: 10px;
  left: 8px;
  display: flex;
  align-items: stretch;
  max-height: calc(100% - 48px);
  color: #c5cbd0;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  pointer-events: none;
}
.drawing-rail,
.drawing-flyout {
  pointer-events: auto;
  border: 1px solid #30383e;
  background: rgb(22 27 31 / 97%);
  box-shadow: 0 5px 20px rgb(0 0 0 / 32%);
}
.drawing-rail {
  display: flex;
  width: 42px;
  flex: 0 0 42px;
  flex-direction: column;
  align-items: center;
  overflow: hidden;
  border-radius: 4px;
}
.drawing-rail-top,
.drawing-rail-bottom {
  display: flex;
  width: 100%;
  flex-direction: column;
  align-items: center;
}
.drawing-rail-top {
  padding-top: 5px;
}
.drawing-rail-bottom {
  padding-bottom: 5px;
}
.drawing-rail-button {
  position: relative;
  display: grid;
  width: 34px;
  height: 34px;
  flex: 0 0 34px;
  place-items: center;
  border: 1px solid transparent;
  border-radius: 4px;
  background: transparent;
  color: #aab3b9;
  cursor: pointer;
  transition: background-color 100ms ease, color 100ms ease, border-color 100ms ease;
}
.drawing-rail-button:hover {
  border-color: #414a50;
  background: #2a3136;
  color: #edf0f2;
}
.drawing-rail-button.active {
  border-color: #695536;
  background: #3a3022;
  color: #e3b96f;
}
.drawing-rail-button.has-active-tool:not(.active)::after {
  position: absolute;
  right: 3px;
  bottom: 3px;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #d6a85d;
  content: "";
}
.drawing-rail-button svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.7;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.drawing-category-glyph {
  font-family: ui-sans-serif, system-ui, sans-serif;
  font-size: 19px;
  font-weight: 500;
  line-height: 1;
}
.drawing-rail-separator {
  width: 24px;
  height: 1px;
  margin: 5px 0 4px;
  background: #343c42;
}
.drawing-rail-spacer {
  flex: 1 1 auto;
}
.drawing-count {
  display: grid;
  min-width: 21px;
  height: 18px;
  place-items: center;
  margin: 0 0 4px;
  border-radius: 3px;
  background: #293137;
  color: #aeb8be;
  font: 9px ui-monospace, SFMono-Regular, Consolas, monospace;
}
.drawing-flyout {
  display: flex;
  width: 238px;
  min-width: 238px;
  max-height: 100%;
  flex-direction: column;
  margin-left: 5px;
  overflow: hidden;
  border-radius: 4px;
}
.drawing-flyout-header {
  display: flex;
  min-height: 58px;
  flex: 0 0 58px;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  border-bottom: 1px solid #30383e;
  background: #20272c;
}
.drawing-flyout-eyebrow {
  color: #7f8b92;
  font-size: 8px;
  font-weight: 700;
  letter-spacing: .12em;
}
.drawing-flyout-header h3 {
  margin: 4px 0 0;
  color: #e0e5e8;
  font-size: 12px;
  font-weight: 600;
}
.drawing-flyout-close {
  display: grid;
  width: 25px;
  height: 25px;
  place-items: center;
  border: 1px solid transparent;
  border-radius: 3px;
  background: transparent;
  color: #8d989f;
  font-size: 19px;
  cursor: pointer;
}
.drawing-flyout-close:hover {
  border-color: #424c53;
  background: #2b3339;
  color: #e1e6e9;
}
.drawing-flyout-tools {
  display: grid;
  min-height: 0;
  grid-template-columns: 1fr 1fr;
  gap: 3px;
  overflow: auto;
  padding: 8px;
  scrollbar-color: #465159 transparent;
  scrollbar-width: thin;
}
.drawing-tool-item {
  display: flex;
  min-width: 0;
  min-height: 35px;
  align-items: center;
  gap: 7px;
  padding: 4px 6px;
  border: 1px solid transparent;
  border-radius: 3px;
  background: transparent;
  color: #aeb8be;
  font: 10px/1.25 inherit;
  text-align: left;
  cursor: pointer;
}
.drawing-tool-item:hover {
  border-color: #414b52;
  background: #2a3238;
  color: #e6ebee;
}
.drawing-tool-item.active {
  border-color: #725b38;
  background: #3a3022;
  color: #f0d29b;
}
.drawing-tool-glyph {
  display: grid;
  width: 20px;
  height: 20px;
  flex: 0 0 20px;
  place-items: center;
  border: 1px solid #3a444a;
  border-radius: 3px;
  color: #9ca8af;
  font-size: 9px;
  font-weight: 600;
}
.drawing-tool-item.active .drawing-tool-glyph {
  border-color: #80663e;
  color: #e3b96f;
}
.drawing-tool-item > span:nth-child(2) {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.drawing-tool-check {
  width: 13px;
  height: 13px;
  flex: 0 0 13px;
  margin-left: auto;
  fill: none;
  stroke: #e3b96f;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.drawing-flyout-footer {
  display: flex;
  min-height: 24px;
  flex: 0 0 24px;
  align-items: center;
  justify-content: space-between;
  padding: 0 10px;
  border-top: 1px solid #30383e;
  color: #748189;
  font: 8px ui-monospace, SFMono-Regular, Consolas, monospace;
  letter-spacing: .06em;
}
@media (max-width: 760px) {
  .drawing-flyout {
    width: min(218px, calc(100vw - 66px));
    min-width: min(218px, calc(100vw - 66px));
  }
  .drawing-flyout-tools {
    grid-template-columns: 1fr;
  }
}
</style>
