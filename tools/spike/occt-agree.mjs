// Do the two engines agree? Run the §6.3 verified end-view fixture through OCCT.
import initOpenCascade from "opencascade.js/dist/node.js";
import { solve } from "../../src/model/solver.js";
import { noEdges, edgeOwners, panelBevels } from "../../src/model/bevel.js";
import { assembly } from "../../src/occt/solids.js";
import { viewGeometry } from "../../src/occt/hlr.js";
import { mergeViewLines, describe } from "../../src/occt/merge.js";
import { viewLines, segEnds } from "../../src/drawing/hlr.js";

const oc = await initOpenCascade();
const sol = solve({ envelope: { x: 236, y: 286, z: 356 }, thickness: 18,
  order: ["front", "back", "left", "right", "top", "bottom"] });
const owners = edgeOwners(sol.env, sol.panels);
const shape = assembly(oc, sol.panels, (i, p) => panelBevels(i, p, noEdges(), owners));

for (const view of ["front", "end", "plan"]) {
  const kernel = describe(mergeViewLines(viewGeometry(oc, shape, view, sol.E).lines).lines);
  const analytic = describe(viewLines(sol.panels, view, sol.E).map((s) => {
    const [a, b] = segEnds(s);
    return { a, b, visible: s.visible };
  }));
  const agree = JSON.stringify(kernel) === JSON.stringify(analytic);
  console.log(`\n### ${view}: ${agree ? "AGREE" : "DIFFER"} (kernel ${kernel.length}, analytic ${analytic.length})`);
  if (!agree) {
    for (const l of kernel.filter((x) => !analytic.includes(x))) console.log("  kernel only  ", l);
    for (const l of analytic.filter((x) => !kernel.includes(x))) console.log("  analytic only", l);
  } else {
    for (const l of kernel) console.log("  ", l);
  }
}
