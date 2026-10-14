import { useMemo } from "react";
import { chartMentors, objects } from "../content.ts";
import { BOUNDS, fitView, project } from "../lib/coords.ts";
import type { Mentor } from "../types.ts";

const W = 640;
const H = 280;

export function MiniMap({ mentor }: { mentor: Mentor }) {
  const view = useMemo(() => fitView(W, H, { l: 28, r: 16, t: 16, b: 22 }), []);
  return (
    <svg className="minimap" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${mentor.nameZh}在尺度–质量图上的位置`}>
      <rect width={W} height={H} fill="#0c0e14" rx="12" />
      {objects.map((obj) => {
        const p = project(obj.logL, obj.logM, view);
        const related = mentor.relatedObjects.includes(obj.id);
        return <circle key={obj.id} cx={p.x} cy={p.y} r={related ? 3.2 : 1.6} fill={related ? "#f3ecdf" : "rgba(243,236,223,0.35)"} />;
      })}
      {chartMentors.map((m) =>
        m.regions.map((region, i) => {
          const active = m.id === mentor.id;
          const props = {
            fill: m.pigment,
            fillOpacity: active ? 0.35 : 0.05,
            stroke: m.pigment,
            strokeOpacity: active ? 0.95 : 0.2,
            strokeWidth: active ? 1.6 : 0.6,
          };
          if (region.shape === "ellipse") {
            const c = project(region.cx, region.cy, view);
            return <ellipse key={`${m.id}-${i}`} cx={c.x} cy={c.y} rx={region.rx * view.k} ry={region.ry * view.k} {...props} />;
          }
          if (region.shape === "rect") {
            const a = project(region.logL0, region.logM1, view);
            const b = project(region.logL1, region.logM0, view);
            return (
              <rect
                key={`${m.id}-${i}`}
                x={Math.min(a.x, b.x)}
                y={Math.min(a.y, b.y)}
                width={Math.abs(b.x - a.x)}
                height={Math.abs(b.y - a.y)}
                rx="8"
                {...props}
              />
            );
          }
          const d =
            region.points
              .map((pt, idx) => {
                const s = project(pt[0], pt[1], view);
                return `${idx === 0 ? "M" : "L"}${s.x.toFixed(1)} ${s.y.toFixed(1)}`;
              })
              .join(" ") + " Z";
          return <path key={`${m.id}-${i}`} d={d} {...props} />;
        }),
      )}
      {mentor.placement === "chart" ? (
        <circle
          cx={project(mentor.anchor.logL, mentor.anchor.logM, view).x}
          cy={project(mentor.anchor.logL, mentor.anchor.logM, view).y}
          r="5"
          fill="#f3ecdf"
          stroke={mentor.pigment}
          strokeWidth="2"
        />
      ) : null}
      <text x="16" y={H - 8} fill="rgba(243,236,223,0.55)" fontSize="11">
        {`L：10^${BOUNDS.logL[0]}–10^${BOUNDS.logL[1]} m`}
      </text>
    </svg>
  );
}
