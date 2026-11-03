<script setup lang="ts">
import type { DrawingKind } from "lightweight-charts-drawing";

defineProps<{ activeTool: DrawingKind | null; expanded: boolean; drawingCount: number; selectedCount: number }>();
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

function choose(kind: DrawingKind): void {
  emit("select", kind);
}
</script>

<template>
  <aside class="drawing-toolbar" :class="{ 'is-collapsed': !expanded }" aria-label="Drawing tools" data-testid="drawing-toolbar">
    <div class="drawing-toolbar-head">
      <button
        class="drawing-toolbar-toggle"
        type="button"
        :aria-expanded="expanded"
        :aria-label="expanded ? 'Collapse drawing toolbar' : 'Expand drawing toolbar'"
        :title="expanded ? 'Collapse drawing toolbar' : 'Expand drawing toolbar'"
        data-testid="drawing-toolbar-toggle"
        @click="emit('toggle')"
      >{{ expanded ? "‹" : "✎" }}</button>
      <span v-if="expanded" class="drawing-toolbar-title">DRAWINGS</span>
      <span v-if="expanded" class="drawing-toolbar-count" data-testid="drawing-count">{{ drawingCount }} / {{ selectedCount }}</span>
      <button
        v-if="expanded"
        class="drawing-tool-clear"
        type="button"
        :class="{ active: activeTool === null }"
        :aria-pressed="activeTool === null"
        title="Select / cancel drawing tool"
        data-testid="drawing-tool-select"
        @click="emit('select', null)"
      >SELECT</button>
    </div>
    <div v-if="expanded" class="drawing-toolbar-groups">
      <details v-for="(group, index) in groups" :key="group.label" :open="index === 0">
        <summary>{{ group.label }}</summary>
        <div class="drawing-toolbar-tools">
          <button
            v-for="tool in group.tools"
            :key="tool.kind"
            type="button"
            class="drawing-tool-item"
            :class="{ active: activeTool === tool.kind }"
            :aria-pressed="activeTool === tool.kind"
            :title="tool.label"
            :data-tool-kind="tool.kind"
            @click="choose(tool.kind)"
          >{{ tool.label }}</button>
        </div>
      </details>
    </div>
    <div v-else class="drawing-toolbar-collapsed-mark" aria-hidden="true">DRAW</div>
  </aside>
</template>

<style scoped>
.drawing-toolbar {
  position: absolute;
  z-index: 8;
  top: 38px;
  left: 8px;
  display: flex;
  width: 184px;
  max-height: calc(100% - 48px);
  flex-direction: column;
  overflow: hidden;
  border: 1px solid #343b40;
  border-radius: 3px;
  background: rgb(23 28 32 / 96%);
  box-shadow: 0 4px 16px rgb(0 0 0 / 28%);
  color: #c4cdd2;
  font: 10px ui-monospace, SFMono-Regular, Consolas, monospace;
}
.drawing-toolbar.is-collapsed {
  width: 30px;
  max-height: 42px;
}
.drawing-toolbar-head {
  display: flex;
  min-height: 29px;
  flex: 0 0 29px;
  align-items: center;
  gap: 7px;
  padding: 0 5px;
  border-bottom: 1px solid #343b40;
  background: #20262b;
}
.drawing-toolbar-toggle {
  display: grid;
  width: 20px;
  height: 21px;
  flex: 0 0 20px;
  place-items: center;
  border: 1px solid transparent;
  border-radius: 2px;
  background: transparent;
  color: #d6a85d;
  font: 17px ui-monospace, monospace;
  cursor: pointer;
}
.drawing-toolbar-toggle:hover,
.drawing-tool-clear:hover,
.drawing-tool-item:hover {
  border-color: #665438;
  background: #30291f;
  color: #f0d29b;
}
.drawing-toolbar-title {
  color: #d6a85d;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: .08em;
}
.drawing-toolbar-count {\n  margin-left: auto;\n  color: #7f8b92;\n  font-size: 8px;\n}\n.drawing-tool-clear {
  margin-left: auto;
  padding: 3px 5px;
  border: 1px solid #343b40;
  border-radius: 2px;
  background: #252c31;
  color: #9ea9b0;
  font: inherit;
  cursor: pointer;
}
.drawing-tool-clear.active,
.drawing-tool-item.active {
  border-color: #8d7044;
  background: #3a3022;
  color: #f0d29b;
}
.drawing-toolbar-groups {
  min-height: 0;
  overflow: auto;
  padding: 3px 0;
  scrollbar-width: thin;
}
.drawing-toolbar-groups details {
  border-bottom: 1px solid #2b3237;
}
.drawing-toolbar-groups summary {
  padding: 7px 8px;
  color: #aeb8be;
  font-size: 9px;
  font-weight: 700;
  cursor: pointer;
  list-style-position: inside;
}
.drawing-toolbar-groups summary:hover {
  background: #252c31;
  color: #e1e7ea;
}
.drawing-toolbar-tools {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1px;
  padding: 0 5px 5px;
}
.drawing-tool-item {
  min-height: 22px;
  padding: 3px 6px;
  overflow: hidden;
  border: 1px solid transparent;
  border-radius: 2px;
  background: transparent;
  color: #aab4ba;
  font: inherit;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}
.drawing-toolbar-collapsed-mark {
  padding: 0 0 5px;
  color: #89949d;
  font-size: 7px;
  text-align: center;
  writing-mode: vertical-rl;
  transform: rotate(180deg);
}
</style>
