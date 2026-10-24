export interface CatalogDatasetEntry {
  id: string;
  barType: string | null;
  instrumentId: string | null;
  timeframe: string | null;
  available: boolean;
  diagnostic: string | null;
}

export interface ReplayChartViewportSync {
  revision: number;
  source: "live" | "reference";
  /** Raw logical range in the source chart's own coordinate system. */
  from: number;
  to: number;
  /** Snapshot logical index of Live SBar index 0; Snapshot = Live + offset. */
  offset: number;
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
  structure: ReplayInspectorStructureDto | null;
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

export interface ReplayStepResultDto {
  runState: RunStateDto;
  inspector: ReplayInspectorDto | null;
}

export interface ReplayInspectorSBarDto {
  sbarId: string;
  barType: string;
  tsEvent: string;
  tsInit: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  body: string;
  upperShadow: string;
  lowerShadow: string;
  totalRange: string;
  bodyRatio: number;
  shadowRatio: number;
  direction: string;
}

export interface ReplayInspectorCBarDto {
  cbarId: string;
  high: string;
  low: string;
  sbarStartId: string;
  sbarEndId: string;
  spanSbars: number;
  fractalType: string | null;
  createdAt: string;
}

export interface ReplayInspectorSwingDto {
  swingId: string;
  direction: string;
  high: string;
  low: string;
  cbarStartId: string;
  cbarEndId: string;
  sbarStartId: string;
  sbarEndId: string;
  startOi: string | null;
  endOi: string | null;
  volume: string;
  spanSbars: number;
  state: string;
  createdAt: string;
  updatedAt: string;
}

export type OriginObjectSelection =
  | { kind: "sbar"; id: string; originDatasetId: string }
  | { kind: "cbar"; id: string; originDatasetId: string }
  | { kind: "swing"; id: string; originDatasetId: string };

/**
 * Inspector input is workspace-scoped: a selected domain object, a confirmed
 * Replay checkpoint summary, or a Compare difference are distinct contexts.
 * Compare differences intentionally do not masquerade as domain selections.
 */
export type InspectorWorkspaceContext =
  | {
      workspace: "dataset";
      originDatasetId: string | null;
      timeframe: string | null;
      structureEnabled: boolean;
      selectedObject:
        | { kind: "sbar"; object: SBarDto }
        | { kind: "cbar"; object: ReplayInspectorCBarDto }
        | { kind: "swing"; object: ReplayInspectorSwingDto }
        | null;
    }
  | {
      workspace: "replay";
      timeframe: string | null;
      checkpoint: ReplayInspectorDto | null;
      selectedObject:
        | { kind: "sbar"; object: SBarDto | ReplayInspectorSBarDto; source: "input" | "checkpoint" }
        | { kind: "cbar"; object: ReplayInspectorCBarDto }
        | { kind: "swing"; object: ReplayInspectorSwingDto }
        | null;
      error: string;
    }
  | {
      workspace: "compare";
      difference: ObjectDifferenceDto | null;
      baselineSnapshotId: string | null;
      candidateSnapshotId: string | null;
    };

export interface ReplayInspectorStructureDto {
  cbarCount: number;
  cbars: ReplayInspectorCBarDto[];
  swingCount: number;
  swings: ReplayInspectorSwingDto[];
}

export type ReplayChartSelection = {
  kind: "sbar" | "cbar" | "swing";
  id: string;
  checkpointSbarId: string | null;
};

export interface ReplayInspectorDto {
  stateKey: string;
  checkpointIndex: number;
  sbarId: string;
  sbar: ReplayInspectorSBarDto;
  structure: ReplayInspectorStructureDto | null;
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
  instrumentId?: string | null;
  barType?: string | null;
  inputStartTsEvent?: string | null;
  inputEndTsEvent?: string | null;
  generatedAt: string | null;
  checkpointCount: number | null;
  diagnostic: string | null;
}

export interface SnapshotReferenceDto {
  snapshotId: string;
  runId: string;
  instrumentId: string;
  barType: string;
  timeframe: string;
  snapshotGeneratedAt: string;
  sbarSequenceFingerprint: string;
  bars: SBarDto[];
  structure: ReplayInspectorStructureDto;
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

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface PropertyDifferenceDto {
  field: string;
  baselineValue: JsonValue;
  candidateValue: JsonValue;
}

export interface ObjectDifferenceDto {
  checkpointIndex: number;
  sbarId: string;
  objectType: string;
  kind: "added" | "removed" | "modified";
  objectId: string;
  properties: PropertyDifferenceDto[];
}

export interface DiagnosticDto {
  source: string;
  severity: string;
  category: string;
  objectType: string | null;
  objectId: string | null;
  sbarIds: string[];
  checkpointIndex: number | null;
  message: string;
}

export interface DiagnosticsDifferenceDto {
  checkpointIndex: number;
  sbarId: string;
  baseline: DiagnosticDto[];
  candidate: DiagnosticDto[];
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
