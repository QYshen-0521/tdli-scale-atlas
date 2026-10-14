import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import { FLIGHT_EASING, FLIGHT_MS } from "./lib/motion.ts";
import "./styles.css";

document.documentElement.style.setProperty("--flight-ms", `${FLIGHT_MS}ms`);
document.documentElement.style.setProperty("--flight-ease", FLIGHT_EASING);

const basename = import.meta.env.BASE_URL.replace(/\/$/, "") || "/";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter basename={basename === "/" ? undefined : basename} useTransitions={false}>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
