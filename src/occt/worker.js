// §11 The kernel, off the main thread.
//
// Everything OpenCASCADE does happens here: fetching 9.3 MB of wasm, compiling
// it, instantiating it, meshing panels, and hidden line removal. None of it is
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
 * The steps a job goes through, in order. Reported as it goes, so a failure can
 * say which one it died in rather than only that it died.
 *
 * "the kernel is unavailable" was the whole message for every one of these, and
 * they fail for entirely different reasons: a slow connection stalls `fetching`,
 * a browser that is not cross-origin isolated cannot get past `starting`, and a
 * boolean that will not converge hangs in `working`.
 */
export const PHASES = ["fetching", "compiling", "starting", "working"];

/**
 * Fetch the wasm ourselves rather than letting the glue do it, so the bytes can
 * be counted on the way past. Handed to the factory as `wasmBinary`, so this is
 * the only time it is downloaded.
 *
 * Only bytes received, never a percentage: the body arrives decompressed while
 * Content-Length is the gzipped figure, and a progress bar that reads 260% is
 * worse than no progress bar.
 */
async function fetchWasm(url, report) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} fetching ${url}`);
  if (!response.body) return response.arrayBuffer();

  const reader = response.body.getReader();
  const chunks = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    report({ phase: "fetching", loaded });
  }
  const out = new Uint8Array(loaded);
  let at = 0;
  for (const c of chunks) { out.set(c, at); at += c.length; }
  return out.buffer;
}

/** Load once, share the promise. `dir` is resolved by the client against the
 *  page's own base: a worker has no `document`, and the pthread worker inside
 *  the kernel resolves `./occt-box.js` against its own URL. */
function load(dir, report) {
  if (!kernel) {
    kernel = (async () => {
      report({ phase: "fetching", loaded: 0 });
      const [{ default: factory }, wasmBinary] = await Promise.all([
        import(/* @vite-ignore */ `${dir}occt-box.js`),
        fetchWasm(`${dir}occt-box.wasm`, report),
      ]);
      report({ phase: "starting", isolated: self.crossOriginIsolated === true });
      return factory({
        wasmBinary,
        // The wasm arrives as `wasmBinary`, so the glue should never fetch it —
        // but if some path still does, it must still resolve against the page.
        locateFile: (path) =>
          (path.endsWith(".wasm") || path.endsWith(".worker.js") ? dir + path : path),
      });
    })().catch((e) => { kernel = null; throw e; });   // a failed load is retryable
  }
  return kernel;
}

/** Every typed array in a result, so it moves rather than copies. */
export function buffersOf(value, out = []) {
  if (ArrayBuffer.isView(value)) out.push(value.buffer);
  else if (Array.isArray(value)) for (const v of value) buffersOf(v, out);
  else if (value && typeof value === "object") for (const v of Object.values(value)) buffersOf(v, out);
  return out;
}

export const OPS = {
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
    const report = (progress) => self.postMessage({ id, progress });
    let phase = "fetching";
    const watch = (p) => { phase = p.phase; report(p); };
    try {
      const oc = await load(dir, watch);
      watch({ phase: "working" });
      const result = OPS[op](oc, payload);
      self.postMessage({ id, ok: true, result }, buffersOf(result));
    } catch (error) {
      // Errors do not survive structured cloning with their prototype, and the
      // phase is the part worth keeping: it says which step to look at.
      self.postMessage({
        id, ok: false, phase,
        isolated: self.crossOriginIsolated === true,
        error: String(error?.message ?? error),
      });
    }
  };
}

export { panelBevels };
