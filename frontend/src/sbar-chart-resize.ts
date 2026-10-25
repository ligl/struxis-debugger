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

    // Hidden workspaces report a zero-sized host. Do not resize Lightweight
    // Charts to a synthetic 1x1 viewport: that clears/reflows the canvas and
    // causes a visible flash when the workspace becomes visible again.
    const width = Math.floor(entry.contentRect.width);
    const height = Math.floor(entry.contentRect.height);
    if (width <= 0 || height <= 0) return;

    chart.applyOptions({ width, height });
    onResized();
  });

  observer.observe(host);
  return () => observer.disconnect();
}
