import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { applyReportToData } from "./apply-report.mjs";

const failures = [];
const check = (name, ok) => {
  if (!ok) failures.push(name);
};

function fixtureRoot(files) {
  const root = mkdtempSync(path.join(tmpdir(), "apply-directions-"));
  mkdirSync(path.join(root, "data/coverage"), { recursive: true });
  const base = {
    "data/people.json": [],
    "data/affiliations.json": [],
    "data/evidence.json": [],
    "data/atlas-annotations.json": [],
    "data/editorial.json": [],
    "data/coverage/ledger.json": [],
    "data/coverage/pilot-ledger.json": [],
    "data/directions.json": {},
  };
  for (const [file, data] of Object.entries({ ...base, ...files })) {
    writeFileSync(path.join(root, file), `${JSON.stringify(data, null, 2)}\n`);
  }
  return root;
}

function readJson(root, file) {
  return JSON.parse(readFileSync(path.join(root, file), "utf8"));
}

// Copied from scripts/check-data.mjs so this fails if the index drifts from that rule.
function indexMatchesClaim(directions, personId, claimValue) {
  const expected = String(claimValue || "").split("；").map((item) => item.trim()).filter(Boolean);
  const got = directions[personId];
  return Boolean(got) && got.join("\n") === expected.join("\n");
}

const person = {
  id: "naoc-6986163",
  nameOriginal: "李菂",
  nameZh: "李菂",
  nameEn: "",
  aliases: ["李菂"],
  email: "dili@nao.cas.cn",
  profileUrl: "https://nao.cas.cn/nrc/zg/202204/t20220414_6986163.html",
  profileUrls: ["https://nao.cas.cn/nrc/zg/202204/t20220414_6986163.html"],
  orcid: "",
  openAlexId: "",
  identifierStatus: "unchecked",
  topicTags: [],
  routeAliases: [],
};
const other = { ...person, id: "kept-neighbor", nameOriginal: "邻", email: "neighbor@example.edu" };

function claim(personId, field, value) {
  return {
    id: `ev-${personId}-${field}`,
    personId,
    field,
    value,
    sourceId: "pilot-naoc",
    locator: person.profileUrl,
    excerpt: value,
    fetchedAt: "2026-10-15",
    reviewedAt: "",
    reviewer: "",
    status: "verified",
    note: "",
  };
}

const beforeDirections = {
  "kept-neighbor": ["星系形成"],
  "naoc-6986163": ["主要从事天体物理及空间科学方面的研究。"],
};
const updateRoot = fixtureRoot({
  "data/people.json": [person, other],
  "data/evidence.json": [
    claim("naoc-6986163", "directions", "主要从事天体物理及空间科学方面的研究。"),
    claim("kept-neighbor", "directions", "星系形成"),
  ],
  "data/directions.json": beforeDirections,
});
const updated = await applyReportToData(updateRoot, {
  checkedAt: "2026-10-26T05:39:23.779Z",
  changes: [
    {
      type: "update-directions",
      personId: "naoc-6986163",
      after: " 射电巡天 ； ；星际介质演化 ",
    },
    {
      type: "absent",
      personId: "kept-neighbor",
      name: "邻",
    },
  ],
}, { photos: false });
const updatedDirections = readJson(updateRoot, "data/directions.json");
const updatedEvidence = readJson(updateRoot, "data/evidence.json");
const updatedClaim = updatedEvidence.find((item) => item.personId === "naoc-6986163" && item.field === "directions");
check("update-directions-applied", updated.touched === 1 && updatedClaim.value === " 射电巡天 ； ；星际介质演化 ");
check("update-directions-index", indexMatchesClaim(updatedDirections, "naoc-6986163", updatedClaim.value));
check("update-directions-splits-semicolon", JSON.stringify(updatedDirections["naoc-6986163"]) === JSON.stringify(["射电巡天", "星际介质演化"]));
check("update-directions-keeps-neighbor", JSON.stringify(updatedDirections["kept-neighbor"]) === JSON.stringify(["星系形成"]));
check("absent-does-not-delete", readJson(updateRoot, "data/people.json").some((item) => item.id === "kept-neighbor"));

const retainedRoot = fixtureRoot({
  "data/people.json": [person],
  "data/evidence.json": [
    claim("naoc-6986163", "directions", "中微子天文学"),
    claim("naoc-6986163", "directions-retained", "暗物质直接探测"),
  ],
  "data/directions.json": { "naoc-6986163": ["中微子天文学"] },
});
const retainedBefore = readFileSync(path.join(retainedRoot, "data/directions.json"), "utf8");
const retained = await applyReportToData(retainedRoot, {
  checkedAt: "2026-10-26T00:00:00.000Z",
  changes: [{ type: "update-directions", personId: "naoc-6986163", after: "暗物质直接探测" }],
}, { photos: false });
const retainedClaim = readJson(retainedRoot, "data/evidence.json").find((item) => item.field === "directions");
check("retained-quote-not-applied", retained.touched === 0 && retainedClaim.value === "中微子天文学");
check("retained-quote-index-unchanged", readFileSync(path.join(retainedRoot, "data/directions.json"), "utf8") === retainedBefore);

