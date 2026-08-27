// Is the isometric painting a face over one that stands in front of it?
//
// The decisive test, and the only one: sample points across the picture; at
// each, find every visible face that covers it and how deep along the eye it
// is; the face painted LAST there must be the NEAREST. Anything else is a
// face showing through something solid.
import { buildIsometric, panelQuads, facePaintOrder, isoProject, ISO_EYE, ISO_X, ISO_Y, ISO_Z } from "../../src/drawing/iso.js";
import { DEFAULT_DESIGN, derive, addPanel, setRebateSides } from "../../src/ui/design.js";
import { explodedBox } from "../../src/model/explode.js";
import { FACES } from "../../src/model/constants.js";
import { rebateSides, readRebateKey } from "../../src/model/rebate.js";

const depthAt = (v) => v.x - v.y + v.z;

/** Is the projected point p inside the projected polygon? */
function inside(pts2, p) {
  let hit = false;
  for (let i = 0, j = pts2.length - 1; i < pts2.length; j = i++) {
    const a = pts2[i], b = pts2[j];
    if ((a.y > p.y) !== (b.y > p.y) &&
        p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) hit = !hit;
  }
  return hit;
}

/** Depth of a planar face at a projected point: solve on the face's plane. */
function depthOnFace(pts, p) {
  // The face is planar; take its normal and a point on it, then walk the eye
  // ray from an arbitrary point that projects to p.
  const [A, B, C] = pts;
  const u = { x: B.x - A.x, y: B.y - A.y, z: B.z - A.z };
  const w = { x: C.x - A.x, y: C.y - A.y, z: C.z - A.z };
  const n = { x: u.y * w.z - u.z * w.y, y: u.z * w.x - u.x * w.z, z: u.x * w.y - u.y * w.x };
  // A ray through the origin-ish point that projects to p, along the eye.
  // Any point whose projection is p works; build one from the iso basis.
  // p.x = ISO_X (x+y), p.y = ISO_Y (x-y) - ISO_Z z. Fix z = 0:
  const sx = p.x / ISO_X, dx = p.y / ISO_Y;      // x+y and x-y
  const o = { x: (sx + dx) / 2, y: (sx - dx) / 2, z: 0 };
  const denom = n.x * ISO_EYE.x + n.y * ISO_EYE.y + n.z * ISO_EYE.z;
  if (Math.abs(denom) < 1e-12) return null;      // edge-on
  const t = ((A.x - o.x) * n.x + (A.y - o.y) * n.y + (A.z - o.z) * n.z) / denom;
  const hit = { x: o.x + ISO_EYE.x * t, y: o.y + ISO_EYE.y * t, z: o.z + ISO_EYE.z * t };
  return depthAt(hit);
}

// Build the box the user would have: rebates on a doubled, clad box.
function box({ rebates = [], layers = ["doubler"], preset } = {}) {
  let d = DEFAULT_DESIGN;
  for (const layer of layers) for (const f of FACES) d = addPanel(d, layer, f);
  for (const key of rebates) {
    const { face } = readRebateKey(key);
    d = setRebateSides(d, key, Object.fromEntries(rebateSides(face).map((s) => [s, true])));
  }
  return derive(d);
}

const GRID = 260;

/**
 * Every visible face in the whole picture, in the order the drawing paints
 * them — panel by panel, and within a panel in the order the quads come back.
 */
function paintedFaces(derivedBox, explode) {
  const { sol } = derivedBox;
  const iso = buildIsometric(sol, { explode });
  const faces = [];
  for (const g of iso.groups) {
    const panel = sol.panels.find((p) => p.face === g.face && p.layer === g.layer);
    for (const q of facePaintOrder(panelQuads(panel, explodedBox(panel, explode), {}).filter((x) => x.visible))) {
      faces.push({ face: g.face, layer: g.layer, pts: q.pts, flat: q.pts.map(isoProject) });
    }
  }
  return faces;
}

/** Sample the picture: wherever a face is painted over a nearer one, say so. */
function check(name, derivedBox, explode = 0) {
  const faces = paintedFaces(derivedBox, explode);
  const all = faces.flatMap((f) => f.flat);
  const lo = { x: Math.min(...all.map((p) => p.x)), y: Math.min(...all.map((p) => p.y)) };
  const hi = { x: Math.max(...all.map((p) => p.x)), y: Math.max(...all.map((p) => p.y)) };
  let worst = 0, where = null, samples = 0, bad = 0;
  const culprits = new Map();
  for (let gx = 0; gx < GRID; gx++) {
    for (let gy = 0; gy < GRID; gy++) {
      const p = { x: lo.x + ((hi.x - lo.x) * (gx + 0.5)) / GRID,
                  y: lo.y + ((hi.y - lo.y) * (gy + 0.5)) / GRID };
      let last = null, lastDepth = 0, best = -Infinity, bestFace = null;
      for (const f of faces) {
        if (!inside(f.flat, p)) continue;
        const d = depthOnFace(f.pts, p);
        if (d === null) continue;
        last = f; lastDepth = d;
        if (d > best) { best = d; bestFace = f; }
      }
      if (!last) continue;
      samples++;
      const err = best - lastDepth;
      if (err > 1e-6) {
        bad++;
        const k = `${last.layer}|${last.face} painted over ${bestFace.layer}|${bestFace.face}`;
        culprits.set(k, (culprits.get(k) ?? 0) + 1);
        if (err > worst) { worst = err; where = k; }
      }
    }
  }
  const pct = samples ? ((bad / samples) * 100).toFixed(1) : "0";
  console.log(`${name} ${bad ? `WRONG at ${pct}% of the picture, worst ${worst.toFixed(1)} mm` : "clean"}`);
  if (bad) {
    for (const [k, n] of [...culprits.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)) {
      console.log(`    ${n.toString().padStart(5)}  ${k}`);
    }
  }
  return bad;
}

