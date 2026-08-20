// §11 dist/, served the way GitHub Pages serves it.
//
// The Vite dev and preview servers send COOP and COEP themselves, so every
// local run tests the one path production never takes. Pages cannot set headers
// at all: there, public/coi-serviceworker.js is the only thing that can make
// the page cross-origin isolated, and it only takes effect after a reload.
//
// Serve the built site with no headers whatever, and the service worker is on
// its own — which is the condition to reproduce anything that only happens in
// production.
//
//   npx vite build && node tools/spike/serve-plain.mjs
//   node tools/spike/pages-check.mjs
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
const root = path.resolve("dist");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".wasm": "application/wasm", ".json": "application/json", ".svg": "image/svg+xml" };
http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split("?")[0]);
  let file = path.join(root, url === "/" ? "index.html" : url);
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); return res.end("not found");
  }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] ?? "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
}).listen(5099, () => console.log("plain server on 5099"));
