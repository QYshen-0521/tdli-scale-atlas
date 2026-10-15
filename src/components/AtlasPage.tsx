import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAtlasState } from "../atlas-state.tsx";
import { mentors } from "../content.ts";
import { supportsViewTransition, useOpenMentor } from "../lib/nav.ts";
import type { FilterKey } from "../types.ts";
import { Chart } from "./Chart.tsx";
import { OffplanePanel } from "./OffplanePanel.tsx";
import { OrgSidebar } from "./OrgSidebar.tsx";
import { RosterBar } from "./RosterBar.tsx";
import { countRoster, useRoster } from "../use-roster.tsx";

const FILTERS: { id: FilterKey; zh: string; en: string }[] = [
  { id: "all", zh: "全部", en: "All" },
  { id: "planet", zh: "行星与恒星", en: "Planets" },
  { id: "compact", zh: "致密天体", en: "Compact" },
  { id: "galaxy", zh: "星系", en: "Galaxies" },
  { id: "cosmos", zh: "宇宙学尺度", en: "Cosmos" },
];

export default function AtlasPage() {
  const openMentor = useOpenMentor();
  const { panelOpen, setPanelOpen, flip } = useAtlasState();
  const { query, update, clear } = useRoster();
  const [params] = useSearchParams();
  const [guides, setGuides] = useState(true);
  const [enter] = useState(() => flip?.dest === "atlas" && !supportsViewTransition());
  const result = countRoster(mentors, query);
  const chartPeople = result.people.filter((mentor) => mentor.placement === "chart" && mentor.regions.length > 0);
  const offplanePeople = result.people.filter((mentor) => mentor.placement === "offplane");

  useEffect(() => {
    document.title = "尺度衡星 · 李政道研究所";
  }, []);

  function go(id: string) {
    const next = new URLSearchParams(params);
    next.set("from", "atlas");
    openMentor(id, `/mentor/${id}?${next.toString()}`, "detail");
  }

  return (
    <div className={`atlas-page${enter ? " is-enter" : ""}`}>
      <header className="topbar">
        <div className="brand">
          <p className="eyebrow">李政道研究所 · Tsung-Dao Lee Institute</p>
          <h1>
            尺度衡星
            <small>The Scale Atlas</small>
          </h1>
        </div>
        <div className="filters" role="toolbar" aria-label="按研究尺度变淡，不移除">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={query.scale === item.id ? "is-on" : ""}
              aria-pressed={query.scale === item.id}
              onClick={() => update({ scale: item.id })}
            >
              {item.zh}
              <small>{item.en}</small>
            </button>
          ))}
          <button type="button" className={guides ? "is-on" : ""} aria-pressed={guides} onClick={() => setGuides((value) => !value)}>
            参考线
            <small>Guides</small>
          </button>
        </div>
        <p className="top-note">
          图上 {chartPeople.length} 人 · 尺度之外 {offplanePeople.length} 人
          <span>尺度分类只让其他人变淡。左侧勾选机构才会从图层拿掉。滚轮缩放 · 拖拽平移 · 双击空白复位</span>
        </p>
      </header>
      <RosterBar people={mentors} query={query} onChange={update} onClear={clear} />
      <div className="workspace">
        <OrgSidebar people={mentors} query={query} onChange={update} />
        <div className="workspace-main">
          <div className={`atlas-body${panelOpen ? " panel-open" : ""}`}>
            <OffplanePanel open={panelOpen} people={offplanePeople} onToggle={() => setPanelOpen((value) => !value)} onOpen={go} />
            <Chart filter={query.scale} guides={guides} mentors={chartPeople} onOpenMentor={go} />
          </div>
        </div>
      </div>
    </div>
  );
}
