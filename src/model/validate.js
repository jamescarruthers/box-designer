// §8 Validation messages.

import { AXES, PAIR, AXIS_LABEL } from "./constants.js";
import { panelBlank, boxSize } from "./solver.js";
import { bevelIssues } from "./bevel.js";

/**
 * `edges` is what will be cut; `asked` is what the design asked for.
 *
 * §26 They differ once an impossible bevel is dropped before the kernel sees
 * it — and the one that was dropped is exactly the one somebody needs telling
 * about. Judging the bevels on what survived would report nothing at all,
 * which is the quietest possible way to ignore a request.
 */
export function validate(sol, edges, asked = edges) {
  const msgs = [];
  const internal = boxSize(sol.cavity);

  for (const b of AXES) {
    const v = internal[b];
    if (!(v > 0)) {
      msgs.push({ level: "error",
        text: `Internal ${AXIS_LABEL[b]} is ${v.toFixed(1)} mm — the walls meet or cross.` });
    } else if (v < 20) {
      msgs.push({ level: "warning",
        text: `Internal ${AXIS_LABEL[b]} is only ${v.toFixed(1)} mm.` });
    }
  }

  for (const p of sol.panels) {
    const { length, width } = panelBlank(p);
    if (!(length > 0) || !(width > 0)) {
      msgs.push({ level: "error",
        text: `${p.layer} ${p.face} panel has a non-positive size (${length.toFixed(1)} × ${width.toFixed(1)}).` });
    }
  }

  msgs.push(...bevelIssues(asked, sol.wall, sol.skin ?? skinFrom(sol)));

  if (!sol.closureExact) {
    msgs.push({ level: "error",
      text: `Volume closure error ${sol.closure.toExponential(3)} mm³ — this is a bug, not user input.` });
  }
  return msgs;
}

function skinFrom(sol) {
  const out = {};
  for (const b of AXES) for (const f of PAIR[b]) out[f] = sol.cladding[f] || sol.thickness[f] || 0;
  return out;
}
