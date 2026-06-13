import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "node:path";

// Vanilla Vite SPA — output goes to dist/ as static files.
// Designed to be uploaded to any static host (IONOS, etc.).
// PHP files live in public/api/ and Vite copies them as-is into dist/api/.
export default defineConfig(({ mode }) => ({
  base: '/',   // ← AÑADE ESTA LÍNEA
  plugins: [react(), tailwindcss(), tsconfigPaths()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: "::",
    port: 8080,
    strictPort: false,
  },
  build: {
    outDir: "dist",
    sourcemap: mode === "development",
  },
}));
