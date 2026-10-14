import { createContext, useContext, useLayoutEffect, useMemo, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { FLIGHT_EASING, FLIGHT_MS } from "./lib/motion.ts";

export type Box = { left: number; top: number; width: number; height: number };

export type Flip = {
  id: string;
  from: Box;
  dest: "detail" | "atlas" | "directory";
  token: number;
};

type AtlasState = {
  panelOpen: boolean;
  setPanelOpen: Dispatch<SetStateAction<boolean>>;
  flyingId: string | null;
  setFlyingId: (id: string | null) => void;
  flip: Flip | null;
  setFlip: (flip: Flip | null) => void;
};

const AtlasStateContext = createContext<AtlasState | null>(null);

export function AtlasStateProvider({ children }: { children: ReactNode }) {
  const [panelOpen, setPanelOpen] = useState(true);
  const [flyingId, setFlyingId] = useState<string | null>(null);
  const [flip, setFlip] = useState<Flip | null>(null);
  const value = useMemo(
    () => ({ panelOpen, setPanelOpen, flyingId, setFlyingId, flip, setFlip }),
    [panelOpen, flyingId, flip],
  );
  return <AtlasStateContext.Provider value={value}>{children}</AtlasStateContext.Provider>;
}

export function useAtlasState() {
  const value = useContext(AtlasStateContext);
  if (!value) throw new Error("AtlasStateProvider 缺失");
  return value;
}

/** FLIP fallback when the View Transitions API is unavailable. */
export function useAvatarArrival(id: string | undefined, dest: Flip["dest"], ready = true) {
  const { flip, setFlip } = useAtlasState();
  useLayoutEffect(() => {
    if (!ready || !id || !flip || flip.dest !== dest || flip.id !== id) return;
    const el = document.querySelector(`[data-avatar-for="${CSS.escape(id)}"]`);
    if (!(el instanceof HTMLElement)) return;
    const to = el.getBoundingClientRect();
    if (to.width < 2) return;
    const dx = flip.from.left - to.left;
    const dy = flip.from.top - to.top;
    const s = flip.from.width / to.width;
    const anim = el.animate(
      [
        { transform: `translate(${dx}px, ${dy}px) scale(${s})`, transformOrigin: "top left" },
        { transform: "none", transformOrigin: "top left" },
      ],
      { duration: FLIGHT_MS, easing: FLIGHT_EASING, fill: "both" },
    );
    anim.onfinish = () => setFlip(null);
    return () => {
      anim.onfinish = null;
      anim.cancel();
    };
  }, [dest, flip, id, ready, setFlip]);
}
