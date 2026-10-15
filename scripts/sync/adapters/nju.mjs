import { absoluteUrl, clip, personName, plain } from "./text.mjs";

export const NJU_PAGES = [
  { rank: "中科院院士", url: "https://astronomy.nju.edu.cn/szll/szgk/zkyys/index.html", bucket: "include" },
  { rank: "教授", url: "https://astronomy.nju.edu.cn/szll/szgk/js/index.html", bucket: "include" },
  { rank: "副教授", url: "https://astronomy.nju.edu.cn/szll/szgk/fjs/index.html", bucket: "include" },
  { rank: "助理教授", url: "https://astronomy.nju.edu.cn/szll/szgk/zljs/index.html", bucket: "include" },
  { rank: "专职科研", url: "https://astronomy.nju.edu.cn/szll/szgk/zzky/index.html", bucket: "defer" },
  { rank: "博士后", url: "https://astronomy.nju.edu.cn/szll/szgk/bsh/index.html", bucket: "exclude" },
  { rank: "实验技术", url: "https://astronomy.nju.edu.cn/szll/szgk/syjs/index.html", bucket: "exclude" },
];

function tidy(value) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function researchOf(block) {
  const sub = (block.match(/class="sub-content"[^>]*>([\s\S]*)$/) || [])[1] || "";
  const stripped = sub.replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<script[\s\S]*?<\/script>/gi, " ");
  const text = tidy(plain(stripped));
  const stop = /课题组成员|毕业成员|科研助理|研究手段|发表论文|招生信息|指导研究生|二、/;
  const take = (match) => clip(tidy((match || "").split(stop)[0]), 360);
  const main = text.match(/主要研究领域\s*[:：]?\s*(.{4,320})/);
  if (main && take(main[1]).length >= 8) return take(main[1]);
  const field = text.match(/研究领域\s*[:：]\s*(.{4,320})/);
  if (field && take(field[1]).length >= 8) return take(field[1]);
  const interest = text.match(/我感兴趣的一些主题\s*[:：]\s*(.{4,320})/);
  if (interest && take(interest[1]).length >= 8) return take(interest[1]);
  const heading = text.match(/研究方向\s*(.{4,320})/);
  if (heading && take(heading[1]).length >= 8 && !/^取得了/.test(heading[1])) return take(heading[1]);
  const paras = [...stripped.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => tidy(plain(match[1])))
    .filter((item) => item.length >= 8 && !/^博士后\s*[:：]/.test(item));
  return clip(paras[0] || text.slice(0, 500), 360);
}

export function parseNjuRankHtml(html, page) {
  const blocks = String(html || "").split('<div class="right-main">').slice(1);
  const cards = [];
  for (const block of blocks) {
    const href = absoluteUrl((block.match(/<a href="([^"]+)"/) || [])[1], page.url);
    const name = personName((block.match(/<a href="[^"]+"[^>]*>\s*([^<]+)/) || [])[1]);
    if (!name || !href) continue;
    const subtitle = plain((block.match(/<span>\s*\|\s*<\/span>\s*<span>([^<]*)<\/span>/) || [])[1]);
    const facultyTitle = /研究员|教授|院士/.test(subtitle) && !/博士后/.test(subtitle);
    let decision = page.bucket;
    let reason = "";
    if (page.bucket === "exclude") {
      reason = page.rank === "博士后" ? "博士后不在收录范围。" : "实验技术不在收录范围。";
    } else if (page.bucket === "defer" && !facultyTitle) {
      reason = "专职科研页没有写成教授、副教授、助理教授或研究员。是否纳入需要决定。";
    } else if (page.bucket === "defer" && facultyTitle) {
      decision = "include";
    }
    const directions = decision === "exclude" ? "" : researchOf(block);
    if (decision === "include" && directions.length < 8) {
      decision = "defer";
      reason = "职称页上没有可用的研究方向原文，不编造。";
    }
    if (decision === "include" && !reason) {
      reason = "南京大学天文与空间科学学院官方职称页上的教学科研人员，页面有研究方向原文。";
    }
    const rawTitle = facultyTitle ? subtitle : page.rank;
    cards.push({
      orgId: "nju-sass",
      division: "nju-sass",
      section: page.rank,
      name,
      title: rawTitle,
      email: "",
      href,
      directions,
      decision,
      reason,
      joint: /兼/.test(subtitle),
    });
  }
  return cards;
}
