import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => JSON.parse(readFileSync(path.join(root, file), "utf8"));
const people = read("data/people.json");
const affiliations = read("data/affiliations.json");
const evidence = read("data/evidence.json");
const annotations = read("data/atlas-annotations.json");
const papers = read("data/papers.json");
const organizations = read("data/organizations.json");
const objects = read("data/objects.json");
const ledger = read("data/coverage/ledger.json");
const pilotLedger = read("data/coverage/pilot-ledger.json");
const coverageRows = ledger.concat(pilotLedger);
const legacy = read("data/mentors.json");
const editorial = read("data/editorial.json");
const directions = read("data/directions.json");
const errors = [];

function thumbFor(assetPath) {
  if (/\.svg$/i.test(assetPath)) return null;
  const slash = assetPath.lastIndexOf("/");
  if (slash < 0) return null;
  return `${assetPath.slice(0, slash)}/thumbs${assetPath.slice(slash)}`;
}

const objectIds = new Set(objects.map((obj) => obj.id));
const objectGroups = new Set(["planet", "compact", "galaxy", "cosmos"]);
for (const obj of objects) {
  if (!obj.image.startsWith("/assets/")) errors.push(`object ${obj.id} image path`);
  if (!existsSync(path.join(root, "public", obj.image))) errors.push(`missing file ${obj.image}`);
  const objectThumb = thumbFor(obj.image);
  if (objectThumb && !existsSync(path.join(root, "public", objectThumb))) errors.push(`missing thumb ${objectThumb}`);
  if (!(obj.logL > 0) || !(obj.logM > 0)) errors.push(`bad logs ${obj.id}`);
  if (!objectGroups.has(obj.group)) errors.push(`object ${obj.id} group`);
}

const orgIds = new Set(organizations.map((org) => org.id));
for (const org of organizations) {
  if (org.parentId && !orgIds.has(org.parentId)) errors.push(`org parent ${org.id} -> ${org.parentId}`);
}
const personIds = new Set();
for (const person of people) {
  if (personIds.has(person.id)) errors.push(`duplicate person ${person.id}`);
  personIds.add(person.id);
  if (!person.nameOriginal) errors.push(`no name ${person.id}`);
  if (!person.profileUrl?.startsWith("https://")) errors.push(`profile url ${person.id}`);
  const claims = evidence.filter((item) => item.personId === person.id);
  for (const field of ["name", "title", "directions", "profileUrl"]) {
    const claim = claims.find((item) => item.field === field && item.value && item.locator);
    if (!claim) errors.push(`missing evidence ${person.id} ${field}`);
  }
  const directions = claims.find((item) => item.field === "directions");
  if (!directions?.value?.trim()) errors.push(`empty directions ${person.id}`);
}

for (const affiliation of affiliations) {
  if (!personIds.has(affiliation.personId)) errors.push(`affiliation person ${affiliation.personId}`);
  if (!orgIds.has(affiliation.orgId)) errors.push(`affiliation org ${affiliation.orgId}`);
  if (!affiliation.rawTitle) errors.push(`affiliation title ${affiliation.personId}`);
}

const annotationIds = new Set();
for (const annotation of annotations) {
  if (annotationIds.has(annotation.personId)) errors.push(`duplicate annotation ${annotation.personId}`);
  annotationIds.add(annotation.personId);
  if (!personIds.has(annotation.personId)) errors.push(`annotation person ${annotation.personId}`);
  if (annotation.applicability !== "chart" || annotation.status !== "reviewed" || annotation.coverage === "offplane" || annotation.coverage === "pending") {
    errors.push(`not on chart ${annotation.personId}`);
  }
  if (annotation.applicability === "chart") {
    if (annotation.status !== "reviewed" || !annotation.regions?.length) errors.push(`chart annotation ${annotation.personId}`);
    if (!annotation.anchor || !Number.isFinite(annotation.anchor.logL) || !Number.isFinite(annotation.anchor.logM)) {
      errors.push(`anchor ${annotation.personId}`);
    }
    if (!annotation.leader || !Number.isFinite(annotation.leader.logL) || !Number.isFinite(annotation.leader.logM)) {
      errors.push(`leader ${annotation.personId}`);
    }
    if (!annotation.placementNoteZh?.trim()) errors.push(`placement note ${annotation.personId}`);
    if (!annotation.relatedObjects?.length) errors.push(`related objects ${annotation.personId}`);
    if (!annotation.groups?.length) errors.push(`groups ${annotation.personId}`);
  } else if (annotation.regions?.length) {
    errors.push(`non-chart annotation has geometry ${annotation.personId}`);
  }
  for (const oid of annotation.relatedObjects || []) {
    if (!objectIds.has(oid)) errors.push(`${annotation.personId} missing object ${oid}`);
  }
}
for (const person of people) {
  if (!annotationIds.has(person.id)) errors.push(`no annotation ${person.id}`);
}

