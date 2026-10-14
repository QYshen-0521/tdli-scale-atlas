import { Link, useLocation, useSearchParams } from "react-router-dom";
import { organizations } from "../content.ts";
import { selectRoster, type RosterQuery } from "../roster.ts";
import type { Mentor } from "../types.ts";
import { rosterPath } from "../use-roster.tsx";

const ROLES: { id: string; zh: string }[] = [
  { id: "", zh: "全部职级" },
  { id: "chair", zh: "讲席" },
  { id: "distinguished", zh: "特聘" },
  { id: "senior", zh: "资深学者" },
  { id: "tenured", zh: "长聘" },
  { id: "tenure_track", zh: "青年学者" },
  { id: "senior_researcher", zh: "资深研究员" },
  { id: "researcher", zh: "研究员" },
  { id: "associate_researcher", zh: "副研究员" },
  { id: "assistant_researcher", zh: "助理研究员" },
];

const POSTS: { id: RosterQuery["post"]; zh: string }[] = [
  { id: "current", zh: "现任" },
  { id: "joint", zh: "双聘" },
  { id: "adjunct", zh: "兼职" },
  { id: "retired", zh: "退休" },
  { id: "all", zh: "含离任与退休" },
];

const TOPICS: { id: string; zh: string }[] = [
  { id: "", zh: "全部方向" },
  { id: "astronomy", zh: "天文" },
  { id: "cosmology", zh: "宇宙学" },
  { id: "astroparticle", zh: "天体粒子" },
  { id: "dark-matter", zh: "暗物质" },
  { id: "neutrino", zh: "中微子" },
  { id: "lab", zh: "实验室天体物理" },
];

const ATLAS: { id: RosterQuery["atlas"]; zh: string }[] = [
  { id: "", zh: "标注不限" },
  { id: "reviewed", zh: "有尺度标注" },
  { id: "not_applicable", zh: "无适用尺度" },
  { id: "pending", zh: "待标注" },
];

export function RosterBar({
  people,
  query,
  onChange,
  onClear,
}: {
  people: Mentor[];
  query: RosterQuery;
  onChange: (partial: Partial<RosterQuery>) => void;
  onClear: () => void;
}) {
  const location = useLocation();
  const [params] = useSearchParams();
  const result = selectRoster(people, organizations, query);
  const divisions = organizations.filter((org) => org.type === "division");
  const onAtlas = location.pathname === "/";
  return (
    <div className="roster-bar">
      <div className="view-switch" role="navigation" aria-label="尺度图与名录">
        <Link to={rosterPath("/", params)} className={onAtlas ? "is-on" : ""} aria-current={onAtlas ? "page" : undefined}>
          尺度图
        </Link>
        <Link
          to={rosterPath("/directory", params)}
          className={location.pathname === "/directory" ? "is-on" : ""}
          aria-current={location.pathname === "/directory" ? "page" : undefined}
        >
          名录
        </Link>
      </div>
      <label className="roster-search">
        <span className="sr">搜索姓名、机构或方向</span>
        <input
          value={query.q}
          placeholder="搜索姓名、机构、方向"
          onChange={(event) => onChange({ q: event.target.value })}
        />
      </label>
      <label>
        <span className="sr">机构</span>
        <select value={query.org} onChange={(event) => onChange({ org: event.target.value })}>
          <option value="tdli">李政道研究所</option>
          {divisions.map((org) => (
            <option key={org.id} value={org.id}>
              {org.nameZh}
            </option>
          ))}
          <option value="all">不限机构</option>
        </select>
      </label>
      <label>
        <span className="sr">职级</span>
        <select value={query.role} onChange={(event) => onChange({ role: event.target.value })}>
          {ROLES.map((item) => (
            <option key={item.id || "all"} value={item.id}>
              {item.zh}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="sr">任职</span>
        <select value={query.post} onChange={(event) => onChange({ post: event.target.value as RosterQuery["post"] })}>
          {POSTS.map((item) => (
            <option key={item.id} value={item.id}>
              {item.zh}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="sr">方向</span>
        <select value={query.topic} onChange={(event) => onChange({ topic: event.target.value })}>
          {TOPICS.map((item) => (
            <option key={item.id || "all"} value={item.id}>
              {item.zh}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="sr">尺度标注</span>
        <select value={query.atlas} onChange={(event) => onChange({ atlas: event.target.value as RosterQuery["atlas"] })}>
          {ATLAS.map((item) => (
            <option key={item.id || "all"} value={item.id}>
              {item.zh}
            </option>
          ))}
        </select>
      </label>
      <button type="button" className="text-btn" onClick={onClear}>
        清空筛选
      </button>
      <p className="roster-count">
        符合条件 {result.total} 人，其中 {result.annotated} 人有尺度标注、{result.notApplicable} 人无适用尺度、{result.pending} 人待标注
      </p>
    </div>
  );
}
