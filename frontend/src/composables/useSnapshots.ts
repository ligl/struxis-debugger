import { ref } from "vue";
import { describeIpcError, listSnapshots } from "../origin-bridge";
import type { SnapshotArtifactDto } from "../origin-types";

export function useSnapshots() {
  const snapshots = ref<SnapshotArtifactDto[]>([]);
  const snapshotsLoading = ref(false);
  const snapshotsError = ref("");
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