for (const paper of papers) {
  if (!personIds.has(paper.personId)) errors.push(`paper person ${paper.personId}`);
  if (paper.url && !/^https?:\/\//.test(paper.url)) errors.push(`bad paper url ${paper.id}`);
}

const legacyIds = [
  "lai", "jing", "yang", "zhangpj", "zu", "feng", "mizuno", "pan", "tan", "tang", "ogihara", "darius",
  "zheng", "wangjs", "zhouhao", "liu", "zhouning", "xu", "he", "ge", "zhangjie", "wu", "yi",
];
const appSource = readFileSync(path.join(root, "src/App.tsx"), "utf8");
if (!appSource.includes('path="/mentor/:id"')) errors.push("missing legacy route /mentor/:id");
for (const id of legacyIds) {
  if (!personIds.has(id)) errors.push(`lost legacy id ${id}`);
}
for (const mentor of legacy) {
  const kept = papers.filter((paper) => paper.personId === mentor.id).map((paper) => paper.title);
  for (const paper of mentor.papers) {
    if (!kept.includes(paper.title)) errors.push(`lost paper ${mentor.id}: ${paper.title}`);
  }
  const annotation = annotations.find((item) => item.personId === mentor.id);
  if (mentor.placement === "chart" && annotation?.regions?.length !== mentor.regions.length) {
    errors.push(`lost regions ${mentor.id}`);
  }
  if (mentor.placement === "offplane") {
    if (annotation?.applicability !== "chart" || annotation.status !== "reviewed" || !annotation.regions?.length) {
      errors.push(`legacy offplane not placed on chart ${mentor.id}`);
    }
  }
  if (mentor.photo && !existsSync(path.join(root, "public", mentor.photo))) errors.push(`missing photo ${mentor.photo}`);
}
if (!annotations.some((item) => item.personId === "lai" && item.coverage === "broad")) {
  errors.push("expected lai to be the broad envelope");
}

const included = coverageRows.filter((row) => row.decision === "include");
const includedIds = new Set(included.map((row) => row.personId));
const tdliIncluded = ledger.filter((row) => row.decision === "include").map((row) => row.personId);
const pilotIncluded = pilotLedger.filter((row) => row.decision === "include").map((row) => row.personId);
if (new Set(tdliIncluded).size !== tdliIncluded.length) errors.push("duplicate included person");
if (new Set(pilotIncluded).size !== pilotIncluded.length) errors.push("duplicate pilot included person");
for (const row of coverageRows) {
  if (!row.decision || !row.reason) errors.push(`ledger row missing decision ${row.candidateId}`);
  if (row.decision === "include" && !personIds.has(row.personId)) errors.push(`include without person ${row.candidateId}`);
}
for (const person of people) {
  if (!includedIds.has(person.id)) errors.push(`person missing from ledger ${person.id}`);
}
const astroNames = included.filter((row) => row.division === "astro").map((row) => row.nameOriginal);
const requiredAstro = ["钱列加", "盛政明", "葛绪雷", "顾一舟", "黄小军", "姜海娇", "孙清辉", "杨楷", "朱鹏飞", "赖东", "景益鹏", "张鹏杰"];
for (const name of requiredAstro) {
  if (!astroNames.includes(name)) errors.push(`astronomy ledger missing ${name}`);
}
if (astroNames.length < 27) errors.push(`astronomy baseline dropped below 27: ${astroNames.length}`);
for (const name of ["何红建", "韩君", "向昕", "李数", "梅华林", "Michael Ramsey-Musolf", "Yuichiro Nakai"]) {
  if (!included.some((row) => row.nameOriginal === name || row.nameEn === name)) errors.push(`cross-division missing ${name}`);
}
const aliasPairs = {
  darius: ["42602", "42601"],
  tan: ["40675", "40265"],
  tang: ["43985", "43984"],
  wangjs: ["41275", "40018"],
  yi: ["40681", "40270"],
  zhouhao: ["41271", "40022"],
};
for (const [id, nums] of Object.entries(aliasPairs)) {
  const person = people.find((item) => item.id === id);
  const urls = (person?.profileUrls || []).join(" ");
  for (const num of nums) {
    if (!urls.includes(`/people/${num}`)) errors.push(`alias ${id} missing ${num}`);
  }
}
const yanagida = affiliations.find((item) => item.personId === "yanagida");
if (!yanagida || yanagida.current || yanagida.kind !== "retired") errors.push("yanagida should be retired and not current");
for (const person of people) {
  const claim = evidence.find((item) => item.personId === person.id && item.field === "directions" && item.value);
  if (!claim) continue;
  const expected = claim.value.split("；").map((item) => item.trim()).filter(Boolean);
  const got = directions[person.id];
  if (!got || got.join("\n") !== expected.join("\n")) errors.push(`directions index ${person.id}`);
}
for (const id of Object.keys(directions)) {
  if (!personIds.has(id)) errors.push(`directions index extra ${id}`);
}
for (const entry of editorial) {
  if (!entry.photo) continue;
  if (!existsSync(path.join(root, "public", entry.photo))) errors.push(`missing photo ${entry.photo}`);
  const photoThumb = thumbFor(entry.photo);
  if (photoThumb && !existsSync(path.join(root, "public", photoThumb))) errors.push(`missing thumb ${photoThumb}`);
}

const emails = new Map();
for (const person of people) {
  if (!person.email) continue;
  if (emails.has(person.email)) errors.push(`duplicate email ${person.email}`);
  emails.set(person.email, person.id);
}

const sync = spawnSync(process.execPath, ["scripts/sync/self-check.mjs"], { cwd: root, encoding: "utf8" });
if (sync.status !== 0) errors.push(`sync self-check failed\n${sync.stdout}\n${sync.stderr}`);
const roster = spawnSync(process.execPath, ["--experimental-strip-types", "scripts/roster-self-check.ts"], {
  cwd: root,
  encoding: "utf8",
});
if (roster.status !== 0) errors.push(`roster self-check failed\n${roster.stdout}\n${roster.stderr}`);
const pilot = spawnSync(process.execPath, ["scripts/sync/pilot-self-check.mjs"], { cwd: root, encoding: "utf8" });
if (pilot.status !== 0) errors.push(`pilot self-check failed\n${pilot.stdout}\n${pilot.stderr}`);

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
const pending = annotations.filter((item) => item.applicability === "pending").length;
console.log(`ok: ${people.length} people, ${objects.length} objects, astronomy ledger ${astroNames.length}, pending annotations ${pending}`);
