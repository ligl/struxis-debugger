export type TimeframeUnit = "second" | "minute" | "hour" | "day" | "week";

const NANOS_PER_MILLISECOND = 1_000_000n;
const MAX_DATE_MILLISECONDS = 8_640_000_000_000_000n;

function parseEpochNanoseconds(value: string | null | undefined): bigint | null {
  if (value == null || value.trim() === "") return null;
  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) return null;

  try {
    const nanoseconds = BigInt(normalized);
    const milliseconds = nanoseconds / NANOS_PER_MILLISECOND;
    if (milliseconds > MAX_DATE_MILLISECONDS) return null;
    return nanoseconds;
  } catch {
    return null;
  }
}

/**
 * Parse the canonical Struxis Timeframe display (5s, 15m, 1h, 1D, 1W).
 * Legacy duration-only strings such as 300s are intentionally interpreted
 * literally as seconds; callers must not infer a different unit from BarType.
 */
export function parseTimeframeUnit(timeframe: string | null | undefined): TimeframeUnit | null {
  if (!timeframe) return null;
  const match = /^\s*\d+\s*([smhDWw])\s*$/.exec(timeframe);
  if (!match) return null;

  switch (match[1]) {
    case "s": return "second";
    case "m": return "minute";
    case "h": return "hour";
    case "D": return "day";
    case "W":
    case "w": return "week";
    default: return null;
  }
}

function utcParts(nanoseconds: bigint): { year: string; month: string; day: string; hour: string; minute: string; second: string } | null {
  const milliseconds = nanoseconds / NANOS_PER_MILLISECOND;
  if (milliseconds > MAX_DATE_MILLISECONDS) return null;
  const date = new Date(Number(milliseconds));
  if (Number.isNaN(date.getTime())) return null;

  const pad2 = (value: number) => String(value).padStart(2, "0");
  return {
    year: String(date.getUTCFullYear()).padStart(4, "0"),
    month: pad2(date.getUTCMonth() + 1),
    day: pad2(date.getUTCDate()),
    hour: pad2(date.getUTCHours()),
    minute: pad2(date.getUTCMinutes()),
    second: pad2(date.getUTCSeconds()),
  };
}

function formatAtPrecision(value: string | null | undefined, precision: "day" | "minute" | "second"): string {
  const nanoseconds = parseEpochNanoseconds(value);
  if (nanoseconds === null) return value == null || value.trim() === "" ? "—" : "Invalid timestamp";

  const parts = utcParts(nanoseconds);
  if (!parts) return "Invalid timestamp";
  const date = parts.year + "-" + parts.month + "-" + parts.day;
  if (precision === "day") return date;
  const minute = date + " " + parts.hour + ":" + parts.minute;
  if (precision === "minute") return minute;
  return minute + ":" + parts.second;
}

/** Formats event-time fields according to the authoritative Timeframe unit. */
export function formatDomainTimestamp(value: string | null | undefined, timeframe: string | null | undefined): string {
  const unit = parseTimeframeUnit(timeframe);
  if (!unit) return value == null || value.trim() === "" ? "—" : "Invalid timeframe";
  if (unit === "day" || unit === "week") return formatAtPrecision(value, "day");
  if (unit === "second") return formatAtPrecision(value, "second");
  return formatAtPrecision(value, "minute");
}

/** Formats entity lifecycle timestamps at fixed second precision. */
export function formatLifecycleTimestamp(value: string | null | undefined): string {
  return formatAtPrecision(value, "second");
}
