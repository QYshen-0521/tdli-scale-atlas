import { clean } from "../parse.mjs";

export function plain(html) {
  return clean(
    String(html || "")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&apos;/g, "'"),
  );
}

export function absoluteUrl(href, base) {
  try {
    return new URL(href, base).href.split("#")[0];
  } catch {
    return "";
  }
}

export function personName(value) {
  const text = plain(value).replace(/（兼）|\(兼\)/g, "").trim();
  if (/[\u4e00-\u9fff]/.test(text) && !/[A-Za-z]/.test(text)) return text.replace(/\s+/g, "");
  return text.replace(/\s+/g, " ");
}

export function clip(value, max = 360) {
  const text = plain(value);
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trim()}…`;
}
