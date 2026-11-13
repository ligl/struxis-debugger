import type { Ref } from "vue";
import { createFixedPriceRange, createKeyZoneObservation, cancelKeyZoneObservation, describeIpcError } from "../origin-bridge";
import type { CreateFixedPriceRangeDto, FixedPriceRangeResultDto, CreateObservationDto, CancelObservationDto, ObservationCommandResultDto, ReplayInspectorDto, RunStateDto } from "../origin-types";

export function useKeyZoneObservations(
  run: Ref<RunStateDto | null>,
  busy: Ref<boolean>,
  runBusy: Readonly<Ref<boolean>>,
  inspector: Ref<ReplayInspectorDto | null>,
) {
  async function submit<T extends CreateObservationDto | CancelObservationDto | CreateFixedPriceRangeDto, R extends { inspector: ReplayInspectorDto }>(
    request: T,
    invoke: (request: T) => Promise<R>,
  ): Promise<R> {
    if (runBusy.value || run.value?.status !== "paused") throw new Error("Pause the Run and wait for the current operation to finish.");
    const { runId, expectedSbarId } = request.context;
    if (run.value.runId !== runId || run.value.cursorSbarId !== expectedSbarId) throw new Error("Run changed. Select the current KeyZone again.");
    busy.value = true;
    try {
      const result = await invoke(request);
      if (run.value?.runId !== runId || run.value.cursorSbarId !== expectedSbarId) throw new Error("Run changed before the operation returned. Refresh its current state.");
      inspector.value = result.inspector;
      return result;
    } catch (error) {
      throw new Error(describeIpcError(error));
    } finally {
      busy.value = false;
    }
  }
  return {
    createFixed: (request: CreateFixedPriceRangeDto): Promise<FixedPriceRangeResultDto> => submit(request, createFixedPriceRange),
    create: (request: CreateObservationDto) => submit(request, createKeyZoneObservation),
    cancel: (request: CancelObservationDto) => submit(request, cancelKeyZoneObservation),
  };
}
