import { createAnimationFrameCoalescer } from "./animation-frame-coalescer";

export type StructureProjectionScheduler = (() => void) & {
  flush: () => void;
  cancel: () => void;
};

/**
 * Coalesces chart projection invalidations to one frame while allowing callers
 * to flush synchronously when a user action immediately depends on fresh
 * geometry (for example, object hit-testing after a snapshot replacement).
 */
export function createStructureProjectionScheduler(
  project: () => void,
): StructureProjectionScheduler {
  const schedule = createAnimationFrameCoalescer(project);
  const scheduler = schedule as unknown as StructureProjectionScheduler;

  scheduler.flush = () => {
    schedule.cancel();
    project();
  };
  scheduler.cancel = () => {
    schedule.cancel();
  };

  return scheduler;
}
