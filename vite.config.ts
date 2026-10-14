import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const pages = process.env.GITHUB_PAGES === "true";

export default defineConfig({
  base: pages ? "/tdli-scale-atlas/" : "/",
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 47231,
    strictPort: true,
  },
  preview: {
    host: "0.0.0.0",
    port: 47231,
    strictPort: true,
  },
});
