// Draw the sheet with OpenCASCADE, on request.
//
// The analytic sheet is already there when the app paints. Asking for the
// kernel fetches 3.5 MB and takes a few hundred milliseconds a view, so it
// happens on demand, in the kernel worker (§11), and reports its own state
// rather than blocking anything — least of all the thread that paints.

import { useEffect, useState } from "react";
import { callKernel } from "../occt/client.js";
import { isolated } from "../occt/kernel.js";
import { buildSheet, withoutLagging } from "../drawing/sheet.js";

export function useKernelSheet(derived, design, enabled, attempt = 0) {
  const [state, setState] = useState({ status: "idle" });

  useEffect(() => {
    if (!enabled) { setState({ status: "idle" }); return; }
    let live = true;
    // Superseded jobs are cancelled, not just ignored. One still waiting its
    // turn goes altogether; one the worker has already started cannot be
    // recalled, but its answer is thrown away rather than drawn.
    const cancel = new AbortController();
    setState((s) => ({ status: s.sheet ? "refreshing" : "loading", sheet: s.sheet,
      progress: { phase: "queued" } }));

    const t0 = performance.now();
    // §32 A lining left off the drawing is left out of the shape the kernel is
    // given, rather than drawn and covered up. The panels it drops are the last
    // group in the list (§30 builds them last), so every other panel keeps the
    // index its bevels and fittings were resolved against — which these two
    // arrays and `owners` are all keyed by.
    const drawSol = derived.drawing.insulation ? derived.sol : withoutLagging(derived.sol);
    callKernel("views", {
      sol: drawSol,
      edges: derived.edges,
      owners: derived.owners,
      sectionAt: derived.sectionAt,
      fittings: drawSol.panels.map((p) => derived.fittingsOn?.(p) ?? []),
      tubes: drawSol.panels.map((p) => derived.tubesOn?.(p) ?? []),
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
          section: derived.drawing.section,
          insulation: derived.drawing.insulation,
        });
        setState({ status: "ready", sheet, ms: Math.round(performance.now() - t0), isolated: isolated() });
      })
      .catch((error) => {
        if (!live) return;                       // superseded, not failed
        console.error("OpenCASCADE sheet failed:", error);
        if (live) setState({ status: "failed", error });
      });

    return () => { live = false; cancel.abort(); };
  }, [enabled, derived, design.title, attempt]);

  return state;
}
