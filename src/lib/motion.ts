/**
 * Shared timing for the mentor portrait flight and the fades that travel with it.
 *
 * The previous duration was 700ms and the flight felt too fast. Speed is now
 * 2/3 of that, so every paired enter/exit timing lasts 700 × 3/2 = 1050ms.
 */
export const FLIGHT_MS = 1050;
