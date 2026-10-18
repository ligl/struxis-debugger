<script setup lang="ts">
import type { OriginDatasetDto } from "../origin-types";
defineProps<{ origin: OriginDatasetDto | null; loadStatus: "idle" | "loading" | "loaded" | "failed"; loadError: string; previewBars: OriginDatasetDto["bars"]; formatTimestamp: (value: string | null) => string; }>();
</script>

<template>
<section class="panel result-panel">
        <div class="panel-heading">
          <div>
            <p class="section-index">02 / RESULT</p>
            <h2>Current Origin</h2>
          </div>
          <span class="status-label" :class="loadStatus">
            {{ loadStatus === "loading" ? "LOADING" : loadStatus === "loaded" ? "LATEST LOAD OK" : loadStatus === "failed" ? "LATEST LOAD FAILED" : "SESSION STATE" }}
          </span>
        </div>

        <div v-if="loadError" class="error-message load-error">
          <strong>Latest attempt diagnostic</strong>
          <span>{{ loadError }}</span>
          <small v-if="origin">The previous Origin remains available and unchanged.</small>
        </div>

        <template v-if="origin">
          <div class="origin-identity">
            <span class="field-label">ORIGIN DATASET ID</span>
            <code>{{ origin.originDatasetId }}</code>
            <span class="field-label">SEQUENCE FINGERPRINT · SHA-256</span>
            <code class="fingerprint">{{ origin.sbarSequenceFingerprint }}</code>
          </div>

          <div class="metric-grid">
            <div class="metric">
              <span>SBAR COUNT</span>
              <strong>{{ origin.sbarCount.toLocaleString() }}</strong>
            </div>
            <div class="metric">
              <span>INSTRUMENT</span>
              <strong>{{ origin.instrumentId }}</strong>
            </div>
            <div class="metric">
              <span>BAR TYPE</span>
              <strong>{{ origin.barType }}</strong>
            </div>
            <div class="metric">
              <span>STRUCTURE</span>
              <strong>{{ origin.enableStructure ? "ENABLED" : "DISABLED" }}</strong>
            </div>
          </div>

          <div class="range-summary">
            <div>
              <span class="field-label">FIRST SBAR · EVENT TIME</span>
              <strong>{{ origin.firstSbarId }}</strong>
              <small>{{ formatTimestamp(origin.firstTsEvent) }}</small>
            </div>
            <div>
              <span class="field-label">LAST SBAR · EVENT TIME</span>
              <strong>{{ origin.lastSbarId }}</strong>
              <small>{{ formatTimestamp(origin.lastTsEvent) }}</small>
            </div>
          </div>

          <div class="table-heading">
            <div>
              <p class="section-index">VALIDATED PROJECTION</p>
              <h3>Oldest-first SBar sample</h3>
            </div>
            <span>{{ previewBars.length }} / {{ origin.sbarCount.toLocaleString() }} shown</span>
          </div>
          <div class="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>SBar ID / ts_event</th>
                  <th>Open</th>
                  <th>High</th>
                  <th>Low</th>
                  <th>Close</th>
                  <th>Volume</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="bar in previewBars" :key="bar.sbarId">
                  <td class="timestamp-cell">{{ bar.sbarId }}</td>
                  <td>{{ bar.open }}</td>
                  <td>{{ bar.high }}</td>
                  <td>{{ bar.low }}</td>
                  <td>{{ bar.close }}</td>
                  <td>{{ bar.volume }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p class="source-note">Source: {{ origin.sourceCatalog }} · Values are copied from the validated Struxis SBar series.</p>
        </template>

        <div v-else class="no-origin">
          <span class="no-origin-glyph">∅</span>
          <h3>No validated Origin Dataset</h3>
          <p>Choose an available Catalog stream and load it. An Origin is published only after processing, complete SBar validation, and runtime cleanup succeed.</p>
        </div>
      </section>
</template>
