import { selectRoster, type RosterQuery } from "../src/roster.ts";
import type { Organization } from "../src/types.ts";

const orgs: Organization[] = [
  { id: "sjtu", nameZh: "上海交通大学", nameEn: "SJTU", aliases: [], type: "university", parentId: "", url: "", country: "CN", countryName: "中国", locality: "上海", ror: "" },
  { id: "tdli", nameZh: "李政道研究所", nameEn: "TDLI", aliases: ["李所"], type: "institute", parentId: "sjtu", url: "", country: "CN", countryName: "中国", locality: "上海", ror: "" },
  { id: "tdli-astro", nameZh: "天文与天体物理研究部", nameEn: "Astronomy", aliases: [], type: "division", parentId: "tdli", url: "", country: "CN", countryName: "中国", locality: "上海", ror: "" },
  { id: "harvard", nameZh: "哈佛大学", nameEn: "Harvard", aliases: [], type: "university", parentId: "", url: "", country: "US", countryName: "美国", locality: "Cambridge", ror: "" },
];

const people = [
  {
    id: "joint-person",
    nameZh: "联",
    nameEn: "Lian",
    aliases: ["联聘"],
    interests: ["宇宙学"],
    topicTags: ["cosmology"],
    atlasStatus: "pending" as const,
    placement: "pending" as const,
    affiliations: [
      { orgId: "tdli-astro", role: "tenured" as const, kind: "primary" as const, current: true, country: "CN", rawTitle: "长聘学者" },
      { orgId: "harvard", role: "other" as const, kind: "adjunct" as const, current: true, country: "US", rawTitle: "Affiliate" },
    ],
  },
  {
    id: "retired-person",
    nameZh: "退",
    nameEn: "Tui",
    aliases: [],
    interests: ["中微子"],
    topicTags: ["neutrino"],
    atlasStatus: "not_applicable" as const,
    placement: "offplane" as const,
    affiliations: [
      { orgId: "tdli-astro", role: "chair" as const, kind: "retired" as const, current: false, country: "CN", rawTitle: "讲席教授（退休）" },
    ],
  },
];

const base: RosterQuery = { q: "", org: "tdli", role: "", post: "current", topic: "", atlas: "", country: "", scale: "all" };
const failures: string[] = [];
const expect = (name: string, value: unknown, wanted: unknown) => {
  if (value !== wanted) failures.push(`${name}: ${String(value)} != ${String(wanted)}`);
};

const current = selectRoster(people, orgs, base);
expect("default-hides-retired", current.total, 1);
expect("default-id", current.people[0]?.id, "joint-person");
expect("pending-count", current.pending, 1);

const bothCountries = selectRoster(people, orgs, { ...base, org: "harvard", country: "CN", post: "all" });
expect("same-affiliation-chain", bothCountries.total, 0);
const harvardUs = selectRoster(people, orgs, { ...base, org: "harvard", country: "US", post: "all" });
expect("harvard-us", harvardUs.total, 1);
expect("dedup", new Set(harvardUs.people.map((person) => person.id)).size, harvardUs.total);

const retired = selectRoster(people, orgs, { ...base, post: "retired" });
expect("retired-view", retired.people[0]?.id, "retired-person");
const search = selectRoster(people, orgs, { ...base, q: "联聘" });
expect("alias-search", search.total, 1);

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("roster self-check ok");
