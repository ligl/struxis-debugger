export interface CatalogDatasetEntry {
  id: string;
  barType: string | null;
  instrumentId: string | null;
  timeframe: string | null;
  available: boolean;
  diagnostic: string | null;
}

export interface SBarDto {
  sbarId: string;
  barType: string;
  tsEvent: string;
  tsInit: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
}

export interface OriginDatasetDto {
  originDatasetId: string;
  sourceCatalog: string;
  enableStructure: boolean;
  instrumentId: string;
  barType: string;
  timeframe: string;
  sbarSequenceFingerprint: string;
  sbarCount: number;
  firstSbarId: string;
  lastSbarId: string;
  firstTsEvent: string;
  lastTsEvent: string;
  bars: SBarDto[];
}

export interface TestDatasetDto {
  testDatasetId: string;
  originDatasetId: string;
  instrumentId: string;
  barType: string;
  timeframe: string;
  startSbarId: string;
  endSbarId: string;
  sbarCount: number;
  sbarSequenceFingerprint: string;
}

export interface IpcError {
  code: "invalid_argument" | "not_found" | "conflict" | "invalid_state" | "internal";
  message: string;
}

export type RunStatus =
  | "ready"
  | "running"
  | "paused"
  | "completed"
  | "failed"
  | "disposed";

export interface RunStateDto {
  runId: string;
  testDatasetId: string;
  inputFingerprint: string;
  inputCount: number;
  status: RunStatus;
  processedCount: number;
  cursorSbarId: string | null;
  failureDiagnostic: string | null;
}

export type SnapshotArtifactKind =
  | "complete"
  | "invalidPublished"
  | "recordingTemporary"
  | "finalizingTemporary"
  | "failedTemporary"
  | "completeButUnpublished"
  | "unreadableTemporary";

export interface SnapshotArtifactDto {
  fileName: string;
  path: string;
  kind: SnapshotArtifactKind;
  snapshotId: string | null;
  runId: string | null;
  stateKey: string | null;
  generatedAt: string | null;
  checkpointCount: number | null;
  diagnostic: string | null;
}

export type CompareRejectCategory =
  | "inputMismatch"
  | "snapshotUnreadable"
  | "snapshotIncomplete"
  | "snapshotIntegrityFailure"
  | "checkpointTrajectoryConflict"
  | "stateReconstructionFailure"
  | "unknown";

export interface CompareRejectionDto {
  category: CompareRejectCategory;
  message: string;
}

export interface SnapshotCompareMetadataDto {
  snapshotId: string;
  runId: string;
  stateKey: string;
  instrumentId: string;
  barType: string;
  snapshotGeneratedAt: string;
  inputBarCount: number;
  sbarSequenceFingerprint: string;
  configFingerprint: string;
  effectiveConfig: string;
}

export interface CheckpointCompareSummaryDto {
  checkpointIndex: number;
  sbarId: string;
  tsEvent: string;
  differenceCount: number;
}

export interface PropertyDifferenceDto {
  field: string;
  baselineValue: unknown | null;
  candidateValue: unknown | null;
}

export interface ObjectDifferenceDto {
  checkpointIndex: number;
  sbarId: string;
  objectType: string;
  kind: "added" | "removed" | "modified" | "unmatched";
  objectId: string | null;
  properties: PropertyDifferenceDto[];
}

export interface DiagnosticsDifferenceDto {
  checkpointIndex: number;
  sbarId: string;
  baseline: unknown;
  candidate: unknown;
}

export interface SnapshotCompareResultDto {
  baseline: SnapshotCompareMetadataDto;
  candidate: SnapshotCompareMetadataDto;
  checkpointCount: number;
  checkpoints: CheckpointCompareSummaryDto[];
  differences: ObjectDifferenceDto[];
  firstStructuralDivergence: CheckpointCompareSummaryDto | null;
  diagnosticsDifferences: DiagnosticsDifferenceDto[];
  firstDiagnosticsDivergence: number | null;
}
