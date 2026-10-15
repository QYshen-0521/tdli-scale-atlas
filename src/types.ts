export type Coverage = "focused" | "wide" | "broad" | "offplane" | "pending";

export type Group = "planet" | "compact" | "galaxy" | "cosmos" | "particle" | "lab";

export type FilterKey = "all" | "planet" | "compact" | "galaxy" | "cosmos";

export type ObjectGroup = Exclude<FilterKey, "all">;

export type Region =
  | { shape: "ellipse"; cx: number; cy: number; rx: number; ry: number }
  | { shape: "rect"; logL0: number; logL1: number; logM0: number; logM1: number }
  | { shape: "polygon"; points: [number, number][] };

export type Paper = {
  title: string;
  venue: string;
  url?: string;
};

export type AtlasStatus = "reviewed" | "pending" | "not_applicable";

export type AppointmentKind = "primary" | "joint" | "adjunct" | "retired";

export type CanonicalRole =
  | "chair"
  | "distinguished"
  | "senior"
  | "tenured"
  | "tenure_track"
  | "senior_researcher"
  | "researcher"
  | "associate_researcher"
  | "assistant_researcher"
  | "academician"
  | "professor"
  | "associate_professor"
  | "assistant_professor"
  | "faculty"
  | "other";

export type ClaimStatus = "verified" | "conflict" | "legacy" | "missing";

export type Organization = {
  id: string;
  nameZh: string;
  nameEn: string;
  aliases: string[];
  type: "university" | "institute" | "division" | "academy";
  parentId: string;
  url: string;
  country: string;
  countryName: string;
  locality: string;
  ror: string;
};

export type PersonRecord = {
  id: string;
  nameOriginal: string;
  nameZh: string;
  nameEn: string;
  aliases: string[];
  email: string;
  profileUrl: string;
  profileUrls: string[];
  orcid: string;
  openAlexId: string;
  identifierStatus: "unchecked" | "verified" | "rejected";
  topicTags: string[];
  routeAliases: string[];
};

export type Affiliation = {
  id: string;
  personId: string;
  orgId: string;
  rawTitle: string;
  role: CanonicalRole;
  kind: AppointmentKind;
  current: boolean;
  startDate: string;
  endDate: string;
  divisionLabel: string;
};

export type Evidence = {
  id: string;
  personId: string;
  field: string;
  value: string;
  sourceId: string;
  locator: string;
  excerpt: string;
  fetchedAt: string;
  reviewedAt: string;
  reviewer: string;
  status: ClaimStatus;
  note: string;
};

export type Editorial = {
  personId: string;
  shortZh: string;
  seal: string;
  titleEn: string;
  legacyTitleZh: string;
  legacyTitleEn: string;
  blurbZh: string;
  summaryZh: string[];
  summaryEn: string;
  honors: string[];
  homepage: string;
  photo: string;
  photoSource: string;
  photoFocus: string;
  bibliographyUrl: string;
  pigment: string;
  z: number;
  contentStatus: "legacy" | "absent";
};

export type AtlasAnnotation = {
  personId: string;
  status: "reviewed" | "pending";
  applicability: "chart" | "not_applicable" | "pending";
  coverage: Coverage;
  groups: Group[];
  panelGroup?: "" | "particle" | "lab" | "instrument";
  regions: Region[];
  anchor: { logL: number; logM: number } | null;
  leader: { logL: number; logM: number } | null;
  relatedObjects: string[];
  placementNoteZh: string;
  placementNoteEn: string;
  methodVersion: string;
  reviewedAt: string;
  note: string;
};

export type PaperRecord = {
  id: string;
  personId: string;
  title: string;
  venue: string;
  url: string;
  selection: string;
  verification: "legacy" | "verified";
};

export type RosterAffiliation = {
  orgId: string;
  role: CanonicalRole;
  kind: AppointmentKind;
  current: boolean;
  country: string;
  rawTitle: string;
};

export type Mentor = {
  id: string;
  nameZh: string;
  nameEn: string;
  aliases: string[];
  shortZh: string;
  seal: string;
  photo?: string;
  photoSource?: string;
  photoFocus?: string;
  titleZh: string;
  titleEn: string;
  divisionZh: string;
  email?: string;
  homepage?: string;
  profileUrl: string;
  profileUrls: string[];
  pigment: string;
  placement: "chart" | "offplane" | "pending";
  coverage: Coverage;
  groups: Group[];
  panelGroup?: "particle" | "lab" | "instrument";
  blurbZh: string;
  summaryZh: string[];
  summaryEn: string;
  interests: string[];
  honors: string[];
  papers: Paper[];
  bibliographyUrl?: string;
  regions: Region[];
  anchor: { logL: number; logM: number };
  leader?: { logL: number; logM: number };
  relatedObjects: string[];
  placementNoteZh: string;
  placementNoteEn: string;
  z: number;
  atlasStatus: AtlasStatus;
  verifiedAt: string;
  conflicts: string[];
  appointmentKind: AppointmentKind;
  current: boolean;
  role: CanonicalRole;
  orgId: string;
  topicTags: string[];
  editorialStatus: "legacy" | "absent";
  affiliations: RosterAffiliation[];
};

export type Celestial = {
  id: string;
  nameZh: string;
  nameEn: string;
  group: ObjectGroup;
  logL: number;
  logM: number;
  measureZh: string;
  blurbZh: string;
  image: string;
  credit: string;
  license: string;
  sourceUrl: string;
  priority: number;
  approx?: boolean;
};
