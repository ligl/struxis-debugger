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

  function prepareForOrigin(loadedOrigin: OriginDatasetDto): void {
    testDataset.value = null;
    startSbarId.value = loadedOrigin.firstSbarId;
    endSbarId.value = loadedOrigin.lastSbarId;
  }

  async function refreshCurrentTestDataset(): Promise<void> {
    testError.value = "";
    try {
      testDataset.value = await getCurrentTestDataset();
      if (testDataset.value) {
        startSbarId.value = testDataset.value.startSbarId;
        endSbarId.value = testDataset.value.endSbarId;
      } else if (origin.value) {
        startSbarId.value = origin.value.firstSbarId;
        endSbarId.value = origin.value.lastSbarId;
      } else {
        startSbarId.value = "";
        endSbarId.value = "";
      }
    } catch (error) {
      testError.value = describeIpcError(error);
    }
  }

  async function createTestDataset(): Promise<void> {
    if (testLoading.value || !origin.value || !canMutate.value) return;
    testLoading.value = true;
    testError.value = "";
    testStatus.value = "";
    try {
      testDataset.value = await createTestDatasetIpc(
        startSbarId.value.trim(),
        endSbarId.value.trim(),
      );
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
