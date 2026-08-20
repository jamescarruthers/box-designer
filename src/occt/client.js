// §11 Talking to the kernel worker.
//
// One worker, shared by the 3D view and the drawing, spawned on the first
// request and never on the first paint. Every call has a deadline: the main
// thread is free now, so the deadline is real.
//
// The deadline is on *silence*, not on the whole job. A 4 MB download over a
// slow connection and a kernel that has deadlocked look identical if all you
// measure is elapsed time, and the first one is not a failure. The worker
// reports each step as it reaches it and each block of bytes as it arrives;
// the clock restarts on every one of those. So the timeout now means what it
// should: nothing has happened for ninety seconds.
//
// Jobs go over **one at a time**. The worker is single-threaded and the work is
// synchronous, so a second job sent while the first is meshing does not start
// any sooner — it sits in the worker's own queue where nothing can see it, its
// deadline running against a silence that is somebody else's work. Six clicks
// of the engine toggle used to mean six full meshes queued behind each other,
// each one's watchdog ticking; on a box big enough the last one's deadline
// expired, the worker was torn down mid-job, and the toggle stopped working
// until the whole 9 MB kernel had been fetched again. Holding the queue here
// costs nothing — the work was serial anyway — and means a waiting job's clock
// does not start until the worker is actually listening to it.
//
// A call that does time out does not just reject. A kernel that has stopped
// answering is either deadlocked or thrashing, and either way it will not
// recover and will hold a core while it does not. The worker is terminated and
// the next request starts a fresh one.

import { LOAD_TIMEOUT_MS, describeFailure, describeStall } from "./kernel.js";

let worker = null;
let seq = 0;

/**
 * Every job the worker has been given or is about to be given.
 *
 * A job stays here until the worker answers it or its watchdog fires — even
 * once nobody wants it any more. Abandoned work is still work: the worker is
 * busy with it, the next job cannot start until it ends, and if it never ends
 * that is exactly the hang the watchdog is for.
 */
const jobs = new Map();
const queue = [];                       // ids waiting their turn, in order
let current = null;                     // the id the worker is holding

/**
 * Set once a job has stalled in `working`, and passed to every job after it.
 * The only thing in there that can block indefinitely is BRepMesh waiting on a
 * thread pool that never took the work, and threads are worth 18-22% of the
 * mesh step. So having seen one hang, stop asking.
 */
let safeMode = false;

/** Resolved against the page, not the worker: the worker has no `document`. */
const kernelDir = () => new URL("occt/", document.baseURI).href;

/** Done with, one way or another: forget it and let the next job start. */
function finish(id) {
  const entry = jobs.get(id);
  if (!entry) return;
  clearTimeout(entry.timer);
  jobs.delete(id);
  const at = queue.indexOf(id);
  if (at >= 0) queue.splice(at, 1);
  if (current === id) current = null;
  pump();
}

/** Answer the caller, if there still is one, and close the job. */
function settle(id, fn) {
  const entry = jobs.get(id);
  if (!entry) return;
  if (entry.resolve) fn(entry);
  finish(id);
}

function failAll(error) {
  // Emptied before anything is rejected: settling a job pumps the queue, and a
  // queue pumped in the middle of a failure hands work to a worker that is on
  // its way out.
  queue.length = 0;
  current = null;
  for (const id of [...jobs.keys()]) settle(id, (e) => e.reject(error));
}

export function terminateKernel() {
  if (!worker) return;
  worker.terminate();
  worker = null;
}

function ensureWorker() {
  if (worker) return worker;
  worker = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
  worker.onmessage = ({ data }) => {
    if (data.progress) return advance(data.id, data.progress);
    // An answer to a job nobody is waiting for any more still frees the worker,
    // which is why settling closes the job either way.
    settle(data.id, (e) => (data.ok
      ? e.resolve(data.result)
      : e.reject(describeFailure(new Error(data.error), data))));
  };
  // A worker that dies outright — an allocation it could not make, a wasm trap
  // — reports here and nowhere else, so every call in flight has to be told.
  worker.onerror = (event) => {
    const error = describeFailure(new Error(event.message || "the kernel worker stopped"));
    console.error("OpenCASCADE worker failed:", error);
    terminateKernel();
    failAll(error);
  };
  return worker;
}