const addRoot = fixtureRoot();
const added = await applyReportToData(addRoot, {
  checkedAt: "2026-10-26T00:00:00.000Z",
  changes: [{
    type: "add",
    name: "丁",
    email: "ding@sjtu.edu.cn",
    after: "助理研究员",
    directions: "星系形成；暗物质",
    href: "/people/9/ding",
    division: "astro",
    current: true,
  }],
}, { photos: false });
const addId = "p-dingsjtueducn";
const addEvidence = readJson(addRoot, "data/evidence.json").find((item) => item.personId === addId && item.field === "directions");
const addDirections = readJson(addRoot, "data/directions.json");
check("add-writes-index", added.touched === 1 && indexMatchesClaim(addDirections, addId, addEvidence.value));
check("add-splits-directions", JSON.stringify(addDirections[addId]) === JSON.stringify(["星系形成", "暗物质"]));

const mergePerson = { ...person, id: "lishu", nameOriginal: "李数", email: "shuli@sjtu.edu.cn" };
const mergeRoot = fixtureRoot({
  "data/people.json": [mergePerson],
  "data/evidence.json": [claim("lishu", "directions", "粒子物理")],
  "data/directions.json": { lishu: ["粒子物理"] },
});
const merged = await applyReportToData(mergeRoot, {
  checkedAt: "2026-10-26T00:00:00.000Z",
  changes: [{
    type: "add-affiliation",
    personId: "lishu",
    orgId: "naoc-radio",
    name: "李数",
    after: "研究员",
    directions: "暗物质与中微子天文；星系形成",
    href: "https://nao.cas.cn/example",
    preferDirections: true,
    current: true,
  }],
}, { photos: false });
const mergeEvidence = readJson(mergeRoot, "data/evidence.json");
const mergeClaim = mergeEvidence.find((item) => item.personId === "lishu" && item.field === "directions");
const mergeRetained = mergeEvidence.find((item) => item.personId === "lishu" && item.field === "directions-retained");
const mergeDirections = readJson(mergeRoot, "data/directions.json");
check("prefer-clearer-astronomy-text", merged.touched === 1 && mergeClaim.value === "暗物质与中微子天文；星系形成" && mergeRetained.value === "粒子物理");
check("prefer-clearer-updates-index", indexMatchesClaim(mergeDirections, "lishu", mergeClaim.value));

const keepRoot = fixtureRoot({
  "data/people.json": [mergePerson],
  "data/evidence.json": [claim("lishu", "directions", "中微子天文学")],
  "data/directions.json": { lishu: ["中微子天文学"] },
});
const keepBefore = readFileSync(path.join(keepRoot, "data/directions.json"), "utf8");
await applyReportToData(keepRoot, {
  checkedAt: "2026-10-26T00:00:00.000Z",
  changes: [{
    type: "add-affiliation",
    personId: "lishu",
    orgId: "nju-sass",
    name: "李数",
    after: "教授",
    directions: "粒子物理",
    href: "https://astronomy.nju.edu.cn/example",
    preferDirections: false,
    current: true,
  }],
}, { photos: false });
const keptClaim = readJson(keepRoot, "data/evidence.json").find((item) => item.field === "directions");
check("generic-particle-does-not-replace", keptClaim.value === "中微子天文学");
check("generic-particle-index-unchanged", readFileSync(path.join(keepRoot, "data/directions.json"), "utf8") === keepBefore);

const titleRoot = fixtureRoot({
  "data/people.json": [person],
  "data/affiliations.json": [{
    id: "aff-naoc-6986163-naoc-radio",
    personId: "naoc-6986163",
    orgId: "naoc-radio",
    rawTitle: "研究员",
    role: "other",
    kind: "primary",
    current: true,
    startDate: "",
    endDate: "",
    divisionLabel: "naoc-radio",
  }],
  "data/evidence.json": [claim("naoc-6986163", "title", "研究员"), claim("naoc-6986163", "directions", "射电天文")],
  "data/directions.json": { "naoc-6986163": ["射电天文"] },
});
const titleBefore = readFileSync(path.join(titleRoot, "data/directions.json"), "utf8");
await applyReportToData(titleRoot, {
  checkedAt: "2026-10-26T00:00:00.000Z",
  changes: [{ type: "update-title", personId: "naoc-6986163", orgId: "naoc-radio", after: "研究员、杰青" }],
}, { photos: false });
check("title-change-leaves-directions-file", readFileSync(path.join(titleRoot, "data/directions.json"), "utf8") === titleBefore);

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("apply self-check ok");
