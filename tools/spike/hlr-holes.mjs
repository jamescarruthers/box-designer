// §11 What a bore costs the drawing.
//
// Written while chasing what looked like a kernel performance problem: hidden
// line removal over a panel with a driver cut into it appeared to take minutes.
// It does not. The cost is 34 ms against 47 ms for plain boxes — HLRBRep_Algo
// is the exact algorithm and a cylinder costs it nothing to speak of here.
//
// What actually took minutes was a fitting built with no position, whose bore
// landed at NaN. See §11 of claude.md. Kept as the measurement, so the next
// person to suspect the drawing path can check in thirty seconds.
//
//   node tools/spike/hlr-holes.mjs

import fs from "node:fs";
import initOpenCascade from "opencascade.js/dist/node.js";

// Written straight out: node block-buffers stdout to a file, and the whole
// point of this spike is watching a measurement that takes minutes.
const say = (line) => { fs.writeSync(1, line + "\n"); };
import { solve } from "../../src/model/solver.js";
import { PROMINENCE_PRESETS } from "../../src/model/constants.js";
import { uniformEdges, edgeOwners, fullLengthEdges, applicableEdges, panelBevels } from "../../src/model/bevel.js";
import { newFitting, fittingOwners } from "../../src/model/fittings.js";
import { assembly } from "../../src/occt/solids.js";
import { viewGeometry } from "../../src/occt/hlr.js";

const oc = await initOpenCascade();
const sol = solve({ envelope: { x: 236, y: 286, z: 356 }, thickness: 18, order: PROMINENCE_PRESETS[0].order });
const owners = edgeOwners(sol.env, sol.panels);
const edges = applicableEdges(uniformEdges("chamfer", 6), fullLengthEdges(sol.env, sol.panels, owners));
const bevels = (i, p) => panelBevels(i, p, edges, owners);

const driver = newFitting("driver", "front", { a: 118, b: 240 });
const front = fittingOwners(sol.panels, ["front"]).front;
const fittings = sol.panels.map((p) => (p === front ? [driver] : []));

say("kernel ready");
for (const [label, shape] of [
  ["boxes only", assembly(oc, sol.panels, bevels)],
  ["one driver", assembly(oc, sol.panels, bevels, (i) => fittings[i])],
]) {
  const t0 = Date.now();
  const lines = viewGeometry(oc, shape, "front", sol.E).lines.length;
  say(`${label.padEnd(12)} ${String(Date.now() - t0).padStart(8)} ms for one view, ${lines} lines`);
}
