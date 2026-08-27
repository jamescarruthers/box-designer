// Can the kernel draw the isometric of an *exploded* box?
//
// §38 said no — "there is no exploded shape to ask it for, the panels are one
// solid by then" — and fell back to the analytic isometric whenever the slider
// was off zero. But the assembly is a compound of separate panel solids, not a
// fusion, and explode moves each panel along its own normal: the planar
// coordinates a hole is bored at do not change, only the thickness axis does,
// and that comes from the panel's box. So an exploded panel should build.
import initOpenCascade from "opencascade.js/dist/node.js";
import { solve } from "../../src/model/solver.js";
import { edgeOwners, panelBevels, noEdges, uniformEdges, applicableEdges, fullLengthEdges } from "../../src/model/bevel.js";
import { assembly } from "../../src/occt/solids.js";
import { isoGeometry } from "../../src/occt/hlr.js";
import { explodedBox } from "../../src/model/explode.js";
import { PROMINENCE_PRESETS } from "../../src/model/constants.js";
import { newFitting } from "../../src/model/fittings.js";
import { buildIsometric } from "../../src/drawing/iso.js";

const oc = await initOpenCascade();
console.log("kernel up");

const sol = solve({ envelope: { x: 236, y: 286, z: 356 }, thickness: 18, cladding: 6,
  order: PROMINENCE_PRESETS[0].order });
const owners = edgeOwners(sol.env, sol.panels);
const edges = noEdges();
const driver = { ...newFitting("driver", "front"), at: { a: 118, b: 178 } };
const fittingsFor = (i, p) => (p.face === "front" && p.layer === "shell" ? [driver] : []);

const moved = (amount) => sol.panels.map((p) => ({ ...p, box: explodedBox(p, amount) }));

for (const amount of [0, 30, 90]) {
  const panels = moved(amount);
  const t0 = performance.now();
  const shape = assembly(oc, panels, (i, p) => panelBevels(i, sol.panels[i], edges, owners), fittingsFor);
  const iso = isoGeometry(oc, shape, sol.E);
  const ms = Math.round(performance.now() - t0);
  const analytic = buildIsometric(sol, { explode: amount, fittingsOn: (p) => fittingsFor(0, p) });
  console.log(`explode ${String(amount).padStart(3)}  kernel ${String(iso.lines.length).padStart(4)} lines`,
    `ext ${iso.ext.h.toFixed(0)}×${iso.ext.v.toFixed(0)}`, `${ms} ms`,
    `| analytic ext ${analytic.ext.h.toFixed(0)}×${analytic.ext.v.toFixed(0)}`,
    `${analytic.groups.reduce((a, g) => a + g.lines.length, 0)} lines,`,
    `${analytic.groups.reduce((a, g) => a + g.fills.length, 0)} fills`);
}

// And with fillets — the case the kernel exists for — using the app's own
// derived state rather than a hand-rolled edge map.
const { DEFAULT_DESIGN, derive, addPanel, setIn } = await import("../../src/ui/design.js");
const { FACES } = await import("../../src/model/constants.js");
let d = setIn(DEFAULT_DESIGN, ["edge", "type"], "fillet");
for (const f of FACES) d = addPanel(d, "cladding", f);
const der = derive(d);
for (const amount of [0, 60]) {
  const panels = der.sol.panels.map((p) => ({ ...p, box: explodedBox(p, amount) }));
  const t0 = performance.now();
  const shape = assembly(oc, panels, (i, p) => der.bevelsOf(der.sol.panels[i], i));
  const iso = isoGeometry(oc, shape, der.sol.E);
  const an = buildIsometric(der.sol, { explode: amount, bevelsOf: (p, i) => der.bevelsOf(p, i) });
  console.log(`filleted, explode ${String(amount).padStart(3)}  kernel ${iso.lines.length} lines`,
    `ext ${iso.ext.h.toFixed(0)}x${iso.ext.v.toFixed(0)}`,
    `${Math.round(performance.now() - t0)} ms | analytic ext ${an.ext.h.toFixed(0)}x${an.ext.v.toFixed(0)}`);
}
