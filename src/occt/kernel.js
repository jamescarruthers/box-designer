// Loading the kernel in the browser.
//
// The trimmed build in occt/ is 9.3 MB of wasm, so it is fetched only when
// something asks for it. Until then — and if it fails — the analytic engine of
// §2–§6 draws the sheet, which is why the app is usable on the first paint
// rather than after a 3.5 MB download.

import { ensureCrossOriginIsolated } from "./isolate.js";

let pending = null;
let failure = null;

/**
 * How long to wait for the kernel before giving up.
 *
 * Generous: the wasm is about 4 MB compressed and some connections are slow.
 * The point is not speed but that a stall always ends in the analytic engine
 * and a message, rather than in a status chip that never changes.
 *
 * This cannot rescue a tab the browser kills outright — nothing in JS can —
 * but it turns every hang into a graceful fallback.
 */
export const LOAD_TIMEOUT_MS = 90_000;

/** Instantiating a shared memory that will not fit reads as an allocation failure. */
export function describeFailure(e) {
  const text = String(e?.message ?? e);
  if (e instanceof RangeError || /memory|allocat|Out of/i.test(text)) {
    return new Error(`the kernel could not reserve the memory it asked for (${text})`);
  }
  return e;
}

/**
 * Whether threads are available at all. False just means slower, never broken.
 *
 * This is a capability, not a claim that any given step used it. Only BRepMesh
 * takes threads; HLRBRep has no parallel mode, so the sheet is serial however
 * this answers.
 */
export const isolated = () => typeof window !== "undefined" && window.crossOriginIsolated === true;

export function kernelState() {
  if (failure) return { status: "failed", error: failure };
  if (!pending) return { status: "idle" };
  return { status: "loading" };
}

/** Load once, share the promise. Rejections are remembered, not retried in a loop. */
export function loadKernel() {
  if (failure) return Promise.reject(failure);
  if (pending) return pending;

  // Loaded from public/ at run time rather than through the bundler. The glue
  // is 248 kB and the wasm 9.3 MB, so neither belongs in the first paint — and
  // the pthread worker resolves `./occt-box.js` relative to its own URL, which
  // a hashed bundle filename would break.
  // Against document.baseURI, not import.meta.env.BASE_URL: the base is "./",
  // and a relative dynamic import would resolve against the chunk in /assets/
  // rather than against the page.
  const dir = new URL("occt/", document.baseURI).href;

  let timer;
  const watchdog = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`gave up after ${Math.round(LOAD_TIMEOUT_MS / 1000)} s`)),
      LOAD_TIMEOUT_MS);
  });

  const load = ensureCrossOriginIsolated()
    .then(() => import(/* @vite-ignore */ `${dir}occt-box.js`))
    .then(({ default: factory }) => factory({
      locateFile: (path) => (path.endsWith(".wasm") || path.endsWith(".worker.js") ? dir + path : path),
    }));

  pending = Promise.race([load, watchdog])
    .then((oc) => { clearTimeout(timer); return oc; })
    .catch((e) => {
      clearTimeout(timer);
      const err = describeFailure(e);
      // Worth a console line: the drawing silently falls back to the analytic
      // engine, so without this the failure is invisible.
      console.error("OpenCASCADE kernel failed to load:", err);
      failure = err;
      pending = null;
      throw err;
    });

  return pending;
}
