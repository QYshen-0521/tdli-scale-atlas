import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assessHealth, parseMemberHtml } from "./parse.mjs";
import { applyChanges, compareSources, semanticChanges } from "./compare.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const before = createHash("sha256").update(readFileSync(path.join(root, "data/people.json"))).digest("hex");
const failures = [];
const check = (name, ok) => {
  if (!ok) failures.push(name);
};

function card(name, email, title, href, directions, _section = "青年学者") {
  return `<div class="department-title">青年学者</div><a href="${href}" class="teacher-item"><div class="name">${name}</div><div class="title">${title}</div><span><i class="iconfont icon-mail-o"></i>${email}</span><span data-directions="${directions}"></span></a>`;
}

const published = [
  {
    id: "jia",
    name: "甲",
    email: "jia@sjtu.edu.cn",
    title: "青年学者",
    directions: "星系形成",
    profileUrls: "https://tdli.sjtu.edu.cn/people/100/jia",
    division: "astro",
    current: true,
  },
];

function run(html, division = "astro", health) {
  const sourceHealth = health || assessHealth(html, { minPeople: 1, markers: ["teacher-item"] });
  return compareSources({
    sources: [{
      id: "fixture",
      division,
      health: sourceHealth,
      cards: sourceHealth.ok ? parseMemberHtml(html, division) : [],
    }],
    published,
  });
}

const same = run(card("甲", "jia@sjtu.edu.cn", "青年学者", "/people/100/jia", "星系形成"));
check("repeat-no-change", semanticChanges(same).length === 0);

const again = run(card("甲", "jia@sjtu.edu.cn", "青年学者", "/people/100/jia", "星系形成"));
check("repeat-stable", JSON.stringify(semanticChanges(same)) === JSON.stringify(semanticChanges(again)));

const title = run(card("甲", "jia@sjtu.edu.cn", "长聘学者", "/people/100/jia", "星系形成"));
check("title-change", title.some((change) => change.type === "update-title" && change.after === "长聘学者"));
const applied = applyChanges(published, title);
check("title-applied", applied.find((person) => person.id === "jia").title === "长聘学者");
const second = compareSources({
  sources: [{
    id: "fixture",
    division: "astro",
    health: { ok: true },
    cards: parseMemberHtml(card("甲", "jia@sjtu.edu.cn", "长聘学者", "/people/100/jia", "星系形成"), "astro"),
  }],
  published: applied,
});
check("second-run-quiet", semanticChanges(second).length === 0);

const alias = run(card("甲", "jia@sjtu.edu.cn", "青年学者", "/people/200/jia-en", "星系形成"));
check("alias-not-new-person", alias.some((change) => change.type === "add-alias") && !alias.some((change) => change.type === "add"));
check("alias-keeps-id", applyChanges(published, alias).filter((person) => person.email === "jia@sjtu.edu.cn").length === 1);

const empty = compareSources({
  sources: [{ id: "astro", division: "astro", health: assessHealth("", { minPeople: 5, markers: ["teacher-item"] }), cards: [] }],
  published,
});
check("empty-fails", empty.some((change) => change.type === "source-failed") && !empty.some((change) => change.type === "absent"));
check("empty-does-not-delete", applyChanges(published, empty).length === published.length);

const shortHtml = `<div>天文与天体物理研究部</div>${card("甲", "jia@sjtu.edu.cn", "青年学者", "/people/100/jia", "星系形成")}`;
const short = compareSources({
  sources: [{
    id: "astro",
    division: "astro",
    health: assessHealth(shortHtml, { minPeople: 5, markers: ["teacher-item", "天文与天体物理研究部"] }),
    cards: [],
  }],
  published,
});
check("short-list-stops", short.some((change) => change.type === "source-failed" && change.reason === "short-list"));

const paged = `<div class="department-title">青年学者</div><a class="teacher-item" href="/people/1/a"></a><a href="/page/2">下一页</a>`;
check("pagination", assessHealth(paged, { minPeople: 1, markers: ["teacher-item"] }).reason === "pagination");

const partial = compareSources({
  sources: [
    {
      id: "astro",
      division: "astro",
      health: { ok: true, reason: "ok", count: 1 },
      cards: parseMemberHtml(card("甲", "jia@sjtu.edu.cn", "特聘学者", "/people/100/jia", "星系形成"), "astro"),
    },
    {
      id: "particle",
      division: "particle",
      health: { ok: false, reason: "fetch", count: 0 },
      cards: [],
      error: "timeout",
    },
  ],
  published: [
    ...published,
    { id: "yi", name: "乙", email: "yi@sjtu.edu.cn", title: "青年学者", directions: "中微子", profileUrls: "/people/9/yi", division: "particle", current: true },
  ],
});
check("partial-keeps-other-source", partial.some((change) => change.type === "update-title" && change.personId === "jia"));
check("partial-does-not-drop-failed-source", !partial.some((change) => change.type === "absent" && change.personId === "yi"));
check("partial-records-failure", partial.some((change) => change.type === "source-failed" && change.sourceId === "particle"));

const absent = run(`<div class="department-title">青年学者</div><a href="/people/8/bing" class="teacher-item"><div class="name">丙</div><div class="title">青年学者</div><i class="iconfont icon-mail-o"></i>bing@sjtu.edu.cn</a>`);
check("absence-is-not-delete", absent.some((change) => change.type === "absent" && change.personId === "jia"));
check("absence-apply-keeps", applyChanges(published, absent).some((person) => person.id === "jia"));

const added = run(`${card("甲", "jia@sjtu.edu.cn", "青年学者", "/people/100/jia", "星系形成")}<div class="department-title">研究员系列</div><a href="/people/9/ding" class="teacher-item"><div class="name">丁</div><div class="title">助理研究员</div><i class="iconfont icon-mail-o"></i>ding@sjtu.edu.cn<span data-directions="星系"></span></a>`);
check("add-person", added.some((change) => change.type === "add" && change.email === "ding@sjtu.edu.cn"));

const snapshot = structuredClone(published);
const rolled = applyChanges(snapshot, title);
check("rollback", JSON.stringify(snapshot) === JSON.stringify(published) && rolled !== snapshot);

const after = createHash("sha256").update(readFileSync(path.join(root, "data/people.json"))).digest("hex");
check("published-data-untouched", before === after);

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("sync self-check ok");
