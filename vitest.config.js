import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    environmentMatchGlobs: [["test/app.test.jsx", "jsdom"], ["test/isolate.test.js", "jsdom"], ["test/render.test.js", "jsdom"], ["test/kernel-worker.test.js", "jsdom"]],
    testTimeout: 60000,
  },
});
