import { tiltOf } from "../lib/format.ts";

type Props = {
  id: string;
  char: string;
  pigment: string;
  broad?: boolean;
  size?: number;
};

export function Seal({ id, char, pigment, broad = false, size = 48 }: Props) {
  const tilt = tiltOf(id);
  return (
    <svg
      className="seal"
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
      style={{ transform: `rotate(${tilt}deg)` }}
    >
      {broad ? (
        <circle cx="32" cy="32" r="30" fill="none" stroke={pigment} strokeWidth="1.2" strokeDasharray="2.2 2.4" />
      ) : null}
      <circle cx="32" cy="32" r="22.5" fill="#8e2f2a" stroke={pigment} strokeWidth="1.6" />
      <circle cx="32" cy="32" r="18.6" fill="none" stroke="rgba(246, 239, 226, 0.55)" strokeWidth="0.8" />
      <text
        x="32"
        y="33.5"
        textAnchor="middle"
        dominantBaseline="central"
        fill="#f6efe2"
        fontSize={char.length > 1 ? 16 : 22}
        fontFamily='"Noto Serif SC", "Songti SC", serif'
      >
        {char}
      </text>
    </svg>
  );
}
