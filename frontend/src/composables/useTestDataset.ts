import { computed, ref, type ComputedRef, type Ref } from "vue";
import {
  createTestDataset as createTestDatasetIpc,
  describeIpcError,
  getCurrentTestDataset,
} from "../origin-bridge";
import type { OriginDatasetDto, TestDatasetDto } from "../origin-types";

export function useTestDataset(
  origin: Ref<OriginDatasetDto | null>,
  canMutate: ComputedRef<boolean>,
) {
  const testDataset = ref<TestDatasetDto | null>(null);
  const startSbarId = ref("");
  const endSbarId = ref("");
  const testLoading = ref(false);
  const testError = ref("");
  const testStatus = ref("");
  let refreshGeneration = 0;

  function prepareForOrigin(loadedOrigin: OriginDatasetDto): void {
    // Invalidate any startup/session refresh that began before this Origin handoff.
    refreshGeneration += 1;
    testDataset.value = null;
    startSbarId.value = loadedOrigin.firstSbarId;
    endSbarId.value = loadedOrigin.lastSbarId;
  }

  async function refreshCurrentTestDataset(): Promise<void> {
    const generation = ++refreshGeneration;
    testError.value = "";
    try {
      const current = await getCurrentTestDataset();
      if (generation !== refreshGeneration) return;

      testDataset.value = current;
      if (current) {
        startSbarId.value = current.startSbarId;
        endSbarId.value = current.endSbarId;
      } else if (origin.value) {
        startSbarId.value = origin.value.firstSbarId;
        endSbarId.value = origin.value.lastSbarId;
      } else {
        startSbarId.value = "";
        endSbarId.value = "";
      }
    } catch (error) {
      // Stale failures must not replace the diagnostic for a newer request.
      if (generation === refreshGeneration) {
        testError.value = describeIpcError(error);
      }
    }
  }

  async function createTestDataset(): Promise<void> {
    if (testLoading.value || !origin.value || !canMutate.value) return;
    testLoading.value = true;
    testError.value = "";
    testStatus.value = "";
    try {
      const created = await createTestDatasetIpc(
        startSbarId.value.trim(),
        endSbarId.value.trim(),
      );
      // A refresh started while creation was in flight cannot replace this result.
      refreshGeneration += 1;
      testDataset.value = created;
      testError.value = "";
      testStatus.value = "Test Dataset created from the backend-validated SBar interval.";
    } catch (error) {
      testError.value = describeIpcError(error);
    } finally {
      testLoading.value = false;
    }
  }

  return {
    testDataset,
    startSbarId,
    endSbarId,
    testLoading,
    testError,
    testStatus,
    prepareForOrigin,
    refreshCurrentTestDataset,
    createTestDataset,
  };
}
