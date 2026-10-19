import { ref } from "vue";
import { compareSnapshots as compareSnapshotsIpc, describeIpcError, listSnapshots } from "../origin-bridge";
import type { SnapshotArtifactDto, SnapshotCompareResultDto } from "../origin-types";

export function useSnapshots() {
  const snapshots = ref<SnapshotArtifactDto[]>([]);
  const snapshotsLoading = ref(false);
  const snapshotsError = ref("");
  const compareResult = ref<SnapshotCompareResultDto | null>(null);
  const compareLoading = ref(false);
  const compareError = ref("");

  async function runCompare(baselineSnapshotId: string, candidateSnapshotId: string): Promise<void> {
    if (compareLoading.value) return;
    compareLoading.value = true;
    compareError.value = "";
    compareResult.value = null;
    try {
      compareResult.value = await compareSnapshotsIpc(baselineSnapshotId, candidateSnapshotId);
    } catch (error) {
      compareError.value = describeIpcError(error);
    } finally {
      compareLoading.value = false;
    }
  }

  let refreshPromise: Promise<void> | null = null;
  let refreshRequested = false;

  function refreshSnapshots(): Promise<void> {
    if (refreshPromise) {
      // Coalesce overlapping requests, but guarantee one more read after the
      // active request so a Run-triggered refresh cannot be silently dropped.
      refreshRequested = true;
      return refreshPromise;
    }

    refreshPromise = (async () => {
      do {
        refreshRequested = false;
        snapshotsLoading.value = true;
        snapshotsError.value = "";
        try {
          snapshots.value = await listSnapshots();
        } catch (error) {
          snapshotsError.value = describeIpcError(error);
        } finally {
          snapshotsLoading.value = false;
        }
      } while (refreshRequested);
    })().finally(() => {
      refreshPromise = null;
    });

    return refreshPromise;
  }

  return {
    snapshots,
    snapshotsLoading,
    snapshotsError,
    refreshSnapshots,
  };
}
