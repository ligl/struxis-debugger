<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { CreateFixedPriceRangeDto, FixedPriceRangeResultDto, ObservationControlsContext } from "../origin-types";

const props = defineProps<{
  context?: ObservationControlsContext;
  create: (request: CreateFixedPriceRangeDto) => Promise<FixedPriceRangeResultDto>;
}>();
const expanded = ref(false);
const lower = ref("");
const upper = ref("");
const pending = ref(false);
const error = ref("");
const status = ref("");
const enabled = computed(() => Boolean(props.context?.enabled) && !pending.value);
// Compare decimal inputs exactly; price strings must reach Rust without a float conversion.
function decimal(value: string): { units: bigint; scale: number } | null {
  const text = value.trim();
  if (!/^[+-]?\d+(?:\.\d+)?$/.test(text)) return null;
  const scale = text.split(".")[1]?.length ?? 0;
  return { units: BigInt(text.replace(".", "")), scale };
}
const validation = computed(() => {
  const low = decimal(lower.value);
  const high = decimal(upper.value);
  if (!low || !high) return "Enter a decimal price for Lower and Upper.";
  const scale = Math.max(low.scale, high.scale);
  return low.units * 10n ** BigInt(scale - low.scale) >= high.units * 10n ** BigInt(scale - high.scale)
    ? "Lower must be less than Upper." : "";
});
watch(() => props.context?.runId, () => {
  expanded.value = false;
  lower.value = "";
  upper.value = "";
  error.value = "";
  status.value = "";
});
async function submit(): Promise<void> {
  const context = props.context;
  if (!context || !enabled.value || validation.value) return;
  pending.value = true;
  error.value = "";
  status.value = "";
  try {
    const result = await props.create({
      context: { runId: context.runId, expectedSbarId: context.cursorSbarId },
      lower: lower.value.trim(), upper: upper.value.trim(),
    });
    if (props.context?.runId !== context.runId) return;
    status.value = `FixedPriceRange KeyZone ${result.keyzoneId} created. Use New observation to observe it.`;
    expanded.value = false;
    lower.value = "";
    upper.value = "";
  } catch (reason) {
    if (props.context?.runId === context.runId) error.value = reason instanceof Error ? reason.message : String(reason);
  } finally {
    pending.value = false;
  }
}
</script>

<template>
  <section class="fixed-price-range-controls" aria-label="FixedPriceRange KeyZone controls">
    <button class="primary-button" type="button" :disabled="!enabled" :aria-expanded="expanded" @click="expanded = !expanded">New FixedPriceRange keyzone</button>
    <p v-if="!context?.enabled" class="hint">{{ context?.disabledReason || 'Pause a Run after an accepted K-line to create a KeyZone.' }}</p>
    <form v-if="expanded" aria-label="Create FixedPriceRange KeyZone" @submit.prevent="submit">
      <fieldset :disabled="!enabled">
        <p class="hint">Current Run · {{ context?.timeframe }}. Creation does not start an observation.</p>
        <label>Lower<input v-model="lower" aria-label="FixedPriceRange Lower" type="text" inputmode="decimal" required /></label>
        <label>Upper<input v-model="upper" aria-label="FixedPriceRange Upper" type="text" inputmode="decimal" required /></label>
        <p v-if="validation" class="hint" role="status">{{ validation }}</p>
        <button class="primary-button" type="submit" :disabled="Boolean(validation)">{{ pending ? 'Creating…' : 'Create FixedPriceRange keyzone' }}</button>
      </fieldset>
    </form>
    <p v-if="error" role="alert">{{ error }}</p>
    <p v-if="status" role="status">{{ status }}</p>
  </section>
</template>

<style scoped>
.fixed-price-range-controls { display: grid; gap: 10px; padding: 0 8px 14px; margin-bottom: 14px; border-bottom: 1px solid var(--dbg-border); min-width: 0; }
form, fieldset { min-width: 0; }
fieldset { display: grid; gap: 12px; padding: 0; margin: 0; border: 0; }
label { display: grid; gap: 8px; color: var(--dbg-text-secondary); font-size: 11px; }
input { box-sizing: border-box; width: 100%; min-width: 0; padding: 8px 10px; border: 1px solid var(--dbg-border); border-radius: 4px; background: var(--dbg-surface-2); color: var(--dbg-text-primary); font: inherit; }
input:focus-visible { outline: 1px solid var(--dbg-accent); outline-offset: 2px; }
button { min-height: 32px; padding: 8px 12px; white-space: normal; line-height: 1.5; }
p { margin: 0; font-size: 11px; line-height: 1.6; overflow-wrap: anywhere; }
.hint { color: var(--dbg-text-secondary); }
[role="alert"] { color: var(--dbg-warning); }
</style>
