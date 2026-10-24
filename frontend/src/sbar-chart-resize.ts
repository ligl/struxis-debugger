import type { IChartApi } from "lightweight-charts";

/**
 * Observes a chart host and applies its measured size to the chart instance.
 * The caller owns the chart and must invoke the returned disposer before the
 * chart is removed. Chart-specific reprojection remains in the callback.
 */
export function observeSbarChartResize(
  host: HTMLElement,
  chart: IChartApi,
  onResized: () => void,
): () => void {
  const observer = new ResizeObserver((entries) => {
    const entry = entries[0];
    if (!entry) return;

    chart.applyOptions({
      width: Math.max(1, Math.floor(entry.contentRect.width)),
      height: Math.max(1, Math.floor(entry.contentRect.height)),
    });
    onResized();
  });

  observer.observe(host);
  return () => observer.disconnect();
}
