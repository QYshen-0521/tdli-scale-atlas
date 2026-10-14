import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { chartMentors, offplaneMentors } from "../content.ts";
import { transitionTo } from "../lib/nav.ts";
import type { FilterKey } from "../types.ts";
import { Chart } from "./Chart.tsx";
import { OffplanePanel } from "./OffplanePanel.tsx";

const FILTERS: { id: FilterKey; zh: string; en: string }[] = [
  { id: "all", zh: "全部", en: "All" },
  { id: "planet", zh: "行星与恒星", en: "Planets" },
  { id: "compact", zh: "致密天体", en: "Compact" },
  { id: "galaxy", zh: "星系", en: "Galaxies" },
  { id: "cosmos", zh: "宇宙学尺度", en: "Cosmos" },
];

export default function AtlasPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [guides, setGuides] = useState(true);
  const [panel, setPanel] = useState(true);

  useEffect(() => {
    document.title = "尺度衡星 · 李政道研究所";
  }, []);

  function openMentor(id: string) {
    transitionTo(navigate, `/mentor/${id}`);
  }

  return (
    <div className="atlas-page">
      <header className="topbar">
        <div className="brand">
          <p className="eyebrow">李政道研究所 · Tsung-Dao Lee Institute</p>
          <h1>
            尺度衡星
            <small>The Scale Atlas</small>
          </h1>
        </div>
        <div className="filters" role="toolbar" aria-label="按研究尺度筛选">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={filter === item.id ? "is-on" : ""}
              aria-pressed={filter === item.id}
              onClick={() => setFilter(item.id)}
            >
              {item.zh}
              <small>{item.en}</small>
            </button>
          ))}
          <button type="button" className={guides ? "is-on" : ""} aria-pressed={guides} onClick={() => setGuides((v) => !v)}>
            参考线
            <small>Guides</small>
          </button>
        </div>
        <p className="top-note">
          {chartMentors.length} 位在图上 · {offplaneMentors.length} 位在尺度之外
          <span>滚轮按光标缩放 · 拖拽平移 · 双击空白复位 · + / − / 0</span>
        </p>
      </header>
      <div className={`atlas-body${panel ? " panel-open" : ""}`}>
        <OffplanePanel open={panel} onToggle={() => setPanel((v) => !v)} onOpen={openMentor} />
        <Chart filter={filter} guides={guides} onOpenMentor={openMentor} />
      </div>
    </div>
  );
}
