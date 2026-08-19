import initOpenCascade from "opencascade.js/dist/node.js";
import { solve } from "../../src/model/solver.js";
import { uniformEdges, noEdges, edgeOwners, fullLengthEdges, applicableEdges, panelBevels } from "../../src/model/bevel.js";
import { meshPanels } from "../../src/occt/mesh.js";
import { panelPositions } from "../../src/three/panelGeometry.js";

const oc = await initOpenCascade();
const sol = solve({ envelope: { x: 236, y: 286, z: 356 }, thickness: 18,
  order: ["front", "back", "left", "right", "top", "bottom"] });
const owners = edgeOwners(sol.env, sol.panels);
const cont = fullLengthEdges(sol.env, sol.panels, owners);

for (const [label, edges] of [["square", noEdges()], ["fillet R12", applicableEdges(uniformEdges("fillet", 12), cont)]]) {
  const t0 = Date.now();
  const meshes = meshPanels(oc, sol.panels, (i, p) => panelBevels(i, p, edges, owners), sol.E);
  const ms = Date.now() - t0;
  const tris = meshes.reduce((a, m) => a + m.triangles, 0);
  const flipped = meshes.reduce((a, m) => a + m.flipped, 0);
  const analytic = sol.panels.map((p, i) => panelPositions(p, panelBevels(i, p, edges, owners), sol.E));
  const aTris = analytic.reduce((a, m) => a + m.triangles, 0);
  console.log(`${label.padEnd(11)} kernel ${String(tris).padStart(5)} triangles in ${ms} ms (flipped ${flipped}) | analytic ${aTris}`);
}
