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
    org: "all",
    role: "",
    post: "current",
    topic: "",
    atlas: "",
    country: "",
    scale: "all",
  };
}

/** Missing `org` means every covered institution. `none` matches nobody. Otherwise comma-joined ids, also read from repeated `org` params. */
export function readOrgParam(params: URLSearchParams) {
  const listed = params
    .getAll("org")
    .flatMap((value) => value.split(","))
    .map((item) => item.trim())
    .filter(Boolean);
  if (listed.length === 0) return "all";
  if (listed.length === 1 && listed[0] === "none") return "none";
  return listed.filter((id) => id !== "all" && id !== "none").join(",") || "all";
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
    org: readOrgParam(params),
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
  next.delete("org");
  if (query.org === "none") next.set("org", "none");
  else if (query.org && query.org !== "all") {
    for (const id of query.org.split(",")) {
      const trimmed = id.trim();
      if (trimmed) next.append("org", trimmed);
    }
  }
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

/** `null` = no org restriction. Empty list matches nobody. */
export function selectedOrgIds(org: string): string[] | null {
  if (!org || org === "all") return null;
  if (org === "none") return [];
  return org.split(",").map((id) => id.trim()).filter(Boolean);
}

function orgSelectionMatches(chain: string[], org: string) {
  const selected = selectedOrgIds(org);
  if (!selected) return true;
  return selected.some((id) => chain.includes(id));
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
  if (!orgSelectionMatches(orgChain(affiliation.orgId, orgs), query.org)) return false;
  return true;
}

export type OrgNode = {
  id: string;
  nameZh: string;
  aliasZh: string;
  children: OrgNode[];
};

function zhAlias(org: Organization) {
  return org.aliases.find((alias) => alias !== org.nameZh && /[\u4e00-\u9fff]/.test(alias)) || "";
}

export function collectOrgIds(nodes: OrgNode[], into: string[] = []) {
  for (const node of nodes) {
    into.push(node.id);
    collectOrgIds(node.children, into);
  }
  return into;
}

/** Institutions that actually employ someone in `people`, plus their parents, as a tree. */
export function orgForest(
  organizations: Organization[],
  people: { affiliations: { orgId: string }[] }[],
): OrgNode[] {
  const byId = new Map(organizations.map((org) => [org.id, org]));
  const visible = new Set<string>();
  for (const person of people) {
    for (const affiliation of person.affiliations) {
      let cursor = byId.get(affiliation.orgId);
      const guard = new Set<string>();
      while (cursor && !guard.has(cursor.id)) {
        guard.add(cursor.id);
        visible.add(cursor.id);
        cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
      }
    }
  }
  const byParent = new Map<string, Organization[]>();
  for (const org of organizations) {
    if (!visible.has(org.id)) continue;
    const parentKey = org.parentId && visible.has(org.parentId) ? org.parentId : "";
    const list = byParent.get(parentKey) || [];
    list.push(org);
    byParent.set(parentKey, list);
  }
  const build = (parentId: string): OrgNode[] =>
    (byParent.get(parentId) || []).map((org) => ({
      id: org.id,
      nameZh: org.nameZh,
      aliasZh: zhAlias(org),
      children: build(org.id),
    }));
  return build("");
}

function findOrgNode(nodes: OrgNode[], id: string): OrgNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    const child = findOrgNode(node.children, id);
    if (child) return child;
  }
  return undefined;
}

function ancestorIdsInForest(nodes: OrgNode[], id: string, trail: string[] = []): string[] | null {
  for (const node of nodes) {
    if (node.id === id) return trail;
    const nested = ancestorIdsInForest(node.children, id, [...trail, node.id]);
    if (nested !== null) return nested;
  }
  return null;
}

/** Ids whose checkbox is on. `null` selection (all) includes the whole forest. A selected parent covers its descendants. */
export function includedOrgIds(orgQuery: string, forest: OrgNode[]) {
  const all = collectOrgIds(forest);
  const selected = selectedOrgIds(orgQuery);
  if (!selected) return new Set(all);
  const picked = new Set(selected);
  const included = new Set<string>();
  const walk = (nodes: OrgNode[], ancestorOn: boolean) => {
    for (const node of nodes) {
      const on = ancestorOn || picked.has(node.id);
      if (on) included.add(node.id);
      walk(node.children, on);
    }
  };
  walk(forest, false);
  return included;
}

function compressOrgSelection(forest: OrgNode[], included: Set<string>) {
  const out: string[] = [];
  const walk = (nodes: OrgNode[]) => {
    for (const node of nodes) {
      const ids = collectOrgIds([node]);
      if (ids.every((id) => included.has(id))) out.push(node.id);
      else walk(node.children);
    }
  };
  walk(forest);
  return out;
}

export function formatOrgSelection(forest: OrgNode[], included: Set<string>) {
  const all = collectOrgIds(forest);
  if (all.length > 0 && all.every((id) => included.has(id))) return "all";
  const compressed = compressOrgSelection(forest, included);
  return compressed.length ? compressed.join(",") : "none";
}

/** Toggle one node and its descendants. Checking a parent covers children; unchecking a child keeps the rest. */
export function toggleOrgQuery(orgQuery: string, clickedId: string, forest: OrgNode[]) {
  const included = includedOrgIds(orgQuery, forest);
  const node = findOrgNode(forest, clickedId);
  if (!node) return orgQuery;
  const ids = collectOrgIds([node]);
  const turningOff = ids.every((id) => included.has(id));
  if (turningOff) {
    for (const id of ids) included.delete(id);
    for (const ancestorId of ancestorIdsInForest(forest, clickedId) ?? []) included.delete(ancestorId);
  } else {
    for (const id of ids) included.add(id);
  }
  return formatOrgSelection(forest, included);
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
