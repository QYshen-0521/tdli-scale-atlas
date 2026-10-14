import { useCallback } from "react";
import { flushSync } from "react-dom";
import { useNavigate } from "react-router-dom";
import type { NavigateFunction } from "react-router-dom";
import { useAtlasState } from "../atlas-state.tsx";

export function supportsViewTransition() {
  return typeof document !== "undefined" && typeof document.startViewTransition === "function";
}

export function transitionTo(navigate: NavigateFunction, to: string, onDone?: () => void) {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced || !supportsViewTransition()) {
    navigate(to);
    onDone?.();
    return;
  }
  try {
    const transition = document.startViewTransition(() => {
      flushSync(() => {
        navigate(to);
      });
    });
    transition.finished.finally(() => onDone?.());
  } catch {
    navigate(to);
    onDone?.();
  }
}

export function useOpenMentor() {
  const navigate = useNavigate();
  const { setFlyingId, setFlip } = useAtlasState();

  return useCallback((id: string, to: string, dest: "detail" | "atlas") => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduced && supportsViewTransition()) {
      flushSync(() => setFlyingId(id));
      transitionTo(navigate, to, () => setFlyingId(null));
      return;
    }
    if (!reduced) {
      const el = document.querySelector(`[data-avatar-for="${CSS.escape(id)}"]`);
      if (el instanceof HTMLElement) {
        const box = el.getBoundingClientRect();
        setFlip({
          id,
          dest,
          token: performance.now(),
          from: { left: box.left, top: box.top, width: box.width, height: box.height },
        });
      }
    }
    navigate(to);
  }, [navigate, setFlip, setFlyingId]);
}
