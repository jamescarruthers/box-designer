// §29 How big a flare will OCCT actually run round the back of a cutout?
//
// The §26 rule was measured for a bevel on a panel's outer edge: anything up to
// 0.9 of the wall cuts, the wall exactly does not. A bore's rim is a different
// shape — a circle on a flat face, not a straight edge between two — so the
// limit is measured again here rather than assumed to carry across.
import initOpenCascade from "opencascade.js/dist/node.js";
import { solve } from "../../src/model/solver.js";
import { newFitting, fittingOwners } from "../../src/model/fittings.js";
import { cutFittings, panelBox, volumeOf } from "../../src/occt/solids.js";

const oc = await initOpenCascade();

function tryFlare({ thickness, cutout, type, radius }) {
  const sol = solve({ envelope: { x: 400, y: 300, z: 400 }, thickness });
  const panel = fittingOwners(sol.panels, ["front"]).front;
  const f = { ...newFitting("driver", "front", { a: 200, b: 200 }), cutout,
    flare: { type, radius } };
  try {
    const shape = cutFittings(oc, panelBox(oc, panel), panel, [f]);
    const v = volumeOf(oc, shape);
    return Number.isFinite(v) && v > 0 ? "ok" : "empty";
  } catch (e) {
    const msg = typeof e === "number" ? (oc.getExceptionMessage?.(e) ?? `#${e}`) : (e?.message ?? String(e));
    return `FAIL ${String(msg).slice(0, 60)}`;
  }
}

for (const thickness of [12, 18, 25]) {
  for (const type of ["fillet", "chamfer"]) {
    const line = [];
    for (const frac of [0.25, 0.5, 0.75, 0.9, 1.0, 1.25, 1.5, 2]) {
      const radius = Number((thickness * frac).toFixed(2));
      const r = tryFlare({ thickness, cutout: 116, type, radius });
      line.push(`${frac}×:${r === "ok" ? "ok" : "X"}`);
    }
    console.log(`${String(thickness).padStart(2)} mm ${type.padEnd(8)}`, line.join("  "));
  }
}

// And whether a big flare on a small hole is the other limit.
console.log("\nR8 flare on shrinking cutouts, 18 mm panel:");
for (const cutout of [116, 60, 40, 24, 16]) {
  console.log(`  ⌀${String(cutout).padStart(3)}  fillet`, tryFlare({ thickness: 18, cutout, type: "fillet", radius: 8 }));
}
