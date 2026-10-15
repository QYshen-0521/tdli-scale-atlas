/** Prefix a public-folder path with Vite's base, so GitHub Pages subpaths resolve. */
export function publicUrl(path: string) {
  if (!path) return path;
  if (/^(?:https?:|data:)/.test(path)) return path;
  const base = import.meta.env.BASE_URL || "/";
  const suffix = path.startsWith("/") ? path.slice(1) : path;
  return base.endsWith("/") ? `${base}${suffix}` : `${base}/${suffix}`;
}

/** Small sibling used by the chart and directory. SVG diagrams stay as they are. */
export function thumbPath(path: string) {
  if (!path || /\.svg$/i.test(path)) return path;
  const slash = path.lastIndexOf("/");
  if (slash < 0) return path;
  return `${path.slice(0, slash)}/thumbs${path.slice(slash)}`;
}

export function thumbUrl(path: string) {
  return publicUrl(thumbPath(path));
}
