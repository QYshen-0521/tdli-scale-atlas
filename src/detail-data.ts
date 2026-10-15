import evidenceRaw from "../data/evidence.json";
import paperRaw from "../data/papers.json";
import type { Evidence, Paper, PaperRecord } from "./types.ts";

const evidence = evidenceRaw as Evidence[];
const papers = paperRaw as PaperRecord[];

const evidenceByPerson = new Map<string, Evidence[]>();
for (const item of evidence) {
  const list = evidenceByPerson.get(item.personId);
  if (list) list.push(item);
  else evidenceByPerson.set(item.personId, [item]);
}

const papersByPerson = new Map<string, PaperRecord[]>();
for (const item of papers) {
  const list = papersByPerson.get(item.personId);
  if (list) list.push(item);
  else papersByPerson.set(item.personId, [item]);
}

export function evidenceFor(personId: string) {
  return evidenceByPerson.get(personId) || [];
}

export function papersFor(personId: string): Paper[] {
  return (papersByPerson.get(personId) || []).map((item) => ({
    title: item.title,
    venue: item.venue,
    url: item.url || undefined,
  }));
}

export function verifiedAt(personId: string) {
  const dates = evidenceFor(personId)
    .filter((item) => item.reviewedAt && item.field !== "editorial")
    .map((item) => item.reviewedAt);
  return dates.sort().at(-1) || "";
}

export function conflictsFor(personId: string) {
  return evidenceFor(personId)
    .filter((item) => item.note && item.status !== "legacy")
    .map((item) => item.note);
}

export function detailFor(personId: string) {
  return {
    evidence: evidenceFor(personId).filter((item) => item.status !== "legacy"),
    papers: papersFor(personId),
    verifiedAt: verifiedAt(personId),
    conflicts: conflictsFor(personId),
  };
}
