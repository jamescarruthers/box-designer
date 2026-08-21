// Mesh the panels with OpenCASCADE, on request.
//
// Same shape as useKernelSheet: the analytic ring stacks are already on screen,
// so this runs in the background and the viewport swaps over when it lands.
//
// The work happens in the kernel worker (§11), so a slow or stuck mesh leaves
// the page responsive and the toggle usable. Everything the worker needs goes
// as data — bevels and fittings are resolved here, per panel index, because a
// closure over `derived` cannot cross the boundary.

import { useEffect, useState } from "react";
import { callKernel } from "../occt/client.js";
import { isolated } from "../occt/kernel.js";
import { panelBevels } from "../model/bevel.js";

export function useKernelSolids(derived, enabled, attempt = 0) {
  const [state, setState] = useState({ status: "idle" });

  useEffect(() => {
    if (!enabled) { setState({ status: "idle" }); return; }
    let live = true;
    // Superseded jobs are cancelled, not just ignored. One still waiting its
    // turn goes altogether; one the worker has already started cannot be
    // recalled, but its answer is thrown away rather than drawn.
    const cancel = new AbortController();
    setState((s) => ({ status: s.solids ? "refreshing" : "loading", solids: s.solids,
      progress: { phase: "queued" } }));

    const { sol, edges, owners, fittingsOn } = derived;
    const t0 = performance.now();
    let ran = {};

    callKernel("mesh", {
      panels: sol.panels,
      bevels: sol.panels.map((p, i) => panelBevels(i, p, edges, owners)),
      fittings: sol.panels.map((p) => fittingsOn?.(p) ?? []),
      tubes: sol.panels.map((p) => derived.tubesOn?.(p) ?? []),
      E: sol.E,
    }, {
      // §11 The step it is on, so a slow download reads as progress rather than
      // as a hang — which is exactly how it used to read.
      signal: cancel.signal,
      onProgress: (progress) => { ran = progress; if (live) setState((s) => ({ ...s, progress })); },
    })
      .then((solids) => {
        if (!live) return;
        // §25 Panels the kernel would not build come back marked rather than
        // missing, and the views fall back to the analytic stack for those.
        const refused = solids.filter((m) => m?.failed);
        setState({
          status: "ready", solids,
          ms: Math.round(performance.now() - t0),
          triangles: solids.reduce((a, m) => a + (m.triangles ?? 0), 0),
          refused,
          // What the worker actually did. Cross-origin isolation only says
          // threads are allowed; it does not say the pool came up, and asking
          // for parallel meshing when it has not is how the kernel hangs.
          threaded: ran.threaded === true,
          isolated: ran.isolated ?? isolated(),
        });
      })
      .catch((error) => {
        if (!live) return;                       // superseded, not failed
        console.error("OpenCASCADE solids failed:", error);
        if (live) setState({ status: "failed", error });
      });

    return () => { live = false; cancel.abort(); };
  }, [enabled, derived, attempt]);

  return state;
}
