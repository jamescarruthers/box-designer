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

export function useKernelSolids(derived, enabled) {
  const [state, setState] = useState({ status: "idle" });

  useEffect(() => {
    if (!enabled) { setState({ status: "idle" }); return; }
    let live = true;
    setState((s) => ({ status: s.solids ? "refreshing" : "loading", solids: s.solids,
      progress: { phase: "fetching" } }));

    const { sol, edges, owners, fittingsOn } = derived;
    const t0 = performance.now();

    callKernel("mesh", {
      panels: sol.panels,
      bevels: sol.panels.map((p, i) => panelBevels(i, p, edges, owners)),
      fittings: sol.panels.map((p) => fittingsOn?.(p) ?? []),
      E: sol.E,
    }, {
      // §11 The step it is on, so a slow download reads as progress rather than
      // as a hang — which is exactly how it used to read.
      onProgress: (progress) => { if (live) setState((s) => ({ ...s, progress })); },
    })
      .then((solids) => {
        if (!live) return;
        setState({
          status: "ready", solids,
          ms: Math.round(performance.now() - t0),
          triangles: solids.reduce((a, m) => a + m.triangles, 0),
          // Meshing asks for parallel, so with isolation this really was threaded.
          threaded: isolated(),
        });
      })
      .catch((error) => {
        console.error("OpenCASCADE solids failed:", error);
        if (live) setState({ status: "failed", error });
      });

    return () => { live = false; };
  }, [enabled, derived]);

  return state;
}