const plain = box({ layers: [] });
check("plain box, no rebate     ", plain);
const rebated = box({ layers: ["doubler"], rebates: ["top"] });
console.log("  grooved panels:", rebated.sol.panels.filter((p) => p.notches?.length)
  .map((p) => `${p.layer}|${p.face}`).join(" ") || "NONE");
check("top carcass rebated      ", rebated);
const many = box({ layers: ["doubler"], rebates: ["top", "bottom", "doubler|top", "doubler|bottom"] });
console.log("  grooved panels:", many.sol.panels.filter((p) => p.notches?.length)
  .map((p) => `${p.layer}|${p.face}`).join(" ") || "NONE");
check("top & bottom, both layers", many);
check("the same, exploded 40    ", many, 40);
check("the same, exploded 90    ", many, 90);

// One failing sample, in full, so the diagnosis is not a guess.
function firstFailure(derivedBox, explode) {
  const faces = paintedFaces(derivedBox, explode);
  const all = faces.flatMap((f) => f.flat);
  const lo = { x: Math.min(...all.map((p) => p.x)), y: Math.min(...all.map((p) => p.y)) };
  const hi = { x: Math.max(...all.map((p) => p.x)), y: Math.max(...all.map((p) => p.y)) };
  for (let gx = 0; gx < GRID; gx++) for (let gy = 0; gy < GRID; gy++) {
    const p = { x: lo.x + ((hi.x - lo.x) * (gx + 0.5)) / GRID, y: lo.y + ((hi.y - lo.y) * (gy + 0.5)) / GRID };
    let last = null, lastD = 0, best = -Infinity, bestF = null;
    for (const f of faces) {
      if (!inside(f.flat, p)) continue;
      const d = depthOnFace(f.pts, p);
      if (d === null) continue;
      last = f; lastD = d;
      if (d > best) { best = d; bestF = f; }
    }
    if (last && best - lastD > 1) {
      const { sol } = derivedBox;
      const boxOf = (f) => explodedBox(sol.panels.find((q) => q.face === f.face && q.layer === f.layer), explode);
      console.log("failing sample at", p);
      console.log("  painted last:", last.layer, last.face, "depth", lastD.toFixed(1),
        "\n    quad", JSON.stringify(last.pts.map((v) => [v.x, v.y, v.z])),
        "\n    panel box", JSON.stringify(boxOf(last)));
      console.log("  nearest     :", bestF.layer, bestF.face, "depth", best.toFixed(1),
        "\n    quad", JSON.stringify(bestF.pts.map((v) => [v.x, v.y, v.z])),
        "\n    panel box", JSON.stringify(boxOf(bestF)));
      return;
    }
  }
}
console.log("\n--- a sweep of boxes ---");
import { PROMINENCE_PRESETS } from "../../src/model/constants.js";
import { setLayerOrder } from "../../src/ui/design.js";

let total = 0;
for (const preset of PROMINENCE_PRESETS) {
  for (const layers of [[], ["doubler"], ["cladding", "doubler"]]) {
    let d = DEFAULT_DESIGN;
    d = setLayerOrder(d, "shell", preset.order);
    for (const layer of layers) for (const f of FACES) d = addPanel(d, layer, f);
    // Rebate the two least prominent faces, which are the ones that can take one.
    for (const face of preset.order.slice(4)) {
      for (const key of [face, ...(layers.includes("doubler") ? [`doubler|${face}`] : [])]) {
        const { face: f } = readRebateKey(key);
        d = setRebateSides(d, key, Object.fromEntries(rebateSides(f).map((s) => [s, true])));
      }
    }
    const der = derive(d);
    const grooved = der.sol.panels.filter((p) => p.notches?.length).length;
    for (const ex of [0, 30, 80]) {
      total += check(`${preset.id.padEnd(7)} ${(layers.join("+") || "bare").padEnd(17)} groove ${String(grooved).padStart(2)} explode ${String(ex).padStart(2)}  `, der, ex);
    }
  }
}
console.log("\ntotal wrong samples across the sweep:", total);
