<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { legStartKey, type LegDto, type SwingLegReference } from "../origin-types";
import InspectorPropertyField from "./InspectorPropertyField.vue";

const props = defineProps<{
  swingId: string;
  legs?: readonly LegDto[];
}>();

const emit = defineEmits<{ legHighlight: [leg: SwingLegReference | null] }>();
const expanded = ref(false);
const openLegs = ref(new Set<string>());
const hovered = ref<string | null>(null);
const focused = ref<string | null>(null);

function toggleLeg(leg: LegDto): void {
  const key = legStartKey(leg);
  if (!openLegs.value.delete(key)) openLegs.value.add(key);
}

function toggleLegs(): void {
  expanded.value = !expanded.value;
  if (!expanded.value) {
    hovered.value = null;
    focused.value = null;
  }
}

function clearFocus(event: FocusEvent): void {
  if (event.relatedTarget instanceof Node && (event.currentTarget as HTMLElement).contains(event.relatedTarget)) return;
  focused.value = null;
}

const highlight = computed(() => {
  const key = hovered.value ?? focused.value;
  if (!expanded.value || key === null) return null;
  const leg = props.legs?.find((entry) => legStartKey(entry) === key);
  return leg ? { swingId: props.swingId, cbarStartId: leg.cbarStartId, sbarStartId: leg.sbarStartId } : null;
});

watch(highlight, (leg) => emit("legHighlight", leg));
watch(() => props.legs, (legs) => {
  const valid = new Set(legs?.map(legStartKey));
  for (const key of openLegs.value) {
    if (!valid.has(key)) openLegs.value.delete(key);
  }
  if (hovered.value !== null && !valid.has(hovered.value)) hovered.value = null;
  if (focused.value !== null && !valid.has(focused.value)) focused.value = null;
});
</script>

<template>
  <section class="swing-legs" aria-label="Leg composition">
    <p v-if="legs === undefined" class="inspector-provenance">Legs not recorded</p>
    <template v-else>
      <button type="button" class="leg-toggle" :aria-expanded="expanded" @click="toggleLegs">
        <span class="leg-chevron" aria-hidden="true">{{ expanded ? "▾" : "▸" }}</span> Legs ({{ legs.length }})
      </button>
      <ul v-if="expanded" class="leg-list">
        <li v-for="leg in legs" :key="legStartKey(leg)" class="leg-item"
          @mouseenter="hovered = legStartKey(leg)" @mouseleave="hovered = null"
          @focusin="focused = legStartKey(leg)" @focusout="clearFocus">
          <button type="button" class="leg-toggle leg-row" :aria-expanded="openLegs.has(legStartKey(leg))"
            @click="toggleLeg(leg)">
            <span class="leg-chevron" aria-hidden="true">{{ openLegs.has(legStartKey(leg)) ? "▾" : "▸" }}</span>
            <span>{{ leg.direction === "Up" ? "↑" : "↓" }} {{ leg.endKind }}</span>
            <span class="leg-prices">{{ leg.startPrice }} → {{ leg.endPrice }}</span>
          </button>
          <dl v-if="openLegs.has(legStartKey(leg))" class="inspector-fields leg-fields">
            <InspectorPropertyField label="CBar Start ID" :value="leg.cbarStartId" test-id="inspector-leg-cbar-start-id" reference-kind="cbar" />
            <InspectorPropertyField label="CBar End ID" :value="leg.cbarEndId" reference-kind="cbar" />
            <InspectorPropertyField label="SBar Start ID" :value="leg.sbarStartId" reference-kind="sbar" />
            <InspectorPropertyField label="SBar End ID" :value="leg.sbarEndId" reference-kind="sbar" />
            <InspectorPropertyField label="High" :value="leg.high" />
            <InspectorPropertyField label="Low" :value="leg.low" />
            <InspectorPropertyField label="Highest High SBar" :value="leg.highSbarId" reference-kind="sbar" />
            <InspectorPropertyField label="Lowest Low SBar" :value="leg.lowSbarId" reference-kind="sbar" />
            <InspectorPropertyField label="Volume" :value="leg.volume" />
            <InspectorPropertyField label="Span SBars" :value="String(leg.spanSbars)" />
          </dl>
        </li>
      </ul>
    </template>
  </section>
</template>

<style scoped>
.swing-legs {
  margin: 10px 0;
  border-block: 1px solid var(--dbg-line, #30383d);
}

.leg-toggle {
  align-items: baseline;
  background: transparent;
  border: 0;
  color: var(--dbg-text-primary);
  cursor: pointer;
  display: flex;
  flex-wrap: wrap;
  font: inherit;
  gap: 5px;
  padding: 6px 2px;
  text-align: left;
  width: 100%;
}

.leg-toggle:hover, .leg-toggle:focus-visible {
  color: #f5e6cd;
}

.leg-chevron {
  color: var(--dbg-text-muted);
  width: 1em;
}

.leg-list {
  list-style: none;
  margin: 0;
  padding: 0 0 5px 10px;
}

.leg-row {
  color: var(--dbg-text-secondary, #c3cbd1);
}

.leg-prices {
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}

.leg-fields {
  margin: 0 0 6px 12px;
}
</style>
