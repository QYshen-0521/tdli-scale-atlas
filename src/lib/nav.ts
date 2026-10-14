import { flushSync } from "react-dom";
import type { NavigateFunction } from "react-router-dom";

export function supportsViewTransition() {
  return typeof document !== "undefined" && typeof document.startViewTransition === "function";
}

export function transitionTo(navigate: NavigateFunction, to: string) {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced || !supportsViewTransition()) {
    navigate(to);
    return;
  }
  try {
    document.startViewTransition(() => {
      flushSync(() => {
        navigate(to);
      });
    });
  } catch {
    navigate(to);
  }
}
