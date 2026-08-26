// §49 Is the isometric drawing the board the model has?
//
// Two invariants over a sweep of boxes: the drawn surface closes — every edge
// has a face either side of it — and it encloses the volume `panelSolidVolume`
// gives the panel. A drawing that fails either is drawing a shape the box does
// not have, and it reads as boards crossing through each other.
//
//   npx vite-node tools/spike/iso-solid.mjs
import { DEFAULT_DESIGN, derive, addPanel } from "../../src/ui/design.js";
import { panelQuads } from "../../src/drawing/iso.js";
import { panelSolidVolume } from "../../src/model/rebate.js";
import { explodedBox } from "../../src/model/explode.js";
import { PROMINENCE_PRESETS } from "../../src/model/constants.js";

const FACES = ["front", "back", "left", "right", "top", "bottom"];
const every = (d = 6) => ({ depth: d, sides: Object.fromEntries(FACES.map((s) => [s, true])) });
const VERTICALS = ["front|left", "back|left", "front|right", "back|right"];
const edgeSet = (type, keys, radius = 12) => ({ type: "none", radius: 12, perEdge: true,
  by: Object.fromEntries(keys.map((k) => [k, { type, radius }])) });
const r6 = (n) => Math.round(n * 1e6) / 1e6;
const key3 = (v) => `${r6(v.x)},${r6(v.y)},${r6(v.z)}`;

const openEdges = (quads) => {
  const seen = new Map();
  for (const q of quads) for (let i = 0; i < q.pts.length; i++) {
    const u = key3(q.pts[i]), v = key3(q.pts[(i + 1) % q.pts.length]);
    if (u === v) continue;
    const k = u < v ? `${u}|${v}` : `${v}|${u}`;
    seen.set(k, (seen.get(k) ?? 0) + 1);
  }
  return [...seen.values()].filter((c) => c !== 2).length;
};
const drawnVolume = (quads) => {
  let out = 0;
  for (const q of quads) {
    const [a, b, c] = q.pts;
    const u = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
    const v = { x: c.x - a.x, y: c.y - a.y, z: c.z - a.z };
    const w = { x: u.y * v.z - u.z * v.y, y: u.z * v.x - u.x * v.z, z: u.x * v.y - u.y * v.x };
    const pts = w.x * q.normal.x + w.y * q.normal.y + w.z * q.normal.z >= 0 ? q.pts : [...q.pts].reverse();
    for (let i = 1; i + 1 < pts.length; i++) {
      const [p, q1, q2] = [pts[0], pts[i], pts[i + 1]];
      out += (p.x * (q1.y * q2.z - q2.y * q1.z) - p.y * (q1.x * q2.z - q2.x * q1.z)
        + p.z * (q1.x * q2.y - q2.x * q1.y)) / 6;
    }
  }
  return Math.abs(out);
};

let doubled = { ...DEFAULT_DESIGN };
for (const f of FACES) doubled = addPanel(doubled, "doubler", f);

let n = 0, open = 0, wrong = 0;
for (const preset of PROMINENCE_PRESETS) {
  for (const edge of [edgeSet("mitre", []), edgeSet("mitre", VERTICALS),
    edgeSet("fillet", ["front|left", "front|right"], 8), edgeSet("chamfer", ["left|top"], 6)]) {
    for (const [base, key] of [[DEFAULT_DESIGN, (f) => f], [doubled, (f) => `doubler|${f}`]]) {
      for (const face of [null, ...FACES]) {
        const d = derive({ ...base, preset: preset.id, order: preset.order, edge,
          rebate: face ? { [key(face)]: every() } : {} });
        for (const explode of [0, 60]) {
          for (const [i, panel] of d.sol.panels.entries()) {
            const bevels = d.bevelsOf(panel, i);
            const quads = panelQuads(panel, explodedBox(panel, explode), bevels);
            n++;
            const holes = openEdges(quads);
            if (holes) { open++; console.log("NOT CLOSED", preset.id, face, panel.layer, panel.face, holes); }
            if (Object.values(bevels).some((t) => t.type === "fillet" || t.type === "chamfer")) continue;
            const drawn = drawnVolume(quads), model = panelSolidVolume(panel);
            if (Math.abs(drawn - model) > 1e-6 * Math.max(1, model)) {
              wrong++;
              console.log("NOT THE MODEL", preset.id, face, panel.layer, panel.face,
                drawn.toFixed(1), model.toFixed(1));
            }
          }
        }
      }
    }
  }
}
console.log(`${n} panels: ${open} surfaces not closed, ${wrong} not the model's volume`);
