// §15 Picking an edge in the 3D view.
//
// A line is almost impossible to hit with a mouse — it has no area, and the one
// pixel it does occupy moves as the box turns. So each of the twelve envelope
// edges gets an invisible box around it, and those are what the ray hits. The
// box is the pick target; the line is only what you see.
//
// The proxies are geometry, not rendering, so they live here where they can be
// checked without a canvas.

import { AXIS, AXES, EDGES, edgeAxis } from "../model/constants.js";
import { toThree } from "./panelGeometry.js";

/**
 * How fat to make a proxy, as a fraction of the box's smallest dimension.
 *
 * Big enough to hit without aiming, small enough that two edges meeting at a
 * corner do not both claim the same pixel. Clamped, or a 3 metre box would want
 * a 90 mm target and a 60 mm one would want almost none.
 */
export const PICK_FRACTION = 0.045;
export const PICK_MIN = 4;
export const PICK_MAX = 30;

export const pickRadius = (E) =>
  Math.max(PICK_MIN, Math.min(PICK_MAX, Math.min(E.x, E.y, E.z) * PICK_FRACTION));

/** The two ends of one envelope edge, in model coordinates. */
export function edgeEnds(env, key) {
  const [f1, f2] = key.split("|");
  const run = edgeAxis(key);
  const at = {};
  for (const f of [f1, f2]) {
    const [a, s] = AXIS[f];
    at[a] = s < 0 ? env[a][0] : env[a][1];
  }
  const lo = { ...at, [run]: env[run][0] };
  const hi = { ...at, [run]: env[run][1] };
  return [lo, hi];
}

/**
 * A pick proxy per edge, in three coordinates: a box as long as the edge and
 * `2r` square across it.
 *
 * Returned as plain numbers rather than three objects so the arithmetic can be
 * tested on its own — the renderer turns each one into a mesh.
 */
export function edgeProxies(env, E, r = pickRadius(E)) {
  return EDGES.map((key) => {
    const [lo, hi] = edgeEnds(env, key);
    const run = edgeAxis(key);
    const mid = Object.fromEntries(AXES.map((a) => [a, (lo[a] + hi[a]) / 2]));
    const size = Object.fromEntries(AXES.map((a) => [a, a === run ? hi[a] - lo[a] : 2 * r]));

    // Sizes are axis-aligned in both frames — the model-to-three map is a
    // rotation through right angles — so they permute rather than transform.
    const centre = toThree([mid.x, mid.y, mid.z], E);
    return {
      key,
      centre,
      size: [size.x, size.z, size.y],   // x → x, z → y, y → z, as toThree does
      run,
    };
  });
}

/**
 * Which of three's axes an edge runs along, matching `toThree`'s x → x,
 * z → y, y → z.
 */
export const RUN_INDEX = { x: 0, z: 1, y: 2 };

/**
 * The highlight bar for a hovered edge: the proxy, slimmed across.
 *
 * A line will not do. WebGL draws every line one pixel wide whatever the
 * material asks for, and this one lands exactly on the panel edges already
 * drawn there — highlighting an edge by putting a hairline on a hairline
 * showed nothing at all on screen. A bar has width, so it reads.
 */
export const HINT_FRACTION = 0.5;

export function hintSize(proxy, r = null, fraction = HINT_FRACTION) {
  const across = 2 * (r ?? Math.min(proxy.size[0], proxy.size[1], proxy.size[2]) / 2) * fraction;
  const along = RUN_INDEX[proxy.run];
  return proxy.size.map((s, i) => (i === along ? s : across));
}

/**
 * The edges worth offering for a treatment, and why the others are not.
 *
 * A bevel needs one panel running the whole edge (§3); a mitre needs the two
 * panels to run it together (§12). Different questions, so the tool decides
 * which answer it needs rather than one answer standing in for both.
 */
export function pickableEdges(tool, { fullLength, mitrable }) {
  return Object.fromEntries(EDGES.map((key) => {
    if (tool === "mitre") {
      const m = mitrable?.[key];
      return [key, { ok: !!m?.ok, why: m?.why }];
    }
    if (tool === "none") return [key, { ok: true }];
    return [key, fullLength?.[key]
      ? { ok: true }
      : { ok: false, why: "no one panel runs the whole of this edge" }];
  }));
}
