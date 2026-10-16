import affiliationRaw from "../data/affiliations.json";
import annotationRaw from "../data/atlas-annotations.json";
import directionRaw from "../data/directions.json";
import editorialRaw from "../data/editorial.json";
import objectRaw from "../data/objects.json";
import organizationRaw from "../data/organizations.json";
import peopleRaw from "../data/people.json";
import type {
  Affiliation,
  AtlasAnnotation,
  Celestial,
  Editorial,
  Mentor,
  Organization,
  PersonRecord,
} from "./types.ts";

export const organizations = organizationRaw as Organization[];
export const people = peopleRaw as PersonRecord[];
export const affiliations = affiliationRaw as Affiliation[];
export const editorials = editorialRaw as Editorial[];
export const annotations = annotationRaw as AtlasAnnotation[];
export const objects = objectRaw as Celestial[];
const directions = directionRaw as Record<string, string[]>;

const orgById = new Map(organizations.map((org) => [org.id, org]));
const editorialById = new Map(editorials.map((item) => [item.personId, item]));
const annotationById = new Map(annotations.map((item) => [item.personId, item]));
const affiliationsByPerson = new Map<string, Affiliation[]>();
for (const item of affiliations) {
  const list = affiliationsByPerson.get(item.personId);
  if (list) list.push(item);
  else affiliationsByPerson.set(item.personId, [item]);
}

export const mentors: Mentor[] = people.map((person) => {
  const personAffiliations = affiliationsByPerson.get(person.id) || [];
  const affiliation = personAffiliations.find((item) => item.current) || personAffiliations[0];
  const editorial = editorialById.get(person.id);
  const annotation = annotationById.get(person.id);
  const org = affiliation ? orgById.get(affiliation.orgId) : undefined;
  const placement = annotation?.applicability === "chart"
    ? "chart"
    : annotation?.applicability === "not_applicable"
      ? "offplane"
      : "pending";
  const atlasStatus = placement === "chart" ? "reviewed" : placement === "offplane" ? "not_applicable" : "pending";
  const displayZh = person.nameZh || person.nameOriginal || person.nameEn;
  const displayEn = person.nameEn || person.nameOriginal || displayZh;
  return {
    id: person.id,
    nameZh: displayZh,
    nameEn: displayEn,
    aliases: person.aliases,
    shortZh: editorial?.shortZh || displayZh,
    seal: editorial?.seal || displayZh.slice(0, 1),
    photo: editorial?.photo || undefined,
    photoSource: editorial?.photoSource || undefined,
    photoFocus: editorial?.photoFocus || undefined,
    titleZh: affiliation?.rawTitle || "",
    titleEn: editorial?.titleEn || "",
    divisionZh: org?.nameZh || "",
    email: person.email || undefined,
    homepage: editorial?.homepage || undefined,
    profileUrl: person.profileUrl,
    profileUrls: person.profileUrls,
    pigment: editorial?.pigment || "#d4b483",
    placement,
    coverage: annotation?.coverage || "pending",
    groups: annotation?.groups || [],
    panelGroup: annotation?.panelGroup || undefined,
    blurbZh: editorial?.blurbZh || "",
    summaryZh: editorial?.summaryZh || [],
    summaryEn: editorial?.summaryEn || "",
    interests: directions[person.id] || [],
    honors: editorial?.honors || [],
    // Papers and verification notes ship with the detail route, not the atlas bundle.
    papers: [],
    bibliographyUrl: editorial?.bibliographyUrl || undefined,
    regions: placement === "chart" ? annotation?.regions || [] : [],
    anchor: annotation?.anchor || { logL: 15, logM: 36 },
    leader: annotation?.leader || undefined,
    relatedObjects: annotation?.relatedObjects || [],
    placementNoteZh: annotation?.placementNoteZh || "",
    placementNoteEn: annotation?.placementNoteEn || "",
    z: editorial?.z || 0,
    atlasStatus,
    verifiedAt: "",
    conflicts: [],
    appointmentKind: affiliation?.kind || "primary",
    current: affiliation?.current ?? false,
    role: affiliation?.role || "other",
    orgId: affiliation?.orgId || "",
    topicTags: person.topicTags,
    editorialStatus: editorial?.contentStatus || "absent",
    affiliations: personAffiliations.map((item) => ({
      orgId: item.orgId,
      role: item.role,
      kind: item.kind,
      current: item.current,
      country: orgById.get(item.orgId)?.country || "",
      rawTitle: item.rawTitle,
    })),
  };
});

export const chartMentors = mentors
  .filter((mentor) => mentor.placement === "chart" && mentor.atlasStatus === "reviewed" && mentor.regions.length > 0)
  .slice()
  .sort((a, b) => a.z - b.z);

export const offplaneMentors = mentors.filter(
  (mentor) => mentor.placement === "offplane" && mentor.atlasStatus === "not_applicable",
);

const objectMap = new Map(objects.map((item) => [item.id, item]));
const mentorMap = new Map(mentors.map((item) => [item.id, item]));
for (const person of people) {
  for (const alias of person.routeAliases) mentorMap.set(alias, mentorMap.get(person.id)!);
}

export function objectById(id: string) {
  return objectMap.get(id);
}

export function mentorById(id: string | undefined) {
  if (!id) return undefined;
  return mentorMap.get(id);
}
