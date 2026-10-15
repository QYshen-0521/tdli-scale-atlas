import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

function read(root, file) {
  return JSON.parse(readFileSync(path.join(root, file), "utf8"));
}

function write(root, file, data) {
  writeFileSync(path.join(root, file), `${JSON.stringify(data, null, 2)}\n`);
}

export function applyReportToData(root, report) {
  const people = read(root, "data/people.json");
  const affiliations = read(root, "data/affiliations.json");
  const evidence = read(root, "data/evidence.json");
  const annotations = read(root, "data/atlas-annotations.json");
  const editorial = read(root, "data/editorial.json");
  const ledger = read(root, "data/coverage/ledger.json");
  let touched = 0;
  for (const change of report.changes || []) {
    if (change.type === "absent" || change.type === "source-failed") continue;
    if (change.type === "update-title") {
      const affiliation = affiliations.find((item) => item.personId === change.personId);
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
      touched += 1;
    } else if (change.type === "add-alias") {
      const person = people.find((item) => item.id === change.personId);
      if (!person) continue;
      const url = change.after.startsWith("http") ? change.after : `https://tdli.sjtu.edu.cn${change.after}`;
      if (!person.profileUrls.includes(url)) person.profileUrls.push(url);
      touched += 1;
    } else if (change.type === "add") {
      const id = `p-${String(change.email || change.name).toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 24)}`;
      if (people.some((item) => item.id === id || item.email === change.email)) continue;
      const orgId = change.division === "particle" ? "tdli-particle" : change.division === "condensed" ? "tdli-condensed" : "tdli-astro";
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
        divisionLabel: change.division || "astro",
      });
      const stamp = report.checkedAt?.slice(0, 10) || "";
      for (const [field, value] of [["name", change.name], ["title", change.after], ["directions", change.directions || change.excerpt || ""], ["profileUrl", profileUrl]]) {
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
      editorial.push({
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
      });
      ledger.push({
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
      });
      touched += 1;
    }
  }
  if (!touched) return { touched };
  write(root, "data/people.json", people);
  write(root, "data/affiliations.json", affiliations);
  write(root, "data/evidence.json", evidence);
  write(root, "data/atlas-annotations.json", annotations);
  write(root, "data/editorial.json", editorial);
  write(root, "data/coverage/ledger.json", ledger);
  return { touched };
}

const isMain = process.argv[1] && process.argv[1].endsWith("apply-report.mjs");
if (isMain) {
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
  const report = JSON.parse(readFileSync(process.argv[2], "utf8"));
  const result = applyReportToData(root, report);
  console.log(`applied ${result.touched}`);
}
