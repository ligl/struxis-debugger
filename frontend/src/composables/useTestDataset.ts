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
  const testLoading = ref(false);
  const testError = ref("");
  const testStatus = ref("");
  let refreshGeneration = 0;

  function prepareForOrigin(_loadedOrigin: OriginDatasetDto): void {
    // Invalidate any startup/session refresh that began before this Origin handoff.
    refreshGeneration += 1;
    testDataset.value = null;
  }

  async function refreshCurrentTestDataset(): Promise<TestDatasetDto | null> {
    const generation = ++refreshGeneration;
    testError.value = "";
    try {
      const current = await getCurrentTestDataset();
      if (generation !== refreshGeneration) return null;
      testDataset.value = current;
      return current;
    } catch (error) {
      // Stale failures must not replace the diagnostic for a newer request.
      if (generation === refreshGeneration) testError.value = describeIpcError(error);
      return null;
    }
  }

  async function createTestDataset(startSbarId: string, endSbarId: string): Promise<void> {
    if (testLoading.value || !origin.value || !canMutate.value) return;
    testLoading.value = true;
    // Invalidate reads that began before this mutation takes ownership.
    refreshGeneration += 1;
    testError.value = "";
    testStatus.value = "";
    try {
      const created = await createTestDatasetIpc(
        startSbarId.trim(),
        endSbarId.trim(),
      );
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
    testLoading,
    testError,
    testStatus,
    prepareForOrigin,
    refreshCurrentTestDataset,
    createTestDataset,
  };
}
