import { ref } from "vue";
import { getReplayInspector } from "../origin-bridge";
import type { ReplayInspectorDto } from "../origin-types";

export function useReplayInspector() {
  const replayInspector = ref<ReplayInspectorDto | null>(null);
  const replayInspectorError = ref("");
  let loading = false;
  let requestGeneration = 0;

  async function refresh(hasRun: boolean): Promise<void> {
    if (!hasRun) {
      // Invalidate any outstanding read before clearing the visible state. A
      // late response from a disposed Run must not repopulate the Inspector.
      requestGeneration += 1;
      loading = false;
      replayInspector.value = null;
      replayInspectorError.value = "";
      return;
    }
    if (loading) return;

    loading = true;
    const generation = ++requestGeneration;
    replayInspectorError.value = "";
    try {
      const checkpoint = await getReplayInspector();
      if (generation === requestGeneration) {
        replayInspector.value = checkpoint;
      }
    } catch (error) {
      if (generation === requestGeneration) {
        replayInspectorError.value = error instanceof Error ? error.message : String(error);
      }
    } finally {
      // An obsolete request must not release the guard for a newer request.
      if (generation === requestGeneration) loading = false;
    }
  }

  return {
    replayInspector,
    replayInspectorError,
    refresh,
  };
}
