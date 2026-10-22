import { ref } from "vue";
import { compareSnapshots, describeIpcError } from "../origin-bridge";
import type { SnapshotCompareResultDto } from "../origin-types";

/** Owns the Compare command lifecycle and the authoritative comparison result. */
export function useCompareWorkspace() {
  const compareResult = ref<SnapshotCompareResultDto | null>(null);
  const compareLoading = ref(false);
  const compareError = ref("");

  async function runCompare(baselineSnapshotId: string, candidateSnapshotId: string): Promise<void> {
    if (compareLoading.value) return;
    compareLoading.value = true;
    compareError.value = "";
    compareResult.value = null;
    try {
      compareResult.value = await compareSnapshots(baselineSnapshotId, candidateSnapshotId);
    } catch (error) {
      compareError.value = describeIpcError(error);
    } finally {
      compareLoading.value = false;
    }
  }

  return {
    compareResult,
    compareLoading,
    compareError,
    runCompare,
  };
}
