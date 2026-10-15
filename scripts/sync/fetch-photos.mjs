import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { acquirePortrait, commitPortrait, mapPool, markSharedPlaceholders } from "./photos.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(file) {
  return JSON.parse(readFileSync(path.join(root, file), "utf8"));
}

const people = read("data/people.json");
const editorial = read("data/editorial.json");
const byId = new Map(editorial.map((entry) => [entry.personId, entry]));

const acquired = await mapPool(people, 4, async (person, index) => {
  const entry = byId.get(person.id);
  const result = await acquirePortrait({
    personId: person.id,
    profileUrls: person.profileUrls?.length ? person.profileUrls : [person.profileUrl],
    photoSource: entry?.photoSource || person.profileUrl || "",
  });
  if ((index + 1) % 20 === 0 || index + 1 === people.length) {
    console.log(`已查看 ${index + 1}/${people.length}`);
  }
  return { person, entry, had: Boolean(entry?.photo), ...result };
});

markSharedPlaceholders(acquired);

const summary = { refreshed: [], filled: [], unchanged: [], kept: [], missing: [] };
for (const row of acquired) {
  const name = row.person.nameOriginal || row.person.nameEn || row.person.id;
  if (!row.ok) {
    const item = { id: row.person.id, name, reason: row.reason || "没有肖像" };
    if (row.had) {
      summary.kept.push(item);
      console.warn(`保留原图 ${row.person.id} ${name} — ${item.reason}`);
    } else {
      summary.missing.push(item);
      console.warn(`肖像未取得 ${row.person.id} ${name} — ${item.reason}`);
    }
    continue;
  }
  const saved = commitPortrait({ root, personId: row.person.id, bytes: row.bytes, kind: row.kind });
  if (row.had && !saved.changed && row.entry?.photo === saved.photo) {
    summary.unchanged.push({ id: row.person.id, name, photo: saved.photo });
    continue;
  }
  if (row.entry) {
    row.entry.photo = saved.photo;
    row.entry.photoSource = row.photoSource;
  }
  const item = { id: row.person.id, name, photo: saved.photo, photoSource: row.photoSource, imageUrl: row.imageUrl, width: row.width, height: row.height };
  if (row.had) summary.refreshed.push(item);
  else summary.filled.push(item);
}

writeFileSync(path.join(root, "data/editorial.json"), `${JSON.stringify(editorial, null, 2)}\n`);

let mentorsRaw = readFileSync(path.join(root, "data/mentors.json"), "utf8");
for (const mentor of JSON.parse(mentorsRaw)) {
  const entry = byId.get(mentor.id);
  if (!entry) continue;
  for (const field of ["photo", "photoSource"]) {
    if (!entry[field] || mentor[field] === entry[field]) continue;
    const idAt = mentorsRaw.indexOf(`"id": "${mentor.id}"`);
    if (idAt < 0) continue;
    const nextId = mentorsRaw.indexOf('"id": "', idAt + 8);
    const end = nextId < 0 ? mentorsRaw.length : nextId;
    const block = mentorsRaw.slice(idAt, end);
    const pattern = new RegExp(`"${field}": "([^"]*)"`);
    if (!pattern.test(block)) continue;
    const updated = block.replace(pattern, `"${field}": ${JSON.stringify(entry[field])}`);
    mentorsRaw = mentorsRaw.slice(0, idAt) + updated + mentorsRaw.slice(end);
  }
}
writeFileSync(path.join(root, "data/mentors.json"), mentorsRaw);

const report = {
  checkedAt: new Date().toISOString(),
  people: people.length,
  refreshed: summary.refreshed.length,
  filled: summary.filled.length,
  unchanged: summary.unchanged.length,
  kept: summary.kept.length,
  missing: summary.missing.length,
  refreshedIds: summary.refreshed.map((item) => item.id),
  filledIds: summary.filled.map((item) => item.id),
  kept: summary.kept,
  missing: summary.missing,
};
writeFileSync("/tmp/photo-report.json", `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({
  refreshed: report.refreshed,
  filled: report.filled,
  unchanged: report.unchanged,
  kept: report.kept,
  missing: report.missing,
}, null, 2));
