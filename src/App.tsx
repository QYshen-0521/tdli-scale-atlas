import { Route, Routes } from "react-router-dom";
import { AtlasStateProvider } from "./atlas-state.tsx";
import { CameraProvider } from "./camera.tsx";
import AtlasPage from "./components/AtlasPage.tsx";
import DetailPage from "./components/DetailPage.tsx";
import DirectoryPage from "./components/DirectoryPage.tsx";

export default function App() {
  return (
    <CameraProvider>
      <AtlasStateProvider>
        <div className="grain" aria-hidden="true" />
        <Routes>
          <Route path="/" element={<AtlasPage />} />
          <Route path="/directory" element={<DirectoryPage />} />
          <Route path="/mentor/:id" element={<DetailPage />} />
        </Routes>
      </AtlasStateProvider>
    </CameraProvider>
  );
}
