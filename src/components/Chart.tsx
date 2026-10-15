import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";
import { useAtlasState, useAvatarArrival } from "../atlas-state.tsx";
import { useCamera } from "../camera.tsx";
import { objects } from "../content.ts";
import { publicUrl, thumbUrl } from "../lib/assets.ts";
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

type AxisSink = (view: View, zoom: number) => void;

/** Screen position is `translate(tx, ty) scale(s)` of the last committed projection. */
function gestureTransform(base: View, live: View) {
  const s = live.k / base.k;
  return { s, tx: live.x - base.x * s, ty: live.y - base.y * s };
}

function paintWorld(
  node: HTMLDivElement,
  surface: HTMLDivElement,
  base: View,
  live: View,
  fittedK: number,
  zoomLabel: HTMLElement | null,
  onAxis: AxisSink | null,
) {
  const { s, tx, ty } = gestureTransform(base, live);
  node.style.transform = `translate3d(${tx}px, ${ty}px, 0) scale(${s})`;
  node.style.setProperty("--inv-s", String(1 / s));
  node.classList.add("is-live");
  surface.classList.add("is-gesturing");
  const zoomNow = live.k / fittedK;
  if (zoomLabel) zoomLabel.textContent = `${zoomNow.toFixed(1)}×`;
  onAxis?.(live, zoomNow);
}

