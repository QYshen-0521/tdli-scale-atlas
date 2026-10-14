import { useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { mentorById, objectById } from "../content.ts";
import { paperHref } from "../lib/format.ts";
import { supportsViewTransition, transitionTo } from "../lib/nav.ts";
import { MiniMap } from "./MiniMap.tsx";
import { Seal } from "./Seal.tsx";

const COVERAGE_LABEL = {
  focused: "图上的一块区域",
  wide: "较宽的色带",
  broad: "广域虚线轮廓",
  offplane: "不在尺度–质量图上",
} as const;

export default function DetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const mentor = mentorById(id ?? "");
  const enter = supportsViewTransition() ? "" : " enter";

  useEffect(() => {
    document.title = mentor ? `${mentor.nameZh} · 尺度衡星` : "未找到 · 尺度衡星";
    headingRef.current?.focus();
  }, [mentor]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
      if (event.key === "Escape" || event.key === "Backspace") {
        event.preventDefault();
        transitionTo(navigate, "/");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  if (!mentor) {
    return (
      <main className={`detail-page${enter}`}>
        <button type="button" className="back-btn" onClick={() => transitionTo(navigate, "/")}>
          ← 返回星图
        </button>
        <div className="detail-missing">
          <h1 ref={headingRef} tabIndex={-1}>
            没有找到这位导师
          </h1>
          <p>链接可能写错了。星图上的印章仍然在。</p>
        </div>
      </main>
    );
  }

  const pictures = mentor.relatedObjects
    .map((oid) => objectById(oid))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  return (
    <main className={`detail-page${enter}`}>
      <button type="button" className="back-btn" onClick={() => transitionTo(navigate, "/")}>
        ← 返回星图
        <kbd>Esc</kbd>
      </button>
      <article className="detail-sheet">
        <header className="detail-hero">
          <div className="detail-seal" style={{ viewTransitionName: `seal-${mentor.id}` }}>
            <Seal
              id={mentor.id}
              char={mentor.seal}
              pigment={mentor.pigment}
              broad={mentor.coverage === "broad"}
              size={92}
            />
          </div>
          <div>
            <p className="eyebrow">{mentor.divisionZh}</p>
            <h1 ref={headingRef} tabIndex={-1}>
              {mentor.nameZh}
              <small>{mentor.nameEn}</small>
            </h1>
            <p className="detail-title">{mentor.titleZh}</p>
            <p className="detail-title en">{mentor.titleEn}</p>
            <ul className="chips">
              <li style={{ borderColor: mentor.pigment }}>{COVERAGE_LABEL[mentor.coverage]}</li>
              {mentor.interests.slice(0, 4).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </header>

        <div className="detail-grid">
          <section className="prose">
            {mentor.summaryZh.map((para) => (
              <p key={para}>{para}</p>
            ))}
            <p className="en-block">{mentor.summaryEn}</p>
          </section>
          <aside className="place-card">
            <h2>{mentor.placement === "chart" ? "在图上的位置" : "为什么不在图上"}</h2>
            {mentor.placement === "chart" ? <MiniMap mentor={mentor} /> : null}
            <p>{mentor.placementNoteZh}</p>
            <p className="en-block">{mentor.placementNoteEn}</p>
          </aside>
        </div>

        {pictures.length ? (
          <section className="gallery">
            <h2>相关天体</h2>
            <ul>
              {pictures.map((obj) => (
                <li key={obj.id}>
                  <img src={obj.image} alt={`${obj.nameZh}，${obj.nameEn}`} />
                  <span>
                    <strong>{obj.nameZh}</strong>
                    <small>{obj.nameEn}</small>
                    {obj.blurbZh}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="papers">
          <h2>代表性论文</h2>
          <p className="fine">
            条目来自李政道研究所官方主页，或主页给出的 Inspire 记录。没有 DOI 的链接会打开
            ADS 上的题名检索，而不是猜测文献编号。
          </p>
          <ol>
            {mentor.papers.map((paper) => (
              <li key={paper.title}>
                <a href={paperHref(paper)} target="_blank" rel="noreferrer">
                  {paper.title}
                </a>
                <span>{paper.venue}</span>
              </li>
            ))}
          </ol>
          {mentor.bibliographyUrl ? (
            <p className="fine">
              <a href={mentor.bibliographyUrl} target="_blank" rel="noreferrer">
                更全的文献表
              </a>
            </p>
          ) : null}
        </section>

        {mentor.honors.length ? (
          <section>
            <h2>荣誉</h2>
            <ul className="honors">
              {mentor.honors.map((honor) => (
                <li key={honor}>{honor}</li>
              ))}
            </ul>
          </section>
        ) : null}

        <footer className="detail-foot">
          <a href={mentor.profileUrl} target="_blank" rel="noreferrer">
            李政道研究所主页
          </a>
          {mentor.homepage ? (
            <a href={mentor.homepage} target="_blank" rel="noreferrer">
              个人主页
            </a>
          ) : null}
          {mentor.email ? <span>{mentor.email}</span> : null}
        </footer>
      </article>
    </main>
  );
}
