import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The threaded OpenCASCADE build needs SharedArrayBuffer, which needs the page
// to be cross-origin isolated. The dev and preview servers can just send the
// headers; on GitHub Pages a service worker has to add them (see
// public/coi-serviceworker.js), because Pages cannot set headers at all.
const crossOriginIsolation = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
};

export default defineConfig({
  plugins: [react()],
  base: "./",
  server: { headers: crossOriginIsolation },
  preview: { headers: crossOriginIsolation },
  // The kernel is 9.3 MB of wasm; leave it as a file rather than inlining it,
  // and keep it out of the eager dependency scan.
  optimizeDeps: { exclude: ["opencascade.js"] },
  worker: { format: "es" },
  build: { assetsInlineLimit: 0, chunkSizeWarningLimit: 12000 },
});
