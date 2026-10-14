import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";
import { useAtlasState, useAvatarArrival } from "../atlas-state.tsx";
import { useCamera } from "../camera.tsx";
import { objects } from "../content.ts";
import { publicUrl } from "../lib/assets.ts";
import {
  BOUNDS,
  RS_OFFSET,
  WATER_OFFSET,
  WATER_SLOPE,
  axisScales,
  clampPan,
  fitView,
  project,
  span,
  unproject,
  zoomAt,
} from "../lib/coords.ts";
import type { Pads, View } from "../lib/coords.ts";
import { sciParts } from "../lib/format.ts";
import type { Celestial, FilterKey, Mentor, Region } from "../types.ts";
import { MentorAvatar } from "./MentorAvatar.tsx";

type Box = { x: number; y: number; w: number; h: number };

const PAD: Pads = { l: 62, r: 24, t: 18, b: 46 };

function dimmed(mentor: Mentor, filter: FilterKey) {
  return filter !== "all" && !mentor.groups.some((group) => group === filter);
}

function objectDimmed(obj: Celestial, filter: FilterKey) {
  return filter !== "all" && obj.group !== filter;
}

function overlaps(a: Box, b: Box) {
  return Math.abs(a.x - b.x) < (a.w + b.w) / 2 + 6 && Math.abs(a.y - b.y) < (a.h + b.h) / 2 + 4;
}

function regionPath(region: Region, view: View) {
  if (region.shape === "polygon") {
    return (
      region.points
        .map((pt, i) => {
          const s = project(pt[0], pt[1], view);
          return `${i === 0 ? "M" : "L"}${s.x.toFixed(1)} ${s.y.toFixed(1)}`;
        })
        .join(" ") + " Z"
    );
  }
  return "";
}

function limits(viewKBase: number) {
  return { min: viewKBase * 0.72, max: viewKBase * 80 };
}