function clearWorld(node: HTMLDivElement, surface: HTMLDivElement) {
  node.style.transform = "";
  node.style.setProperty("--inv-s", "1");
  node.classList.remove("is-live");
  surface.classList.remove("is-gesturing");
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
  const { flip } = useAtlasState();
  useAvatarArrival(flip?.dest === "atlas" ? flip.id : undefined, "atlas", Boolean(view));
  const worldRef = useRef<HTMLDivElement>(null);
  const zoomLabelRef = useRef<HTMLSpanElement>(null);
  const viewRef = useRef(view);
  const fittedRef = useRef<View | null>(null);
  const dirtyRef = useRef(dirty);
  const sizeRef = useRef(size);
  const liveRef = useRef<View | null>(null);
  const pendingLive = useRef<View | null>(null);
  const axisSink = useRef<AxisSink | null>(null);
  const drag = useRef<{ id: number; x: number; y: number; ox: number; oy: number; k: number; moved: boolean } | null>(null);
  const moved = useRef(false);
  const pts = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<number | null>(null);
  const animRef = useRef(0);
  const liveRaf = useRef(0);
  const wheelTimer = useRef(0);
  const openRef = useRef(onOpenMentor);
  const gestureApi = useRef({
    markDirty: () => {},
    scheduleLive: (_next: View) => {},
    commitGesture: (_mark: boolean) => {},
    reset: () => {},
    stopAnim: () => {},
    setView: (_next: View) => {},
  });

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

  function stopAnim() {
    cancelAnimationFrame(animRef.current);
    animRef.current = 0;
  }

  function markDirty() {
    if (dirtyRef.current) return;
    dirtyRef.current = true;
    setDirty(true);
  }

  function applyLive(next: View) {
    const base = viewRef.current;
    const node = worldRef.current;
    const surface = surfaceRef.current;
    if (!base || !node || !surface) return;
    const fittedK = fittedRef.current?.k || base.k;
    liveRef.current = next;
    pendingLive.current = next;
    paintWorld(node, surface, base, next, fittedK, zoomLabelRef.current, axisSink.current);
  }

  function scheduleLive(next: View) {
    stopAnim();
    pendingLive.current = next;
    if (liveRaf.current) return;
    liveRaf.current = requestAnimationFrame(() => {
      liveRaf.current = 0;
      if (pendingLive.current) applyLive(pendingLive.current);
    });
  }

  function commitGesture(markDirtyNow: boolean) {
    stopAnim();
    if (wheelTimer.current) {
      window.clearTimeout(wheelTimer.current);
      wheelTimer.current = 0;
    }
    if (liveRaf.current) {
      cancelAnimationFrame(liveRaf.current);
      liveRaf.current = 0;
    }
    const next = pendingLive.current || liveRef.current;
    const base = viewRef.current;
    pendingLive.current = null;
    if (!next || !base) {
      liveRef.current = null;
      return;
    }
    const same =
      Math.abs(next.x - base.x) < 0.05 &&
      Math.abs(next.y - base.y) < 0.05 &&
      Math.abs(next.k - base.k) < 1e-4;
    liveRef.current = null;
    if (same) {
      if (worldRef.current && surfaceRef.current) clearWorld(worldRef.current, surfaceRef.current);
      return;
    }
    if (markDirtyNow) markDirty();
    setView(next);
  }

  function reset() {
    const from = pendingLive.current || liveRef.current || viewRef.current;
    const target = fittedRef.current;
    if (!from || !target) return;
    if (wheelTimer.current) {
      window.clearTimeout(wheelTimer.current);
      wheelTimer.current = 0;
    }
    stopAnim();
    const t0 = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / 520);
      const e = 1 - (1 - t) ** 3;
      const { w, h } = sizeRef.current;
      const next = {
        x: from.x + (target.x - from.x) * e,
        y: from.y + (target.y - from.y) * e,
        k: from.k + (target.k - from.k) * e,
      };
      applyLive(w > 40 ? clampPan(next, w, h, PAD) : next);
      if (t < 1) animRef.current = requestAnimationFrame(step);
      else {
        pendingLive.current = null;
        liveRef.current = null;
        dirtyRef.current = false;
        setDirty(false);
        setView(target);
      }
    };
    animRef.current = requestAnimationFrame(step);
  }

  useLayoutEffect(() => {
    viewRef.current = view;
    dirtyRef.current = dirty;
    sizeRef.current = size;
    fittedRef.current = fitted;
    openRef.current = onOpenMentor;
    gestureApi.current.markDirty = markDirty;
    gestureApi.current.scheduleLive = scheduleLive;
    gestureApi.current.commitGesture = commitGesture;
    gestureApi.current.reset = reset;
    gestureApi.current.stopAnim = stopAnim;
    gestureApi.current.setView = setView;
    const node = worldRef.current;
    const surface = surfaceRef.current;
    if (!node || !surface) return;
    const live = liveRef.current;
    const base = viewRef.current;
    if (!live || !base) {
      clearWorld(node, surface);
      const fittedK = fittedRef.current?.k;
      if (zoomLabelRef.current && base && fittedK) {
        zoomLabelRef.current.textContent = `${(base.k / fittedK).toFixed(1)}×`;
      }
      return;
    }
    paintWorld(node, surface, base, live, fittedRef.current?.k || base.k, zoomLabelRef.current, axisSink.current);
  });

  useEffect(() => {
    const el = surfaceRef.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      const current = pendingLive.current || liveRef.current || viewRef.current;
      if (!current) return;
      event.preventDefault();
      const api = gestureApi.current;
      api.stopAnim();
      const rect = el.getBoundingClientRect();
      const base = fitView(rect.width, rect.height, PAD);
      const { min, max } = limits(base.k);
      const factor = Math.exp(-event.deltaY * 0.00135);
      const next = zoomAt(current, event.clientX - rect.left, event.clientY - rect.top, factor, min, max);
      api.markDirty();
      api.scheduleLive(clampPan(next, rect.width, rect.height, PAD));
      if (wheelTimer.current) window.clearTimeout(wheelTimer.current);
      wheelTimer.current = window.setTimeout(() => gestureApi.current.commitGesture(true), 140);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      if (wheelTimer.current) window.clearTimeout(wheelTimer.current);
      cancelAnimationFrame(liveRaf.current);
      cancelAnimationFrame(animRef.current);
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
      const viewNow = pendingLive.current || liveRef.current || viewRef.current;
      if (!viewNow || !surfaceRef.current) return;
      const rect = surfaceRef.current.getBoundingClientRect();
      const base = fitView(rect.width, rect.height, PAD);
      const { min, max } = limits(base.k);
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const finish = (next: View) => {
        const api = gestureApi.current;
        api.stopAnim();
        if (wheelTimer.current) window.clearTimeout(wheelTimer.current);
        if (liveRaf.current) cancelAnimationFrame(liveRaf.current);
        pendingLive.current = null;
        liveRef.current = null;
        api.markDirty();
        api.setView(clampPan(next, rect.width, rect.height, PAD));
      };
      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        finish(zoomAt(viewNow, cx, cy, 1.25, min, max));
      } else if (event.key === "-" || event.key === "_") {
        event.preventDefault();
        finish(zoomAt(viewNow, cx, cy, 0.8, min, max));
      } else if (event.key === "0") {
        event.preventDefault();
        gestureApi.current.reset();
      } else if (event.key.startsWith("Arrow")) {
        event.preventDefault();
        const dx = event.key === "ArrowLeft" ? 56 : event.key === "ArrowRight" ? -56 : 0;
        const dy = event.key === "ArrowUp" ? 56 : event.key === "ArrowDown" ? -56 : 0;
        finish({ ...viewNow, x: viewNow.x + dx, y: viewNow.y + dy });
      } else if (event.key === "Escape") {
        setPinned(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
    const current = pendingLive.current || liveRef.current || viewRef.current;
    if (current) {
      drag.current = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        ox: current.x,
        oy: current.y,
        k: current.k,
        moved: false,
      };
    }
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!pts.current.has(event.pointerId) || !surfaceRef.current) return;
    const currentView = pendingLive.current || liveRef.current || viewRef.current;
    if (!currentView) return;
    pts.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const rect = surfaceRef.current.getBoundingClientRect();
    if (pts.current.size >= 2 && pinch.current) {
      const [a, b] = [...pts.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const factor = dist / pinch.current;
      pinch.current = dist;
      const base = fitView(rect.width, rect.height, PAD);
      const { min, max } = limits(base.k);
      const next = zoomAt(currentView, (a.x + b.x) / 2 - rect.left, (a.y + b.y) / 2 - rect.top, factor, min, max);
      moved.current = true;
      markDirty();
      scheduleLive(clampPan(next, rect.width, rect.height, PAD));
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
    markDirty();
    scheduleLive(clampPan({ x: current.ox + dx, y: current.oy + dy, k: current.k }, rect.width, rect.height, PAD));
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    pts.current.delete(event.pointerId);
    if (pts.current.size < 2) pinch.current = null;
    const dragged = drag.current?.moved;
    drag.current = null;
    if (dragged || liveRef.current || pendingLive.current) commitGesture(true);
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
  const markerLayout = useMemo(() => {
    const layout = new Map<string, { x: number; y: number; size: number; dot: boolean; showLabel: boolean; showEn: boolean }>();
    if (!view) return layout;
    const markerSize = (obj: Celestial, force: boolean) => {
      if (force || obj.priority >= 9 || zoom > 1.85) {
        return Math.max(28, Math.min(68, 24 + Math.log2(Math.max(zoom, 0.85)) * 12));
      }
      if (obj.priority >= 7 || zoom > 1.25) return 16;
      return 7;
    };
    const occupied: Box[] = [];
    const labelIds = new Set<string>();
    for (const mentor of mentors) {
      const p = project(mentor.anchor.logL, mentor.anchor.logM, view);
      occupied.push({
        x: p.x,
        y: p.y + 8,
        w: Math.max(sealSizeNow, mentor.shortZh.length * 14 + 8),
        h: sealSizeNow + 16,
      });
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
    for (const obj of objects) {
      const p = project(obj.logL, obj.logM, view);
      const force = hoverObject === obj.id || pinned === obj.id;
      const px = markerSize(obj, force);
      layout.set(obj.id, {
        x: p.x,
        y: p.y,
        size: px,
        dot: px <= 8 && !force,
        showLabel: labelIds.has(obj.id),
        showEn: zoom > 2.1 || force,
      });
    }
    return layout;
  }, [hoverObject, mentors, pinned, sealSizeNow, view, zoom]);

  const onMentorOpen = useCallback((id: string) => {
    if (moved.current) return;
    openRef.current(id);
  }, []);
  const onMentorEnter = useCallback((id: string) => setHoverMentor(id), []);
  const onMentorLeave = useCallback((id: string) => setHoverMentor((current) => (current === id ? null : current)), []);
  const onObjectToggle = useCallback((id: string) => {
    if (moved.current) return;
    setPinned((current) => (current === id ? null : id));
  }, []);
  const onObjectEnter = useCallback((id: string) => setHoverObject(id), []);
  const onObjectLeave = useCallback((id: string) => setHoverObject((current) => (current === id ? null : current)), []);
  const bindAxes = useCallback((sink: AxisSink | null) => {
    axisSink.current = sink;
  }, []);

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
          <div ref={worldRef} className="chart-world">
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
                  onEnter={onMentorEnter}
                  onLeave={onMentorLeave}
                  onOpen={onMentorOpen}
                />
              ))}
            </svg>
            <div className="obj-layer">
              {objects.map((obj) => {
                const placed = markerLayout.get(obj.id);
                if (!placed) return null;
                return (
                  <ObjectMarker
                    key={obj.id}
                    obj={obj}
                    x={placed.x}
                    y={placed.y}
                    size={placed.size}
                    dot={placed.dot}
                    dim={objectDimmed(obj, filter)}
                    pinned={pinned === obj.id}
                    hot={hoverObject === obj.id}
                    showLabel={placed.showLabel}
                    showEn={placed.showEn}
                    onToggle={onObjectToggle}
                    onEnter={onObjectEnter}
                    onLeave={onObjectLeave}
                  />
                );
              })}
            </div>
            {mentors.map((mentor) => {
              const p = project(mentor.anchor.logL, mentor.anchor.logM, view);
              return (
                <ChartAvatar
                  key={mentor.id}
                  mentor={mentor}
                  x={p.x}
                  y={p.y}
                  sealSize={sealSizeNow}
                  dim={dimmed(mentor, filter)}
                  hot={hoverMentor === mentor.id}
                  onOpen={onMentorOpen}
                  onEnter={onMentorEnter}
                  onLeave={onMentorLeave}
                />
              );
            })}
            {hoverMentor ? <MentorTip mentorId={hoverMentor} view={view} width={size.w} mentors={mentors} /> : null}
          </div>
          <LiveAxes view={view} width={size.w} height={size.h} zoom={zoom} bind={bindAxes} />
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
        <span ref={zoomLabelRef}>{zoom.toFixed(1)}×</span>
      </button>
    </div>
  );
}

