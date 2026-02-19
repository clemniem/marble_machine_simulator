/** Simulation ticks per second. */
export const TICK_RATE = 60;

/** Seconds per simulation tick (fixed timestep). */
export const TICK_DT = 1 / TICK_RATE;

/** Safety cap — max marbles alive at once to prevent runaway simulations. */
export const MAX_MARBLES = 1000;

/**
 * Max accumulated frame time (seconds) before we start dropping ticks.
 * Prevents spiral-of-death when the browser tab is backgrounded.
 */
export const MAX_ACCUMULATOR = 0.25;

/** Default marble speed in progress-units per tick. */
export const DEFAULT_MARBLE_SPEED = 0.02;

/** Default spawn rate for source nodes (marbles per second). */
export const DEFAULT_SPAWN_RATE = 1;