export function Chart({
  filter,
  guides,
  mentors,
  onOpenMentor,
}: {
  filter: FilterKey;
  guides: boolean;
  mentors: Mentor[];
  onOpenMentor: (id: string) => void;
}) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const { view, setView, dirty, setDirty } = useCamera();
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [hoverMentor, setHoverMentor] = useState<string | null>(null);
  const [hoverObject, setHoverObject] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const [broken, setBroken] = useState<Record<string, boolean>>({});
  const { flip } = useAtlasState();
  useAvatarArrival(flip?.dest === "atlas" ? flip.id : undefined, "atlas", Boolean(view));
  const drag = useRef<{ id: number; x: number; y: number; ox: number; oy: number; moved: boolean } | null>(null);
  const moved = useRef(false);
  const pts = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<number | null>(null);
  const raf = useRef(0);

  useLayoutEffect(() => {
    const el = surfaceRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      setSize({ w: rect.width, h: rect.height });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    if (dirty || size.w < 40 || size.h < 40) return;
    setView(fitView(size.w, size.h, PAD));
  }, [dirty, setView, size.h, size.w]);

  const fitted = size.w > 40 ? fitView(size.w, size.h, PAD) : null;
  const zoom = view && fitted ? view.k / fitted.k : 1;

  function commit(next: View, markDirty: boolean) {
    const rect = surfaceRef.current?.getBoundingClientRect();
    const clamped = rect ? clampPan(next, rect.width, rect.height, PAD) : next;
    if (markDirty) setDirty(true);
    setView(clamped);
  }

  function reset() {
    if (!fitted || !view) return;
    const from = view;
    const target = fitted;
    const t0 = performance.now();
    cancelAnimationFrame(raf.current);
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / 520);
      const e = 1 - (1 - t) ** 3;
      const rect = surfaceRef.current?.getBoundingClientRect();
      const next = {
        x: from.x + (target.x - from.x) * e,
        y: from.y + (target.y - from.y) * e,
        k: from.k + (target.k - from.k) * e,
      };
      setView(rect ? clampPan(next, rect.width, rect.height, PAD) : next);
      if (t < 1) raf.current = requestAnimationFrame(step);
      else setDirty(false);
    };
    raf.current = requestAnimationFrame(step);
  }

  useEffect(() => {
    const el = surfaceRef.current;
    if (!el || !view) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = el.getBoundingClientRect();
      const base = fitView(rect.width, rect.height, PAD);
      const { min, max } = limits(base.k);
      const factor = Math.exp(-event.deltaY * 0.00135);
      const next = zoomAt(view, event.clientX - rect.left, event.clientY - rect.top, factor, min, max);
      commit(next, true);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  });

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
      if (!view || !surfaceRef.current) return;
      const rect = surfaceRef.current.getBoundingClientRect();
      const base = fitView(rect.width, rect.height, PAD);
      const { min, max } = limits(base.k);
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        commit(zoomAt(view, cx, cy, 1.25, min, max), true);
      } else if (event.key === "-" || event.key === "_") {
        event.preventDefault();
        commit(zoomAt(view, cx, cy, 0.8, min, max), true);
      } else if (event.key === "0") {
        event.preventDefault();
        reset();
      } else if (event.key.startsWith("Arrow") && view) {
        event.preventDefault();
        const dx = event.key === "ArrowLeft" ? 56 : event.key === "ArrowRight" ? -56 : 0;
        const dy = event.key === "ArrowUp" ? 56 : event.key === "ArrowDown" ? -56 : 0;
        commit({ ...view, x: view.x + dx, y: view.y + dy }, true);
      } else if (event.key === "Escape") {
        setPinned(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    if (target.closest("[data-interactive='control']")) return;
    pts.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pts.current.size === 2) {
      const [a, b] = [...pts.current.values()];
      pinch.current = Math.hypot(a.x - b.x, a.y - b.y);
      drag.current = null;
      return;
    }
    if (view) {
      drag.current = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        ox: view.x,
        oy: view.y,
        moved: false,
      };
    }
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!pts.current.has(event.pointerId) || !view || !surfaceRef.current) return;
    pts.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const rect = surfaceRef.current.getBoundingClientRect();
    if (pts.current.size >= 2 && pinch.current) {
      const [a, b] = [...pts.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const factor = dist / pinch.current;
      pinch.current = dist;
      const base = fitView(rect.width, rect.height, PAD);
      const { min, max } = limits(base.k);
      const next = zoomAt(view, (a.x + b.x) / 2 - rect.left, (a.y + b.y) / 2 - rect.top, factor, min, max);
      moved.current = true;
      commit(next, true);
      return;
    }
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    const dx = event.clientX - current.x;
    const dy = event.clientY - current.y;
    if (Math.hypot(dx, dy) > 4) {
      current.moved = true;
      moved.current = true;
    }
    if (!current.moved) return;
    commit({ x: current.ox + dx, y: current.oy + dy, k: view.k }, true);
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    pts.current.delete(event.pointerId);
    if (pts.current.size < 2) pinch.current = null;
    drag.current = null;
    window.setTimeout(() => {
      moved.current = false;
    }, 40);
  }

  function onBackgroundClick(event: ReactMouseEvent<HTMLDivElement>) {
    if (moved.current) return;
    const target = event.target as HTMLElement;
    if (target.closest("[data-interactive]")) return;
    setPinned(null);
  }

  const sealSizeNow = zoom < 1.45 ? 34 : 44;
  const markerSize = (obj: Celestial, force: boolean) => {
    if (force || obj.priority >= 9 || zoom > 1.85) {
      return Math.max(28, Math.min(68, 24 + Math.log2(Math.max(zoom, 0.85)) * 12));
    }
    if (obj.priority >= 7 || zoom > 1.25) return 16;
    return 7;
  };
  const occupied: Box[] = [];
  const labelIds = new Set<string>();
  if (view) {
    for (const mentor of mentors) {
      const p = project(mentor.anchor.logL, mentor.anchor.logM, view);
      const w = Math.max(sealSizeNow, mentor.shortZh.length * 14 + 8);
      const h = sealSizeNow + 16;
      occupied.push({ x: p.x, y: p.y + 8, w, h });
    }
    for (const obj of objects) {
      const p = project(obj.logL, obj.logM, view);
      const force = hoverObject === obj.id || pinned === obj.id;
      const px = markerSize(obj, force);
      occupied.push({ x: p.x, y: p.y, w: px, h: px });
    }
    const ranked = objects.slice().sort((a, b) => b.priority - a.priority);
    for (const obj of ranked) {
      const p = project(obj.logL, obj.logM, view);
      const force = hoverObject === obj.id || pinned === obj.id;
      const px = markerSize(obj, force);
      const allow = force || zoom > 2.8 || (zoom > 1.55 && obj.priority >= 7) || obj.priority >= 9;
      if (!allow) continue;
      const box = { x: p.x, y: p.y + px / 2 + 11, w: obj.nameZh.length * 13 + 10, h: 16 };
      if (!force && occupied.some((item) => overlaps(item, box))) continue;
      labelIds.add(obj.id);
      occupied.push(box);
    }
  }

  const pinnedObject = pinned ? objects.find((obj) => obj.id === pinned) : undefined;

  return (
    <div
      ref={surfaceRef}
      className={`chart-surface${view ? " is-ready" : ""}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClick={onBackgroundClick}
      onDoubleClick={(event) => {
        const target = event.target as HTMLElement;
        if (target.closest("[data-interactive]")) return;
        reset();
      }}
      role="application"
      aria-label="尺度与质量对数图。滚轮以光标为中心缩放，拖拽平移，双击空白处复位。"
    >
      {view ? (
        <>
          <svg className="chart-svg" width="100%" height="100%">
            <ChartGrid view={view} width={size.w} height={size.h} />
            {guides ? <Guides view={view} /> : null}
            <LeaderLines view={view} dimFilter={filter} mentors={mentors} />
            {mentors.map((mentor) => (
              <MentorShapes
                key={mentor.id}
                mentor={mentor}
                view={view}
                active={hoverMentor === mentor.id}
                dim={dimmed(mentor, filter)}
                onEnter={() => setHoverMentor(mentor.id)}
                onLeave={() => setHoverMentor((id) => (id === mentor.id ? null : id))}
                onOpen={() => {
                  if (moved.current) return;
                  onOpenMentor(mentor.id);
                }}
              />
            ))}
          </svg>
          {objects.map((obj) => {
            const p = project(obj.logL, obj.logM, view);
            const force = hoverObject === obj.id || pinned === obj.id;
            const sizePx = markerSize(obj, force);
            const showLabel = labelIds.has(obj.id);
            const dot = sizePx <= 8 && !force;
            const dim = objectDimmed(obj, filter);
            return (
              <div key={obj.id} className={`obj-layer${force ? " is-front" : ""}${dim ? " is-dim" : ""}`}>
                <button
                  type="button"
                  className={`obj-btn${pinned === obj.id ? " is-pinned" : ""}${dot ? " is-dot" : ""}`}
                  style={{ left: p.x, top: p.y, width: sizePx, height: sizePx }}
                  data-interactive="object"
                  onClick={() => {
                    if (moved.current) return;
                    setPinned((id) => (id === obj.id ? null : obj.id));
                  }}
                  onMouseEnter={() => setHoverObject(obj.id)}
                  onMouseLeave={() => setHoverObject((id) => (id === obj.id ? null : id))}
                  onFocus={() => setHoverObject(obj.id)}
                  onBlur={() => setHoverObject((id) => (id === obj.id ? null : id))}
                  aria-label={`${obj.nameZh}，${obj.nameEn}。${obj.measureZh}`}
                >
                  {dot ? null : broken[obj.id] ? (
                    <span className="obj-fallback" style={{ width: sizePx, height: sizePx }}>
                      {obj.nameZh.slice(0, 1)}
                    </span>
                  ) : (
                    <img
                      src={publicUrl(obj.image)}
                      alt=""
                      width={sizePx}
                      height={sizePx}
                      style={{ width: sizePx, height: sizePx }}
                      onError={() => setBroken((state) => ({ ...state, [obj.id]: true }))}
                    />
                  )}
                </button>
                {showLabel ? (
                  <span className="obj-label" style={{ left: p.x, top: p.y + sizePx / 2 + 6 }}>
                    {obj.nameZh}
                    {zoom > 2.1 || force ? <i>{obj.nameEn}</i> : null}
                  </span>
                ) : null}
              </div>
            );
          })}
          {mentors.map((mentor) => {
            const p = project(mentor.anchor.logL, mentor.anchor.logM, view);
            const dim = dimmed(mentor, filter);
            const sealSize = zoom < 1.45 ? 34 : 44;
            return (
              <button
                key={mentor.id}
                type="button"
                className={`avatar-btn${dim ? " is-dim" : ""}${hoverMentor === mentor.id ? " is-hot" : ""}`}
                style={{
                  left: p.x - sealSize / 2,
                  top: p.y - sealSize / 2,
                }}
                data-interactive="mentor"
                onClick={() => {
                  if (moved.current) return;
                  onOpenMentor(mentor.id);
                }}
                onMouseEnter={() => setHoverMentor(mentor.id)}
                onMouseLeave={() => setHoverMentor((id) => (id === mentor.id ? null : id))}
                onFocus={() => setHoverMentor(mentor.id)}
                onBlur={() => setHoverMentor((id) => (id === mentor.id ? null : id))}
                aria-label={`${mentor.nameZh}，${mentor.nameEn}。${mentor.blurbZh} 打开研究页。`}
              >
                <MentorAvatar mentor={mentor} size={sealSize} />
                <span className="avatar-name">
                  {mentor.shortZh}
                  {mentor.coverage === "broad" ? <em>广域</em> : null}
                </span>
              </button>
            );
          })}
          <Axes view={view} width={size.w} height={size.h} zoom={zoom} />
          {hoverMentor ? <MentorTip mentorId={hoverMentor} view={view} width={size.w} mentors={mentors} /> : null}
        </>
      ) : (
        <p className="chart-wait">正在展开星图</p>
      )}
      {pinnedObject ? (
        <ObjectCard
          obj={pinnedObject}
          onClose={() => setPinned(null)}
        />
      ) : null}
      <button type="button" className="reset-fab" data-interactive="control" onClick={reset}>
        重置视野
        <span>{zoom.toFixed(1)}×</span>
      </button>
    </div>
  );
}

function ChartGrid({ view, width, height }: { view: View; width: number; height: number }) {
  const { dL, dM } = span();
  const { kx, ky } = axisScales(view.k);
  const lines: { x1: number; y1: number; x2: number; y2: number; key: string }[] = [];
  for (let n = BOUNDS.logL[0]; n <= BOUNDS.logL[1]; n += 1) {
    const x = view.x + (n - BOUNDS.logL[0]) * kx;
    if (x < -20 || x > width + 20) continue;
    lines.push({ x1: x, y1: view.y, x2: x, y2: view.y + dM * ky, key: `v${n}` });
  }
  for (let n = BOUNDS.logM[0]; n <= BOUNDS.logM[1]; n += 1) {
    const y = view.y + (BOUNDS.logM[1] - n) * ky;
    if (y < -20 || y > height + 20) continue;
    lines.push({ x1: view.x, y1: y, x2: view.x + dL * kx, y2: y, key: `h${n}` });
  }
  return (
    <g className="grid">
      {lines.map((line) => (
        <line key={line.key} x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} />
      ))}
    </g>
  );
}

function Guides({ view }: { view: View }) {
  const bh: string[] = [];
  for (let logM = 29.9; logM <= 53.8; logM += 0.4) {
    const logL = logM + RS_OFFSET;
    if (logL < BOUNDS.logL[0] || logL > BOUNDS.logL[1]) continue;
    const p = project(logL, logM, view);
    bh.push(`${bh.length ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`);
  }
  const water: string[] = [];
  for (let logL = 4.85; logL <= 17.1; logL += 0.25) {
    const logM = WATER_SLOPE * logL + WATER_OFFSET;
    if (logM < BOUNDS.logM[0] || logM > BOUNDS.logM[1]) continue;
    const p = project(logL, logM, view);
    water.push(`${water.length ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`);
  }
  const bhLabel = project(21.15, 48, view);
  const waterLabel = project(14.2, WATER_SLOPE * 14.2 + WATER_OFFSET, view);
  return (
    <g className="guides">
      <path d={bh.join(" ")} />
      <path d={water.join(" ")} className="water" />
      <text x={bhLabel.x} y={bhLabel.y}>黑洞视界</text>
      <text x={waterLabel.x} y={waterLabel.y}>水的密度</text>
    </g>
  );
}

function LeaderLines({ view, dimFilter, mentors }: { view: View; dimFilter: FilterKey; mentors: Mentor[] }) {
  return (
    <g className="leaders">
      {mentors.map((mentor) => {
        if (!mentor.leader) return null;
        const a = project(mentor.anchor.logL, mentor.anchor.logM, view);
        const b = project(mentor.leader.logL, mentor.leader.logM, view);
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (dist < 28) return null;
        const dim = dimmed(mentor, dimFilter);
        return (
          <line
            key={mentor.id}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke={mentor.pigment}
            strokeOpacity={dim ? 0.12 : 0.55}
            strokeWidth={1}
          />
        );
      })}
    </g>
  );
}

function Axes({ view, width, height, zoom }: { view: View; width: number; height: number; zoom: number }) {
  const step = zoom > 3 ? 1 : zoom > 1.45 ? 2 : 3;
  const xTicks: { n: number; x: number }[] = [];
  const left = unproject(0, 0, view).logL;
  const right = unproject(width, 0, view).logL;
  for (let n = Math.ceil(BOUNDS.logL[0]); n <= BOUNDS.logL[1]; n += 1) {
    if (n % step !== 0) continue;
    if (n < left - 0.2 || n > right + 0.2) continue;
    xTicks.push({ n, x: project(n, BOUNDS.logM[0], view).x });
  }
  const yTicks: { n: number; y: number }[] = [];
  const top = unproject(0, 0, view).logM;
  const bottom = unproject(0, height, view).logM;
  for (let n = Math.ceil(BOUNDS.logM[0]); n <= BOUNDS.logM[1]; n += 1) {
    if (n % step !== 0) continue;
    if (n > top + 0.2 || n < bottom - 0.2) continue;
    yTicks.push({ n, y: project(BOUNDS.logL[0], n, view).y });
  }
  const notes: Record<number, string> = {
    3: "1 km",
    7: "R⊕",
    9: "R☉",
    11: "AU",
    16: "pc",
    19: "kpc",
    22: "Mpc",
    25: "Gpc",
  };
  return (
    <>
      <div className="axis x-axis">
        {xTicks.map((tick) => (
          <span key={tick.n} style={{ left: tick.x }}>
            10<sup>{tick.n}</sup>
            {notes[tick.n] ? <small>{notes[tick.n]}</small> : null}
          </span>
        ))}
        <b>尺度 L / m</b>
      </div>
      <div className="axis y-axis">
        {yTicks.map((tick) => (
          <span key={tick.n} style={{ top: tick.y, left: Math.max(44, Math.min(view.x - 8, width * 0.42)) }}>
            10<sup>{tick.n}</sup>
          </span>
        ))}
        <b style={{ left: Math.max(8, Math.min(view.x - 8, width * 0.42) - 36) }}>质量 M / kg</b>
      </div>
    </>
  );
}

function MentorShapes({
  mentor,
  view,
  active,
  dim,
  onEnter,
  onLeave,
  onOpen,
}: {
  mentor: Mentor;
  view: View;
  active: boolean;
  dim: boolean;
  onEnter: () => void;
  onLeave: () => void;
  onOpen: () => void;
}) {
  const base = mentor.coverage === "broad" ? 0.035 : mentor.coverage === "wide" ? 0.055 : 0.12;
  const fillOpacity = dim ? 0.012 : active ? Math.max(0.22, base) : base;
  const strokeOpacity = dim ? 0.18 : active ? 1 : 0.78;
  const dash = mentor.coverage === "broad" ? "7 6" : undefined;
  const handlers = {
    onMouseEnter: onEnter,
    onMouseLeave: onLeave,
    onClick: (event: ReactMouseEvent) => {
      event.stopPropagation();
      onOpen();
    },
  };
  return (
    <g className={`region ${mentor.coverage}${active ? " is-active" : ""}`}>
      {mentor.regions.map((region, index) => {
        const paint = {
          fill: mentor.pigment,
          fillOpacity,
          stroke: mentor.pigment,
          strokeOpacity,
          strokeWidth: mentor.coverage === "broad" ? 1.5 : 1.25,
          strokeDasharray: dash,
          strokeLinejoin: "round" as const,
        };
        if (region.shape === "ellipse") {
          const c = project(region.cx, region.cy, view);
          const { kx, ky } = axisScales(view.k);
          return (
            <ellipse
              key={index}
              cx={c.x}
              cy={c.y}
              rx={Math.max(8, region.rx * kx)}
              ry={Math.max(8, region.ry * ky)}
              {...paint}
              pointerEvents={mentor.coverage === "broad" ? "none" : "auto"}
              {...(mentor.coverage === "broad" ? {} : handlers)}
            />
          );
        }
        if (region.shape === "rect") {
          const a = project(region.logL0, region.logM1, view);
          const b = project(region.logL1, region.logM0, view);
          return (
            <rect
              key={index}
              x={Math.min(a.x, b.x)}
              y={Math.min(a.y, b.y)}
              width={Math.abs(b.x - a.x)}
              height={Math.abs(b.y - a.y)}
              rx={16}
              {...paint}
              pointerEvents={mentor.coverage === "broad" ? "none" : "auto"}
              {...(mentor.coverage === "broad" ? {} : handlers)}
            />
          );
        }
        return (
          <path
            key={index}
            d={regionPath(region, view)}
            {...paint}
            pointerEvents={mentor.coverage === "broad" ? "none" : "auto"}
            {...(mentor.coverage === "broad" ? {} : handlers)}
          />
        );
      })}
      {mentor.coverage === "broad"
        ? mentor.regions.map((region, index) => {
            if (region.shape === "rect") {
              const a = project(region.logL0, region.logM1, view);
              const b = project(region.logL1, region.logM0, view);
              return (
                <rect
                  key={`hit-${index}`}
                  x={Math.min(a.x, b.x)}
                  y={Math.min(a.y, b.y)}
                  width={Math.abs(b.x - a.x)}
                  height={Math.abs(b.y - a.y)}
                  rx={16}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={18}
                  pointerEvents="stroke"
                  {...handlers}
                />
              );
            }
            return null;
          })
        : null}
    </g>
  );
}

function MentorTip({ mentorId, view, width, mentors }: { mentorId: string; view: View; width: number; mentors: Mentor[] }) {
  const mentor = mentors.find((item) => item.id === mentorId);
  if (!mentor) return null;
  const p = project(mentor.anchor.logL, mentor.anchor.logM, view);
  const left = Math.min(width - 240, Math.max(8, p.x + 28));
  return (
    <div className="mentor-tip" style={{ left, top: p.y - 8 }}>
      <strong>{mentor.nameZh}</strong>
      <span>{mentor.nameEn}</span>
      <p>{mentor.blurbZh}</p>
    </div>
  );
}

function ObjectCard({ obj, onClose }: { obj: Celestial; onClose: () => void }) {
  const length = sciParts(10 ** obj.logL);
  const mass = sciParts(10 ** obj.logM);
  return (
    <aside className="inspector" data-interactive="control">
      <button type="button" className="icon-x" onClick={onClose} aria-label="关闭天体说明">
        ×
      </button>
      <img src={publicUrl(obj.image)} alt={`${obj.nameZh}（${obj.nameEn}）`} />
      <div>
        <h3>
          {obj.nameZh}
          <small>{obj.nameEn}</small>
        </h3>
        <p className="measure">{obj.measureZh}</p>
        <p className="nums">
          {length ? (
            <>
              L ≈ {length.man}×10<sup>{length.exp}</sup> m
            </>
          ) : null}
          <br />
          {mass ? (
            <>
              M ≈ {mass.man}×10<sup>{mass.exp}</sup> kg
            </>
          ) : null}
        </p>
        <p>{obj.blurbZh}</p>
        <p className="credit">
          {obj.credit} · {obj.license}
          {obj.approx ? " · 坐标为量级" : ""}
        </p>
      </div>
    </aside>
  );
}
