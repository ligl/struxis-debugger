import { ref } from "vue";
import { getReplayInspector } from "../origin-bridge";
import type { ReplayInspectorDto } from "../origin-types";

export function useReplayInspector() {
  const replayInspector = ref<ReplayInspectorDto | null>(null);
  const replayInspectorError = ref("");
  let loading = false;

  async function refresh(hasRun: boolean): Promise<void> {
    if (!hasRun) {
      replayInspector.value = null;
      replayInspectorError.value = "";
      return;
    }
    if (loading) return;

    loading = true;
    replayInspectorError.value = "";
    try {
      replayInspector.value = await getReplayInspector();
    } catch (error) {
      replayInspectorError.value = error instanceof Error ? error.message : String(error);
    } finally {
      loading = false;
    }
  }

  return {
    replayInspector,
    replayInspectorError,
    refresh,
  };
}
