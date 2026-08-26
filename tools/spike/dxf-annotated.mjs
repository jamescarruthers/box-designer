// §48 A DXF with everything on it: a ring of mitres, a rounded edge, a driver
// with blind bolt holes and a flare, a port, and a let-in baffle's grooves.
// Writes the file and an SVG of it, so the annotation can be looked at.
//
//   node tools/spike/dxf-annotated.mjs out-dir
import fs from "node:fs";
import { DEFAULT_DESIGN, derive } from "../../src/ui/design.js";
import { sheetsDxf } from "../../src/cutlist/dxf.js";
import { PROMINENCE_PRESETS } from "../../src/model/constants.js";

const out = process.argv[2] ?? ".";
const VERTICALS = ["front|left", "back|left", "front|right", "back|right"];
const d = derive({
  ...DEFAULT_DESIGN,
  preset: PROMINENCE_PRESETS[0].id, order: PROMINENCE_PRESETS[0].order,
  grainLocked: true,
  edge: { type: "none", radius: 12, perEdge: true, by: {
    ...Object.fromEntries(VERTICALS.map((k) => [k, { type: "mitre", radius: 18 }])),
    "left|top": { type: "fillet", radius: 8 },
    "right|top": { type: "chamfer", radius: 6 },
  } },
  fittings: [
    { id: "d1", type: "driver", face: "front", at: { a: 109, b: 163 }, cutout: 116, pcd: 147,
      bolts: 5, boltHole: 5, boltDeep: 12, flare: { type: "fillet", radius: 8 } },
    { id: "p1", type: "port", face: "back", at: { a: 109, b: 80 }, diameter: 68, length: 150, wall: 3 },
  ],
});
for (const r of d.rows) {
  console.log(`${r.id} ${r.faceLabel.padEnd(6)} edges: ${r.edgeWork.padEnd(24)} ${r.fittingNote ?? ""}`);
}
fs.writeFileSync(`${out}/annotated.dxf`, sheetsDxf(d.sheets));
console.log(`→ ${out}/annotated.dxf`);
