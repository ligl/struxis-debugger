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

export interface IpcError {
  code: "invalid_argument" | "not_found" | "conflict" | "invalid_state" | "internal";
  message: string;
}
