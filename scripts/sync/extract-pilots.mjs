import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseCambridgeFacultyHtml, parseCambridgeProfile, CAMBRIDGE_FACULTY_URL } from "./adapters/cambridge.mjs";
import { parseNjuRankHtml, NJU_PAGES } from "./adapters/nju.mjs";
import { classifyNaocCard, parseNaocProfile, parseNaocSeniorHtml, NAOC_SENIOR_URL, NAOC_DEPARTMENTS } from "./adapters/naoc.mjs";
import { astronomyScore, mergeableName, pilotRole, pilotTopicTags } from "./pilot-policy.mjs";

const FETCHED_AT = "2026-10-15";
const REVIEWER = "pilot-2026-10-15";

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { "user-agent": "tdli-scale-atlas-sync/1.0" },
    signal: AbortSignal.timeout(40000),
    redirect: "follow",
  });
  if (!response.ok) throw new Error(`${url} HTTP ${response.status}`);
  return response.text();
}

async function mapPool(items, limit, worker) {
  const out = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      out[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => run()));
  return out;
}

function dedupe(cards) {
  const byHref = new Map();
  for (const card of cards) {
    const prev = byHref.get(card.href);
    if (!prev) {
      byHref.set(card.href, card);
      continue;
    }
    if (prev.decision !== "include" && card.decision === "include") byHref.set(card.href, card);
  }
  return [...byHref.values()];
}

export async function collectNju(fetchHtml = fetchText) {
  const cards = [];
  for (const page of NJU_PAGES) {
    const html = await fetchHtml(page.url);
    const parsed = parseNjuRankHtml(html, page);
    if (!parsed.length && page.bucket === "include") throw new Error(`nju empty ${page.rank}`);
    cards.push(...parsed);
  }
  return dedupe(cards);
}

export async function collectCambridge(fetchHtml = fetchText, { enrich = true } = {}) {
  const html = await fetchHtml(CAMBRIDGE_FACULTY_URL);
  const cards = parseCambridgeFacultyHtml(html);
  if (cards.length < 15) throw new Error(`cambridge short ${cards.length}`);
  if (!enrich) return cards;
  return mapPool(cards, 4, async (card) => {
    try {
      const profile = parseCambridgeProfile(await fetchHtml(card.href));
      const title = profile.jobTitle || card.title;
      if (profile.emeritus || /emeritus/i.test(title)) {
        return { ...card, title, decision: "exclude", reason: "个人页职务含 Emeritus，默认名录不收已退休人员。", directions: profile.directions };
      }
      if (profile.directions.length < 8) {
        return { ...card, title, decision: "defer", reason: "Faculty 名录有此人，个人页没有可用的 Research 原文。", profileTitle: profile.jobTitle };
      }
      return { ...card, title, directions: profile.directions, profileTitle: profile.jobTitle };
    } catch (error) {
      return { ...card, decision: "defer", reason: `个人页没有打开：${error instanceof Error ? error.message : String(error)}` };
    }
  });
}

export async function collectNaoc(fetchHtml = fetchText, { enrich = true } = {}) {
  const html = await fetchHtml(NAOC_SENIOR_URL);
  let cards = parseNaocSeniorHtml(html).map(classifyNaocCard);
  if (cards.length < 80) throw new Error(`naoc short ${cards.length}`);
  if (!enrich) return cards;
  return mapPool(cards, 4, async (card) => {
    if (card.decision === "exclude") return card;
    try {
      await new Promise((resolve) => setTimeout(resolve, 120));
      const profile = parseNaocProfile(await fetchHtml(card.href));
      const heading = profile.heading || "";
      let next = { ...card, profileTitle: heading, email: profile.email || card.email };
      if (!next.title) {
        if (/工程师/.test(heading)) {
          next.decision = "exclude";
          next.reason = "个人页职称是工程师，不在收录范围。";
          next.title = heading.replace(next.name, "").trim() || "工程师";
        } else if (/研究员/.test(heading) && !/博士后|访问/.test(heading)) {
          next.title = heading.replace(next.name, "").replace(/\s+/g, " ").trim();
          next.decision = "include";
          next.reason = "正高级名录未注职称，个人页写明研究员，并有研究方向原文。";
        }
      }
      if (next.decision !== "include") return next;
      if (profile.directions.length < 8) {
        next.decision = "defer";
        next.reason = "个人页没有写明研究方向或研究领域的原句，不编造。";
        return next;
      }
      next.directions = profile.directions;
      return next;
    } catch (error) {
      if (card.decision === "exclude") return card;
      return { ...card, decision: "defer", reason: `个人页没有打开：${error instanceof Error ? error.message : String(error)}` };
    }
  });
}

