import type { FilterKey, Organization, RosterAffiliation } from "./types.ts";

export type RosterQuery = {
  q: string;
  org: string;
  role: string;
  post: "current" | "retired" | "joint" | "adjunct" | "all";
  topic: string;
  atlas: "" | "reviewed" | "pending" | "not_applicable";
  country: string;
  scale: FilterKey;
};

export type RosterPerson = {
  id: string;
  nameZh: string;
  nameEn: string;
  aliases: string[];
  email?: string;
  interests: string[];
  topicTags: string[];
  atlasStatus: "reviewed" | "pending" | "not_applicable";
  placement?: "chart" | "offplane" | "pending";
  affiliations: RosterAffiliation[];
  divisionZh?: string;
};

export type RosterResult<T extends RosterPerson = RosterPerson> = {
  people: T[];
  total: number;
  annotated: number;
  notApplicable: number;
  pending: number;
};

export function defaultRosterQuery(): RosterQuery {
  return {
    q: "",
    org: "tdli",
    role: "",
    post: "current",
    topic: "",
    atlas: "",
    country: "",
    scale: "all",
  };
}

export function rosterQueryFromParams(params: URLSearchParams): RosterQuery {
  const fallback = defaultRosterQuery();
  const post = params.get("post");
  const atlas = params.get("atlas");
  const scale = params.get("scale");
  const posts = new Set(["current", "retired", "joint", "adjunct", "all"]);
  const atlases = new Set(["", "reviewed", "pending", "not_applicable"]);
  const scales = new Set(["all", "planet", "compact", "galaxy", "cosmos"]);
  return {
    q: params.get("q") || "",
    org: params.get("org") || fallback.org,
    role: params.get("role") || "",
    post: post && posts.has(post) ? (post as RosterQuery["post"]) : fallback.post,
    topic: params.get("topic") || "",
    atlas: atlas && atlases.has(atlas) ? (atlas as RosterQuery["atlas"]) : "",
    country: params.get("country") || "",
    scale: scale && scales.has(scale) ? (scale as FilterKey) : "all",
  };
}

export function writeRosterParams(current: URLSearchParams, query: RosterQuery) {
  const next = new URLSearchParams(current);
  const put = (key: string, value: string, omit: string) => {
    if (!value || value === omit) next.delete(key);
    else next.set(key, value);
  };
  put("q", query.q.trim(), "");
  put("org", query.org, "tdli");
  put("role", query.role, "");
  put("post", query.post, "current");
  put("topic", query.topic, "");
  put("atlas", query.atlas, "");
  put("country", query.country, "");
  put("scale", query.scale, "all");
  return next;
}

function orgChain(orgId: string, byId: Map<string, Organization>) {
  const ids: string[] = [];
  let cursor = byId.get(orgId);
  const guard = new Set<string>();
  while (cursor && !guard.has(cursor.id)) {
    guard.add(cursor.id);
    ids.push(cursor.id);
    cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
  }
  return ids;
}

function affiliationMatches(
  affiliation: RosterAffiliation,
  orgs: Map<string, Organization>,
  query: RosterQuery,
) {
  if (query.post === "current" && !affiliation.current) return false;
  if (query.post === "retired" && affiliation.kind !== "retired") return false;
  if (query.post === "joint" && affiliation.kind !== "joint") return false;
  if (query.post === "adjunct" && affiliation.kind !== "adjunct") return false;
  if (query.role && affiliation.role !== query.role) return false;
  if (query.country && affiliation.country !== query.country) return false;
  if (query.org && query.org !== "all") {
    const chain = orgChain(affiliation.orgId, orgs);
    if (!chain.includes(query.org)) return false;
  }
  return true;
}

function haystack(person: RosterPerson, orgs: Map<string, Organization>) {
  const orgNames = person.affiliations.flatMap((item) => {
    const org = orgs.get(item.orgId);
    return org ? [org.nameZh, org.nameEn, ...org.aliases, item.rawTitle] : [item.rawTitle];
  });
  return [person.nameZh, person.nameEn, person.email || "", ...person.aliases, ...person.interests, ...orgNames]
    .join(" ")
    .toLowerCase();
}

export function selectRoster<T extends RosterPerson>(
  people: T[],
  organizations: Organization[],
  query: RosterQuery,
): RosterResult<T> {
  const orgs = new Map(organizations.map((org) => [org.id, org]));
  const needle = query.q.trim().toLowerCase();
  const seen = new Set<string>();
  const matched: T[] = [];
  for (const person of people) {
    if (seen.has(person.id)) continue;
    if (query.atlas === "reviewed" && person.atlasStatus !== "reviewed") continue;
    if (query.atlas === "pending" && person.atlasStatus !== "pending") continue;
    if (query.atlas === "not_applicable" && person.atlasStatus !== "not_applicable") continue;
    if (query.topic && !person.topicTags.includes(query.topic)) continue;
    const hit = person.affiliations.some((affiliation) => affiliationMatches(affiliation, orgs, query));
    if (!hit) continue;
    if (needle && !haystack(person, orgs).includes(needle)) continue;
    seen.add(person.id);
    matched.push(person);
  }
  return {
    people: matched,
    total: matched.length,
    annotated: matched.filter((person) => person.atlasStatus === "reviewed" && person.placement !== "offplane" && person.placement !== "pending").length,
    notApplicable: matched.filter((person) => person.atlasStatus === "not_applicable").length,
    pending: matched.filter((person) => person.atlasStatus === "pending").length,
  };
}
