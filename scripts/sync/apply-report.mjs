import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fillMissingPortraits } from "./photos.mjs";

function read(root, file) {
  return JSON.parse(readFileSync(path.join(root, file), "utf8"));
}

function readOptional(root, file) {
  const full = path.join(root, file);
  if (!existsSync(full)) return null;
  return JSON.parse(readFileSync(full, "utf8"));
}

function write(root, file, data) {
  writeFileSync(path.join(root, file), `${JSON.stringify(data, null, 2)}\n`);
}

// Same split as scripts/check-data.mjs: full-width semicolon only.
export function directionItems(value) {
  return String(value || "").split("；").map((item) => item.trim()).filter(Boolean);
}

function sortedDirections(directions) {
  return Object.fromEntries(Object.entries(directions).sort(([a], [b]) => a.localeCompare(b)));
}

export async function applyReportToData(root, report, options = {}) {
  const people = read(root, "data/people.json");
  const affiliations = read(root, "data/affiliations.json");
  const evidence = read(root, "data/evidence.json");
  const annotations = read(root, "data/atlas-annotations.json");
  const editorial = read(root, "data/editorial.json");
  const ledger = read(root, "data/coverage/ledger.json");
  const pilotLedgerPath = "data/coverage/pilot-ledger.json";
  const pilotLedger = read(root, pilotLedgerPath);
  const directionsPath = "data/directions.json";
  const directions = readOptional(root, directionsPath) || {};
  let pilotTouched = false;
  let directionsTouched = false;
  let touched = 0;
  const addedEditorial = [];
  const syncDirections = (personId, value) => {
    const items = directionItems(value);
    if (!personId || !items.length) return;
    directions[personId] = items;
    directionsTouched = true;
  };
  for (const change of report.changes || []) {
    if (change.type === "absent" || change.type === "source-failed") continue;
    if (change.type === "update-title") {
      const affiliation = change.orgId
        ? affiliations.find((item) => item.personId === change.personId && item.orgId === change.orgId)
        : affiliations.find((item) => item.personId === change.personId);
      const claim = evidence.find((item) => item.personId === change.personId && item.field === "title");
      if (!affiliation) continue;
      affiliation.rawTitle = change.after;
      if (claim) claim.value = change.after;
      for (const row of ledger) {
        if (row.personId === change.personId) row.rawTitle = change.after;
      }
      touched += 1;
    } else if (change.type === "update-directions") {
      const claim = evidence.find((item) => item.personId === change.personId && item.field === "directions");
      const retained = evidence.find((item) => item.personId === change.personId && item.field === "directions-retained");
      if (!claim) continue;
      const norm = (value) => String(value || "").replace(/\s+/g, "").replace(/[，,]/g, "、");
      if (retained && norm(change.after) === norm(retained.value)) continue;
      claim.value = change.after;
      claim.status = "verified";
      syncDirections(change.personId, change.after);
      touched += 1;
    } else if (change.type === "add-alias") {
      const person = people.find((item) => item.id === change.personId);
      if (!person) continue;
      const url = change.after.startsWith("http") ? change.after : `https://tdli.sjtu.edu.cn${change.after}`;
      if (!person.profileUrls.includes(url)) person.profileUrls.push(url);
      touched += 1;
    } else if (change.type === "add-affiliation") {
      if (!change.orgId || affiliations.some((item) => item.personId === change.personId && item.orgId === change.orgId)) continue;
      affiliations.push({
        id: `aff-${change.personId}-${change.orgId}`,
        personId: change.personId,
        orgId: change.orgId,
        rawTitle: change.after || "",
        role: "other",
        kind: "primary",
        current: change.current !== false,
        startDate: "",
        endDate: "",
        divisionLabel: change.orgId,
      });
      const person = people.find((item) => item.id === change.personId);
      const href = change.href?.startsWith("http") ? change.href : "";
      if (person && href && !person.profileUrls.includes(href)) person.profileUrls.push(href);
      if (change.preferDirections && change.directions) {
        const claim = evidence.find((item) => item.personId === change.personId && item.field === "directions");
        if (claim && claim.value !== change.directions) {
          evidence.push({
            id: `ev-${change.personId}-${change.orgId}-directions-retained`,
            personId: change.personId,
            field: "directions-retained",
            value: claim.value,
            sourceId: claim.sourceId,
            locator: claim.locator,
            excerpt: String(claim.value).slice(0, 420),
            fetchedAt: report.checkedAt?.slice(0, 10) || "",
            reviewedAt: "",
            reviewer: "",
            status: "verified",
            note: "方向来源冲突。规范字段改用天文表述更明确的一份。",
          });
          claim.value = change.directions;
          claim.note = "与另一任职来源冲突，采用天文相关表述更清楚的一份。";
          syncDirections(change.personId, change.directions);
        }
      }
      pilotLedger.push({
        candidateId: `sync:${change.orgId}:${change.personId}`,
        personId: change.personId,
        nameOriginal: change.name || person?.nameOriginal || "",
        nameEn: "",
        email: change.email || "",
        division: change.orgId,
        section: "",
        rawTitle: change.after || "",
        decision: "include",
        current: true,
        reason: "周更发现此人已在其他机构，合并为同一人的另一条任职。",
        conflicts: [],
        topicTags: [],
        profileUrls: href ? [href] : [],
        directoryUrls: href ? [href] : [],
        aliasUrls: [],
        supervisorTopic: "",
        fetchedAt: report.checkedAt?.slice(0, 10) || "",
        appearances: [],
      });
      pilotTouched = true;
      touched += 1;
    } else if (change.type === "add") {
      const id = `p-${String(change.email || change.name).toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 24)}`;
      if (people.some((item) => item.id === id || (change.email && item.email === change.email))) continue;
      const orgId = change.orgId || (change.division === "particle" ? "tdli-particle" : change.division === "condensed" ? "tdli-condensed" : "tdli-astro");
      const profileUrl = change.href?.startsWith("http") ? change.href : `https://tdli.sjtu.edu.cn${change.href || ""}`;
      people.push({
        id,
        nameOriginal: change.name,
        nameZh: /[\u4e00-\u9fff]/.test(change.name || "") ? change.name : "",
        nameEn: /[\u4e00-\u9fff]/.test(change.name || "") ? "" : change.name,
        aliases: [change.name],
        email: change.email || "",
        profileUrl,
        profileUrls: [profileUrl],
        orcid: "",
        openAlexId: "",
        identifierStatus: "unchecked",
        topicTags: [],
        routeAliases: [],
      });
      affiliations.push({
        id: `aff-${id}-tdli`,
        personId: id,
        orgId,
        rawTitle: change.after || "",
        role: "other",
        kind: change.current === false ? "retired" : "primary",
        current: change.current !== false,
        startDate: "",
        endDate: "",
        divisionLabel: change.orgId || change.division || "astro",
      });
      const stamp = report.checkedAt?.slice(0, 10) || "";
      const directionValue = change.directions || change.excerpt || "";
      for (const [field, value] of [["name", change.name], ["title", change.after], ["directions", directionValue], ["profileUrl", profileUrl]]) {
        evidence.push({
          id: `ev-${id}-${field}`,
          personId: id,
          field,
          value,
          sourceId: change.sourceId || "",
          locator: profileUrl,
          excerpt: String(value).slice(0, 420),
          fetchedAt: stamp,
          reviewedAt: "",
          reviewer: "",
          status: "verified",
          note: "周更提案写入。合并前请再看一眼来源。",
        });
      }
      syncDirections(id, directionValue);
      annotations.push({
        personId: id,
        status: "pending",
        applicability: "pending",
        coverage: "pending",
        groups: [],
        panelGroup: "",
        regions: [],
        anchor: null,
        leader: null,
        relatedObjects: [],
        placementNoteZh: "还没有经过审核的尺度标注，所以名录里有此人，星图上不画区域。",
        placementNoteEn: "",
        methodVersion: "",
        reviewedAt: "",
        note: "周更新增，尺度标注待审核。",
      });
      const entry = {
        personId: id,
        shortZh: change.name,
        seal: String(change.name || "?").slice(0, 1),
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
        pigment: "#d4b483",
        z: 0,
        contentStatus: "absent",
      };
      editorial.push(entry);
      addedEditorial.push(entry);
      const ledgerRow = {
        candidateId: `sync:${change.email || id}`,
        personId: id,
        nameOriginal: change.name,
        nameEn: "",
        email: change.email || "",
        division: change.division || "",
        section: "",
        rawTitle: change.after || "",
        decision: "include",
        current: change.current !== false,
        reason: "周更从来源页发现的范围内人员。",
        conflicts: [],
        topicTags: [],
        profileUrls: [profileUrl],
        directoryUrls: [profileUrl],
        aliasUrls: [],
        supervisorTopic: "",
        fetchedAt: stamp,
        appearances: [],
      };
      if (change.orgId && !String(change.orgId).startsWith("tdli")) {
        pilotLedger.push(ledgerRow);
        pilotTouched = true;
      } else {
        ledger.push(ledgerRow);
      }
      touched += 1;
    }
  }
  let photoMisses = [];
  if (touched && options.photos !== false && addedEditorial.length) {
    const portraits = await fillMissingPortraits(root, addedEditorial, people, options);
    photoMisses = portraits.misses;
  }
  if (!touched) return { touched, photoMisses };
  write(root, "data/people.json", people);
  write(root, "data/affiliations.json", affiliations);
  write(root, "data/evidence.json", evidence);
  write(root, "data/atlas-annotations.json", annotations);
  write(root, "data/editorial.json", editorial);
  write(root, "data/coverage/ledger.json", ledger);
  if (pilotTouched) write(root, pilotLedgerPath, pilotLedger);
  if (directionsTouched) write(root, directionsPath, sortedDirections(directions));
  return { touched, photoMisses };
}

const isMain = process.argv[1] && process.argv[1].endsWith("apply-report.mjs");
if (isMain) {
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
  const report = JSON.parse(readFileSync(process.argv[2], "utf8"));
  const result = await applyReportToData(root, report);
  console.log(`applied ${result.touched}`);
  for (const miss of result.photoMisses || []) console.warn(`肖像未取得，人已写入名录：${miss.id} ${miss.name} — ${miss.reason}`);
}
