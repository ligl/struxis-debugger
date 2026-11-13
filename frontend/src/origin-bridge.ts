import { invoke } from "@tauri-apps/api/core";
import type { CreateFixedPriceRangeDto, FixedPriceRangeResultDto, CreateObservationDto, CancelObservationDto, ObservationCommandResultDto } from "./origin-types";

export function createFixedPriceRange(request: CreateFixedPriceRangeDto): Promise<FixedPriceRangeResultDto> {
  return invoke("create_fixed_price_range", { request });
}

export function createKeyZoneObservation(request: CreateObservationDto): Promise<ObservationCommandResultDto> {
  return invoke("create_keyzone_observation", { request });
}

export function cancelKeyZoneObservation(request: CancelObservationDto): Promise<ObservationCommandResultDto> {
  return invoke("cancel_keyzone_observation", { request });
}
import type { CatalogDatasetEntry, OriginDatasetDto, ReplayInspectorDto, ReplayStepResultDto, RunStateDto, SnapshotArtifactDto, SnapshotCompareResultDto, SnapshotReferenceDto, TestDatasetDto } from "./origin-types";

export function listCatalogDatasets(): Promise<CatalogDatasetEntry[]> {
  return invoke<CatalogDatasetEntry[]>("list_catalog_datasets");
}

export function loadOrigin(
  datasetId: string,
  enableStructure: boolean,
): Promise<OriginDatasetDto> {
  return invoke<OriginDatasetDto>("load_origin", {
    datasetId,
    enableStructure,
  });
}

export function getCurrentOrigin(): Promise<OriginDatasetDto | null> {
  return invoke<OriginDatasetDto | null>("get_current_origin");
}

export function createTestDataset(
  startSbarId: string,
  endSbarId: string,
): Promise<TestDatasetDto> {
  return invoke<TestDatasetDto>("create_test_dataset", {
    startSbarId,
    endSbarId,
  });
}

export function getCurrentTestDataset(): Promise<TestDatasetDto | null> {
  return invoke<TestDatasetDto | null>("get_current_test_dataset");
}

export function describeIpcError(error: unknown): string {
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.length > 0) return message;
  }
  return "The operation failed without a diagnostic message.";
}

export function listSnapshots(): Promise<SnapshotArtifactDto[]> {
  return invoke<SnapshotArtifactDto[]>("list_snapshots");
}

export function saveRunSnapshot(): Promise<string> {
  return invoke<string>("save_run_snapshot");
}

export function getSnapshotReference(snapshotId: string): Promise<SnapshotReferenceDto> {
  return invoke<SnapshotReferenceDto>("get_snapshot_reference", { snapshotId });
}

export function getSnapshotReferenceCheckpoint(snapshotId: string, sbarId: string): Promise<import("./origin-types").SnapshotStructureCheckpointDto> {
  return invoke("get_snapshot_reference_checkpoint", { snapshotId, sbarId });
}

export function getSnapshotReferenceObject(snapshotId: string, kind: "cbar" | "swing" | "trend", objectId: string): Promise<import("./origin-types").SnapshotStructureCheckpointDto | null> {
  return invoke("get_snapshot_reference_object", { snapshotId, kind, objectId });
}

export function compareSnapshots(
  baselineSnapshotId: string,
  candidateSnapshotId: string,
): Promise<SnapshotCompareResultDto> {
  return invoke<SnapshotCompareResultDto>("compare_snapshots", {
    baselineSnapshotId,
    candidateSnapshotId,
  });
}

export function startRun(): Promise<RunStateDto> {
  return invoke<RunStateDto>("start_run");
}

export function restartRun(): Promise<RunStateDto> {
  return invoke<RunStateDto>("restart_run");
}

export function restartToSBar(targetSbarId: string): Promise<ReplayStepResultDto> {
  return invoke<ReplayStepResultDto>("restart_to_sbar", { targetSbarId });
}

export function getRunState(): Promise<RunStateDto | null> {
  return invoke<RunStateDto | null>("get_run_state");
}

export function getReplayInspector(): Promise<ReplayInspectorDto | null> {
  return invoke<ReplayInspectorDto | null>("get_replay_inspector");
}

export function stepRun(): Promise<ReplayStepResultDto> {
  return invoke<ReplayStepResultDto>("step_run");
}

export function stopRun(): Promise<RunStateDto> {
  return invoke<RunStateDto>("stop_run");
}

export function disposeRun(): Promise<RunStateDto> {
  return invoke<RunStateDto>("dispose_run");
}

export function resetRun(): Promise<void> {
  return invoke<void>("reset_run");
}
