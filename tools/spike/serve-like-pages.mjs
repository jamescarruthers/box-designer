// §23 Serve `dist` the way GitHub Pages serves it: the kernel gzipped on the
// wire. `vite preview` sends it whole — 10.6 MB against the 4.0 MB a browser
// really downloads — which makes any timing taken against it far too gloomy.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { gzipSync } from "node:zlib";

const root = process.argv[2] ?? "dist";
const port = Number(process.argv[3] ?? 5012);
const TYPES = {
  ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript",
  ".css": "text/css", ".wasm": "application/wasm", ".json": "application/json",
  ".png": "image/png", ".svg": "image/svg+xml",
};
const cache = new Map();

createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(req.url.split("?")[0]));
  const file = join(root, path.endsWith("/") ? `${path}index.html` : path);
  try {
    let body = cache.get(file);
    if (!body) { body = await readFile(file); cache.set(file, body); }
    const type = TYPES[extname(file)] ?? "application/octet-stream";
    // Pages compresses; so does this. Everything else is byte-for-byte.
    const wants = (req.headers["accept-encoding"] ?? "").includes("gzip");
    const headers = { "Content-Type": type };
    // §11 The kernel needs these to use more than one thread.
    headers["Cross-Origin-Opener-Policy"] = "same-origin";
    headers["Cross-Origin-Embedder-Policy"] = "require-corp";
    if (wants && /\.(wasm|js|mjs|css|html|json|svg)$/.test(file)) {
      const key = `${file}:gz`;
      let gz = cache.get(key);
      if (!gz) { gz = gzipSync(body, { level: 9 }); cache.set(key, gz); }
      headers["Content-Encoding"] = "gzip";
      headers["Content-Length"] = gz.length;
      res.writeHead(200, headers); res.end(gz);
      return;
    }
    headers["Content-Length"] = body.length;
    res.writeHead(200, headers); res.end(body);
  } catch {
    res.writeHead(404); res.end("not found");
  }
}).listen(port, () => console.log(`serving ${root} like Pages on http://localhost:${port}/`));
