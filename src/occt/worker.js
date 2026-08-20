// §11 The kernel, off the main thread.
//
// Everything OpenCASCADE does happens here: compiling 9.3 MB of wasm,
// instantiating it, meshing panels, and hidden line removal. None of it is
// interruptible and some of it blocks — a `-pthread` build warns in as many
// words that blocking on the main browser thread is dangerous — so on the main
// thread a stall is a frozen tab, and a frozen tab cannot even run the timer
// meant to rescue it.
//
// Here a stall is a stalled worker. The page stays live, the watchdog fires
// because its thread is free to fire it, and the client terminates this worker
// and falls back to the analytic engine.
//
// The kernel objects never cross the boundary: only panel boxes and numbers go
// in, and typed arrays and plain line lists come out.

import { meshPanels } from "./mesh.js";
import { kernelViews } from "./drawing.js";
import { panelBevels } from "../model/bevel.js";

let kernel = null;

/**
 * Load once, share the promise. `dir` is resolved by the client against the
 * page's own base: a worker has no `document`, and the pthread worker inside
 * the kernel resolves `./occt-box.js` against its own URL.
 */
function load(dir) {
  if (!kernel) {
    kernel = import(/* @vite-ignore */ `${dir}occt-box.js`)
      .then(({ default: factory }) => factory({
        locateFile: (path) =>
          (path.endsWith(".wasm") || path.endsWith(".worker.js") ? dir + path : path),
      }));
  }
  return kernel;
}

/** Every typed array in a result, so it moves rather than copies. */
function buffersOf(value, out = []) {
  if (ArrayBuffer.isView(value)) out.push(value.buffer);
  else if (Array.isArray(value)) for (const v of value) buffersOf(v, out);
  else if (value && typeof value === "object") for (const v of Object.values(value)) buffersOf(v, out);
  return out;
}

const OPS = {
  mesh(oc, { panels, bevels, E, fittings }) {
    return meshPanels(oc, panels, (i) => bevels[i] ?? {}, E, {
      fittingsFor: (i) => fittings?.[i] ?? [],
    });
  },

  views(oc, { sol, edges, owners, sectionAt, fittings }) {
    // Only the geometry: the shape is an OCCT handle and stays on this side.
    return kernelViews(oc, sol, edges, owners, {
      sectionAt,
      fittingsFor: (i) => fittings?.[i] ?? [],
    }).geometry;
  },
};

// Only when this really is a worker. The operations are imported directly by
// the tests, which run the kernel in Node and have no worker scope at all.
if (typeof self !== "undefined" && typeof self.postMessage === "function" && !("window" in globalThis)) {
  self.onmessage = async (event) => {
    const { id, op, dir, payload } = event.data;
    try {
      const oc = await load(dir);
      const result = OPS[op](oc, payload);
      self.postMessage({ id, ok: true, result }, buffersOf(result));
    } catch (error) {
      // Errors do not survive structured cloning with their prototype, and the
      // client only ever shows the message.
      self.postMessage({ id, ok: false, error: String(error?.message ?? error) });
    }
  };
}

// Exported for the tests, which drive the operations without a worker at all.
export { OPS, buffersOf, panelBevels };
