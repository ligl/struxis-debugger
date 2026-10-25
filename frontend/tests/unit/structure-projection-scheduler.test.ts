import { afterEach, describe, expect, it, vi } from "vitest";
import { createStructureProjectionScheduler } from "../../src/structure-projection-scheduler";

describe("createStructureProjectionScheduler", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("coalesces requests and flushes pending projection synchronously once", () => {
    let nextId = 1;
    const callbacks = new Map<number, FrameRequestCallback>();
    const cancelFrame = vi.fn((id: number) => callbacks.delete(id));
    vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => {
      const id = nextId++;
      callbacks.set(id, callback);
      return id;
    }));
    vi.stubGlobal("cancelAnimationFrame", cancelFrame);

    const project = vi.fn();
    const schedule = createStructureProjectionScheduler(project);
    schedule();
    schedule();
    expect(callbacks.size).toBe(1);
    expect(project).not.toHaveBeenCalled();

    schedule.flush();
    expect(project).toHaveBeenCalledOnce();
    expect(callbacks.size).toBe(0);
    expect(cancelFrame).toHaveBeenCalledWith(1);

    // A canceled frame must not later project a second time.
    schedule();
    callbacks.get(2)?.(0);
    expect(project).toHaveBeenCalledTimes(2);
  });

  it("cancels pending projection without executing it", () => {
    const cancelFrame = vi.fn();
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 9));
    vi.stubGlobal("cancelAnimationFrame", cancelFrame);
    const project = vi.fn();
    const schedule = createStructureProjectionScheduler(project);

    schedule();
    schedule.cancel();
    schedule.cancel();

    expect(cancelFrame).toHaveBeenCalledOnce();
    expect(cancelFrame).toHaveBeenCalledWith(9);
    expect(project).not.toHaveBeenCalled();
  });
});
