<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import type { DrawingKind } from "lightweight-charts-drawing";

const props = defineProps<{ activeTool: DrawingKind | null; expanded: boolean; drawingCount: number; selectedCount: number }>();
const emit = defineEmits<{
  select: [tool: DrawingKind | null];
  toggle: [];
  clear: [];
}>();

const groups: { label: string; tools: { label: string; kind: DrawingKind }[] }[] = [
  { label: "Lines", tools: [
    { label: "Horizontal line", kind: "horizontal-line" }, { label: "Horizontal ray", kind: "horizontal-ray" },
    { label: "Vertical line", kind: "vertical-line" }, { label: "Trend line", kind: "trend-line" },
    { label: "Ray", kind: "ray" }, { label: "Info line", kind: "info-line" },
    { label: "Extended line", kind: "extended-line" }, { label: "Trend angle", kind: "trend-angle" },
    { label: "Cross line", kind: "cross-line" },
  ] },
  { label: "Brushes & shapes", tools: [
    { label: "Rectangle", kind: "rectangle" }, { label: "Rotated rectangle", kind: "rotated-rectangle" },
    { label: "Brush", kind: "brush" }, { label: "Highlighter", kind: "highlighter" },
    { label: "Arrow marker", kind: "arrow-marker" }, { label: "Arrow", kind: "arrow" },
    { label: "Arrow up", kind: "arrow-mark-up" }, { label: "Arrow down", kind: "arrow-mark-down" },
    { label: "Path", kind: "path" }, { label: "Circle", kind: "circle" }, { label: "Ellipse", kind: "ellipse" },
    { label: "Polyline", kind: "polyline" }, { label: "Triangle", kind: "triangle" },
    { label: "Arc", kind: "arc" }, { label: "Curve", kind: "curve" }, { label: "Double curve", kind: "double-curve" },
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
  { label: "Text & annotations", tools: [
    { label: "Text", kind: "text" }, { label: "Note", kind: "note" }, { label: "Price note", kind: "price-note" },
    { label: "Pin", kind: "pin" }, { label: "Table", kind: "table" }, { label: "Callout", kind: "callout" },
    { label: "Comment", kind: "comment" }, { label: "Price label", kind: "price-label" },
    { label: "Signpost", kind: "signpost" }, { label: "Flag mark", kind: "flag-mark" },
  ] },
];


const activeGroup = ref<string | null>(null);
const toolbarElement = ref<HTMLElement | null>(null);

function handleDocumentPointerDown(event: PointerEvent): void {
  if (!toolbarElement.value?.contains(event.target as Node)) {
    activeGroup.value = null;
  }
}

onMounted(() => document.addEventListener("pointerdown", handleDocumentPointerDown));
onBeforeUnmount(() => document.removeEventListener("pointerdown", handleDocumentPointerDown));

function choose(kind: DrawingKind, group: string): void {
  activeGroup.value = group;
  emit("select", kind);
}

function chooseActiveGroupTool(kind: DrawingKind): void {
  if (activeGroup.value) choose(kind, activeGroup.value);
}

function toggleGroup(label: string): void {
  activeGroup.value = activeGroup.value === label ? null : label;
}


function toolGlyph(kind: DrawingKind): string {
  if (kind.includes("horizontal") || kind === "price-range") return "horizontal";
  if (kind.includes("vertical") || kind.includes("time-zone") || kind.includes("fib-time") || kind === "date-range") return "vertical";
  if (kind.includes("channel") || kind.includes("pitchfork") || kind.includes("pitchfan")) return "channel";
  if (kind.includes("fib") || kind.includes("gann")) return "fib";
  if (kind.includes("pattern") || kind.includes("elliott") || kind === "cyclic-lines" || kind === "time-cycles") return "pattern";
  if (kind.includes("position") || kind.includes("forecast") || kind.includes("range") || kind.includes("volume-profile") || kind.includes("vwap") || kind === "sector" || kind === "ghost-feed" || kind === "bar-pattern") return "measure";
  if (kind.includes("arrow")) return "arrow";
  if (kind.includes("rectangle") || kind === "triangle") return "shape";
  if (kind.includes("circle") || kind.includes("ellipse") || kind.includes("arc") || kind.includes("spiral")) return "circle";
  if (kind === "brush" || kind === "highlighter" || kind === "path" || kind === "polyline" || kind.includes("curve") || kind === "sine-line") return "brush";
  if (kind === "text" || kind === "note" || kind === "price-note" || kind === "pin" || kind === "table" || kind === "callout" || kind === "comment" || kind === "price-label" || kind === "signpost" || kind === "flag-mark") return "text";
  return "trend";
}

</script>

<template>
  <aside
    ref="toolbarElement"
    class="drawing-toolbar"
    :class="{ 'is-collapsed': !props.expanded, 'has-flyout': props.expanded && activeGroup !== null }"
    aria-label="Drawing tools"
    data-testid="drawing-toolbar"
  >
    <nav v-if="props.expanded" class="drawing-rail" aria-label="Drawing tool categories">
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
        <svg class="drawing-category-icon" viewBox="0 0 24 24" aria-hidden="true">
          <template v-if="group.label === 'Lines'">
            <path d="m4 18 15-12M5 7l.01 0M18 17l.01 0" />
            <circle cx="4" cy="18" r="1.5" /><circle cx="19" cy="6" r="1.5" />
          </template>
          <template v-else-if="group.label === 'Brushes & shapes'">
            <rect x="4" y="4" width="9" height="9" rx="1" /><circle cx="17" cy="16" r="4" />
          </template>
          <template v-else-if="group.label === 'Channels & pitchforks'">
            <path d="m4 17 14-10M4 12l14-5M4 21l14-10" />
          </template>
          <template v-else-if="group.label === 'Fibonacci & Gann'">
            <path d="M4 6h16M4 10h16M4 14h16M4 18h16M8 4v16M16 4v16" />
          </template>
          <template v-else-if="group.label === 'Patterns & waves'">
            <path d="m4 18 6-12 10 12H4Z" /><path d="m10 6 4 12" />
          </template>
          <template v-else-if="group.label === 'Forecast & measurement'">
            <path d="M5 4v16M19 4v16M5 8h14M5 16h14M9 6v4M15 14v4" />
          </template>
          <template v-else>
            <path d="M5 6h14M12 6v13M8 19h8" />
          </template>
        </svg>
        <span v-if="group.tools.some((tool) => tool.kind === props.activeTool)" class="drawing-category-indicator"></span>
      </button>

      <div class="drawing-rail-spacer"></div>
      <div class="drawing-rail-bottom">
        <div class="drawing-count-row">
          <span class="drawing-count" data-testid="drawing-count" :title="drawingCount + ' drawings · ' + selectedCount + ' selected'">{{ drawingCount }}</span>
          <button
            class="drawing-rail-button drawing-clear-button"
            type="button"
            :disabled="drawingCount === 0"
            aria-label="Delete all drawings"
            title="Delete all drawings"
            data-testid="drawing-clear-all"
            @click="emit('clear')"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-.8 13H6.8L6 7m4 4v5m4-5v5" /></svg>
          </button>
        </div>
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

    <button
      v-else
      class="drawing-restore-button"
      type="button"
      aria-label="Expand drawing toolbar"
      title="Show drawing tools"
      aria-expanded="false"
      data-testid="drawing-toolbar-toggle"
      @click="emit('toggle')"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 7 7-7 7" /></svg>
    </button>

    <section v-if="props.expanded && activeGroup" class="drawing-flyout" aria-label="Drawing tools">
      <header class="drawing-flyout-header">
        <h3>{{ activeGroup }}</h3>
        <button class="drawing-flyout-close" type="button" aria-label="Close tool panel" title="Close tool panel" @click="activeGroup = null">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 4 8 8M12 4l-8 8" /></svg>
        </button>
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
          @click="chooseActiveGroupTool(tool.kind)"
        >
          <svg class="drawing-tool-glyph" :data-glyph="toolGlyph(tool.kind)" viewBox="0 0 24 24" aria-hidden="true">
            <template v-if="toolGlyph(tool.kind) === 'horizontal'"><path d="M3 12h18M6 8v8M18 8v8" /></template>
            <template v-else-if="toolGlyph(tool.kind) === 'vertical'"><path d="M12 3v18M8 6h8M8 18h8" /></template>
            <template v-else-if="toolGlyph(tool.kind) === 'channel'"><path d="m3 17 18-10M3 21l18-10M3 13l18-10" /></template>
            <template v-else-if="toolGlyph(tool.kind) === 'fib'"><path d="M4 5h16M4 9h16M4 14h16M4 19h16M7 3v18M17 3v18" /></template>
            <template v-else-if="toolGlyph(tool.kind) === 'pattern'"><path d="m3 18 5-10 5 6 4-9 4 13" /><circle cx="3" cy="18" r="1" /><circle cx="8" cy="8" r="1" /><circle cx="13" cy="14" r="1" /><circle cx="17" cy="5" r="1" /><circle cx="21" cy="18" r="1" /></template>
            <template v-else-if="toolGlyph(tool.kind) === 'measure'"><path d="M4 19V5M20 19V5M4 8h16M4 16h16M8 6v4M16 14v4" /></template>
            <template v-else-if="toolGlyph(tool.kind) === 'arrow'"><path d="M4 19 19 4M9 4h10v10" /></template>
            <template v-else-if="toolGlyph(tool.kind) === 'shape'"><path d="M5 5h14v14H5z" /></template>
            <template v-else-if="toolGlyph(tool.kind) === 'circle'"><circle cx="12" cy="12" r="8" /></template>
            <template v-else-if="toolGlyph(tool.kind) === 'brush'"><path d="M4 17c4-9 7 4 11-5s5-5 5-5M4 20h6" /></template>
            <template v-else-if="toolGlyph(tool.kind) === 'text'"><path d="M4 6h16M12 6v13M8 19h8" /></template>
            <template v-else><path d="m3 17 7-10 5 5 6-7" /><circle cx="3" cy="17" r="1" /><circle cx="10" cy="7" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="21" cy="5" r="1" /></template>
          </svg>
          <span>{{ tool.label }}</span>
          <svg v-if="props.activeTool === tool.kind" class="drawing-tool-check" viewBox="0 0 16 16" aria-hidden="true"><path d="m3 8 3 3 7-7" /></svg>
        </button>
      </div>
    </section>
  </aside>
</template>

<style scoped>
.drawing-toolbar {
  position: absolute;
  z-index: 8;
  top: 38px;
  bottom: 10px;
  left: 0;
  display: flex;
  align-items: stretch;
  max-height: calc(100% - 48px);
  color: #c5cbd0;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  pointer-events: none;
}
.drawing-toolbar.is-collapsed {
  top: auto;
  bottom: 10px;
  left: 0;
  max-height: none;
}
.drawing-restore-button {
  display: grid;
  width: 24px;
  height: 24px;
  flex: 0 0 24px;
  place-items: center;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 3px;
  background: transparent;
  color: #7c878e;
  opacity: .42;
  cursor: pointer;
  pointer-events: auto;
  transition: color 120ms ease, opacity 120ms ease, background-color 120ms ease;
}
.drawing-restore-button:hover,
.drawing-restore-button:focus-visible {
  background: rgb(30 36 40 / 88%);
  color: #d0d7db;
  opacity: .92;
}
.drawing-restore-button svg {
  width: 15px;
  height: 15px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.drawing-rail,
.drawing-flyout {
  pointer-events: auto;
  background: rgb(20 24 28 / 94%);
  box-shadow: 0 3px 12px rgb(0 0 0 / 24%);
}
.drawing-rail {
  display: flex;
  width: 40px;
  flex: 0 0 40px;
  flex-direction: column;
  align-items: center;
  overflow: hidden;
  border-radius: 3px;
}
.drawing-rail-top,
.drawing-rail-bottom {
  display: flex;
  width: 100%;
  flex-direction: column;
  align-items: center;
}
.drawing-rail-top { padding-top: 4px; }
.drawing-rail-bottom { padding-bottom: 4px; }
.drawing-count-row {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: center;
  gap: 1px;
}
.drawing-clear-button:disabled {
  opacity: .3;
  cursor: default;
}
.drawing-clear-button:disabled:hover {
  background: transparent;
  color: #929da4;
}
.drawing-rail-button {
  position: relative;
  display: grid;
  width: 32px;
  height: 32px;
  flex: 0 0 32px;
  place-items: center;
  border: 1px solid transparent;
  border-radius: 3px;
  background: transparent;
  color: #929da4;
  cursor: pointer;
  transition: background-color 100ms ease, color 100ms ease;
}
.drawing-rail-button:hover {
  background: #2a3136;
  color: #e4e9ec;
}
.drawing-rail-button.active {
  background: #332c21;
  color: #dfb66f;
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
  width: 17px;
  height: 17px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.65;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.drawing-category-icon {
  width: 17px;
  height: 17px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.drawing-rail-separator {
  width: 22px;
  height: 1px;
  margin: 4px 0;
  background: #343c42;
}
.drawing-rail-spacer { flex: 1 1 auto; }
.drawing-count {
  display: grid;
  min-width: 19px;
  height: 32px;
  place-items: center;
  margin: 0;
  color: #89949b;
  font: 9px ui-monospace, SFMono-Regular, Consolas, monospace;
}
.drawing-flyout {
  display: flex;
  width: 224px;
  min-width: 224px;
  max-height: 100%;
  flex-direction: column;
  align-self: flex-start;
  margin-left: 4px;
  overflow: hidden;
  border-radius: 3px;
  background: rgb(23 28 32 / 97%);
}
.drawing-flyout-header {
  display: flex;
  min-height: 39px;
  flex: 0 0 39px;
  align-items: center;
  justify-content: space-between;
  padding: 0 10px 0 12px;
  border-bottom: 1px solid #30383e;
}
.drawing-flyout-header h3 {
  margin: 0;
  color: #dce2e5;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: .01em;
}
.drawing-flyout-close {
  display: grid;
  width: 23px;
  height: 23px;
  place-items: center;
  border: 0;
  border-radius: 3px;
  background: transparent;
  color: #87939a;
  cursor: pointer;
}
.drawing-flyout-close:hover {
  background: #2b3339;
  color: #e1e6e9;
}
.drawing-flyout-close svg {
  width: 13px;
  height: 13px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linecap: round;
}
.drawing-flyout-tools {
  display: flex;
  min-height: 0;
  flex-direction: column;
  gap: 1px;
  overflow: auto;
  padding: 5px;
  scrollbar-color: #465159 transparent;
  scrollbar-width: thin;
}
.drawing-tool-item {
  position: relative;
  display: flex;
  min-width: 0;
  min-height: 30px;
  flex: 0 0 30px;
  align-items: center;
  gap: 10px;
  padding: 0 9px;
  border: 0;
  border-radius: 2px;
  background: transparent;
  color: #aeb8be;
  font-family: inherit;
  font-size: 11px;
  line-height: 1;
  text-align: left;
  cursor: pointer;
}
.drawing-tool-item:hover {
  background: #2a3238;
  color: #e6ebee;
}
.drawing-tool-item.active {
  background: #332c21;
  color: #edcc91;
}
.drawing-tool-item.active::before {
  position: absolute;
  top: 5px;
  bottom: 5px;
  left: 0;
  width: 2px;
  border-radius: 1px;
  background: #d6a85d;
  content: "";
}
.drawing-tool-glyph {
  width: 20px;
  height: 20px;
  flex: 0 0 20px;
  fill: none;
  stroke: #a0abb1;
  stroke-width: 1.45;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.drawing-tool-item:hover .drawing-tool-glyph { stroke: #e0e6e9; }
.drawing-tool-item.active .drawing-tool-glyph { stroke: #e2ba73; }
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
@media (max-width: 760px) {
  .drawing-flyout {
    width: min(218px, calc(100vw - 64px));
    min-width: min(218px, calc(100vw - 64px));
  }
}
</style>
