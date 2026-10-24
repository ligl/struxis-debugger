import type { IChartApi } from "lightweight-charts";
import { afterEach, describe, expect, it, vi } from "vitest";
import { observeSbarChartResize } from "../../src/sbar-chart-resize";

describe("observeSbarChartResize", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("applies normalized host dimensions, invokes the adapter callback, and disconnects", () => {
    let resizeCallback: ResizeObserverCallback | undefined;
    const disconnect = vi.fn();
    const observe = vi.fn();

    class ResizeObserverMock {
      constructor(callback: ResizeObserverCallback) {
        resizeCallback = callback;
      }
      observe = observe;
      disconnect = disconnect;
      unobserve = vi.fn();
    }
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);

    const host = document.createElement("div");
    const applyOptions = vi.fn();
    const onResized = vi.fn();
    const chart = { applyOptions } as unknown as IChartApi;
    const dispose = observeSbarChartResize(host, chart, onResized);

    expect(observe).toHaveBeenCalledWith(host);
    resizeCallback?.(
      [{ contentRect: { width: 120.8, height: 0 } } as ResizeObserverEntry],
      {} as ResizeObserver,
    );
    expect(applyOptions).toHaveBeenCalledWith({ width: 120, height: 1 });
    expect(onResized).toHaveBeenCalledOnce();

    dispose();
    expect(disconnect).toHaveBeenCalledOnce();
  });

  it("ignores an empty observer delivery", () => {
    let resizeCallback: ResizeObserverCallback | undefined;
    class ResizeObserverMock {
      constructor(callback: ResizeObserverCallback) {
        resizeCallback = callback;
      }
      observe = vi.fn();
      disconnect = vi.fn();
      unobserve = vi.fn();
    }
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);

    const applyOptions = vi.fn();
    const onResized = vi.fn();
    const dispose = observeSbarChartResize(
      document.createElement("div"),
      { applyOptions } as unknown as IChartApi,
      onResized,
    );

    resizeCallback?.([], {} as ResizeObserver);
    expect(applyOptions).not.toHaveBeenCalled();
    expect(onResized).not.toHaveBeenCalled();
    dispose();
  });
});
