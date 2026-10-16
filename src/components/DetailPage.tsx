import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useAtlasState, useAvatarArrival } from "../atlas-state.tsx";
import { mentorById, objectById, organizations } from "../content.ts";
import { detailFor } from "../detail-data.ts";
import { publicUrl } from "../lib/assets.ts";
import { paperHref } from "../lib/format.ts";
import { supportsViewTransition, useOpenMentor } from "../lib/nav.ts";
import { MiniMap } from "./MiniMap.tsx";
import { MentorAvatar } from "./MentorAvatar.tsx";

export default function DetailPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const openMentor = useOpenMentor();
  const { flip } = useAtlasState();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const mentor = mentorById(id ?? "");
  useAvatarArrival(mentor?.id, "detail", true);
  const [enter] = useState(() => flip?.dest === "detail" && flip.id === id && !supportsViewTransition());
  const fromDirectory = params.get("from") === "directory";
  const backTo = fromDirectory ? "/directory" : "/";
  const backLabel = fromDirectory ? "返回名录" : "返回星图";

  const back = useCallback(() => {
    const next = new URLSearchParams(params);
    next.delete("from");
    const text = next.toString();
    const dest = fromDirectory ? "directory" : "atlas";
    openMentor(mentor?.id || "missing", text ? `${backTo}?${text}` : backTo, dest);
  }, [backTo, fromDirectory, mentor?.id, openMentor, params]);

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
        back();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [back]);

  if (!mentor) {
    return (
      <main className={`detail-page${enter ? " is-enter" : ""}`}>
        <button type="button" className="back-btn" onClick={back}>
          ← {backLabel}
        </button>
        <div className="detail-missing">
          <h1 ref={headingRef} tabIndex={-1}>
            没有找到这位导师
          </h1>
          <p>链接可能写错了。星图上的位置仍然在。</p>
        </div>
      </main>
    );
  }

  const pictures = mentor.relatedObjects
    .map((oid) => objectById(oid))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  const facts = detailFor(mentor.id);

  return (
    <main className={`detail-page${enter ? " is-enter" : ""}`}>
      <button type="button" className="back-btn" onClick={back}>
        ← {backLabel}
        <kbd>Esc</kbd>
      </button>
      <article className="detail-sheet">
        <div className="detail-top">
          <header className="detail-hero">
            <div className="detail-seal">
              <MentorAvatar mentor={mentor} size={112} />
            </div>
            <div className="detail-copy">
              <p className="eyebrow">{mentor.divisionZh}</p>
              <h1 ref={headingRef} tabIndex={-1}>
                {mentor.nameZh}
                <small>{mentor.nameEn}</small>
              </h1>
              <p className="detail-title">{mentor.titleZh}</p>
              {mentor.titleEn ? <p className="detail-title en">{mentor.titleEn}</p> : null}
              {mentor.affiliations.filter((item) => item.current).length > 1 ? (
                <ul className="affiliation-list">
                  {mentor.affiliations.filter((item) => item.current).map((item) => {
                    const org = organizations.find((entry) => entry.id === item.orgId);
                    return (
                      <li key={`${item.orgId}-${item.rawTitle}`}>
                        {org?.nameZh || item.orgId} · {item.rawTitle}
                        {item.kind === "joint" ? " · 双聘" : item.kind === "adjunct" ? " · 兼职" : ""}
                      </li>
                    );
                  })}
                </ul>
              ) : null}
              {mentor.appointmentKind !== "primary" ? (
                <p className="fine">{mentor.appointmentKind === "joint" ? "双聘" : mentor.appointmentKind === "adjunct" ? "兼职" : "退休"}</p>
              ) : null}
              <ul className="chips">
                {mentor.interests.filter((item) => item.length <= 32).slice(0, 4).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </header>
          <aside className="place-card">
            <h2>{mentor.placement === "chart" ? "在图上的位置" : mentor.placement === "offplane" ? "为什么不在图上" : "尺度标注"}</h2>
            {mentor.placement === "chart" ? <MiniMap mentor={mentor} /> : null}
            <p>{mentor.placementNoteZh}</p>
            {mentor.placementNoteEn ? <p className="en-block">{mentor.placementNoteEn}</p> : null}
          </aside>
          {mentor.summaryZh.length || mentor.summaryEn ? (
            <section className="prose">
              {mentor.summaryZh.map((para) => (
                <p key={para}>{para}</p>
              ))}
              {mentor.summaryEn ? <p className="en-block">{mentor.summaryEn}</p> : null}
            </section>
          ) : (
            <section className="prose">
              <p className="fine">官方简介尚未收录。下面的研究方向是官网原文，不是本站改写。</p>
            </section>
          )}
        </div>

        <div className="detail-rest">
        {pictures.length ? (
          <section className="gallery">
            <h2>相关天体</h2>
            <ul>
              {pictures.map((obj) => (
                <li key={obj.id}>
                  <img src={publicUrl(obj.image)} alt={`${obj.nameZh}，${obj.nameEn}`} decoding="async" loading="lazy" />
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

        <section>
          <h2>研究方向</h2>
          {mentor.interests.length ? (
            <ul className="direction-list">
              {mentor.interests.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <p className="fine">官网没有给出研究方向。</p>
          )}
        </section>

        <section className="papers">
          <h2>代表性论文</h2>
          {facts.papers.length ? (
            <>
              <p className="fine">
                {mentor.editorialStatus === "legacy"
                  ? "这些条目沿用此前写入的代表作，本轮没有逐篇重核。没有 DOI 的链接会打开 ADS 题名检索。"
                  : "条目来自已核验的官方列表。"}
              </p>
              <ol>
                {facts.papers.map((paper) => (
                  <li key={paper.title}>
                    <a href={paperHref(paper)} target="_blank" rel="noreferrer">
                      {paper.title}
                    </a>
                    <span>{paper.venue}</span>
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <p className="fine">代表性论文尚未收录。</p>
          )}
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

        <section className="sources">
          <h2>来源与核验</h2>
          <p className="fine">
            身份、职称、研究方向和官方链接的核验日期是 {facts.verifiedAt || "尚未填写"}。
            抓到网页不等于完成核验。没有写出来的内容，只是这里还没有，不能据此推断没有招生、已经离任或没有成果。
          </p>
          {mentor.editorialStatus === "legacy" ? (
            <p className="fine">简介、荣誉、照片和尺度区域沿用仓库里更早的内容，本轮没有逐条升为已核验。</p>
          ) : null}
          {facts.conflicts.length ? (
            <ul className="direction-list">
              {facts.conflicts.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
          <ul className="source-links">
            {facts.evidence.map((item) => (
                <li key={item.id}>
                  <span>{fieldLabel(item.field)}</span>
                  {item.locator.startsWith("http") ? (
                    <a href={item.locator} target="_blank" rel="noreferrer">
                      {item.locator.replace("https://tdli.sjtu.edu.cn", "tdli.sjtu.edu.cn")}
                    </a>
                  ) : (
                    <span>{item.locator}</span>
                  )}
                </li>
              ))}
          </ul>
          <p className="fine">
            <a href="https://github.com/QYshen-0521/tdli-scale-atlas/issues" target="_blank" rel="noreferrer">
              发现错误，请在仓库提交 issue
            </a>
            {" · "}
            <a href="https://github.com/QYshen-0521/tdli-scale-atlas/actions/workflows/faculty-sync.yml" target="_blank" rel="noreferrer">
              每周检查的运行记录
            </a>
          </p>
        </section>

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
        </div>
      </article>
    </main>
  );
}

function fieldLabel(field: string) {
  if (field === "name") return "姓名";
  if (field === "title") return "职称";
  if (field === "directions") return "方向";
  if (field === "directions-retained") return "保留原文";
  if (field === "profileUrl") return "主页";
  if (field === "profileAlias") return "地址别名";
  return field;
}