/** Hand the worker the next job, if it is free to take one. */
function pump() {
  if (current !== null || !queue.length) return;
  const id = queue.shift();
  const entry = jobs.get(id);
  if (!entry) return pump();
  current = id;
  // Anything it picked up while it waited belongs to another job. What it says
  // about itself from here has to be its own, or a stall will be blamed on a
  // download that finished for somebody else.
  entry.progress = {};
  // The clock starts now, not when the job was asked for: until this moment
  // the silence was another job's work, and holding it against this one is how
  // a healthy queue kills a healthy worker.
  entry.timer = setTimeout(() => expire(id), entry.timeout);
  try {
    ensureWorker().postMessage(
      { id, op: entry.op, dir: kernelDir(), payload: { ...entry.payload, safeMode } },
      entry.transfer);
  } catch (error) {
    settle(id, (e) => e.reject(describeFailure(error)));
  }
}

/** The steps that are the kernel loading, which every job is waiting on. */
const LOADING = new Set(["fetching", "compiling", "starting"]);

/** A step reached, or bytes arrived: the job is alive, so restart its clock. */
function advance(id, progress) {
  const entry = jobs.get(id);
  if (!entry) return;
  entry.progress = { ...entry.progress, ...progress };
  entry.onProgress?.(entry.progress);
  clearTimeout(entry.timer);
  entry.timer = setTimeout(() => expire(id), entry.timeout);

  // A job that is still waiting its turn has to say so. Its own clock is not
  // running and the worker has never heard of it, so without this it shows
  // whatever it started with and does not move — which is exactly what "I
  // switched it on and nothing happened" looks like from the outside. If the
  // kernel is still loading it is what this job is waiting for too, so it gets
  // the real figures; if the worker is meshing something else, it gets its
  // place in the queue instead.
  const shared = LOADING.has(progress.phase)
    ? entry.progress
    : { phase: "queued", loaded: entry.progress.loaded };
  for (const other of queue) {
    const waiting = jobs.get(other);
    if (!waiting) continue;
    waiting.progress = { ...waiting.progress, ...shared };
    waiting.onProgress?.(waiting.progress);
  }
}

function expire(id) {
  const entry = jobs.get(id);
  if (!entry) return;
  // The geometry only hangs on a thread that never arrives. Do without.
  if (entry.progress?.phase === "working") safeMode = true;
  const stalled = describeStall(entry.progress, entry.timeout);
  console.error("OpenCASCADE stalled:", stalled.message, entry.progress);
  // Nothing it is doing is worth the core it is doing it on. Torn down before
  // anything is rejected, so no job can be handed to it on the way past.
  terminateKernel();
  queue.length = 0;
  current = null;
  const restarted = new Error("the kernel was restarted after a stall");
  for (const other of [...jobs.keys()]) {
    settle(other, (e) => e.reject(other === id ? stalled : restarted));
  }
}

/**
 * Send one job to the kernel. `transfer` moves the caller's buffers; results
 * come back transferred the same way. `onProgress` is called with
 * `{ phase, loaded, isolated }` as the job moves.
 */
export function callKernel(op, payload, { timeout = LOAD_TIMEOUT_MS, transfer = [], onProgress, signal } = {}) {
  return new Promise((resolve, reject) => {
    const id = ++seq;
    jobs.set(id, {
      op, payload, transfer, resolve, reject, onProgress, timeout,
      // Nothing assumed. A job that starts life saying "fetching" reports the
      // same thing whether the worker got that far or never spoke at all, and
      // those are different faults with different fixes.
      progress: {},
      timer: null,
    });
    queue.push(id);
    // A superseded job must be dropped, not merely ignored. Left in the queue
    // it keeps its watchdog, and a job nobody is waiting for that times out
    // still tears down the worker and every healthy job with it.
    //
    // Dropping it releases the caller. Whether it releases the worker depends
    // on where it had got to: one still queued here never started and goes
    // altogether, while one the worker has already begun cannot be recalled —
    // an OCCT boolean is a single synchronous call with no way in. That one
    // keeps its place and its watchdog and is thrown away when it answers.
    signal?.addEventListener("abort", () => abandon(id), { once: true });
    pump();
  });
}

/** Give up on a job's result, without pretending the worker has stopped. */
function abandon(id) {
  const entry = jobs.get(id);
  if (!entry) return;
  const superseded = new Error("superseded");
  if (current === id) {
    entry.reject(superseded);
    entry.resolve = null;
    entry.reject = null;
    entry.onProgress = null;
  } else {
    settle(id, (e) => e.reject(superseded));
  }
}

/** Whether the last stall made us stop asking for threads. */
export const inSafeMode = () => safeMode;

/** How many jobs are outstanding — the UI shows nothing else about the worker. */
export const pendingJobs = () => jobs.size;
