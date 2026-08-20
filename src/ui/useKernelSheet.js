// Draw the sheet with OpenCASCADE, on request.
//
// The analytic sheet is already there when the app paints. Asking for the
// kernel fetches 3.5 MB and takes a few hundred milliseconds a view, so it
// happens on demand, in the kernel worker (§11), and reports its own state
// rather than blocking anything — least of all the thread that paints.

import { useEffect, useState } from "react";
import { callKernel } from "../occt/client.js";
import { isolated } from "../occt/kernel.js";
import { buildSheet } from "../drawing/sheet.js";

export function useKernelSheet(derived, design, enabled) {
  const [state, setState] = useState({ status: "idle" });

  useEffect(() => {
    if (!enabled) { setState({ status: "idle" }); return; }
    let live = true;
    // Superseded jobs are cancelled, not just ignored: one left in the queue
    // keeps its watchdog and can tear the worker down long after nobody wants it.
    const cancel = new AbortController();
    setState((s) => ({ status: s.sheet ? "refreshing" : "loading", sheet: s.sheet,
      progress: { phase: "fetching" } }));

    const t0 = performance.now();
    callKernel("views", {
      sol: derived.sol,
      edges: derived.edges,
      owners: derived.owners,
      sectionAt: derived.sectionAt,
      fittings: derived.sol.panels.map((p) => derived.fittingsOn?.(p) ?? []),
    }, {
      signal: cancel.signal,
      onProgress: (progress) => { if (live) setState((s) => ({ ...s, progress })); },
    })
      .then((geometry) => {
        if (!live) return;
        const sheet = buildSheet(derived.sol, derived.edges, {
          title: design.title,
          material: derived.material.name.toUpperCase(),
          sectionAt: derived.sectionAt,
          geometry,
          // The kernel cut the holes, so its HLR emits them. Only the bolt
          // circle is added on top, being an annotation rather than geometry.
          fittings: derived.fittings,
          fittingPanels: derived.fittingPanels,
          holesInGeometry: true,
        });
        setState({ status: "ready", sheet, ms: Math.round(performance.now() - t0), isolated: isolated() });
      })
      .catch((error) => {
        if (!live) return;                       // superseded, not failed
        console.error("OpenCASCADE sheet failed:", error);
        if (live) setState({ status: "failed", error });
      });

    return () => { live = false; cancel.abort(); };
  }, [enabled, derived, design.title]);

  return state;
}
