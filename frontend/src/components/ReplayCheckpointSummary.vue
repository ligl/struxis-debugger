<script setup lang="ts">
import type { ReplayInspectorDto } from "../origin-types";
import { formatDomainTimestamp } from "../timestamp-format";
import InspectorPropertyField from "./InspectorPropertyField.vue";

defineProps<{
  replayInspector: ReplayInspectorDto;
  timeframe: string | null;
}>();
</script>

<template>

      <div class="inspector-object-heading">
        <div>
          <p class="section-index">CONFIRMED REPLAY CHECKPOINT</p>
          <h3>Struxis State</h3>
        </div>
        <span class="inspector-object-kind">BACKEND</span>
      </div>
      <dl class="inspector-fields">
        <InspectorPropertyField label="State Key" :value="replayInspector.stateKey" wide />
        <InspectorPropertyField label="Checkpoint" :value="String(replayInspector.checkpointIndex)" test-id="inspector-replay-checkpoint" />
        <InspectorPropertyField label="Confirmed SBar ID" :value="replayInspector.sbarId" test-id="inspector-replay-sbar-id" wide />
      </dl>
      <div class="inspector-subsection">
        <p class="section-index">CONFIRMED SBAR</p>
        <dl class="inspector-market-grid">
          <div><dt>OPEN</dt><dd>{{ replayInspector.sbar.open }}</dd></div>
          <div><dt>HIGH</dt><dd>{{ replayInspector.sbar.high }}</dd></div>
          <div><dt>CLOSE</dt><dd>{{ replayInspector.sbar.close }}</dd></div>
          <div><dt>LOW</dt><dd>{{ replayInspector.sbar.low }}</dd></div>
          <div class="inspector-volume"><dt>VOLUME</dt><dd>{{ replayInspector.sbar.volume }}</dd></div>
        </dl>
      </div>
      <div class="inspector-subsection" data-testid="inspector-replay-sbar-times">
        <p class="section-index">CONFIRMED SBAR TIMES · UTC</p>
        <dl class="inspector-fields">
          <InspectorPropertyField label="Event Time · UTC" :value="formatDomainTimestamp(replayInspector.sbar.tsEvent, timeframe)" :copy-value="replayInspector.sbar.tsEvent" test-id="inspector-replay-ts-event" wide />
          <InspectorPropertyField label="Init Time · UTC" :value="formatDomainTimestamp(replayInspector.sbar.tsInit, timeframe)" :copy-value="replayInspector.sbar.tsInit" test-id="inspector-replay-ts-init" wide />
        </dl>
      </div>
      <div v-if="replayInspector.structure" class="inspector-subsection" data-testid="inspector-replay-related-objects">
        <p class="section-index">RELATED OBJECTS</p>
        <dl class="inspector-fields">
          <InspectorPropertyField label="CBar Series" :value="String(replayInspector.structure.cbarCount)" test-id="inspector-replay-cbar-count" />
          <InspectorPropertyField label="Swing Series" :value="String(replayInspector.structure.swingCount)" test-id="inspector-replay-swing-count" />
        </dl>
        <p class="inspector-provenance">Structure counts are from the backend-confirmed checkpoint. Select a structure object on a chart when that chart exposes its authoritative geometry.</p>
      </div>
      <p class="inspector-provenance">SBar and structure values are read from the latest backend-confirmed Struxis checkpoint. The UI does not infer or mutate structure state.</p>
</template>
