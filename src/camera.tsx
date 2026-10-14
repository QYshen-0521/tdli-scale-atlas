import { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { View } from "./lib/coords.ts";

type Camera = {
  view: View | null;
  setView: (view: View | null) => void;
  dirty: boolean;
  setDirty: (dirty: boolean) => void;
};

const CameraContext = createContext<Camera | null>(null);

export function CameraProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<View | null>(null);
  const [dirty, setDirty] = useState(false);
  const value = useMemo(() => ({ view, setView, dirty, setDirty }), [view, dirty]);
  return <CameraContext.Provider value={value}>{children}</CameraContext.Provider>;
}

export function useCamera() {
  const value = useContext(CameraContext);
  if (!value) throw new Error("CameraProvider 缺失");
  return value;
}
