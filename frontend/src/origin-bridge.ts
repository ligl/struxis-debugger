import { invoke } from "@tauri-apps/api/core";
import type { CatalogDatasetEntry, OriginDatasetDto } from "./origin-types";

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

export function describeIpcError(error: unknown): string {
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.length > 0) return message;
  }
  return "The operation failed without a diagnostic message.";
}
