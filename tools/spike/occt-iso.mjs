import initOpenCascade from "opencascade.js/dist/node.js";
import { solve } from "../../src/model/solver.js";
import { uniformEdges, noEdges, edgeOwners, fullLengthEdges, applicableEdges, panelBevels } from "../../src/model/bevel.js";
import { assembly } from "../../src/occt/solids.js";
import { isoGeometry } from "../../src/occt/hlr.js";
import { buildIsometric } from "../../src/drawing/iso.js";
const oc = await initOpenCascade();
const sol = solve({ envelope: { x: 236, y: 286, z: 356 }, thickness: 18,
  order: ["front", "back", "left", "right", "top", "bottom"] });
const owners = edgeOwners(sol.env, sol.panels);
const cont = fullLengthEdges(sol.env, sol.panels, owners);
for (const [label, edges] of [["square", noEdges()], ["fillet R12", applicableEdges(uniformEdges("fillet", 12), cont)]]) {
  const shape = assembly(oc, sol.panels, (i, p) => panelBevels(i, p, edges, owners));
  const k = isoGeometry(oc, shape, sol.E);
  const a = buildIsometric(sol);
  console.log(`${label.padEnd(11)} kernel ${String(k.lines.length).padStart(4)} lines, ext ${k.ext.h.toFixed(1)}x${k.ext.v.toFixed(1)} | analytic ${a.lines.length} lines, ext ${a.ext.h.toFixed(1)}x${a.ext.v.toFixed(1)}`);
}
