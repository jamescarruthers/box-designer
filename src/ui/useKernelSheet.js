// Draw the sheet with OpenCASCADE, on request.
//
// The analytic sheet is already there when the app paints. Asking for the
// kernel fetches 3.5 MB and takes a few hundred milliseconds a view, so it
// happens on demand and reports its own state rather than blocking anything.

import { useEffect, useState } from "react";
import { loadKernel, threaded } from "../occt/kernel.js";
import { kernelViews } from "../occt/drawing.js";
import { buildSheet } from "../drawing/sheet.js";

export function useKernelSheet(derived, design, enabled) {
  const [state, setState] = useState({ status: "idle" });

  useEffect(() => {
    if (!enabled) { setState({ status: "idle" }); return; }
    let live = true;
    setState((s) => ({ status: s.sheet ? "refreshing" : "loading", sheet: s.sheet }));

    loadKernel()
      .then((oc) => {
        if (!live) return;
        const t0 = performance.now();
        const { geometry } = kernelViews(oc, derived.sol, derived.edges, derived.owners, {
          sectionAt: derived.sectionAt,
        });
        const sheet = buildSheet(derived.sol, derived.edges, {
          title: design.title,
          material: derived.material.name.toUpperCase(),
          sectionAt: derived.sectionAt,
          geometry,
        });
        if (live) setState({ status: "ready", sheet, ms: Math.round(performance.now() - t0), threaded: threaded() });
      })
      .catch((error) => {
        console.error("OpenCASCADE sheet failed:", error);
        if (live) setState({ status: "failed", error });
      });

    return () => { live = false; };
  }, [enabled, derived, design.title]);

  return state;
}
