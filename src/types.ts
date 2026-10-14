export type Coverage = "focused" | "wide" | "broad" | "offplane";

export type Group = "planet" | "compact" | "galaxy" | "cosmos" | "particle" | "lab";

export type FilterKey = "all" | "planet" | "compact" | "galaxy" | "cosmos";

export type Region =
  | { shape: "ellipse"; cx: number; cy: number; rx: number; ry: number }
  | { shape: "rect"; logL0: number; logL1: number; logM0: number; logM1: number }
  | { shape: "polygon"; points: [number, number][] };

export type Paper = {
  title: string;
  venue: string;
  url?: string;
};

export type Mentor = {
  id: string;
  nameZh: string;
  nameEn: string;
  shortZh: string;
  seal: string;
  titleZh: string;
  titleEn: string;
  divisionZh: string;
  email?: string;
  homepage?: string;
  profileUrl: string;
  pigment: string;
  placement: "chart" | "offplane";
  coverage: Coverage;
  groups: Group[];
  panelGroup?: "particle" | "lab";
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
};

export type Celestial = {
  id: string;
  nameZh: string;
  nameEn: string;
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
