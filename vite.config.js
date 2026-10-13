import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [tailwindcss()],
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
