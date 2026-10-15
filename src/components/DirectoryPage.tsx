import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useAtlasState, useAvatarArrival } from "../atlas-state.tsx";
import { mentors, organizations } from "../content.ts";
import report from "../../data/coverage/pilot-report.json";
import { directoryScrollKey, readDirectoryScroll, writeDirectoryScroll } from "../lib/directory-scroll.ts";
import { supportsViewTransition, useOpenMentor } from "../lib/nav.ts";
import { OrgSidebar } from "./OrgSidebar.tsx";
import { RosterBar } from "./RosterBar.tsx";
import { countRoster, rosterPath, useRoster } from "../use-roster.tsx";
import { MentorAvatar } from "./MentorAvatar.tsx";
import { useLocation, useSearchParams } from "react-router-dom";

function placeOf(mentor: (typeof mentors)[number]) {
  const org = organizations.find((item) => item.id === mentor.orgId);
  const parent = organizations.find((item) => item.id === org?.parentId);
  if (org && parent) return `${parent.nameZh} · ${org.nameZh}`;
  return mentor.divisionZh;
}

const KIND: Record<string, string> = {
  primary: "主聘",
  joint: "双聘",
  adjunct: "兼职",
  retired: "退休",
};

export default function DirectoryPage() {
  const openMentor = useOpenMentor();
  const { query, update, clear } = useRoster();
  const [params] = useSearchParams();
  const location = useLocation();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const scrollKey = directoryScrollKey(location.pathname, location.search);
  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const saved = readDirectoryScroll(scrollKey);
    if (saved > 0) el.scrollTop = saved;
    const persist = () => writeDirectoryScroll(scrollKey, el.scrollTop);
    el.addEventListener("scroll", persist, { passive: true });
    return () => {
      persist();
      el.removeEventListener("scroll", persist);
    };
  }, [scrollKey]);
  const { flip } = useAtlasState();
  const [enter] = useState(() => flip?.dest === "directory" && !supportsViewTransition());
  useAvatarArrival(flip?.dest === "directory" ? flip.id : undefined, "directory");
  const result = countRoster(mentors, query);

  useEffect(() => {
    document.title = "名录 · 尺度衡星";
  }, []);

  function open(id: string) {
    const next = new URLSearchParams(params);
    next.set("from", "directory");
    const text = next.toString();
    openMentor(id, `/mentor/${id}?${text}`, "detail");
  }

  return (
    <div className={`directory-page${enter ? " is-enter" : ""}`}>
      <header className="topbar directory-top">
        <div className="brand">
          <p className="eyebrow">李政道研究所 · Tsung-Dao Lee Institute</p>
          <h1>
            名录
            <small>Faculty directory</small>
          </h1>
        </div>
        <p className="top-note">
          默认显示已收录机构的现任人员。左侧勾选可只看李政道研究所、南京大学、国家天文台或剑桥大学。试点收录不表示这些单位或全球已经收全。
          <span>
            <a href={rosterPath("/", params)}>回到尺度图</a>
          </span>
        </p>
      </header>
      <RosterBar people={mentors} query={query} onChange={update} onClear={clear} />
      <div className="workspace">
        <OrgSidebar people={mentors} query={query} onChange={update} />
        <div className="workspace-main directory-scroll" ref={scrollerRef}>
      <details className="coverage-note">
        <summary>试点机构覆盖</summary>
        <p>{report.note} 勾选上一级机构会带出下属单位。国家和机构要由同一条任职同时满足。</p>
        <table className="coverage-table">
          <thead>
            <tr>
              <th>机构</th>
              <th>核验日</th>
              <th>名录条目</th>
              <th>纳入</th>
              <th>排除</th>
              <th>暂缓</th>
              <th>口径</th>
            </tr>
          </thead>
          <tbody>
            {report.orgs.map((org) => (
              <tr key={org.orgId}>
                <td>{org.nameZh}</td>
                <td>{org.fetchedAt}</td>
                <td>{org.rosterCount}</td>
                <td>{org.included}</td>
                <td>{org.excluded}</td>
                <td>{org.deferred}</td>
                <td>{org.scope}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
      <main className="directory-main">
        {result.people.length ? (
          <ul className="directory-list">
            {result.people.map((mentor) => (
              <li key={mentor.id}>
                <button type="button" onClick={() => open(mentor.id)}>
                  <MentorAvatar mentor={mentor} size={52} />
                  <span>
                    <strong>{mentor.nameZh}</strong>
                    {mentor.nameEn && mentor.nameEn !== mentor.nameZh ? <em>{mentor.nameEn}</em> : null}
                    <b>{mentor.titleZh}</b>
                    <small>
                      {placeOf(mentor)}
                      {mentor.appointmentKind !== "primary" ? ` · ${KIND[mentor.appointmentKind] || ""}` : ""}
                      {mentor.atlasStatus === "pending" ? " · 待标注" : ""}
                      {mentor.atlasStatus === "not_applicable" ? " · 无适用尺度" : ""}
                      {mentor.atlasStatus === "reviewed" ? " · 有尺度标注" : ""}
                    </small>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="directory-empty">没有符合条件的人。可以清空筛选后再看。</p>
        )}
      </main>
        </div>
      </div>
    </div>
  );
}
