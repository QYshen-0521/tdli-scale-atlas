import type { Paper } from "../types.ts";

export function sciParts(value: number) {
  if (!Number.isFinite(value) || value <= 0) return null;
  const exp = Math.floor(Math.log10(value));
  const man = value / 10 ** exp;
  const digits = man >= 10 ? 1 : 2;
  return { man: man.toFixed(digits), exp };
}

export function paperHref(paper: Paper) {
  if (paper.url) return paper.url;
  return `https://ui.adsabs.harvard.edu/search?q=${encodeURIComponent(`"${paper.title}"`)}`;
}

export function tiltOf(id: string) {
  let h = 0;
  for (const c of id) h = (h * 33 + c.charCodeAt(0)) >>> 0;
  return ((h % 7) - 3) * 0.7;
}
