import type { Mentor } from "../types.ts";
import { MentorAvatar } from "./MentorAvatar.tsx";

export function OffplanePanel({
  open,
  people,
  onToggle,
  onOpen,
}: {
  open: boolean;
  people: Mentor[];
  onToggle: () => void;
  onOpen: (id: string) => void;
}) {
  const particle = people.filter((m) => m.panelGroup === "particle");
  const lab = people.filter((m) => m.panelGroup === "lab");
  const instrument = people.filter((m) => m.panelGroup === "instrument");
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
          {people.length === 0 ? (
            <p className="margin-lead">这一轮已经把原先放在尺度之外的人，改画到他们工作所对应的天体尺度上。当前筛选下没有人留在图外。</p>
          ) : (
            <>
              <p className="margin-lead">
                纵轴是天体或系统的质量，不是 GeV。中微子、暗物质粒子和宇宙线没有一个诚实的半径；实验室靶则比图的左缘还小。地面望远镜和光谱仪同样不占这块坐标。
              </p>
              {particle.length ? <Section title="粒子与信使" en="Particles & messengers" people={particle} onOpen={onOpen} /> : null}
              {lab.length ? <Section title="实验室天体物理" en="Laboratory astrophysics" people={lab} onOpen={onOpen} /> : null}
              {instrument.length ? <Section title="望远镜与仪器" en="Telescopes & instruments" people={instrument} onOpen={onOpen} /> : null}
              {!particle.length && !lab.length && !instrument.length ? <p className="margin-lead">当前筛选下，没有人在尺度之外。</p> : null}
            </>
          )}
        </div>
      ) : (
        <button type="button" className="margin-tab" onClick={onToggle}>
          尺度之外 · {people.length}
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
            <button type="button" onClick={() => onOpen(mentor.id)}>
              <MentorAvatar mentor={mentor} size={40} thumb loading="lazy" />
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
