<script setup lang="ts">
import type { OriginDatasetDto, TestDatasetDto } from "../origin-types";
defineProps<{ origin: OriginDatasetDto | null; testDataset: TestDatasetDto | null; startSbarId: string; endSbarId: string; testLoading: boolean; canMutateTest: boolean; testError: string; testStatus: string; }>();
const emit = defineEmits<{ "update:startSbarId": [value: string]; "update:endSbarId": [value: string]; create: []; }>();
</script>

<template>
<section class="panel operations-panel">
        <div class="panel-heading">
          <div>
            <p class="section-index">03 / TEST INPUT</p>
            <h2>Test Dataset</h2>
          </div>
          <span class="status-label" :class="{ loaded: testDataset }">
            {{ testDataset ? "READY" : "NOT CREATED" }}
          </span>
        </div>

        <template v-if="origin">
          <p class="microcopy">Select an inclusive SBar ID interval from the validated Origin. IDs remain strings; the backend validates ordering and membership.</p>
          <div class="form-grid">
            <label class="form-field">
              <span>START SBAR ID</span>
              <input :value="startSbarId" @input="emit('update:startSbarId', ($event.target as HTMLInputElement).value)" type="text" autocomplete="off" :disabled="testLoading || !canMutateTest" />
            </label>
            <label class="form-field">
              <span>END SBAR ID</span>
              <input :value="endSbarId" @input="emit('update:endSbarId', ($event.target as HTMLInputElement).value)" type="text" autocomplete="off" :disabled="testLoading || !canMutateTest" />
            </label>
          </div>
          <button
            class="action-button action-primary"
            :disabled="testLoading || !canMutateTest || !startSbarId.trim() || !endSbarId.trim()"
            @click="emit('create')"
          >
            {{ testLoading ? "VALIDATING INTERVAL…" : testDataset ? "REPLACE TEST DATASET" : "CREATE TEST DATASET" }}
          </button>
          <p v-if="!canMutateTest" class="microcopy">Dispose the current Run before replacing its Test Dataset.</p>
        </template>
        <p v-else class="empty-state">Load a validated Origin before selecting a Test interval.</p>

        <p v-if="testError" class="error-message">{{ testError }}</p>
        <p v-else-if="testStatus" class="success-message">{{ testStatus }}</p>

        <div v-if="testDataset" class="detail-list">
          <div><span>TEST DATASET ID</span><code>{{ testDataset.testDatasetId }}</code></div>
          <div><span>ORIGIN ID</span><code>{{ testDataset.originDatasetId }}</code></div>
          <div><span>VALIDATED RANGE</span><code>{{ testDataset.startSbarId }} → {{ testDataset.endSbarId }}</code></div>
          <div><span>SBAR COUNT</span><strong>{{ testDataset.sbarCount.toLocaleString() }}</strong></div>
          <div><span>SEQUENCE FINGERPRINT</span><code>{{ testDataset.sbarSequenceFingerprint }}</code></div>
        </div>
      </section>
</template>
