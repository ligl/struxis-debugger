import { describe, expect, it } from "vitest";
import {
  formatDomainTimestamp,
  formatLifecycleTimestamp,
  parseTimeframeUnit,
} from "../../src/timestamp-format";

const timestamp = "1780315503000000000"; // 2026-06-01 12:05:03 UTC

describe("semantic timestamp formatting", () => {
  it("formats domain event timestamps by Timeframe unit, not duration", () => {
    expect(formatDomainTimestamp(timestamp, "1D")).toBe("2026-06-01");
    expect(formatDomainTimestamp(timestamp, "4D")).toBe("2026-06-01");
    expect(formatDomainTimestamp(timestamp, "1W")).toBe("2026-06-01");
    expect(formatDomainTimestamp(timestamp, "1h")).toBe("2026-06-01 12:00");
    expect(formatDomainTimestamp(timestamp, "5m")).toBe("2026-06-01 12:05");
    expect(formatDomainTimestamp(timestamp, "60m")).toBe("2026-06-01 12:05");
    expect(formatDomainTimestamp(timestamp, "1s")).toBe("2026-06-01 12:05:03");
  });

  it("keeps lifecycle timestamps at second precision regardless of market timeframe", () => {
    expect(formatLifecycleTimestamp(timestamp)).toBe("2026-06-01 12:05:03");
  });

  it("uses UTC consistently regardless of the host local timezone", () => {
    expect(formatDomainTimestamp(timestamp, "1D")).toBe("2026-06-01");
    expect(formatLifecycleTimestamp(timestamp)).toBe("2026-06-01 12:05:03");
  });

  it("distinguishes absent values from malformed timestamps or timeframes", () => {
    expect(formatDomainTimestamp(null, "5m")).toBe("—");
    expect(formatLifecycleTimestamp("")).toBe("—");
    expect(formatLifecycleTimestamp("not-a-timestamp")).toBe("Invalid timestamp");
    expect(formatDomainTimestamp(timestamp, null)).toBe("Invalid timeframe");
  });

  it("parses supported Timeframe units without inferring from BarType", () => {
    expect(parseTimeframeUnit("5s")).toBe("second");
    expect(parseTimeframeUnit("15m")).toBe("minute");
    expect(parseTimeframeUnit("1h")).toBe("hour");
    expect(parseTimeframeUnit("1D")).toBe("day");
    expect(parseTimeframeUnit("1d")).toBe("day");
    expect(parseTimeframeUnit("1W")).toBe("week");
    expect(parseTimeframeUnit("300s")).toBe("second");
    expect(parseTimeframeUnit("BTC-5-MINUTE-LAST")).toBeNull();
  });
});
