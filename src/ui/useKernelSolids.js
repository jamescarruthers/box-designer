// Mesh the panels with OpenCASCADE, on request.
//
// Same shape as useKernelSheet: the analytic ring stacks are already on screen,
// so this loads in the background and the viewport swaps over when it lands.

import { useEffect, useState } from "react";
import { loadKernel, isolated } from "../occt/kernel.js";
import { meshPanels } from "../occt/mesh.js";
import { panelBevels } from "../model/bevel.js";

export function useKernelSolids(derived, enabled) {
  const [state, setState] = useState({ status: "idle" });

  useEffect(() => {
    if (!enabled) { setState({ status: "idle" }); return; }
    let live = true;
    setState((s) => ({ status: s.solids ? "refreshing" : "loading", solids: s.solids }));

    loadKernel()
      .then((oc) => {
        if (!live) return;
        const t0 = performance.now();
        const { sol, edges, owners, fittingsOn } = derived;
        const solids = meshPanels(oc, sol.panels, (i, p) => panelBevels(i, p, edges, owners), sol.E, {
          fittingsFor: (i, p) => fittingsOn?.(p) ?? [],
        });
        if (live) {
          setState({
            status: "ready", solids,
            ms: Math.round(performance.now() - t0),
            triangles: solids.reduce((a, m) => a + m.triangles, 0),
            // Meshing asks for parallel, so with isolation this really was threaded.
            threaded: isolated(),
          });
        }
      })
      .catch((error) => {
        console.error("OpenCASCADE solids failed:", error);
        if (live) setState({ status: "failed", error });
      });

    return () => { live = false; };
  }, [enabled, derived]);

  return state;
}