const ChartAvatar = memo(function ChartAvatar({
  mentor,
  x,
  y,
  sealSize,
  dim,
  hot,
  onOpen,
  onEnter,
  onLeave,
}: {
  mentor: Mentor;
  x: number;
  y: number;
  sealSize: number;
  dim: boolean;
  hot: boolean;
  onOpen: (id: string) => void;
  onEnter: (id: string) => void;
  onLeave: (id: string) => void;
}) {
  return (
    <button
      type="button"
      className={`avatar-btn${dim ? " is-dim" : ""}${hot ? " is-hot" : ""}`}
      style={{ left: x - sealSize / 2, top: y - sealSize / 2 }}
      data-interactive="mentor"
      onClick={() => onOpen(mentor.id)}
      onMouseEnter={() => onEnter(mentor.id)}
      onMouseLeave={() => onLeave(mentor.id)}
      onFocus={() => onEnter(mentor.id)}
      onBlur={() => onLeave(mentor.id)}
      aria-label={`${mentor.nameZh}，${mentor.nameEn}。${mentor.blurbZh} 打开研究页。`}
    >
      <MentorAvatar mentor={mentor} size={sealSize} thumb />
      {hot ? (
        <span className="avatar-name">
          {mentor.shortZh}
          {mentor.coverage === "broad" ? <em>广域</em> : null}
        </span>
      ) : null}
    </button>
  );
});