function count(cards, decision) {
  return cards.filter((card) => card.decision === decision).length;
}

function slugId(prefix, href) {
  const nju = href.match(/\/(i\d+)\.html/);
  if (nju) return `${prefix}-${nju[1]}`;
  const naoc = href.match(/_(\d+)\.html/);
  if (naoc) return `${prefix}-${naoc[1]}`;
  const cam = href.match(/\/people\/([^/?#]+)/);
  if (cam) return `${prefix}-${cam[1].replace(/\./g, "-").toLowerCase()}`;
  return `${prefix}-${href.replace(/[^a-z0-9]+/gi, "").slice(-24).toLowerCase()}`;
}

function findExisting(people, card) {
  const pool = people.filter((person) => !/^(nju|cam|naoc)-/.test(person.id));
  if (card.email) {
    const byEmail = pool.find((person) => person.email && person.email.toLowerCase() === card.email.toLowerCase());
    if (byEmail) return byEmail;
  }
  if (!mergeableName(card.name)) return undefined;
  const hits = pool.filter((person) => person.nameOriginal === card.name || person.nameZh === card.name || person.nameEn === card.name || (person.aliases || []).includes(card.name));
  if (hits.length === 1) return hits[0];
  return undefined;
}

export function buildSnapshot({ nju, cambridge, naoc, existingPeople }) {
  const groups = [
    {
      id: "nju-sass",
      nameZh: "南京大学天文与空间科学学院",
      country: "CN",
      adapter: "nju-rank-pages",
      urls: NJU_PAGES.map((page) => page.url),
      cards: nju,
      scope: "已打开院士、教授、副教授、助理教授、专职科研、博士后、实验技术七个官方职称页。纳入前四类里写有研究方向的人；博士后和实验技术排除；专职科研未写成教师或研究员系列的暂缓。这不是学院历史全体，也不是全球教师。",
    },
    {
      id: "cam-ioa",
      nameZh: "剑桥大学天文研究所",
      country: "GB",
      adapter: "cambridge-faculty",
      urls: [CAMBRIDGE_FACULTY_URL, "https://www.ast.cam.ac.uk/people/research-fellow"],
      cards: cambridge,
      scope: "只核验官方 Faculty 页，并打开每人的 Research 栏目。博士后、荣誉退休、专业服务人员不在这页上。Research Professors 另有页面，本轮不自动收录。",
    },
    {
      id: "naoc",
      nameZh: "中国科学院国家天文台",
      country: "CN",
      adapter: "naoc-senior",
      urls: [NAOC_SENIOR_URL],
      cards: naoc,
      scope: "只核验正高级专业技术人员名录。职称注释或个人页写明研究员、且个人页有研究方向原句的才纳入。正高级工程师和管理支撑部门排除。公开导航没有与此并列的副高级名录，副研究员及以下未覆盖。不含台属天文台的单独名录。",
    },
  ];
  const report = groups.map((group) => ({
    orgId: group.id,
    nameZh: group.nameZh,
    country: group.country,
    adapter: group.adapter,
    urls: group.urls,
    fetchedAt: FETCHED_AT,
    scope: group.scope,
    rosterCount: group.cards.length,
    included: count(group.cards, "include"),
    excluded: count(group.cards, "exclude"),
    deferred: count(group.cards, "defer"),
    status: group.cards.length ? "partial-pilot" : "blocked",
  }));
  const people = [];
  const ledger = [];
  const merges = [];
  for (const group of groups) {
    for (const card of group.cards) {
      const existing = card.decision === "include" ? findExisting(existingPeople, card) : undefined;
      const personId = existing?.id || (card.decision === "include" ? slugId(group.id === "cam-ioa" ? "cam" : group.id === "naoc" ? "naoc" : "nju", card.href) : "");
      if (existing) merges.push({ personId: existing.id, name: card.name, orgId: card.orgId, href: card.href });
      ledger.push({
        candidateId: `${group.id}:${card.href}`,
        personId,
        nameOriginal: card.name,
        nameEn: /[A-Za-z]/.test(card.name) ? card.name : "",
        email: card.email || "",
        division: card.division,
        section: card.section,
        rawTitle: card.title,
        decision: card.decision,
        current: true,
        reason: card.reason,
        conflicts: [],
        topicTags: card.decision === "include" ? pilotTopicTags(card.directions) : [],
        profileUrls: [card.href],
        directoryUrls: [card.href],
        aliasUrls: [],
        supervisorTopic: "",
        fetchedAt: FETCHED_AT,
        orgId: card.orgId,
        directions: card.directions || "",
        profileTitle: card.profileTitle || "",
        joint: Boolean(card.joint),
        mergeInto: existing?.id || "",
      });
      if (card.decision !== "include") continue;
      people.push({
        personId,
        mergeInto: existing?.id || "",
        orgId: card.orgId,
        name: card.name,
        email: card.email || "",
        title: card.title,
        directions: card.directions,
        href: card.href,
        section: card.section,
        joint: Boolean(card.joint),
        profileTitle: card.profileTitle || "",
        topicTags: pilotTopicTags(card.directions),
        role: pilotRole(card.section, card.title),
        score: astronomyScore(card.directions),
      });
    }
  }
  return { fetchedAt: FETCHED_AT, reviewer: REVIEWER, report, ledger, people, merges, departments: NAOC_DEPARTMENTS };
}

function readJson(root, file) {
  return JSON.parse(readFileSync(path.join(root, file), "utf8"));
}

function writeJson(root, file, data) {
  writeFileSync(path.join(root, file), `${JSON.stringify(data, null, 2)}\n`);
}

const PILOT_ORGS = [
  { id: "nju", nameZh: "南京大学", nameEn: "Nanjing University", aliases: ["南大", "NJU"], type: "university", parentId: "", url: "https://www.nju.edu.cn", country: "CN", countryName: "中国", locality: "南京", ror: "" },
  { id: "nju-sass", nameZh: "天文与空间科学学院", nameEn: "School of Astronomy and Space Science", aliases: ["南大天文"], type: "division", parentId: "nju", url: "https://astronomy.nju.edu.cn/szll/szgk/index.html", country: "CN", countryName: "中国", locality: "南京", ror: "" },
  { id: "cam", nameZh: "剑桥大学", nameEn: "University of Cambridge", aliases: ["Cambridge"], type: "university", parentId: "", url: "https://www.cam.ac.uk", country: "GB", countryName: "英国", locality: "Cambridge", ror: "" },
  { id: "cam-ioa", nameZh: "天文研究所", nameEn: "Institute of Astronomy", aliases: ["IoA"], type: "division", parentId: "cam", url: CAMBRIDGE_FACULTY_URL, country: "GB", countryName: "英国", locality: "Cambridge", ror: "" },
  { id: "cas", nameZh: "中国科学院", nameEn: "Chinese Academy of Sciences", aliases: ["中科院", "CAS"], type: "academy", parentId: "", url: "https://www.cas.cn", country: "CN", countryName: "中国", locality: "北京", ror: "" },
  { id: "naoc", nameZh: "国家天文台", nameEn: "National Astronomical Observatories", aliases: ["NAOC"], type: "institute", parentId: "cas", url: NAOC_SENIOR_URL, country: "CN", countryName: "中国", locality: "北京", ror: "" },
];

const NAOC_ORG_META = {
  "naoc-optical": ["光学天文研究部", "Optical Astronomy Division"],
  "naoc-radio": ["射电天文研究部", "Radio Astronomy Division"],
  "naoc-galaxy": ["星系宇宙学研究部", "Galaxies and Cosmology Division"],
  "naoc-solar": ["太阳物理研究部", "Solar Physics Division"],
  "naoc-space": ["空间科学研究部", "Space Science Division"],
  "naoc-lunar": ["月球与深空探测研究部", "Lunar and Deep Space Exploration Division"],
  "naoc-applied": ["应用天文研究部", "Applied Astronomy Division"],
  "naoc-deepspace": ["深空专项研究中心", "Deep Space Exploration Center"],
  "naoc-admin": ["管理支撑部门", "Administration Support"],
};

function pilotOrganizations() {
  const departments = Object.entries(NAOC_ORG_META).map(([id, [nameZh, nameEn]]) => ({
    id,
    nameZh,
    nameEn,
    aliases: [],
    type: "division",
    parentId: "naoc",
    url: NAOC_SENIOR_URL,
    country: "CN",
    countryName: "中国",
    locality: "北京",
    ror: "",
  }));
  return [...PILOT_ORGS, ...departments];
}

const PIGMENTS = ["#d4b483", "#7eb8c9", "#8fbf9f", "#d08a7a", "#b9a4d6"];

function pilotSourceId(orgId) {
  if (String(orgId).startsWith("naoc")) return "pilot-naoc";
  if (String(orgId).startsWith("cam")) return "pilot-cam-ioa";
  if (String(orgId).startsWith("nju")) return "pilot-nju-sass";
  return `pilot-${orgId}`;
}

export function materialize(root, snapshot) {
  const pilotIds = new Set(pilotOrganizations().map((org) => org.id));
  let people = readJson(root, "data/people.json");
  let affiliations = readJson(root, "data/affiliations.json").filter((item) => !pilotIds.has(item.orgId));
  let evidence = readJson(root, "data/evidence.json").filter((item) => !String(item.sourceId || "").startsWith("pilot-"));
  let annotations = readJson(root, "data/atlas-annotations.json");
  let editorial = readJson(root, "data/editorial.json");
  const organizations = readJson(root, "data/organizations.json").filter((org) => !pilotIds.has(org.id));
  const removed = new Set(people.filter((person) => /^(nju|cam|naoc)-/.test(person.id)).map((person) => person.id));
  people = people.filter((person) => !removed.has(person.id));
  affiliations = affiliations.filter((item) => !removed.has(item.personId));
  evidence = evidence.filter((item) => !removed.has(item.personId));
  annotations = annotations.filter((item) => !removed.has(item.personId));
  editorial = editorial.filter((item) => !item.personId || !removed.has(item.personId));

  organizations.push(...pilotOrganizations());

  snapshot.people.forEach((card, index) => {
    const chinese = /[\u4e00-\u9fff]/.test(card.name);
    if (!card.mergeInto) {
      people.push({
        id: card.personId,
        nameOriginal: card.name,
        nameZh: chinese ? card.name : "",
        nameEn: chinese ? "" : card.name,
        aliases: [card.name],
        email: card.email,
        profileUrl: card.href,
        profileUrls: [card.href],
        orcid: "",
        openAlexId: "",
        identifierStatus: "unchecked",
        topicTags: card.topicTags,
        routeAliases: [],
      });
      for (const [field, value] of [
        ["name", card.name],
        ["title", card.title],
        ["directions", card.directions],
        ["profileUrl", card.href],
      ]) {
        evidence.push({
          id: `ev-${card.personId}-${field}`,
          personId: card.personId,
          field,
          value,
          sourceId: pilotSourceId(card.orgId),
          locator: card.href,
          excerpt: String(value).slice(0, 420),
          fetchedAt: FETCHED_AT,
          reviewedAt: FETCHED_AT,
          reviewer: REVIEWER,
          status: "verified",
          note: field === "title" && card.profileTitle ? `个人页职务原文：${card.profileTitle}` : "",
        });
      }
      annotations.push({
        personId: card.personId,
        status: "pending",
        applicability: "pending",
        coverage: "pending",
        groups: [],
        panelGroup: "",
        regions: [],
        anchor: null,
        leader: null,
        relatedObjects: [],
        placementNoteZh: "还没有经过审核的尺度标注，所以名录里有此人，星图上不画区域，也不放进「尺度之外」。",
        placementNoteEn: "",
        methodVersion: "",
        reviewedAt: "",
        note: "试点机构只核到身份和方向，没有画尺度区域。",
      });
      editorial.push({
        personId: card.personId,
        shortZh: card.name,
        seal: card.name.slice(0, 1),
        titleEn: "",
        legacyTitleZh: "",
        legacyTitleEn: "",
        blurbZh: "",
        summaryZh: [],
        summaryEn: "",
        honors: [],
        homepage: "",
        photo: "",
        photoSource: "",
        photoFocus: "",
        bibliographyUrl: "",
        pigment: PIGMENTS[index % PIGMENTS.length],
        z: 0,
        contentStatus: "absent",
      });
    } else {
      const person = people.find((item) => item.id === card.mergeInto);
      if (person && card.href && !person.profileUrls.includes(card.href)) person.profileUrls.push(card.href);
      const claim = evidence.find((item) => item.personId === card.mergeInto && item.field === "directions");
      if (claim && card.directions && astronomyScore(card.directions) > astronomyScore(claim.value)) {
        evidence.push({
          id: `ev-${card.mergeInto}-${card.orgId}-directions-retained`,
          personId: card.mergeInto,
          field: "directions-retained",
          value: claim.value,
          sourceId: claim.sourceId,
          locator: claim.locator,
          excerpt: claim.value.slice(0, 420),
          fetchedAt: FETCHED_AT,
          reviewedAt: FETCHED_AT,
          reviewer: REVIEWER,
          status: "verified",
          note: "方向来源冲突。规范字段改用天文表述更明确的试点来源，这份原文保留。",
        });
        claim.value = card.directions;
        claim.note = "与另一任职来源冲突，采用天文相关表述更清楚的一份。";
        const tags = pilotTopicTags(card.directions);
        if (person) person.topicTags = [...new Set([...(person.topicTags || []), ...tags])];
      } else if (claim && card.directions && card.directions !== claim.value) {
        evidence.push({
          id: `ev-${card.mergeInto}-${card.orgId}-directions-retained`,
          personId: card.mergeInto,
          field: "directions-retained",
          value: card.directions,
          sourceId: pilotSourceId(card.orgId),
          locator: card.href,
          excerpt: card.directions.slice(0, 420),
          fetchedAt: FETCHED_AT,
          reviewedAt: FETCHED_AT,
          reviewer: REVIEWER,
          status: "verified",
          note: "另一任职来源的方向原文。规范字段保留天文表述更明确的已有来源。",
        });
      }
    }
    const personId = card.mergeInto || card.personId;
    affiliations.push({
      id: `aff-${personId}-${card.orgId}`,
      personId,
      orgId: card.orgId,
      rawTitle: card.title,
      role: card.role,
      kind: card.joint ? "joint" : "primary",
      current: true,
      startDate: "",
      endDate: "",
      divisionLabel: card.orgId,
    });
  });

  const sources = readJson(root, "data/coverage/sources.json").filter((item) => !String(item.id || "").startsWith("pilot-"));
  for (const row of snapshot.report) {
    sources.push({
      id: `pilot-${row.orgId}`,
      title: `${row.nameZh}试点名录`,
      url: row.urls[0],
      language: row.country === "GB" ? "en" : "zh",
      fetchedAt: FETCHED_AT,
      expectedMarkers: row.adapter === "cambridge-faculty" ? ["views-field-title"] : row.adapter === "naoc-senior" ? ["yjy-name"] : ["right-main"],
      minFaculty: row.adapter === "cambridge-faculty" ? 15 : row.adapter === "naoc-senior" ? 80 : 30,
      notes: `${row.scope} 适配器 ${row.adapter}。纳入 ${row.included}，排除 ${row.excluded}，暂缓 ${row.deferred}。`,
    });
  }

  writeJson(root, "data/organizations.json", organizations);
  writeJson(root, "data/people.json", people);
  writeJson(root, "data/affiliations.json", affiliations);
  writeJson(root, "data/evidence.json", evidence);
  writeJson(root, "data/atlas-annotations.json", annotations);
  writeJson(root, "data/editorial.json", editorial);
  writeJson(root, "data/coverage/sources.json", sources);
  writeJson(root, "data/coverage/pilot-ledger.json", snapshot.ledger);
  writeJson(root, "data/coverage/pilot-report.json", {
    fetchedAt: snapshot.fetchedAt,
    note: "这是三家试点机构在上述日期的官方名录覆盖，不是全球教师名录，也不是这些机构的历史全体。",
    orgs: snapshot.report,
    merges: snapshot.merges,
  });
  return {
    people: snapshot.people.filter((item) => !item.mergeInto).length,
    merges: snapshot.merges.length,
    report: snapshot.report,
  };
}

const isMain = process.argv[1] && process.argv[1].endsWith("extract-pilots.mjs");
if (isMain) {
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
  const write = process.argv.includes("--write");
  const existingPeople = JSON.parse(readFileSync(path.join(root, "data/people.json"), "utf8"));
  console.log("fetch nju");
  const nju = await collectNju();
  console.log("nju", nju.length, "include", nju.filter((item) => item.decision === "include").length);
  console.log("fetch cambridge");
  const cambridge = await collectCambridge();
  console.log("cambridge", cambridge.length, "include", cambridge.filter((item) => item.decision === "include").length);
  console.log("fetch naoc");
  const naoc = await collectNaoc();
  console.log("naoc", naoc.length, "include", naoc.filter((item) => item.decision === "include").length);
  const snapshot = buildSnapshot({ nju, cambridge, naoc, existingPeople });
  console.log(JSON.stringify(snapshot.report, null, 2));
  console.log("merges", JSON.stringify(snapshot.merges));
  const out = write ? path.join(root, "data/coverage/pilots/snapshot.json") : "/tmp/pilot-snapshot.json";
  if (write) {
    const { mkdirSync } = await import("node:fs");
    mkdirSync(path.dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify(snapshot, null, 2));
    console.log("materialized", materialize(root, snapshot));
  } else {
    writeFileSync(out, JSON.stringify({ report: snapshot.report, merges: snapshot.merges, deferred: snapshot.ledger.filter((row) => row.decision !== "include").map((row) => ({ name: row.nameOriginal, decision: row.decision, reason: row.reason, division: row.division })) }, null, 2));
    console.log("wrote", out);
  }
}
