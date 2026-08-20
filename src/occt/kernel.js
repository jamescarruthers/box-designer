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
 * How long to wait for the kernel before giving up.
 *
 * Generous: the wasm is about 4 MB compressed and some connections are slow.
 * The point is not speed but that a stall always ends in the analytic engine
 * and a message, rather than in a status chip that never changes.
 *
 * This is a real deadline now rather than a hopeful one. It used to be set on
 * the thread that was about to be blocked by the very thing it was timing, so
 * a genuine hang stopped the timer too. The work is in a worker, so the timer
 * fires whatever the kernel is doing.
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
