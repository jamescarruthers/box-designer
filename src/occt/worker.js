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

/** How long to wait for the first byte before giving up on our own fetch. */
export const FIRST_BYTE_MS = 20_000;

/**
 * Fetch the wasm ourselves rather than letting the glue do it, so the bytes can
 * be counted on the way past. Handed to the factory as `wasmBinary`.
 *
 * Only bytes received, never a percentage: the body arrives decompressed while
 * Content-Length is the gzipped figure, and a progress bar that reads 260% is
 * worse than no progress bar.
 *
 * Returns null rather than throwing if nothing at all arrives in time, and then
 * the glue fetches the wasm the way it always did. Counting the bytes is a
 * convenience; downloading the kernel is not, and a convenience must not be the
 * thing that stops it. Reported from the field: no bytes, ninety seconds, on a
 * build where the glue's own loader had been working.
 */
export async function fetchWasm(url, report, firstByte = FIRST_BYTE_MS) {
  const abort = new AbortController();
  const giveUp = setTimeout(() => abort.abort(), firstByte);
  try {
    const response = await fetch(url, { signal: abort.signal });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText} fetching ${url}`);
    if (!response.body) { clearTimeout(giveUp); return response.arrayBuffer(); }

    const reader = response.body.getReader();
    const chunks = [];
    let loaded = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      clearTimeout(giveUp);                  // it is moving; let it take as long as it takes
      chunks.push(value);
      loaded += value.length;
      report({ phase: "fetching", loaded });
    }
    const out = new Uint8Array(loaded);
    let at = 0;
    for (const c of chunks) { out.set(c, at); at += c.length; }
    return out.buffer;
  } catch (e) {
    if (abort.signal.aborted) {
      report({ phase: "fetching", handedOff: true });
      return null;                           // let the glue do it
    }
    throw e;
  } finally {
    clearTimeout(giveUp);
  }
}

const loadWatchers = new Set();
const announce = (progress) => { for (const w of loadWatchers) w(progress); };

function load(dir, report) {
  // Every job waiting on the same load hears the same progress. Reporting only
  // to whichever job happened to start it left the others silent for the whole
  // download — and a silent job is one the client's watchdog kills, which then
  // terminates the worker out from under the download that was going fine.
  loadWatchers.add(report);
  if (!kernel) {
    kernel = (async () => {
      announce({ phase: "fetching", loaded: 0 });
      const [{ default: factory }, wasmBinary] = await Promise.all([
        import(/* @vite-ignore */ `${dir}occt-box.js`),
        fetchWasm(`${dir}occt-box.wasm`, announce),
      ]);
      announce({ phase: "starting", isolated: self.crossOriginIsolated === true });
      return factory({
        // Absent when our own fetch produced nothing: the glue then fetches it.
        ...(wasmBinary ? { wasmBinary } : {}),
        // The wasm arrives as `wasmBinary`, so the glue should never fetch it —
        // but if some path still does, it must still resolve against the page.
        locateFile: (path) =>
          (path.endsWith(".wasm") || path.endsWith(".worker.js") ? dir + path : path),
      });
    })().catch((e) => { kernel = null; throw e; });   // a failed load is retryable
  }
  return kernel.finally(() => loadWatchers.delete(report));
}

/**
 * Whether the thread pool is genuinely there.
 *
 * Not `crossOriginIsolated` on its own. That says SharedArrayBuffer is allowed,
 * which is why the kernel instantiates at all — it says nothing about whether
 * the pthread workers actually came up. Ask BRepMesh for parallel meshing when
 * they have not and it blocks for ever waiting for a thread to take the work:
 * the job reaches `working` and never leaves, which is precisely the failure
 * this is here to stop. Emscripten keeps the pool where it can be counted.
 */
export function threadsReady(oc) {
  const isolated = typeof self !== "undefined" && self.crossOriginIsolated === true;
  const pool = oc?.PThread?.unusedWorkers;
  return isolated && Array.isArray(pool) && pool.length > 0;
}

/** Every typed array in a result, so it moves rather than copies. */
export function buffersOf(value, out = []) {
  if (ArrayBuffer.isView(value)) out.push(value.buffer);
  else if (Array.isArray(value)) for (const v of value) buffersOf(v, out);
  else if (value && typeof value === "object") for (const v of Object.values(value)) buffersOf(v, out);
  return out;
}

export const OPS = {
  mesh(oc, { panels, bevels, E, fittings, safeMode, threads }) {
    return meshPanels(oc, panels, (i) => bevels[i] ?? {}, E, {
      fittingsFor: (i) => fittings?.[i] ?? [],
      // Threads are worth 18-22% of this step and nothing at all elsewhere, so
      // they are never worth a hang — and a hang here cannot be recovered from,
      // only waited out. Opt in explicitly; nothing in the app does.
      parallel: !safeMode && threads === true && threadsReady(oc),
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
      watch({
        phase: "working",
        isolated: self.crossOriginIsolated === true,
        // What this job will actually use, not what the machine could offer.
        threaded: payload?.threads === true && threadsReady(oc),
      });
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
