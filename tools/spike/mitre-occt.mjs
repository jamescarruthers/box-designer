// Does the kernel cut the same mitre the arithmetic describes?
import initOpenCascade from "opencascade.js/dist/node.js";
import { solve, boxVolume } from "../../src/model/solver.js";
import { PROMINENCE_PRESETS } from "../../src/model/constants.js";
import { applyMitres, mitreBevels, mitreLoss } from "../../src/model/mitre.js";
import { panelSolid, volumeOf } from "../../src/occt/solids.js";

const oc = await initOpenCascade();
const sol = solve({ envelope: { x: 236, y: 286, z: 356 }, thickness: 18, order: PROMINENCE_PRESETS[0].order });
const keys = ["front|left", "back|left", "front|right", "back|right"];
const { panels } = applyMitres(sol.panels, sol.env, Object.fromEntries(keys.map((k) => [k, true])));

for (const p of panels) {
  const want = boxVolume(p.box) - mitreLoss(p);
  const got = volumeOf(oc, panelSolid(oc, p, mitreBevels(p)));
  console.log(p.face.padEnd(7), (p.mitres ?? []).map((m) => m.side).join(",").padEnd(12),
    want.toFixed(3).padStart(12), got.toFixed(3).padStart(12),
    Math.abs(got - want) < 1e-6 * want ? "ok" : "MISMATCH");
}
