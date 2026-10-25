import type { CandlestickData, HistogramData, UTCTimestamp } from "lightweight-charts";
import type { SBarDto } from "./origin-types";
import { mapSBarsToChart } from "./sbar-chart-data";

export interface SnapshotPlaybackSeriesProjection {
  candles: CandlestickData<UTCTimestamp>[];
  volume: HistogramData<UTCTimestamp>[];
  processedStart: number;
  processedEndExclusive: number;
}

const CHART_BACKGROUND = "#121619";
const DIM_BRIGHTNESS = 0.42;

function mixHex(foreground: string, background: string, foregroundWeight: number): string {
  const parse = (value: string) => {
    const match = /^#([0-9a-f]{6})$/i.exec(value);
    if (!match) return null;
    const hex = match[1]!;
    return [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16));
  };
  const fg = parse(foreground);
  const bg = parse(background);
  if (!fg || !bg) return foreground;
  const channels = fg.map((channel, index) =>
    Math.round(channel * foregroundWeight + bg[index]! * (1 - foregroundWeight)),
  );
  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function dimColor(color: string): string {
  return mixHex(color, CHART_BACKGROUND, DIM_BRIGHTNESS);
}

/**
 * Builds native-series styling for Snapshot playback. K-lines and volume bars
 * remain rendered exclusively by Lightweight Charts; processed bars retain
 * their source colors while all other bars use a subdued palette.
 */
export function projectSnapshotPlaybackSeries(input: {
  bars: readonly SBarDto[];
  playbackEnabled: boolean;
  offset: number | null;
  liveCount: number;
  processedCount: number;
}): SnapshotPlaybackSeriesProjection {
  const projection = mapSBarsToChart(input.bars);
  const candles = projection.candles.map((candle) => ({ ...candle }));
  const volume = projection.volume.map((bar) => ({ ...bar }));

  const offset = input.offset;
  const liveCount = Math.max(0, Math.floor(input.liveCount));
  const processedCount = Math.max(0, Math.min(liveCount, Math.floor(input.processedCount)));
  const validOffset = offset !== null && Number.isInteger(offset) && offset >= 0;
  const processedStart = input.playbackEnabled && validOffset ? Math.min(input.bars.length, offset) : 0;
  const processedEndExclusive = input.playbackEnabled && validOffset
    ? Math.min(input.bars.length, offset + processedCount)
    : 0;

  if (input.playbackEnabled) {
    for (let index = 0; index < candles.length; index += 1) {
      if (index >= processedStart && index < processedEndExclusive) continue;
      const candle = candles[index]!;
      if (candle.color) {
        const color = dimColor(candle.color);
        candle.color = color;
        candle.borderColor = dimColor(candle.borderColor ?? candle.color);
        candle.wickColor = dimColor(candle.wickColor ?? candle.color);
      }
      const volumeBar = volume[index]!;
      if (volumeBar.color) volumeBar.color = dimColor(volumeBar.color);
    }
  }

  return { candles, volume, processedStart, processedEndExclusive };
}
