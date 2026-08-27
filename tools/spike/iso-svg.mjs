// The isometric on its own, as an SVG, so before and after can be looked at.
import { writeFileSync } from "node:fs";
import { buildIsometric } from "../../src/drawing/iso.js";
import { DEFAULT_DESIGN, derive, addPanel, setRebateSides } from "../../src/ui/design.js";
import { FACES } from "../../src/model/constants.js";
import { rebateSides } from "../../src/model/rebate.js";

const [outFile, explode = "0"] = process.argv.slice(2);
let d = DEFAULT_DESIGN;
for (const f of FACES) d = addPanel(d, "cladding", f);
for (const face of ["top", "bottom"]) {
  d = setRebateSides(d, face, Object.fromEntries(rebateSides(face).map((s) => [s, true])));
}
const { sol } = derive(d);
const iso = buildIsometric(sol, { explode: Number(explode) });
const SHADE = { x: "#e6e2d8", y: "#cfcabd", z: "#f4f1e8" };
const parts = [];
for (const g of iso.groups) {
  for (const f of g.fills) {
    parts.push(`<polygon points="${f.pts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ")}" fill="${SHADE[f.axis] ?? "#ddd"}"/>`);
  }
  for (const l of g.lines) {
    parts.push(`<polyline points="${l.pts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ")}" fill="none" stroke="#1a1a1a" stroke-width="0.9"/>`);
  }
}
writeFileSync(outFile, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-10 -10 ${iso.ext.h + 20} ${iso.ext.v + 20}" width="760">
<rect x="-10" y="-10" width="${iso.ext.h + 20}" height="${iso.ext.v + 20}" fill="#faf8f2"/>
${parts.join("\n")}</svg>`);
console.log("wrote", outFile, "panels", iso.groups.length);
