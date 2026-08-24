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
  },
});
