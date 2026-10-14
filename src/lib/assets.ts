/** Prefix a public-folder path with Vite's base, so GitHub Pages subpaths resolve. */
export function publicUrl(path: string) {
  if (!path) return path;
  if (/^(?:https?:|data:)/.test(path)) return path;
  const base = import.meta.env.BASE_URL || "/";
  const suffix = path.startsWith("/") ? path.slice(1) : path;
  return base.endsWith("/") ? `${base}${suffix}` : `${base}/${suffix}`;
}
