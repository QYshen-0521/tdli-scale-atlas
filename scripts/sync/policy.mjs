const FACULTY = new Set(["李政道讲席教授", "特聘学者", "资深学者", "长聘学者", "青年学者", "研究员系列"]);

export function topicTags(text) {
  const value = String(text || "").toLowerCase();
  const tags = [];
  if (/天文|星系|行星|黑洞|引力波|中子星|恒星|天体物理|astrophys|gravitational|black hole|planet|galaxy|stellar/.test(value)) tags.push("astronomy");
  if (/宇宙|cosmolog/.test(value)) tags.push("cosmology");
  if (/天体粒子|多信使|astroparticle|multi-messenger/.test(value)) tags.push("astroparticle");
  if (/暗物质|dark matter|轴子/.test(value)) tags.push("dark-matter");
  if (/中微子|neutrino/.test(value)) tags.push("neutrino");
  if (/实验室天体|激光等离子体|高能量密度/.test(value)) tags.push("lab");
  return tags;
}

export function inScope(card) {
  if (!FACULTY.has(card.section)) return false;
  if (card.division === "technical") return false;
  if (/博士后|工程师|访问学者/.test(`${card.section} ${card.title}`)) return false;
  if (card.division === "astro") return true;
  return topicTags(`${card.title} ${card.directions}`).length > 0;
}

export function isRetired(card) {
  return /退休/.test(card.title || "");
}
