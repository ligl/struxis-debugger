import { afterEach, describe, expect, it, vi } from "vitest";
import { createAnimationFrameCoalescer } from "../../src/animation-frame-coalescer";

describe("createAnimationFrameCoalescer", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("coalesces repeated schedules and permits a later frame after execution", () => {
    let nextId = 1;
    const callbacks = new Map<number, FrameRequestCallback>();
    vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => {
      const id = nextId++;
      callbacks.set(id, callback);
      return id;
    }));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const callback = vi.fn();
    const schedule = createAnimationFrameCoalescer(callback);
    schedule();
    schedule();
    expect(callbacks.size).toBe(1);
    expect(callback).not.toHaveBeenCalled();
    callbacks.get(1)?.(0);
    expect(callback).toHaveBeenCalledOnce();
    schedule();
    expect(callbacks.size).toBe(2);
    callbacks.get(2)?.(0);
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it("cancels a pending frame and makes cancellation idempotent", () => {
    const cancel = vi.fn();
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 41));
    vi.stubGlobal("cancelAnimationFrame", cancel);
    const callback = vi.fn();
    const schedule = createAnimationFrameCoalescer(callback);
    schedule();
    schedule.cancel();
    schedule.cancel();
    expect(cancel).toHaveBeenCalledOnce();
    expect(cancel).toHaveBeenCalledWith(41);
    expect(callback).not.toHaveBeenCalled();
    schedule();
    expect(vi.mocked(requestAnimationFrame)).toHaveBeenCalledTimes(2);
  });
});
