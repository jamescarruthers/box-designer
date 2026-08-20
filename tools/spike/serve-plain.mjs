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
// A directory and port may be given, so the deployed artifact can be mirrored
// and served under its real sub-path: `node tools/spike/serve-plain.mjs /tmp/mirror 5098`
// then open http://localhost:5098/box-designer/.
const root = path.resolve(process.argv[2] ?? "dist");
const port = Number(process.argv[3] ?? 5099);
// Bytes per second, optional. Browser-level throttling does not reach a
// worker's own fetches, so to test the kernel arriving over a slow line the
// slowness has to be on this side.
const rate = Number(process.argv[4] ?? 0);
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".wasm": "application/wasm", ".json": "application/json", ".svg": "image/svg+xml" };
http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split("?")[0]);
  // A directory means its index.html, the way any static host resolves it.
  let file = path.join(root, url);
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); return res.end("not found");
  }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] ?? "application/octet-stream" });
  if (!rate) return fs.createReadStream(file).pipe(res);

  const body = fs.readFileSync(file);
  const block = Math.max(1, Math.round(rate / 10));
  let at = 0;
  const tick = () => {
    if (at >= body.length) return res.end();
    res.write(body.subarray(at, at + block));
    at += block;
    setTimeout(tick, 100);
  };
  tick();
}).listen(port, () => console.log(`plain server for ${root} on ${port}`));
