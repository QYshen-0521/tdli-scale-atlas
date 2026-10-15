import { absoluteUrl, clip, personName, plain } from "./text.mjs";

export const CAMBRIDGE_FACULTY_URL = "https://www.ast.cam.ac.uk/people/faculty";

export function parseCambridgeFacultyHtml(html) {
  const rows = [...String(html || "").matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
  const cards = [];
  for (const row of rows) {
    const body = row[1];
    const link = body.match(/<a href="(\/people\/[^"]+)">\s*([^<]+?)\s*<\/a>/);
    if (!link) continue;
    const email = ((body.match(/mailto:([^"?]+)/) || [])[1] || "").toLowerCase();
    const label = plain(link[2]);
    const titled = label.match(/^(Professor|Prof\.?|Dr)\s+(.+)$/);
    const name = personName(titled ? titled[2] : label);
    const title = titled ? titled[1] : "Faculty";
    if (!name) continue;
    cards.push({
      orgId: "cam-ioa",
      division: "cam-ioa",
      section: "Faculty",
      name,
      title,
      email,
      href: absoluteUrl(link[1], CAMBRIDGE_FACULTY_URL),
      directions: "",
      decision: "include",
      reason: "剑桥大学天文研究所官方 Faculty 名录中的教师。",
      joint: false,
    });
  }
  return cards;
}

function researchBlock(html) {
  const encoded = (String(html || "").match(/property="content:encoded">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/i) || [])[1] || "";
  const source = encoded || String(html || "");
  const start = source.search(/<h2[^>]*>\s*Research\s*<\/h2>/i);
  if (start < 0) return encoded || "";
  const rest = source.slice(start);
  const end = rest.slice(12).search(/<h2[^>]*>\s*(Career|Contact|Education|Awards|Selected papers)\b/i);
  return end >= 0 ? rest.slice(0, end + 12) : rest.slice(0, 4000);
}

export function parseCambridgeProfile(html) {
  const block = researchBlock(html);
  const items = [...block.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((match) => plain(match[1])).filter(Boolean);
  const paras = [...String(block).matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => plain(match[1]))
    .filter((item) => item.length > 24 && !/below is the list/i.test(item));
  let directions = clip(items.length ? items.join("；") : paras.join(" "), 500);
  if (directions.length < 8) {
    const loose = plain(block).replace(/^Research\s*/i, "").trim();
    if (loose.length > 24) directions = clip(loose, 500);
  }
  if (directions.length < 8) {
    const meta = plain((String(html || "").match(/<meta name="description" content="([^"]*)"/i) || [])[1]);
    directions = clip(meta.split(/Institute of Astronomy|Madingley Road|Education:/i)[0], 500);
  }
  const job = plain((String(html || "").match(/field-sd-job-titles[\s\S]*?<div class="field-item[^"]*">([\s\S]*?)<\/div>/i) || [])[1]);
  const emeritus = /emeritus/i.test(job);
  return { directions, jobTitle: job, emeritus };
}
