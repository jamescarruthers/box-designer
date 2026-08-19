// Prove the adapter against the analytic engine on the same box.
import initOpenCascade from "opencascade.js/dist/node.js";
import { solve } from "../../src/model/solver.js";
import { uniformEdges, noEdges, edgeOwners, fullLengthEdges, applicableEdges, panelBevels } from "../../src/model/bevel.js";
import { assembly, volumeOf } from "../../src/occt/solids.js";
import { hiddenLineRemoval } from "../../src/occt/hlr.js";
import { viewLines } from "../../src/drawing/hlr.js";

const oc = await initOpenCascade();
const sol = solve({ envelope: { x: 236, y: 286, z: 356 }, thickness: 18,
  order: ["front", "back", "left", "right", "top", "bottom"] });
const owners = edgeOwners(sol.env, sol.panels);
const cont = fullLengthEdges(sol.env, sol.panels, owners);

for (const [label, edges] of [["square", noEdges()], ["fillet R12", applicableEdges(uniformEdges("fillet", 12), cont)]]) {
  const t0 = Date.now();
  const shape = assembly(oc, sol.panels, (i, p) => panelBevels(i, p, edges, owners));
  const built = Date.now() - t0;
  const vol = volumeOf(oc, shape);
  const analytic = sol.panels.reduce((a, p) =>
    a + (p.box.x[1] - p.box.x[0]) * (p.box.y[1] - p.box.y[0]) * (p.box.z[1] - p.box.z[0]), 0);
  console.log(`\n=== ${label} ===  built ${built} ms`);
  console.log(`  panel volume: kernel ${(vol / 1e3).toFixed(1)} cm3, analytic ${(analytic / 1e3).toFixed(1)} cm3`);
  for (const view of ["front", "end", "plan"]) {
    const t1 = Date.now();
    const r = hiddenLineRemoval(oc, shape, view, sol.E);
    const n = (k) => r[k].length;
    const mine = viewLines(sol.panels, view, sol.E);
    console.log(`  ${view.padEnd(5)} ${Date.now() - t1} ms  sharpV ${n("sharpVisible")} outV ${n("outlineVisible")} smoothV ${n("smoothVisible")} | sharpH ${n("sharpHidden")} smoothH ${n("smoothHidden")}  (analytic: ${mine.length} segs)`);
  }
}