const ObjectMarker = memo(function ObjectMarker({
  obj,
  x,
  y,
  size,
  dot,
  dim,
  pinned,
  hot,
  showLabel,
  showEn,
  onToggle,
  onEnter,
  onLeave,
}: {
  obj: Celestial;
  x: number;
  y: number;
  size: number;
  dot: boolean;
  dim: boolean;
  pinned: boolean;
  hot: boolean;
  showLabel: boolean;
  showEn: boolean;
  onToggle: (id: string) => void;
  onEnter: (id: string) => void;
  onLeave: (id: string) => void;
}) {
  const [useFull, setUseFull] = useState(false);
  const [broken, setBroken] = useState(false);
  const svg = obj.image.endsWith(".svg");
  const src = svg || useFull ? publicUrl(obj.image) : thumbUrl(obj.image);
  return (
    <div
      className={`obj-anchor${hot || pinned ? " is-front" : ""}${dim ? " is-dim" : ""}`}
      style={{ left: x - size / 2, top: y - size / 2, width: size, height: size }}
    >
      <button
        type="button"
        className={`obj-btn${pinned ? " is-pinned" : ""}${dot ? " is-dot" : ""}`}
        data-interactive="object"
        onClick={() => onToggle(obj.id)}
        onMouseEnter={() => onEnter(obj.id)}
        onMouseLeave={() => onLeave(obj.id)}
        onFocus={() => onEnter(obj.id)}
        onBlur={() => onLeave(obj.id)}
        aria-label={`${obj.nameZh}，${obj.nameEn}。${obj.measureZh}`}
      >
        {dot ? null : broken ? (
          <span className="obj-fallback">{obj.nameZh.slice(0, 1)}</span>
        ) : (
          <img
            src={src}
            alt=""
            width={size}
            height={size}
            draggable={false}
            decoding="async"
            onError={() => {
              if (!svg && !useFull) setUseFull(true);
              else setBroken(true);
            }}
          />
        )}
      </button>
      {showLabel ? (
        <span className="obj-label">
          {obj.nameZh}
          {showEn ? <i>{obj.nameEn}</i> : null}
        </span>
      ) : null}
    </div>
  );
});

