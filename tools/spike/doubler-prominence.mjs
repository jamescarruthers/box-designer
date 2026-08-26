// §53 A prominence of the doublers' own: does the box still close, and does the
// doubler order actually change the doubler panels and nothing else?
import { DEFAULT_DESIGN, derive, setOwnProminence, setLayerOrder, addPanel } from "../../src/ui/design.js";
import { FACES, PROMINENCE_PRESETS } from "../../src/model/constants.js";

let base = DEFAULT_DESIGN;
for (const f of FACES) base = addPanel(base, "doubler", f);
for (const f of FACES) base = addPanel(base, "cladding", f);

const sizes = (d, layer) => derive(d).rows.filter((r) => r.layer === layer)
  .map((r) => `${r.face} ${r.length}×${r.width}`).sort().join("  ");

const follow = base;
let own = setOwnProminence(base, "doubler", true);

let worst = 0, cases = 0;
for (const p of PROMINENCE_PRESETS) {
  const d = setLayerOrder(own, "doubler", p.order);
  const sol = derive(d).sol;
  cases++;
  worst = Math.max(worst, Math.abs(sol.closure) / sol.envVolume);
  console.log(p.id.padEnd(7),
    "closure", sol.closureExact ? "exact" : sol.closure,
    "| shell same:", sizes(d, "shell") === sizes(follow, "shell"),
    "| cavity same:", JSON.stringify(sol.internal) === JSON.stringify(derive(follow).sol.internal),
    "| doublers changed:", sizes(d, "doubler") !== sizes(follow, "doubler"));
}
console.log("cases", cases, "worst relative closure", worst);
console.log("follow doublers:", sizes(follow, "doubler"));
console.log("tb     doublers:", sizes(setLayerOrder(own, "doubler", PROMINENCE_PRESETS[2].order), "doubler"));
