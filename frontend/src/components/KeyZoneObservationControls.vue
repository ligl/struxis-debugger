<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { CreateObservationDto, CancelObservationDto, KeyZoneCheckpointDto, KeyZoneDto, ObservationCommandResultDto, ObservationControlsContext } from "../origin-types";
import { formatDomainTimestamp } from "../timestamp-format";

const props = defineProps<{
  zone: KeyZoneDto;
  registry: KeyZoneCheckpointDto;
  context: ObservationControlsContext;
  create: (request: CreateObservationDto) => Promise<ObservationCommandResultDto>;
  cancel: (request: CancelObservationDto) => Promise<ObservationCommandResultDto>;
}>();
const expanded = ref(false);
const startMode = ref<"current" | "history">("current");
const startAt = ref("");
const n = ref("3");
const x = ref<string | number>("0.5");
const completion = ref<CreateObservationDto["completion"]>("AfterOneInteraction");
const deadline = ref("");
const pending = ref(false);
const cancelling = ref<string | null>(null);
const error = ref("");
const status = ref("");
// Retained after a failed submission so transport retries are idempotent.
const requestId = ref(crypto.randomUUID());
let lastIntent = "";
const acceptedBars = computed(() => props.context.bars.filter((bar) => BigInt(bar.sbarId) <= BigInt(props.context.cursorSbarId)));
const tasks = computed(() => props.registry.observations.filter((task) => task.keyzoneId === props.zone.keyzoneId && task.state === "Observing"));
const unavailable = computed(() => props.zone.state === "Invalidated" ? "This KeyZone is invalidated. New observations are unavailable." : props.context.disabledReason);
const enabled = computed(() => props.context.enabled && props.zone.state !== "Invalidated" && !pending.value);
const boundary = computed(() => startMode.value === "current" ? props.context.cursorSbarId : startAt.value);
const validation = computed<{ field: "n" | "x" | "window"; message: string } | null>(() => {
  if (!/^\d+$/.test(n.value) || BigInt(n.value) < 1n || BigInt(n.value) > 18446744073709551615n) return { field: "n", message: "N must be a positive whole number." };
  if (String(x.value).trim() === "" || !Number.isFinite(Number(x.value)) || Number(x.value) < 0) return { field: "x", message: "X must be a finite number of zero or greater." };
  if (!boundary.value || !deadline.value) return { field: "window", message: "Select a start and deadline." };
  if (BigInt(deadline.value) <= BigInt(boundary.value)) return { field: "window", message: "Deadline must be later than the start. Its K-line is excluded." };
  return null;
});
watch([() => props.context.runId, () => props.zone.keyzoneId], () => {
  expanded.value = false;
  error.value = "";
  status.value = "";
  requestId.value = crypto.randomUUID();
  lastIntent = "";
  startAt.value = acceptedBars.value[0]?.sbarId ?? "";
  const last = props.context.bars.at(-1);
  // One nanosecond after the final input includes that final K-line. It does
  // not promise an expiry event without a subsequent accepted market position.
  deadline.value = last && BigInt(last.sbarId) < 18446744073709551615n ? (BigInt(last.sbarId) + 1n).toString() : last?.sbarId ?? "";
}, { immediate: true });
function label(time: string): string { return formatDomainTimestamp(time, props.context.timeframe); }
async function submit(): Promise<void> {
  if (!enabled.value || validation.value) return;
  const intent = { keyzoneId: props.zone.keyzoneId, startAt: startMode.value === "current" ? null : startAt.value,
    n: n.value, x: Number(x.value), completion: completion.value, deadline: deadline.value };
  const signature = JSON.stringify(intent);
  if (lastIntent && signature !== lastIntent) requestId.value = crypto.randomUUID();
  lastIntent = signature;
  pending.value = true;
  error.value = "";
  status.value = "";
  try {
    const result = await props.create({ ...intent, requestId: requestId.value,
      context: { runId: props.context.runId, expectedSbarId: props.context.cursorSbarId } });
    status.value = `Observation ${result.observationId} ${result.operation === "existing" ? "already exists" : "created"}.`;
    expanded.value = false;
    requestId.value = crypto.randomUUID();
    lastIntent = "";
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : String(reason);
  } finally { pending.value = false; }
}
async function cancelTask(id: string): Promise<void> {
  if (!props.context.enabled || pending.value) return;
  pending.value = true;
  cancelling.value = id;
  error.value = "";
  status.value = "";
  try {
    const result = await props.cancel({ context: { runId: props.context.runId, expectedSbarId: props.context.cursorSbarId }, observationId: id });
    status.value = `Observation ${id} ${result.operation === "alreadyTerminated" ? "has already ended" : "cancelled"}.`;
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : String(reason);
  } finally { pending.value = false; cancelling.value = null; }
}
</script>