function LiveAxes({
  view,
  width,
  height,
  zoom,
  bind,
}: {
  view: View;
  width: number;
  height: number;
  zoom: number;
  bind: (sink: AxisSink | null) => void;
}) {
  const [live, setLive] = useState({ view, zoom });
  const [trackedView, setTrackedView] = useState(view);
  const [trackedZoom, setTrackedZoom] = useState(zoom);
  if (view !== trackedView || zoom !== trackedZoom) {
    setTrackedView(view);
    setTrackedZoom(zoom);
    setLive({ view, zoom });
  }
  useLayoutEffect(() => {
    bind((next, nextZoom) => setLive({ view: next, zoom: nextZoom }));
    return () => bind(null);
  }, [bind]);
  return <Axes view={live.view} width={width} height={height} zoom={live.zoom} />;
}

const ChartGrid = memo(function ChartGrid({ view, width, height }: { view: View; width: number; height: number }) {
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
});

const Guides = memo(function Guides({ view }: { view: View }) {
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
});

const LeaderLines = memo(function LeaderLines({ view, dimFilter, mentors }: { view: View; dimFilter: FilterKey; mentors: Mentor[] }) {
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
});

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

const MentorShapes = memo(function MentorShapes({
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
  onEnter: (id: string) => void;
  onLeave: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  const base = mentor.coverage === "broad" ? 0.035 : mentor.coverage === "wide" ? 0.055 : 0.12;
  const fillOpacity = dim ? 0.012 : active ? Math.max(0.22, base) : base;
  const strokeOpacity = dim ? 0.18 : active ? 1 : 0.78;
  const dash = mentor.coverage === "broad" ? "7 6" : undefined;
  const handlers = {
    onMouseEnter: () => onEnter(mentor.id),
    onMouseLeave: () => onLeave(mentor.id),
    onClick: (event: ReactMouseEvent) => {
      event.stopPropagation();
      onOpen(mentor.id);
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
});

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
      <img src={publicUrl(obj.image)} alt={`${obj.nameZh}（${obj.nameEn}）`} decoding="async" />
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
