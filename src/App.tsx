import { lazy, Suspense, useEffect } from "react";
import { Route, Routes } from "react-router-dom";
import { AtlasStateProvider } from "./atlas-state.tsx";
import { CameraProvider } from "./camera.tsx";
import AtlasPage from "./components/AtlasPage.tsx";
import DirectoryPage from "./components/DirectoryPage.tsx";

const DetailPage = lazy(() => import("./components/DetailPage.tsx"));

export default function App() {
  useEffect(() => {
    const id = window.setTimeout(() => {
      void import("./components/DetailPage.tsx");
    }, 2500);
    return () => window.clearTimeout(id);
  }, []);
  return (
    <CameraProvider>
      <AtlasStateProvider>
        <div className="grain" aria-hidden="true" />
        <Suspense fallback={<div className="detail-page" />}>
          <Routes>
            <Route path="/" element={<AtlasPage />} />
            <Route path="/directory" element={<DirectoryPage />} />
            <Route path="/mentor/:id" element={<DetailPage />} />
          </Routes>
        </Suspense>
      </AtlasStateProvider>
    </CameraProvider>
  );
}
