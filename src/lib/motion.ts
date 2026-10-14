/**
 * Shared timing for the mentor portrait flight and the fades that travel with it.
 *
 * Duration is 1050ms × 3/2 = 1575ms, so the speed is 2/3 of the previous flight.
 * The path itself stays a straight line from A to B (two keyframes, no arc).
 * Time along that line uses ease-in-out: accelerate, then decelerate.
 * CSS `ease-in-out` is cubic-bezier(0.42, 0, 0.58, 1).
 */
export const FLIGHT_MS = 1575;

/** Linear in space, ease-in-out in time. Same curve as CSS `ease-in-out`. */
export const FLIGHT_EASING = "cubic-bezier(0.42, 0, 0.58, 1)";
