import type { CandlestickData, HistogramData, UTCTimestamp } from "lightweight-charts";
import type { SBarDto } from "./origin-types";

export interface SBarChartProjection {
  candles: CandlestickData<UTCTimestamp>[];
  volume: HistogramData<UTCTimestamp>[];
  sbarIdByTime: ReadonlyMap<number, string>;
}

export class SBarChartDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SBarChartDataError";
  }
}

function parseDomainNanoseconds(value: string, field: string): bigint {
  if (!/^(0|[1-9][0-9]*)$/.test(value)) {
    throw new SBarChartDataError(`${field} must be a canonical non-negative integer string.`);
  }
  try {
    return BigInt(value);
  } catch {
    throw new SBarChartDataError(`${field} is not a valid integer timestamp.`);
  }
}

function parseFiniteNumber(value: string, field: string, sbarId: string): number {
  if (value.trim() === "") {
    throw new SBarChartDataError(`SBar ${sbarId} has an empty ${field} value.`);
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new SBarChartDataError(`SBar ${sbarId} has a non-finite ${field} value.`);
  }
  return parsed;
}

/**
 * Projects the authoritative Struxis SBar DTO into Lightweight Charts data.
 * Domain identities remain exact strings; only the display time axis is reduced
 * from nanoseconds to integer Unix seconds.
 */
export function mapSBarsToChart(bars: readonly SBarDto[]): SBarChartProjection {
  const candles: CandlestickData<UTCTimestamp>[] = [];
  const volume: HistogramData<UTCTimestamp>[] = [];
  const sbarIdByTime = new Map<number, string>();
  let previousEventNs: bigint | null = null;

  for (const bar of bars) {
    const eventNs = parseDomainNanoseconds(bar.tsEvent, "ts_event");
    if (bar.sbarId !== bar.tsEvent) {
      throw new SBarChartDataError(
        `SBar ID ${bar.sbarId} does not match its ts_event ${bar.tsEvent}.`,
      );
    }
    if (previousEventNs !== null && eventNs <= previousEventNs) {
      throw new SBarChartDataError("SBar timestamps must be strictly increasing.");
    }
    previousEventNs = eventNs;

    const timeSecondsBigInt = eventNs / 1_000_000_000n;
    if (
      timeSecondsBigInt > BigInt(Number.MAX_SAFE_INTEGER) ||
      timeSecondsBigInt < BigInt(Number.MIN_SAFE_INTEGER)
    ) {
      throw new SBarChartDataError(
        `SBar ${bar.sbarId} timestamp is outside the chart's safe Unix-second range.`,
      );
    }
    const timeSeconds = Number(timeSecondsBigInt);
    if (sbarIdByTime.has(timeSeconds)) {
      throw new SBarChartDataError(
        `Multiple SBars map to chart second ${timeSeconds}; refusing to merge timestamps.`,
      );
    }

    const open = parseFiniteNumber(bar.open, "open", bar.sbarId);
    const high = parseFiniteNumber(bar.high, "high", bar.sbarId);
    const low = parseFiniteNumber(bar.low, "low", bar.sbarId);
    const close = parseFiniteNumber(bar.close, "close", bar.sbarId);
    const barVolume = parseFiniteNumber(bar.volume, "volume", bar.sbarId);
    if (low > high || low > Math.min(open, close) || high < Math.max(open, close)) {
      throw new SBarChartDataError(`SBar ${bar.sbarId} has inconsistent OHLC values.`);
    }
    if (barVolume < 0) {
      throw new SBarChartDataError(`SBar ${bar.sbarId} has negative volume.`);
    }

    const time = timeSeconds as UTCTimestamp;
    const directionColor = close > open ? "#557E65" : close < open ? "#8D555B" : "#858D97";
    candles.push({
      time,
      open,
      high,
      low,
      close,
      color: directionColor,
      borderColor: directionColor,
      wickColor: directionColor,
    });
    volume.push({
      time,
      value: barVolume,
      color: directionColor,
    });
    sbarIdByTime.set(timeSeconds, bar.sbarId);
  }

  return { candles, volume, sbarIdByTime };
}
