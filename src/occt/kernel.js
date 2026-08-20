// What the main thread knows about the kernel.
//
// Not much, deliberately. The kernel itself lives in worker.js and is reached
// through client.js; this module holds only the three things both sides and the
// UI have to agree on — how long to wait, how to describe a failure, and
// whether threads are available at all.
//
// The trimmed build in occt/ is 9.3 MB of wasm, fetched only when something
// asks for it. Until then — and if it fails — the analytic engine of §2–§6
// draws the sheet, which is why the app is usable on the first paint rather
// than after a 3.5 MB download.

/**
 * How long to wait with nothing happening before giving up.
 *
 * Silence, not elapsed time. The wasm is about 4 MB compressed, and on a slow
 * connection that download can run past any total anyone would pick — a
 * download in progress is not a failure, and this used to end it as one at
 * exactly ninety seconds. The worker reports every step and every block of
 * bytes; the clock restarts on each. So it now catches only a job that has
 * genuinely stopped.
 *
 * It is a real deadline in the first place because the work is in a worker. It
 * used to be set on the thread the kernel was about to block, so a hang stopped
 * the timer too.
 */
export const LOAD_TIMEOUT_MS = 90_000;

/** What each step of a job is called where a person will read it. */
export const PHASE_LABEL = {
  fetching: "fetching the kernel",
  compiling: "compiling the kernel",
  starting: "starting the kernel",
  working: "working",
};

const mb = (bytes) => `${(bytes / 1e6).toFixed(1)} MB`;

/**
 * §7 What to show while a job runs. Bytes as they arrive, never a percentage:
 * the body arrives decompressed while Content-Length is the gzipped figure, and
 * a progress bar that reads 260% is worse than no progress bar.
 */
export function kernelProgress(progress = {}) {
  const step = PHASE_LABEL[progress.phase] ?? "starting the kernel";
  if (progress.handedOff) return "fetching the kernel the long way";
  return progress.loaded ? `${step}, ${mb(progress.loaded)}` : step;
}

/**
 * §8 A stall, named. Which step it died in is the whole diagnosis: `fetching`
 * is the network, `starting` is nearly always cross-origin isolation, and
 * `working` is the geometry.
 */
export function describeStall(progress = {}, timeout = LOAD_TIMEOUT_MS) {
  const secs = Math.round(timeout / 1000);
  // No phase at all means the worker never sent a word — it did not start, or
  // it never reached its own first line. Quite different from stalling in one.
  if (!progress.phase) {
    return new Error(`the kernel worker never reported anything in ${secs} s: ` +
      "it did not start, or its script never loaded");
  }
  const step = PHASE_LABEL[progress.phase] ?? "starting up";
  const got = progress.loaded ? `, ${mb(progress.loaded)} in`
    : progress.phase === "fetching" ? ", no bytes at all" : "";
  const why = progress.phase === "starting" && progress.isolated === false
    ? " — this browser is not cross-origin isolated, which the threaded build needs"
    : "";
  return new Error(`the kernel stopped while ${step}${got}: nothing for ${secs} s${why}`);
}

/**
 * Instantiating a shared memory that will not fit reads as an allocation
 * failure; anything else keeps its own message, with the step it died in.
 */
export function describeFailure(e, at = {}) {
  const text = String(e?.message ?? e);
  if (e instanceof RangeError || /memory|allocat|Out of/i.test(text)) {
    return new Error(`the kernel could not reserve the memory it asked for (${text})`);
  }
  if (/SharedArrayBuffer/.test(text)) {
    return new Error("this browser is not cross-origin isolated, so the threaded kernel " +
      `cannot start (${text})`);
  }
  if (!at.phase) return e;
  return new Error(`${PHASE_LABEL[at.phase] ?? at.phase}: ${text}`);
}

/**
 * Whether threads are available at all. False just means slower, never broken.
 *
 * This is a capability, not a claim that any given step used it. Only BRepMesh
 * takes threads; HLRBRep has no parallel mode, so the sheet is serial however
 * this answers.
 */
export const isolated = () => typeof window !== "undefined" && window.crossOriginIsolated === true;
