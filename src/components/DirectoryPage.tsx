import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useAtlasState, useAvatarArrival } from "../atlas-state.tsx";
import { mentors } from "../content.ts";
import { directoryScrollKey, readDirectoryScroll, writeDirectoryScroll } from "../lib/directory-scroll.ts";
import { supportsViewTransition, useOpenMentor } from "../lib/nav.ts";
import { RosterBar } from "./RosterBar.tsx";
import { countRoster, rosterPath, useRoster } from "../use-roster.tsx";
import { MentorAvatar } from "./MentorAvatar.tsx";
import { useLocation, useSearchParams } from "react-router-dom";

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
    <div ref={scrollerRef} className={`directory-page${enter ? " is-enter" : ""}`}>
      <header className="topbar directory-top">
        <div className="brand">
          <p className="eyebrow">李政道研究所 · Tsung-Dao Lee Institute</p>
          <h1>
            名录
            <small>Faculty directory</small>
          </h1>
        </div>
        <p className="top-note">
          默认显示李政道研究所现任人员
          <span>
            <a href={rosterPath("/", params)}>回到尺度图</a>
          </span>
        </p>
      </header>
      <RosterBar people={mentors} query={query} onChange={update} onClear={clear} />
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
                      {mentor.divisionZh}
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
  );
}
