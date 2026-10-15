const memory = new Map<string, number>();
const PREFIX = "tdli-directory-scroll:";

/** Keyed by pathname + search so filters in the URL keep their own place. */
export function directoryScrollKey(pathname: string, search: string) {
  return `${pathname}${search}`;
}

export function readDirectoryScroll(key: string) {
  const cached = memory.get(key);
  if (cached != null) return cached;
  try {
    const raw = sessionStorage.getItem(PREFIX + key);
    if (raw == null) return 0;
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

export function writeDirectoryScroll(key: string, top: number) {
  const value = Number.isFinite(top) && top > 0 ? top : 0;
  memory.set(key, value);
  try {
    sessionStorage.setItem(PREFIX + key, String(value));
  } catch {
    /* sessionStorage can be unavailable; the in-memory map still covers this tab. */
  }
}