<template>
  <section class="observation-controls" data-testid="keyzone-observation-controls" aria-label="Observation controls">
    <p class="section-index">OBSERVE · {{ context.timeframe }} · CURRENT RUN</p>
    <p v-if="unavailable" class="hint">{{ unavailable }}</p>
    <button class="primary-button" type="button" :disabled="!enabled" :aria-expanded="expanded" @click="expanded = !expanded">{{ expanded ? 'Close form' : 'New observation' }}</button>
    <form v-if="expanded" aria-label="Create observation" @submit.prevent="submit">
      <fieldset :disabled="!enabled">
        <label>Start<select v-model="startMode" aria-label="Observation start"><option value="current">After current K-line</option><option value="history">From an accepted K-line</option></select></label>
        <label v-if="startMode === 'history'">First K-line<select v-model="startAt" aria-label="Observation historical start"><option v-for="bar in acceptedBars" :key="bar.sbarId" :value="bar.sbarId">{{ label(bar.sbarId) }}</option></select></label>
        <div class="parameters">
          <label>N · consecutive outside closes<input v-model="n" aria-label="Observation N" type="text" inputmode="numeric" /></label>
          <label>X · distance / zone width<input v-model="x" aria-label="Observation X" type="number" min="0" step="any" /></label>
        </div>
        <label>Finish<select v-model="completion" aria-label="Observation completion"><option value="AfterOneInteraction">After one completed interaction</option><option value="UntilDeadline">Observe repeatedly until deadline</option></select></label>
        <label>Deadline · exclusive<select v-model="deadline" aria-label="Observation deadline"><option v-for="bar in context.bars" :key="bar.sbarId" :value="bar.sbarId">{{ label(bar.sbarId) }}</option><option v-if="context.bars.at(-1) && BigInt(context.bars.at(-1)!.sbarId) < 18446744073709551615n" :value="(BigInt(context.bars.at(-1)!.sbarId) + 1n).toString()">After final input K-line</option></select></label>
        <p class="hint">Start is {{ startMode === 'current' ? 'after the current K-line' : 'inclusive' }}. The deadline K-line is excluded.</p>
        <p v-if="deadline === (BigInt(context.bars.at(-1)?.sbarId ?? '0') + 1n).toString()" class="hint">Includes the final input. An unfinished task stays observing when the Run completes.</p>
        <p v-if="validation" class="hint" role="status">{{ validation.message }}</p>
        <button class="primary-button" type="submit" :disabled="Boolean(validation)">{{ pending ? 'Creating…' : 'Create observation' }}</button>
      </fieldset>
    </form>
    <div v-for="task in tasks" :key="task.observationId" class="active-task">
      <span>Observation {{ task.observationId }} · observing</span>
      <button class="subtle-button" type="button" :disabled="!context.enabled || pending" :aria-label="`Cancel observation ${task.observationId}`" @click="cancelTask(task.observationId)">{{ cancelling === task.observationId ? 'Cancelling…' : 'Cancel' }}</button>
    </div>
    <p v-if="error" role="alert">{{ error }}</p>
    <p v-if="status" role="status">{{ status }}</p>
  </section>
</template>

<style scoped>
.observation-controls { padding: 12px 0; border-block: 1px solid var(--dbg-border); margin-bottom: 12px; }
fieldset { border: 0; padding: 0; margin: 12px 0 0; min-width: 0; display: grid; gap: 10px; }
label { display: grid; gap: 5px; font-size: 11px; color: var(--dbg-text-secondary); min-width: 0; }
input, select { width: 100%; min-width: 0; box-sizing: border-box; padding: 7px; background: var(--dbg-surface-2); color: var(--dbg-text-primary); border: 1px solid var(--dbg-border); border-radius: 4px; }
.parameters { display: grid; gap: 10px; }
.hint { font-size: 11px; line-height: 1.5; color: var(--dbg-text-secondary); }
.active-task { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 10px; font-size: 11px; }
[role="alert"] { color: var(--dbg-warning); font-size: 12px; }
[role="status"] { font-size: 12px; }
</style>
