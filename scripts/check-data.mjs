import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mentors = JSON.parse(readFileSync(path.join(root, "data/mentors.json"), "utf8"));
const objects = JSON.parse(readFileSync(path.join(root, "data/objects.json"), "utf8"));
const ids = new Set();
const objectIds = new Set(objects.map((obj) => obj.id));
const errors = [];

const objectGroups = new Set(["planet", "compact", "galaxy", "cosmos"]);
for (const obj of objects) {
  if (!obj.image.startsWith("/assets/")) errors.push(`object ${obj.id} image path`);
  const file = path.join(root, "public", obj.image);
  if (!existsSync(file)) errors.push(`missing file ${obj.image}`);
  if (!(obj.logL > 0) || !(obj.logM > 0)) errors.push(`bad logs ${obj.id}`);
  if (!objectGroups.has(obj.group)) errors.push(`object ${obj.id} group`);
}

for (const mentor of mentors) {
  if (ids.has(mentor.id)) errors.push(`duplicate ${mentor.id}`);
  ids.add(mentor.id);
  if (!mentor.photo?.startsWith("/assets/mentors/")) errors.push(`mentor ${mentor.id} photo`);
  else if (!existsSync(path.join(root, "public", mentor.photo))) errors.push(`missing photo ${mentor.photo}`);
  if (!mentor.papers?.length) errors.push(`no papers ${mentor.id}`);
  for (const paper of mentor.papers) {
    if (paper.url && !/^https?:\/\//.test(paper.url)) errors.push(`bad url ${mentor.id}`);
  }
  for (const oid of mentor.relatedObjects) {
    if (!objectIds.has(oid)) errors.push(`${mentor.id} missing object ${oid}`);
  }
  if (mentor.placement === "offplane") {
    if (mentor.coverage !== "offplane" || mentor.regions.length) errors.push(`offplane ${mentor.id} has a region`);
  } else {
    if (!mentor.regions.length) errors.push(`chart ${mentor.id} has no region`);
    if (mentor.coverage === "offplane") errors.push(`chart ${mentor.id} marked offplane`);
  }
}

const broad = mentors.filter((m) => m.coverage === "broad").map((m) => m.id);
if (!broad.includes("lai")) errors.push("expected lai to be the broad envelope");

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`ok: ${mentors.length} mentors, ${objects.length} objects, broad: ${broad.join(", ")}`);
