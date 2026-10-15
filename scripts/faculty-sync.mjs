import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { NAOC_DEPARTMENTS } from "./sync/adapters/naoc.mjs";
import { applyChanges, compareSources, semanticChanges } from "./sync/compare.mjs";
import { collectCambridge, collectNaoc, collectNju } from "./sync/extract-pilots.mjs";
import { assessHealth, parseMemberHtml } from "./sync/parse.mjs";

const SOURCES = [
  {
    id: "tdli-astro-member",
    division: "astro",
    url: "https://tdli.sjtu.edu.cn/research/astronomy-and-astrophysics-division/member",
    minPeople: 20,
    markers: ["teacher-item", "天文与天体物理研究部"],
  },
  {
    id: "tdli-particle-member",
    division: "particle",
    url: "https://tdli.sjtu.edu.cn/research/particle-and-nuclear-physics-division/member",
    minPeople: 15,
    markers: ["teacher-item", "粒子与核物理研究部"],
  },
  {
    id: "tdli-condensed-member",
    division: "condensed",
    url: "https://tdli.sjtu.edu.cn/research/condensed-matter-division/member",
    minPeople: 15,
    markers: ["teacher-item", "凝聚态物理研究部"],
  },
];

const PILOTS = [
  {
    id: "pilot-nju-sass",
    policy: "pilot",
    division: "nju-sass",
    orgIds: ["nju-sass"],
    minCards: 30,
    collect: collectNju,
  },
  {
    id: "pilot-cam-ioa",
    policy: "pilot",
    division: "cam-ioa",
    orgIds: ["cam-ioa"],
    minCards: 15,
    collect: (fetchHtml) => collectCambridge(fetchHtml, { enrich: true }),
  },
  {
    id: "pilot-naoc",
    policy: "pilot",
    division: "naoc",
    orgIds: Object.values(NAOC_DEPARTMENTS),
    minCards: 80,
    collect: (fetchHtml) => collectNaoc(fetchHtml, { enrich: true }),
  },
];

function publishedFromRepo(root) {
  const people = JSON.parse(readFileSync(path.join(root, "data/people.json"), "utf8"));
  const affiliations = JSON.parse(readFileSync(path.join(root, "data/affiliations.json"), "utf8"));
  const evidence = JSON.parse(readFileSync(path.join(root, "data/evidence.json"), "utf8"));
  return people.map((person) => {
    const personAffiliations = affiliations.filter((item) => item.personId === person.id);
    const affiliation = personAffiliations[0];
    const directions = evidence.find((item) => item.personId === person.id && item.field === "directions");
    const retained = evidence.find((item) => item.personId === person.id && item.field === "directions-retained");
    return {
      id: person.id,
      name: person.nameOriginal,
      email: person.email,
      title: affiliation?.rawTitle || "",
      directions: directions?.value || "",
      retainedDirections: retained?.value || "",
      profileUrls: (person.profileUrls || []).join(" "),
      division: affiliation?.divisionLabel || "",
      orgId: affiliation?.orgId || "",
      orgIds: personAffiliations.map((item) => item.orgId),
      titlesByOrg: Object.fromEntries(personAffiliations.map((item) => [item.orgId, item.rawTitle])),
      current: affiliation?.current ?? true,
    };
  });
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { "user-agent": "tdli-scale-atlas-sync/1.0" },
    signal: AbortSignal.timeout(40000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

export async function runFacultySync({ root, fetchHtml = fetchText, outDir }) {
  const published = publishedFromRepo(root);
  const sources = [];
  for (const source of PILOTS) {
    try {
      const cards = await source.collect(fetchHtml);
      const health = cards.length >= source.minCards
        ? { ok: true, reason: "ok", count: cards.length }
        : { ok: false, reason: "short-list", count: cards.length };
      sources.push({ ...source, health, cards: health.ok ? cards : [], error: "" });
    } catch (error) {
      sources.push({
        ...source,
        health: { ok: false, reason: "fetch", count: 0 },
        cards: [],
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  for (const source of SOURCES) {
    try {
      const html = await fetchHtml(source.url, source);
      const health = assessHealth(html, source);
      sources.push({ ...source, health, cards: health.ok ? parseMemberHtml(html, source.division) : [], error: "" });
    } catch (error) {
      sources.push({
        ...source,
        health: { ok: false, reason: "fetch", count: 0 },
        cards: [],
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  const changes = compareSources({ sources, published });
  const meaningful = semanticChanges(changes).filter((change) => change.type !== "absent");
  const report = {
    checkedAt: new Date().toISOString(),
    sources: sources.map((source) => ({
      id: source.id,
      ok: source.health.ok,
      reason: source.health.reason,
      count: source.health.count,
      error: source.error,
    })),
    changeCount: meaningful.length,
    absentCount: changes.filter((change) => change.type === "absent").length,
    changes,
  };
  if (outDir) {
    mkdirSync(outDir, { recursive: true });
    writeFileSync(path.join(outDir, "report.json"), JSON.stringify(report, null, 2));
    writeFileSync(path.join(outDir, "report.md"), renderReport(report));
  }
  return { report, published, preview: applyChanges(published, changes) };
}

function renderReport(report) {
  const lines = [
    `# 师资检查 ${report.checkedAt}`,
    "",
    "待审变更不会自动进入已发布数据。来源失败或名单缺席不会删除人员。",
    "",
    "## 来源",
    ...report.sources.map((source) => `- ${source.id}: ${source.ok ? "成功" : "失败"}（${source.reason}，条目 ${source.count}）${source.error ? ` ${source.error}` : ""}`),
    "",
    `字段变更 ${report.changeCount} 条，缺席提醒 ${report.absentCount} 条。`,
    "",
  ];
  for (const change of report.changes) {
    if (change.type === "source-failed") continue;
    lines.push(`- ${change.type} ${change.name || change.personId || ""}：${change.before || "（空）"} → ${change.after || "（不删除）"}`);
    if (change.excerpt) lines.push(`  证据：${change.excerpt}`);
  }
  if (!report.changes.length) lines.push("没有检测到变化。");
  return lines.join("\n") + "\n";
}

const isMain = process.argv[1] && process.argv[1].endsWith("faculty-sync.mjs");
if (isMain) {
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
  const outFlag = process.argv.indexOf("--out");
  const outDir = outFlag >= 0 ? process.argv[outFlag + 1] : "";
  const result = await runFacultySync({ root, outDir });
  console.log(result.report.sources.map((source) => `${source.id} ${source.ok ? "ok" : source.reason}`).join("\n"));
  console.log(`changes ${result.report.changeCount}, absent ${result.report.absentCount}`);
  if (!result.report.changeCount) console.log("无字段变化，不需要教师数据 PR。");
}
