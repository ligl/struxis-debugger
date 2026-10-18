import { ref } from "vue";
import { describeIpcError, listSnapshots } from "../origin-bridge";
import type { SnapshotArtifactDto } from "../origin-types";

export function useSnapshots() {
  const snapshots = ref<SnapshotArtifactDto[]>([]);
  const snapshotsLoading = ref(false);
  const snapshotsError = ref("");

  async function refreshSnapshots(): Promise<void> {
    if (snapshotsLoading.value) return;
    snapshotsLoading.value = true;
    snapshotsError.value = "";
    try {
      snapshots.value = await listSnapshots();
    } catch (error) {
      snapshotsError.value = describeIpcError(error);
    } finally {
      snapshotsLoading.value = false;
    }
  }

  return {
    snapshots,
    snapshotsLoading,
    snapshotsError,
    refreshSnapshots,
  };
}
