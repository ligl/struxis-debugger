import { describe, expect, it, vi } from "vitest";
import { createChartPrimitiveHost, type ChartPrimitiveBinding } from "../../src/sbar-chart-primitive-host";

function binding(id: string) {
  return {
    id,
    attach: vi.fn(),
    detach: vi.fn(),
    invalidate: vi.fn(),
    dispose: vi.fn(),
  } satisfies ChartPrimitiveBinding;
}

describe("createChartPrimitiveHost", () => {
  it("attaches registered bindings in order and detaches them in reverse order", () => {
    const host = createChartPrimitiveHost();
    const first = binding("cbar");
    const second = binding("swing");
    host.register(first);
    host.register(second);

    host.attach();
    host.attach();
    expect(first.attach).toHaveBeenCalledOnce();
    expect(second.attach).toHaveBeenCalledOnce();

    host.detach();
    host.detach();
    expect(second.detach).toHaveBeenCalledOnce();
    expect(first.detach).toHaveBeenCalledOnce();
    expect(host.isAttached).toBe(false);
  });

  it("attaches late registrations immediately and unregisters with full cleanup", () => {
    const host = createChartPrimitiveHost();
    host.attach();
    const item = binding("cbar");
    const unregister = host.register(item);

    expect(item.attach).toHaveBeenCalledOnce();
    host.invalidate("cbar");
    expect(item.invalidate).toHaveBeenCalledOnce();

    unregister();
    unregister();
    expect(item.detach).toHaveBeenCalledOnce();
    expect(item.dispose).toHaveBeenCalledOnce();
    host.invalidate();
    expect(item.invalidate).toHaveBeenCalledOnce();
  });

  it("rolls back earlier attachments if a later binding fails to attach", () => {
    const host = createChartPrimitiveHost();
    const first = binding("first");
    const second = binding("second");
    second.attach.mockImplementation(() => { throw new Error("attach failed"); });
    host.register(first);
    host.register(second);

    expect(() => host.attach()).toThrow("attach failed");
    expect(first.attach).toHaveBeenCalledOnce();
    expect(first.detach).toHaveBeenCalledOnce();
    expect(host.isAttached).toBe(false);
  });

  it("cleans up every binding and remains idempotent when a cleanup throws", () => {
    const host = createChartPrimitiveHost();
    const first = binding("first");
    const second = binding("second");
    second.detach.mockImplementation(() => { throw new Error("detach failed"); });
    host.register(first);
    host.register(second);
    host.attach();

    expect(() => host.dispose()).toThrow("detach failed");
    expect(first.detach).toHaveBeenCalledOnce();
    expect(first.dispose).toHaveBeenCalledOnce();
    expect(second.dispose).toHaveBeenCalledOnce();
    expect(host.isDisposed).toBe(true);
    expect(() => host.dispose()).not.toThrow();
  });

  it("rejects duplicate ids and registration after disposal", () => {
    const host = createChartPrimitiveHost();
    host.register(binding("cbar"));
    expect(() => host.register(binding("cbar"))).toThrow("Duplicate Primitive binding id");

    host.dispose();
    expect(() => host.register(binding("swing"))).toThrow("disposed host");
  });
});
