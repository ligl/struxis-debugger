<script setup lang="ts">
import type { SBarDto } from "../origin-types";

defineProps<{
  selectedSbar: SBarDto | null;
  originDatasetId: string | null;
  workspaceMode: "dataset" | "replay" | "compare";
}>();
</script>

<template>
  <section class="inspector-object" data-testid="inspector-object">
    <template v-if="workspaceMode === 'dataset' && selectedSbar">
      <div class="inspector-object-heading">
        <div>
          <p class="section-index">SELECTED INPUT OBJECT</p>
          <h3>SBar</h3>
        </div>
        <span class="inspector-object-kind">SOURCE DATA</span>
      </div>

      <dl class="inspector-fields">
        <div class="inspector-field inspector-field-wide">
          <dt>SBar ID</dt>
          <dd><code data-testid="inspector-sbar-id" :title="selectedSbar.sbarId">{{ selectedSbar.sbarId }}</code></dd>
        </div>
        <div class="inspector-field inspector-field-wide">
          <dt>Origin Dataset</dt>
          <dd><code :title="originDatasetId ?? ''">{{ originDatasetId ?? "—" }}</code></dd>
        </div>
        <div class="inspector-field inspector-field-wide">
          <dt>Bar Type</dt>
          <dd><code :title="selectedSbar.barType">{{ selectedSbar.barType }}</code></dd>
        </div>
        <div class="inspector-field inspector-field-wide">
          <dt>Event Timestamp (ns)</dt>
          <dd><code>{{ selectedSbar.tsEvent }}</code></dd>
        </div>
        <div class="inspector-field inspector-field-wide">
          <dt>Init Timestamp (ns)</dt>
          <dd><code>{{ selectedSbar.tsInit }}</code></dd>
        </div>
      </dl>

      <div class="inspector-subsection">
        <p class="section-index">MARKET FIELDS</p>
        <dl class="inspector-market-grid">
          <div><dt>OPEN</dt><dd data-testid="inspector-sbar-open">{{ selectedSbar.open }}</dd></div>
          <div><dt>HIGH</dt><dd data-testid="inspector-sbar-high">{{ selectedSbar.high }}</dd></div>
          <div><dt>LOW</dt><dd data-testid="inspector-sbar-low">{{ selectedSbar.low }}</dd></div>
          <div><dt>CLOSE</dt><dd data-testid="inspector-sbar-close">{{ selectedSbar.close }}</dd></div>
          <div class="inspector-volume"><dt>VOLUME</dt><dd data-testid="inspector-sbar-volume">{{ selectedSbar.volume }}</dd></div>
        </dl>
      </div>
      <p class="inspector-provenance">Values shown verbatim from the validated Origin SBar projection. No domain fields are inferred in the UI.</p>
    </template>

    <div v-else-if="workspaceMode === 'dataset'" class="inspector-empty" data-testid="inspector-empty">
      <span class="placeholder-mark">S/</span>
      <h3>Object Inspector</h3>
      <p>Select an SBar on the Origin chart to inspect its exact identity, timestamps and market fields.</p>
      <small>Authoritative Origin data only</small>
    </div>

    <div v-else class="inspector-empty" data-testid="inspector-empty">
      <span class="placeholder-mark">[ ]</span>
      <h3>Object Inspector</h3>
      <p>Structural-object selection for {{ workspaceMode === 'replay' ? 'Replay' : 'Compare' }} is not connected to an authoritative object projection yet.</p>
      <small>No inferred or fabricated domain state is displayed.</small>
    </div>
  </section>
</template>
