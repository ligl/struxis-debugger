import { createChartPrimitiveHost, type ChartPrimitiveHost } from "./sbar-chart-primitive-host";
import { registerCBarPrimitive, registerSwingPrimitive, type StructurePrimitiveController } from "./sbar-chart-structure-primitives";
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  createChart,
  type IChartApi,
  type ISeriesApi,
} from "lightweight-charts";

export interface SBarChartLayerVisibility {
  sbar: boolean;
  volume: boolean;
}

/**
 * Applies chart-layer visibility without rewriting historical point styling.
 * Replay progress colors belong to the Replay adapter; visibility is a
 * series-level presentation concern shared by every SBar chart.
 */
export function applySbarChartSeriesVisibility(
  candleSeries: ISeriesApi<"Candlestick"> | null | undefined,
  volumeSeries: ISeriesApi<"Histogram"> | null | undefined,
  visibility: SBarChartLayerVisibility,
): void {
  candleSeries?.applyOptions({ visible: visibility.sbar });
  volumeSeries?.applyOptions({ visible: visibility.volume });
}

export interface SBarChartRuntimeOptions {
  width: number;
  height: number;
  candleLastValueVisible: boolean;
}

export interface SBarChartRuntime {
  chart: IChartApi;
  candleSeries: ISeriesApi<"Candlestick">;
  volumeSeries: ISeriesApi<"Histogram">;
  primitiveHost: ChartPrimitiveHost;
  cbarPrimitive: StructurePrimitiveController;
  swingPrimitive: StructurePrimitiveController;
}

/**
 * Creates only the shared Lightweight Charts primitives used by SBar charts.
 * The caller remains responsible for event subscriptions, ResizeObserver,
 * overlay scheduling, business interactions, and chart disposal. CBar / Swing
 * Primitive registration is centralized here, but every invocation creates
 * chart-local controllers. The host must be disposed before removing the chart.
 */
export function createSbarChartRuntime(
  host: HTMLElement,
  options: SBarChartRuntimeOptions,
): SBarChartRuntime {
  const chart = createChart(host, {
    width: options.width,
    height: options.height,
    grid: {
      vertLines: { visible: false },
      horzLines: { visible: false },
    },
    layout: {
      background: { type: ColorType.Solid, color: "#121619" },
      textColor: "#a8b2b9",
      attributionLogo: false,
    },
    rightPriceScale: {
      borderColor: "#121619",
      scaleMargins: { top: 0.08, bottom: 0.22 },
    },
    timeScale: {
      borderColor: "#121619",
      timeVisible: true,
      secondsVisible: false,
      rightOffset: 4,
    },
    crosshair: {
      mode: CrosshairMode.Normal,
      vertLine: {
        visible: true,
        color: "#89949d",
        labelBackgroundColor: "#30383f",
      },
      horzLine: {
        visible: true,
        color: "#89949d",
        labelBackgroundColor: "#30383f",
      },
    },
  });

  const candleSeries = chart.addSeries(CandlestickSeries, {
    upColor: "#79B58B",
    downColor: "#D98282",
    borderUpColor: "#79B58B",
    borderDownColor: "#D98282",
    wickUpColor: "#79B58B",
    wickDownColor: "#D98282",
    priceLineVisible: false,
    lastValueVisible: options.candleLastValueVisible,
  });

  const volumeSeries = chart.addSeries(HistogramSeries, {
    priceScaleId: "",
    priceFormat: { type: "volume" },
    lastValueVisible: false,
    priceLineVisible: false,
  });

  chart.priceScale("").applyOptions({
    scaleMargins: { top: 0.82, bottom: 0 },
  });

  const primitiveHost = createChartPrimitiveHost();
  primitiveHost.attach();
  const cbarPrimitive = registerCBarPrimitive(primitiveHost, candleSeries);
  const swingPrimitive = registerSwingPrimitive(primitiveHost, candleSeries);

  return { chart, candleSeries, volumeSeries, primitiveHost, cbarPrimitive, swingPrimitive };
}

/**
 * Releases chart-local drawing resources in dependency order. Adapters must
 * unsubscribe their business-specific chart listeners before calling this.
 */
export function disposeSbarChartRuntime(
  chart: IChartApi | null | undefined,
  primitiveHost: ChartPrimitiveHost | null | undefined,
): void {
  primitiveHost?.dispose();
  chart?.remove();
}
