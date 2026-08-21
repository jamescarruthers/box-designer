import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    // jsdom costs a couple of seconds a file, so only the files that mount
    // something ask for it.
    environmentMatchGlobs: [
      ["test/app.test.jsx", "jsdom"], ["test/inspector.test.jsx", "jsdom"],
      ["test/isolate.test.js", "jsdom"], ["test/render.test.js", "jsdom"],
      ["test/kernel-worker.test.js", "jsdom"], ["test/kernel-ui.test.jsx", "jsdom"],
    ],
    testTimeout: 60000,
  },
});
