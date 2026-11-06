import type { KeyZoneCheckpointDto, SBarDto } from "../../src/origin-types";
export function keyzoneFixture(): KeyZoneCheckpointDto {
  return {
    instrumentId: "AUD/USD.SIM",
    observations: [{ observationId: "1", consumerId: "strategy-a", requestId: "request-a",
      keyzoneId: "9007199254740993", observer: { instrumentId: "AUD/USD.SIM", timeframe: "1m" },
      startMode: "FromTime", startAt: "1700000000000000000", startExclusive: false,
      deadline: "1700000300000000000", completion: "UntilDeadline", configN: "3", configX: 0.5,
      createdAt: "1700000000000000009", state: "Observing", reason: null,
      lastProcessedAt: "1700000180000000000", terminalAt: null, terminalDetectedAt: null }],
    zones: [{ keyzoneId: "9007199254740993", originKind: "Swing", originId: "9007199254740999", timeframe: "1m",
      lower: "9.00001", upper: "12.00002", state: "Finalized", formedAt: "1700000000000000000",
      createdAt: "1700000000000000009", finalizedAt: "1700000120000000000", finalizedDetectedAt: "1700000120000000009",
      invalidatedAt: null, invalidatedDetectedAt: null }],
    interactions: [{ interactionId: "9007199254740995", keyzoneId: "9007199254740993", observerTimeframe: "1m",
      observationId: "1", observer: { instrumentId: "AUD/USD.SIM", timeframe: "1m" },
      state: "Active", configN: "3", configX: 0.5, outsideCount: "0",
      lastProcessedAt: "1700000180000000000", startedAt: "1700000000000000000", startedDetectedAt: "1700000000000000009",
      endedAt: null, endedDetectedAt: null, invalidatedAt: null, invalidatedDetectedAt: null }],
  };
}
export function keyzoneBars(): SBarDto[] {
  return ["1700000000000000000", "1700000060000000000", "1700000120000000000", "1700000180000000000"].map((ts) => ({
    sbarId: ts, tsEvent: ts, tsInit: ts, barType: "AUD/USD.SIM-1-MINUTE-LAST-EXTERNAL",
    open: "10", high: "13", low: "8", close: "11", volume: "100",
  }));
}
