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

export interface ReplayChartCrosshairSync {
  revision: number;
  source: "live" | "reference";
  /** Stable SBar identity shared by the eligible Live and Snapshot sequences. */
  sbarId: string | null;
  /** Source-chart price at the pointer; each chart projects it independently. */
  price: number | null;
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
  keyzones?: KeyZoneCheckpointDto | null;
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

export interface ReplayInspectorTrendDto {
  trendId: string;
  direction: string;
  high: string;
  low: string;
  swingStartId: string;
  swingEndId: string;
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
  | { kind: "swing"; id: string; originDatasetId: string }
  | { kind: "trend"; id: string; originDatasetId: string }
  | { kind: "keyzone"; id: string; originDatasetId: string };

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
        | { kind: "keyzone"; object: KeyZoneDto; registry: KeyZoneCheckpointDto }
        | { kind: "trend"; object: ReplayInspectorTrendDto }
        | null;
    }
  | {
      workspace: "replay";
      timeframe: string | null;
      checkpoint: ReplayInspectorDto | null;
      selectedObject:
        | { kind: "sbar"; object: SBarDto | ReplayInspectorSBarDto; source: "input" | "checkpoint" | "snapshot" }
        | { kind: "cbar"; object: ReplayInspectorCBarDto; source?: "checkpoint" | "snapshot" }
        | { kind: "swing"; object: ReplayInspectorSwingDto; source?: "checkpoint" | "snapshot" }
        | { kind: "keyzone"; object: KeyZoneDto; registry: KeyZoneCheckpointDto; source?: "checkpoint" | "snapshot" }
        | { kind: "trend"; object: ReplayInspectorTrendDto; source?: "checkpoint" | "snapshot" }
        | null;
      snapshotId: string | null;
      snapshotLabel?: string | null;
      snapshotBars: SBarDto[];
      snapshotStructure: ReplayInspectorStructureDto | null;
      error: string;
    }
  | {
      workspace: "compare";
      difference: ObjectDifferenceDto | null;
      baselineSnapshotId: string | null;
      candidateSnapshotId: string | null;
    };

export interface ReplayInspectorFeatureElementDto {
  /** Stable projection identity derived from the first and last source Swing IDs. */
  featureId: string;
  high: string;
  low: string;
  sourceStartSwingId: string;
  sourceEndSwingId: string;
  sbarStartId: string;
  sbarEndId: string;
}

export interface ReplayInspectorStructureDto {
  cbarCount: number;
  cbars: ReplayInspectorCBarDto[];
  swingCount: number;
  swings: ReplayInspectorSwingDto[];
  trendCount: number;
  trends: ReplayInspectorTrendDto[];
  featureSequence?: ReplayInspectorFeatureElementDto[] | null;
}

export type ReplayChartSelection = {
  kind: "sbar" | "cbar" | "swing" | "trend" | "keyzone";
  id: string;
  checkpointSbarId: string | null;
};

type ReplaySnapshotSelectionContext = {
  snapshotId: string;
  /** Human-readable label shared with the Snapshot Reference dropdown. */
  snapshotLabel?: string;
  checkpointSbarId: string;
  timeframe: string;
  bars: SBarDto[];
  structure: ReplayInspectorStructureDto | null;
};

export type ReplaySnapshotInspectorSelection =
  | (ReplaySnapshotSelectionContext & { kind: "sbar"; object: SBarDto })
  | (ReplaySnapshotSelectionContext & { kind: "cbar"; object: ReplayInspectorCBarDto })
  | (ReplaySnapshotSelectionContext & { kind: "swing"; object: ReplayInspectorSwingDto })
  | (ReplaySnapshotSelectionContext & { kind: "trend"; object: ReplayInspectorTrendDto })
  | (ReplaySnapshotSelectionContext & { kind: "keyzone"; object: KeyZoneDto; registry: KeyZoneCheckpointDto });

export interface ReplayInspectorDto {
  stateKey: string;
  checkpointIndex: number;
  sbarId: string;
  sbar: ReplayInspectorSBarDto;
  structure: ReplayInspectorStructureDto | null;
  keyzones?: KeyZoneCheckpointDto | null;
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

export interface SnapshotStructureCheckpointDto {
  sbarId: string;
  structure: ReplayInspectorStructureDto | null;
  keyzones?: KeyZoneCheckpointDto | null;
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
  structureTimeline: SnapshotStructureCheckpointDto[];
  keyzones?: KeyZoneCheckpointDto | null;
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


/** Instrument-owned domain facts; prices, IDs and timestamps remain lossless. */
export interface KeyZoneCheckpointDto {
  instrumentId: string;
  observations: KeyZoneObservationDto[];
  zones: KeyZoneDto[];
  interactions: KeyZoneInteractionDto[];
}
export interface KeyZoneDto {
  keyzoneId: string;
  originKind: "Swing" | "Trend" | "FixedPriceRange";
  originId: string | null;
  timeframe: string;
  lower: string;
  upper: string;
  state: "Provisional" | "Finalized" | "Invalidated";
  formedAt: string;
  createdAt: string;
  finalizedAt: string | null;
  finalizedDetectedAt: string | null;
  invalidatedAt: string | null;
  invalidatedDetectedAt: string | null;
}
export interface KeyZoneInteractionDto {
  interactionId: string;
  keyzoneId: string;
  observerTimeframe: string;
  observationId: string;
  observer: ObservationStateKeyDto;
  interruptedAt?: string;
  interruptedDetectedAt?: string;
  interruptionReason?: "Cancelled" | "Deadline";
  state: "Active" | "Ended" | "Invalidated" | "Interrupted";
  configN: string;
  configX: number;
  outsideCount: string;
  lastProcessedAt: string | null;
  startedAt: string;
  startedDetectedAt: string;
  endedAt: string | null;
  endedDetectedAt: string | null;
  invalidatedAt: string | null;
  invalidatedDetectedAt: string | null;
}

export interface ObservationStateKeyDto { instrumentId: string; timeframe: string }
export interface ObservationContextDto { runId: string; expectedSbarId: string }
export interface CreateObservationDto {
  context: ObservationContextDto;
  keyzoneId: string;
  requestId: string;
  startAt: string | null;
  n: string;
  x: number;
  completion: "AfterOneInteraction" | "UntilDeadline";
  deadline: string;
}
export interface CancelObservationDto {
  context: ObservationContextDto;
  observationId: string;
}
export interface ObservationCommandResultDto {
  observationId: string;
  operation: "created" | "existing" | "cancelled" | "alreadyTerminated";
  inspector: ReplayInspectorDto;
}
export interface ObservationControlsContext {
  runId: string;
  cursorSbarId: string;
  timeframe: string;
  bars: SBarDto[];
  enabled: boolean;
  disabledReason: string;
}
export interface KeyZoneObservationDto {
  observationId: string;
  consumerId: string;
  requestId: string;
  keyzoneId: string;
  observer: ObservationStateKeyDto;
  startMode: "AfterCurrentCursor" | "FromTime";
  startAt: string;
  startExclusive: boolean;
  deadline: string;
  completion: "AfterOneInteraction" | "UntilDeadline";
  configN: string;
  configX: number;
  createdAt: string;
  state: "Observing" | "Completed" | "Cancelled" | "SourceInvalidated";
  reason: "InteractionCompleted" | "Deadline" | "Cancelled" | "SourceInvalidated" | null;
  lastProcessedAt: string | null;
  terminalAt: string | null;
  terminalDetectedAt: string | null;
}
