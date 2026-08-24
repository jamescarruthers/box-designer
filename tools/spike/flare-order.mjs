// §36 §29 found OCCT refuses a flare whose rim lands among the bolt holes, and
// capped the radius short of them. But that refusal is about filleting an edge
// whose sweep runs into holes that are already there — so does cutting the
// flare *first* and drilling the bolts through it build instead?
import initOpenCascade from "opencascade.js/dist/node.js";
import { solve } from "../../src/model/solver.js";
import { newFitting, fittingOwners, fittingCircles, cutoutFlare } from "../../src/model/fittings.js";
import { panelBox, volumeOf, flareCutout } from "../../src/occt/solids.js";
import { AXIS } from "../../src/model/constants.js";

const oc = await initOpenCascade();
const sol = solve({ envelope: { x: 500, y: 400, z: 500 }, thickness: 18 });
const panel = fittingOwners(sol.panels, ["front"]).front;

// The two orders, written out here so the spike does not depend on which one
// the app happens to be doing today.
function build(f, { flareFirst }) {
  const bore = (c) => {
    const [a, s] = AXIS.front;
    const outer = s < 0 ? panel.box[a][0] : panel.box[a][1];
    const t = Math.abs(panel.box[a][1] - panel.box[a][0]);
    const axis = new oc.gp_Ax2_3(
      new oc.gp_Pnt_3(c.at.a, outer + s * 1, c.at.b),
      new oc.gp_Dir_4(0, -s, 0));
    return new oc.BRepPrimAPI_MakeCylinder_3(axis, c.d / 2, t + 2).Shape();
  };
  const cut = (shape, tool) =>
    new oc.BRepAlgoAPI_Cut_3(shape, tool, new oc.Message_ProgressRange_1()).Shape();

  let shape = panelBox(oc, panel);
  const circles = fittingCircles(f);
  const cutout = circles.find((c) => c.role === "cutout");
  const bolts = circles.filter((c) => c.role === "bolt");
  const flare = cutoutFlare(f);

  shape = cut(shape, bore(cutout));
  if (flareFirst) {
    shape = flareCutout(oc, shape, panel, f, flare);
    for (const c of bolts) shape = cut(shape, bore(c));
  } else {
    for (const c of bolts) shape = cut(shape, bore(c));
    shape = flareCutout(oc, shape, panel, f, flare);
  }
  return volumeOf(oc, shape);
}

const driver = { ...newFitting("driver", "front", { a: 250, b: 250 }) };
console.log("⌀116 cutout, 147 PCD, ⌀5 bolts — holes span 71 to 76 mm from centre");
console.log("rim reaches   flare R  bolts-then-flare   flare-then-bolts");
for (const radius of [12, 12.5, 13, 13.5, 14, 15, 16, 17, 17.99]) {
  const f = { ...driver, flare: { type: "fillet", radius } };
  const out = [];
  for (const flareFirst of [false, true]) {
    try {
      const v = build(f, { flareFirst });
      out.push(Number.isFinite(v) && v > 0 ? "ok  " : "empty");
    } catch (e) {
      out.push("REFUSED");
    }
  }
  console.log(String(58 + radius).padStart(9), "mm", String(radius).padStart(7),
    "  ", out[0].padEnd(17), out[1]);
}
