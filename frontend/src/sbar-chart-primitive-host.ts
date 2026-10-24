/**
 * Owns the lifecycle of chart-local Primitive adapters.
 *
 * A binding adapts one drawing concern to Lightweight Charts' public Primitive
 * API. The host coordinates ownership and teardown; it does not own domain
 * state, geometry projection, rendering, or interaction semantics.
 */
export interface ChartPrimitiveBinding {
  /** Stable, chart-local registration key. */
  readonly id: string;
  /** Attach the underlying Primitive to its chart/series/pane owner. */
  attach(): void;
  /** Detach the underlying Primitive without destroying its reusable adapter. */
  detach(): void;
  /** Request a chart redraw when the binding's data or visibility changes. */
  invalidate?(): void;
  /** Release adapter-owned caches and resources permanently. */
  dispose(): void;
}

interface BindingEntry {
  binding: ChartPrimitiveBinding;
  attached: boolean;
  disposed: boolean;
}

export interface ChartPrimitiveHost {
  readonly isAttached: boolean;
  readonly isDisposed: boolean;
  register(binding: ChartPrimitiveBinding): () => void;
  attach(): void;
  detach(): void;
  invalidate(id?: string): void;
  dispose(): void;
}

function throwCollectedErrors(message: string, errors: unknown[]): void {
  if (errors.length === 1) throw errors[0];
  if (errors.length > 1) throw new AggregateError(errors, message);
}

/**
 * Creates one lifecycle registry for one chart instance.
 *
 * Registering while attached attaches immediately. Unregistering detaches and
 * disposes that binding. Host disposal is idempotent and always attempts every
 * cleanup, even when an individual adapter throws.
 */
export function createChartPrimitiveHost(): ChartPrimitiveHost {
  const entries = new Map<string, BindingEntry>();
  let attached = false;
  let disposed = false;

  function detachEntry(entry: BindingEntry, errors: unknown[]): void {
    if (!entry.attached) return;
    entry.attached = false;
    try {
      entry.binding.detach();
    } catch (error) {
      errors.push(error);
    }
  }

  function disposeEntry(entry: BindingEntry, errors: unknown[]): void {
    if (entry.disposed) return;
    entry.disposed = true;
    try {
      entry.binding.dispose();
    } catch (error) {
      errors.push(error);
    }
  }

  function detachAll(): unknown[] {
    const errors: unknown[] = [];
    const ordered = [...entries.values()].reverse();
    for (const entry of ordered) detachEntry(entry, errors);
    return errors;
  }

  return {
    get isAttached() {
      return attached;
    },
    get isDisposed() {
      return disposed;
    },
    register(binding) {
      if (disposed) throw new Error("Cannot register a Primitive binding on a disposed host.");
      if (!binding.id.trim()) throw new Error("Primitive binding id must not be empty.");
      if (entries.has(binding.id)) throw new Error(`Duplicate Primitive binding id: ${binding.id}`);

      const entry: BindingEntry = { binding, attached: false, disposed: false };
      entries.set(binding.id, entry);
      if (attached) {
        try {
          binding.attach();
          entry.attached = true;
        } catch (error) {
          entries.delete(binding.id);
          const cleanupErrors: unknown[] = [];
          try {
            // Attach may have partially registered with the chart before it
            // failed; adapters must make detach safe after partial attachment.
            binding.detach();
          } catch (cleanupError) {
            cleanupErrors.push(cleanupError);
          }
          throwCollectedErrors(`Failed to register Primitive binding ${binding.id}.`, [error, ...cleanupErrors]);
        }
      }

      let registered = true;
      return () => {
        if (!registered) return;
        registered = false;
        const errors: unknown[] = [];
        detachEntry(entry, errors);
        disposeEntry(entry, errors);
        entries.delete(binding.id);
        throwCollectedErrors(`Failed to unregister Primitive binding ${binding.id}.`, errors);
      };
    },
    attach() {
      if (disposed) throw new Error("Cannot attach a disposed Primitive host.");
      if (attached) return;
      attached = true;
      const newlyAttached: BindingEntry[] = [];
      try {
        for (const entry of entries.values()) {
          if (entry.disposed || entry.attached) continue;
          // Track the attempt before calling user code so a partially completed
          // attach can be rolled back if attach() throws.
          newlyAttached.push(entry);
          entry.attached = true;
          entry.binding.attach();
        }
      } catch (error) {
        const cleanupErrors: unknown[] = [];
        for (const entry of newlyAttached.reverse()) detachEntry(entry, cleanupErrors);
        attached = false;
        throwCollectedErrors("Failed to attach Primitive host.", [error, ...cleanupErrors]);
      }
    },
    detach() {
      if (!attached) return;
      attached = false;
      const errors = detachAll();
      throwCollectedErrors("Failed to detach Primitive host.", errors);
    },
    invalidate(id) {
      if (disposed) return;
      const targets = id === undefined
        ? [...entries.values()]
        : [entries.get(id)].filter((entry): entry is BindingEntry => entry !== undefined);
      for (const entry of targets) {
        if (entry.attached && !entry.disposed) entry.binding.invalidate?.();
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      attached = false;
      const errors = detachAll();
      for (const entry of [...entries.values()].reverse()) disposeEntry(entry, errors);
      entries.clear();
      throwCollectedErrors("Failed to dispose Primitive host.", errors);
    },
  };
}
