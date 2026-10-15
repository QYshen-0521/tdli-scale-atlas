import { absoluteUrl, clip, personName, plain } from "./text.mjs";

export const NAOC_SENIOR_URL = "https://nao.cas.cn/nrc/zg/";

export const NAOC_DEPARTMENTS = {
  光学天文研究部: "naoc-optical",
  射电天文研究部: "naoc-radio",
  星系宇宙学研究部: "naoc-galaxy",
  太阳物理研究部: "naoc-solar",
  空间科学研究部: "naoc-space",
  月球与深空探测研究部: "naoc-lunar",
  应用天文研究部: "naoc-applied",
  深空专项研究中心: "naoc-deepspace",
  管理支撑部门: "naoc-admin",
};

export function parseNaocSeniorHtml(html) {
  const parts = String(html || "").split(/<div class="title-box">\s*<span>([^<]+)<\/span>/);
  const cards = [];
  for (let i = 1; i < parts.length; i += 2) {
    const department = plain(parts[i]);
    const body = parts[i + 1] || "";
    const orgId = NAOC_DEPARTMENTS[department] || "";
    const blocks = [...body.matchAll(/<a\b[^>]*class="yjy-list"[^>]*>[\s\S]*?<\/a>/gi)];
    for (const matched of blocks) {
      const block = matched[0];
      const href = absoluteUrl((block.match(/href="([^"]+)"/) || [])[1], NAOC_SENIOR_URL);
      const nameRaw = (block.match(/class="yjy-name">\s*([^<]+)/) || [])[1] || "";
      const commented = plain((block.match(/yjy-names">\s*([^<]+)/) || [])[1]);
      const joint = /（兼）|\(兼\)/.test(nameRaw);
      const name = personName(nameRaw);
      if (!name || !href) continue;
      cards.push({
        orgId: orgId || "naoc",
        division: orgId || "naoc",
        section: "正高级专业技术人员",
        department,
        name,
        title: commented,
        email: "",
        href,
        directions: "",
        decision: "include",
        reason: "",
        joint,
      });
    }
  }
  return cards;
}

export function classifyNaocCard(card) {
  const next = { ...card };
  const title = `${card.title || ""}`;
  if (card.department === "管理支撑部门") {
    next.decision = "exclude";
    next.reason = "列在管理支撑部门。行政支撑岗位本轮不收。若其中仍是科研岗，需要决定。";
    return next;
  }
  if (/工程师/.test(title)) {
    next.decision = "exclude";
    next.reason = "正高级名录职称注释是工程师，不在收录范围。";
    return next;
  }
  if (/研究员/.test(title) && !/博士后|访问/.test(title)) {
    next.decision = "include";
    next.reason = "国家天文台正高级名录的职称注释含研究员，个人页有研究方向原文。";
    return next;
  }
  next.decision = "defer";
  next.reason = "正高级名录这条没有写明研究员或工程师。不凭姓名猜测职称。";
  return next;
}

export function parseNaocProfile(html) {
  const heading = plain((String(html || "").match(/class="info-title">\s*([\s\S]*?)<div/i) || [])[1]);
  const region = (String(html || "").match(/class="comp-personnel-details[\s\S]*/i) || [String(html || "")])[0];
  const body = plain(region).split(/版权所有|代表论著/)[0];
  const subject = (body.match(/学科\s*[:：]\s*([^\s].{1,80}?)(?=\s*(?:学历|邮编|邮箱|地址|简历)\b)/) || [])[1] || "";
  const candidates = [
    ...body.matchAll(/研究领域(?:为|是|包括|：|:)[^。]{4,180}。/g),
    ...body.matchAll(/研究方向(?:为|是|包括|：|:)[^。]{4,180}。/g),
    ...body.matchAll(/主要从事[^。]{4,180}。/g),
  ].map((match) => match[0]).filter((item) => !/博士后|访问学者|奖学金|毕业于|取得了成果/.test(item));
  const editor = plain((String(html || "").match(/class="trs_editor_view[\s\S]*?>([\s\S]*?)<\/div>/i) || [])[1]);
  const beforeDegree = editor.split(/学历\s*[:：]/)[0].trim();
  const directions = candidates[0]
    || (subject && subject.trim().length >= 2 ? subject.trim() : "")
    || (beforeDegree.length >= 4 && beforeDegree.length <= 180 && !/博士后/.test(beforeDegree) ? beforeDegree : "");
  const email = ((body.match(/邮箱\s*[:：]\s*([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i) || [])[1] || "").toLowerCase();
  return { heading, directions: clip(directions, 360), email };
}
