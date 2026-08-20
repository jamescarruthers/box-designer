// §14 Draw a DXF as an SVG, so it can be looked at rather than trusted.
//
// A DXF that parses can still put a hole in the wrong part. Nothing here is a
// CAD viewer — it reads the handful of entity types this app writes and lays
// them out to scale, which is enough to see whether the nest is the nest.
//
//   node tools/spike/dxf-preview.mjs in.dxf out.svg
import fs from "node:fs";

const [inFile, outFile] = process.argv.slice(2);
const lines = fs.readFileSync(inFile, "utf8").split("\n");
const pairs = [];
for (let i = 0; i + 1 < lines.length; i += 2) pairs.push([Number(lines[i]), lines[i + 1]]);

const COLOUR = { OUTLINE: "#e8eef4", HOLES: "#e8703a", SHEET: "#5a6b7c", LABEL: "#7fd18a" };
const entities = [];
let section = null, e = null;
for (let i = 0; i < pairs.length; i++) {
  const [code, value] = pairs[i];
  if (code === 0 && value === "SECTION") { section = pairs[i + 1][1]; continue; }
  if (code === 0 && value === "ENDSEC") { section = null; continue; }
  if (section !== "ENTITIES") continue;
  if (code === 0) { e = { type: value, v: [] }; entities.push(e); continue; }
  if (!e) continue;
  if (code === 8) e.layer = value;
  else if (code === 10) e.x = Number(value);
  else if (code === 20) e.y = Number(value);
  else if (code === 40) e.r = Number(value);
  else if (code === 1) e.text = value;
}
const shapes = [];
for (const x of entities) {
  if (x.type === "VERTEX") shapes.at(-1)?.v.push([x.x, x.y]);
  else if (x.type !== "SEQEND") shapes.push(x);
}

const xs = shapes.flatMap((s) => (s.v.length ? s.v.map((p) => p[0]) : [s.x - (s.r ?? 0), s.x + (s.r ?? 0)]));
const ys = shapes.flatMap((s) => (s.v.length ? s.v.map((p) => p[1]) : [s.y - (s.r ?? 0), s.y + (s.r ?? 0)]));
const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
const pad = 80;
const svg = [`<svg xmlns="http://www.w3.org/2000/svg" width="1400" viewBox="${x0 - pad} ${-y1 - pad} ${x1 - x0 + pad * 2} ${y1 - y0 + pad * 2}">`,
  `<rect x="${x0 - pad}" y="${-y1 - pad}" width="${x1 - x0 + pad * 2}" height="${y1 - y0 + pad * 2}" fill="#14181d"/>`];
for (const s of shapes) {
  const c = COLOUR[s.layer] ?? "#888";
  if (s.type === "POLYLINE") {
    svg.push(`<polygon points="${s.v.map(([x, y]) => `${x},${-y}`).join(" ")}" fill="none" stroke="${c}" stroke-width="4"/>`);
  } else if (s.type === "CIRCLE") {
    svg.push(`<circle cx="${s.x}" cy="${-s.y}" r="${s.r}" fill="none" stroke="${c}" stroke-width="4"/>`);
  } else if (s.type === "TEXT") {
    svg.push(`<text x="${s.x}" y="${-s.y}" fill="${c}" font-size="${28}" text-anchor="middle" font-family="monospace">${
      s.text.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</text>`);
  }
}
svg.push("</svg>");
fs.writeFileSync(outFile, svg.join("\n"));
console.log(`${shapes.length} entities → ${outFile}`);
