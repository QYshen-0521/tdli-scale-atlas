import { offplaneMentors } from "../content.ts";
import type { Mentor } from "../types.ts";
import { Seal } from "./Seal.tsx";

export function OffplanePanel({
  open,
  onToggle,
  onOpen,
}: {
  open: boolean;
  onToggle: () => void;
  onOpen: (id: string) => void;
}) {
  const particle = offplaneMentors.filter((m) => m.panelGroup === "particle");
  const lab = offplaneMentors.filter((m) => m.panelGroup === "lab");
  return (
    <aside className={`margin-col${open ? " is-open" : ""}`} aria-label="没有单一尺度–质量坐标的研究">
      <div className="margin-head">
        <p className="eyebrow">尺度之外</p>
        <h2>信使、粒子与实验室</h2>
        <button type="button" className="text-btn" onClick={onToggle} aria-expanded={open}>
          {open ? "收起" : "展开"}
        </button>
      </div>
      {open ? (
        <div className="margin-scroll">
          <p className="margin-lead">
            纵轴是天体或系统的质量，不是 GeV。中微子、暗物质粒子和宇宙线没有一个诚实的半径；实验室靶则比图的左缘还小。
          </p>
          <Section title="粒子与信使" en="Particles & messengers" people={particle} onOpen={onOpen} />
          <Section title="实验室天体物理" en="Laboratory astrophysics" people={lab} onOpen={onOpen} />
        </div>
      ) : (
        <button type="button" className="margin-tab" onClick={onToggle}>
          尺度之外 · {offplaneMentors.length}
        </button>
      )}
    </aside>
  );
}

function Section({
  title,
  en,
  people,
  onOpen,
}: {
  title: string;
  en: string;
  people: Mentor[];
  onOpen: (id: string) => void;
}) {
  return (
    <section className="margin-section">
      <h3>
        {title}
        <small>{en}</small>
      </h3>
      <ul>
        {people.map((mentor) => (
          <li key={mentor.id}>
            <button type="button" onClick={() => onOpen(mentor.id)} style={{ viewTransitionName: `seal-${mentor.id}` }}>
              <Seal id={mentor.id} char={mentor.seal} pigment={mentor.pigment} size={40} />
              <span>
                <strong>{mentor.nameZh}</strong>
                <em>{mentor.nameEn}</em>
                <b>{mentor.blurbZh}</b>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
