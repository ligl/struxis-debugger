export type AnimationFrameScheduler = (() => void) & { cancel: () => void };

/**
 * Coalesces repeated requests into one animation frame. The scheduled callback
 * clears its frame handle before running, so it may safely schedule a later
 * frame. Call cancel during owner teardown to release pending work.
 */
export function createAnimationFrameCoalescer(callback: () => void): AnimationFrameScheduler {
  let frame: number | null = null;

  const schedule = (() => {
    if (frame !== null) return;
    frame = requestAnimationFrame(() => {
      frame = null;
      callback();
    });
  }) as AnimationFrameScheduler;

  schedule.cancel = () => {
    if (frame === null) return;
    cancelAnimationFrame(frame);
    frame = null;
  };

  return schedule;
}
