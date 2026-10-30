import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";
import { lookSurfaces } from "./build/look-surfaces.mjs";

// Each build's id: baked into the app and written to /version.json, so an
// open app notices a newer release and reloads itself (src/app-update.js).
const BUILD_ID = process.env.VERCEL_GIT_COMMIT_SHA || String(Date.now());
const buildId = {
  name: "build-id",
  generateBundle() {
    this.emitFile({ type: "asset", fileName: "version.json", source: JSON.stringify({ id: BUILD_ID }) });
  },
};

export default defineConfig({
  plugins: [tailwindcss(), buildId],
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  // The site's greys follow the page color picked in Settings (build/look-surfaces.mjs).
  css: { postcss: { plugins: [lookSurfaces()] } },
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  build: {
    sourcemap: false,
    minify: "oxc",
    target: "es2020",
    cssMinify: true,
    reportCompressedSize: false,
    // The app, and the public record at /results (results.html), which
    // loads on its own so a shared link opens fast.
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL("./index.html", import.meta.url)),
        results: fileURLToPath(new URL("./results.html", import.meta.url)),
      },
    },
  },
});
