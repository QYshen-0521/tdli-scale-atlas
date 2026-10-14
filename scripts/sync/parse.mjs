export function clean(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export function emailOf(value) {
  return clean(value).toLowerCase().replace(/\s+at\s+/g, "@").replace(/\s+/g, "");
}

export function parseMemberHtml(html, division) {
  const parts = String(html || "").split(/<div class="department-title[^"]*">([^<]+)<\/div>/);
  const cards = [];
  const chunks = parts.length === 1 ? ["", "", parts[0] || ""] : parts;
  for (let i = 1; i < chunks.length; i += 2) {
    const section = clean(chunks[i]);
    const body = chunks[i + 1] || "";
    const re = /<a href="([^"]+)" class="teacher-item"(.*?)<\/a>/gs;
    let match;
    while ((match = re.exec(body))) {
      const block = match[2];
      cards.push({
        division,
        section,
        name: clean((block.match(/class="name[^"]*">\s*(.*?)\s*<\/div>/s) || [])[1]),
        title: clean((block.match(/class="title[^"]*">\s*(.*?)\s*<\/div>/s) || [])[1]),
        email: emailOf((block.match(/icon-mail-o"><\/i>\s*([^<]+)/) || [])[1]),
        href: match[1].split("?")[0],
        directions: clean((block.match(/data-directions="([^"]*)"/) || [])[1]),
      });
    }
  }
  return cards;
}

export function assessHealth(html, { minPeople = 1, markers = [] } = {}) {
  const text = String(html || "");
  if (text.trim().length < 40) return { ok: false, reason: "empty", count: 0 };
  for (const marker of markers) {
    if (!text.includes(marker)) return { ok: false, reason: "structure", count: 0, marker };
  }
  const count = (text.match(/class="teacher-item"/g) || []).length;
  if (count < minPeople) return { ok: false, reason: "short-list", count };
  if (/下一页|next page/i.test(text) && !/class="disabled"/.test(text)) {
    return { ok: false, reason: "pagination", count };
  }
  return { ok: true, reason: "ok", count };
}
