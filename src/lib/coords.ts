export const BOUNDS = {
  logL: [3, 27] as const,
  logM: [18, 55] as const,
};

export type View = { x: number; y: number; k: number };

export type Pads = { l: number; r: number; t: number; b: number };

export function span() {
  return {
    dL: BOUNDS.logL[1] - BOUNDS.logL[0],
    dM: BOUNDS.logM[1] - BOUNDS.logM[0],
  };
}

export function fitView(width: number, height: number, pad: Pads): View {
  const { dL, dM } = span();
  const availW = Math.max(80, width - pad.l - pad.r);
  const availH = Math.max(80, height - pad.t - pad.b);
  const k = Math.min(availW / dL, availH / dM);
  return {
    k,
    x: pad.l + (availW - dL * k) / 2,
    y: pad.t + (availH - dM * k) / 2,
  };
}

export function project(logL: number, logM: number, view: View) {
  return {
    x: view.x + (logL - BOUNDS.logL[0]) * view.k,
    y: view.y + (BOUNDS.logM[1] - logM) * view.k,
  };
}

export function unproject(px: number, py: number, view: View) {
  return {
    logL: BOUNDS.logL[0] + (px - view.x) / view.k,
    logM: BOUNDS.logM[1] - (py - view.y) / view.k,
  };
}

export function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

/** Keep the world point under (px, py) fixed while changing scale. */
export function zoomAt(
  view: View,
  px: number,
  py: number,
  factor: number,
  minK: number,
  maxK: number,
): View {
  const nextK = clamp(view.k * factor, minK, maxK);
  const { logL, logM } = unproject(px, py, view);
  return {
    k: nextK,
    x: px - (logL - BOUNDS.logL[0]) * nextK,
    y: py - (BOUNDS.logM[1] - logM) * nextK,
  };
}

export function clampPan(view: View, width: number, height: number): View {
  const { dL, dM } = span();
  let { x, y } = view;
  const right = x + dL * view.k;
  const bottom = y + dM * view.k;
  const margin = 72;
  if (right < margin) x += margin - right;
  if (x > width - margin) x -= x - (width - margin);
  if (bottom < margin) y += margin - bottom;
  if (y > height - margin) y -= y - (height - margin);
  return { ...view, x, y };
}

export const RS_OFFSET = -26.828205686534115;
export const WATER_SLOPE = 3;
export const WATER_OFFSET = 3.6220886093024336;
