<script setup lang="ts">
import type { ReplayInspectorDto } from "../origin-types";
import { formatDomainTimestamp } from "../timestamp-format";

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
        <div class="inspector-field inspector-field-wide">
          <dt>State Key</dt>
          <dd><code>{{ replayInspector.stateKey }}</code></dd>
        </div>
        <div class="inspector-field">
          <dt>Checkpoint</dt>
          <dd><code data-testid="inspector-replay-checkpoint">{{ replayInspector.checkpointIndex }}</code></dd>
        </div>
        <div class="inspector-field inspector-field-wide">
          <dt>Confirmed SBar ID</dt>
          <dd><code data-testid="inspector-replay-sbar-id">{{ replayInspector.sbarId }}</code></dd>
        </div>
      </dl>
      <div class="inspector-subsection">
        <p class="section-index">CONFIRMED SBAR</p>
        <dl class="inspector-market-grid">
          <div><dt>OPEN</dt><dd>{{ replayInspector.sbar.open }}</dd></div>
          <div><dt>HIGH</dt><dd>{{ replayInspector.sbar.high }}</dd></div>
          <div><dt>LOW</dt><dd>{{ replayInspector.sbar.low }}</dd></div>
          <div><dt>CLOSE</dt><dd>{{ replayInspector.sbar.close }}</dd></div>
          <div class="inspector-volume"><dt>VOLUME</dt><dd>{{ replayInspector.sbar.volume }}</dd></div>
        </dl>
      </div>
      <div class="inspector-subsection" data-testid="inspector-replay-sbar-times">
        <p class="section-index">CONFIRMED SBAR TIMES · UTC</p>
        <dl class="inspector-fields">
          <div class="inspector-field inspector-field-wide">
            <dt>Event Time · UTC</dt>
            <dd><code data-testid="inspector-replay-ts-event" :data-copy-value="replayInspector.sbar.tsEvent">{{ formatDomainTimestamp(replayInspector.sbar.tsEvent, timeframe) }}</code></dd>
          </div>
          <div class="inspector-field inspector-field-wide">
            <dt>Init Time · UTC</dt>
            <dd><code data-testid="inspector-replay-ts-init" :data-copy-value="replayInspector.sbar.tsInit">{{ formatDomainTimestamp(replayInspector.sbar.tsInit, timeframe) }}</code></dd>
          </div>
        </dl>
      </div>
      <div v-if="replayInspector.structure" class="inspector-subsection" data-testid="inspector-replay-related-objects">
        <p class="section-index">RELATED OBJECTS</p>
        <dl class="inspector-fields">
          <div class="inspector-field">
            <dt>CBar Series</dt>
            <dd><code data-testid="inspector-replay-cbar-count">{{ replayInspector.structure.cbarCount }}</code></dd>
          </div>
          <div class="inspector-field">
            <dt>Swing Series</dt>
            <dd><code data-testid="inspector-replay-swing-count">{{ replayInspector.structure.swingCount }}</code></dd>
          </div>
        </dl>
        <p class="inspector-provenance">Structure counts are from the backend-confirmed checkpoint. Select a structure object on a chart when that chart exposes its authoritative geometry.</p>
      </div>
      <p class="inspector-provenance">SBar and structure values are read from the latest backend-confirmed Struxis checkpoint. The UI does not infer or mutate structure state.</p>
</template>
