import { useEffect, useMemo, useRef, useState } from "react";
import { organizations } from "../content.ts";
import {
  collectOrgIds,
  includedOrgIds,
  orgForest,
  selectRoster,
  toggleOrgQuery,
  type OrgNode,
  type RosterQuery,
} from "../roster.ts";
import type { Mentor } from "../types.ts";

function OrgCheck({
  checked,
  mixed,
  label,
  count,
  onToggle,
}: {
  checked: boolean;
  mixed: boolean;
  label: string;
  count: number;
  onToggle: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = mixed;
  }, [mixed]);
  return (
    <label className="org-check">
      <input ref={ref} type="checkbox" checked={checked} onChange={onToggle} />
      <span className="org-name">{label}</span>
      <span className="org-count">{count}</span>
    </label>
  );
}

function OrgBranches({
  nodes,
  included,
  counts,
  collapsed,
  onToggleCollapse,
  onToggleOrg,
}: {
  nodes: OrgNode[];
  included: Set<string>;
  counts: Map<string, number>;
  collapsed: Set<string>;
  onToggleCollapse: (id: string) => void;
  onToggleOrg: (id: string) => void;
}) {
  return (
    <ul className="org-tree">
      {nodes.map((node) => {
        const ids = collectOrgIds([node]);
        const onCount = ids.filter((id) => included.has(id)).length;
        const state = onCount === 0 ? "off" : onCount === ids.length ? "on" : "mixed";
        const label = node.aliasZh ? `${node.nameZh}（${node.aliasZh}）` : node.nameZh;
        const open = node.children.length > 0 && !collapsed.has(node.id);
        return (
          <li key={node.id}>
            <div className="org-row">
              {node.children.length ? (
                <button
                  type="button"
                  className="org-expand"
                  aria-expanded={open}
                  aria-label={open ? `收起${node.nameZh}` : `展开${node.nameZh}`}
                  onClick={() => onToggleCollapse(node.id)}
                >
                  {open ? "▾" : "▸"}
                </button>
              ) : (
                <span className="org-expand" aria-hidden="true" />
              )}
              <OrgCheck
                checked={state === "on"}
                mixed={state === "mixed"}
                label={label}
                count={counts.get(node.id) || 0}
                onToggle={() => onToggleOrg(node.id)}
              />
            </div>
            {open ? (
              <OrgBranches
                nodes={node.children}
                included={included}
                counts={counts}
                collapsed={collapsed}
                onToggleCollapse={onToggleCollapse}
                onToggleOrg={onToggleOrg}
              />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export function OrgSidebar({
  people,
  query,
  onChange,
}: {
  people: Mentor[];
  query: RosterQuery;
  onChange: (partial: Partial<RosterQuery>) => void;
}) {
  const forest = useMemo(() => orgForest(organizations, people), [people]);
  const included = includedOrgIds(query.org, forest);
  const ids = collectOrgIds(forest);
  const allOn = ids.length > 0 && ids.every((id) => included.has(id));
  const anyOn = ids.some((id) => included.has(id));
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const id of collectOrgIds(forest)) {
      map.set(id, selectRoster(people, organizations, { ...query, org: id }).total);
    }
    return map;
  }, [forest, people, query]);

  function toggleCollapse(id: string) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <aside className="org-sidebar" aria-label="机构">
      <h2>机构</h2>
      <p className="org-lead">勾选要显示的机构。勾选上一级会带出下属单位，例如南京大学下的南大天文。国家或地区须和机构落在同一条任职上。</p>
      <div className="org-row org-all">
        <span className="org-expand" aria-hidden="true" />
        <OrgCheck
          checked={allOn}
          mixed={!allOn && anyOn}
          label="全部已收录机构"
          count={selectRoster(people, organizations, { ...query, org: "all" }).total}
          onToggle={() => onChange({ org: allOn ? "none" : "all" })}
        />
      </div>
      <OrgBranches
        nodes={forest}
        included={included}
        counts={counts}
        collapsed={collapsed}
        onToggleCollapse={toggleCollapse}
        onToggleOrg={(id) => onChange({ org: toggleOrgQuery(query.org, id, forest) })}
      />
    </aside>
  );
}
