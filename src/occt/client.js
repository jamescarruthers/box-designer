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
// A call that does time out does not just reject. A kernel that has stopped
// answering is either deadlocked or thrashing, and either way it will not
// recover and will hold a core while it does not. The worker is terminated and
// the next request starts a fresh one.

import { LOAD_TIMEOUT_MS, describeFailure, describeStall } from "./kernel.js";

let worker = null;
let seq = 0;
const waiting = new Map();

/**
 * Set once a job has stalled in `working`, and passed to every job after it.
 * The only thing in there that can block indefinitely is BRepMesh waiting on a
 * thread pool that never took the work, and threads are worth 18-22% of the
 * mesh step. So having seen one hang, stop asking.
 */
let safeMode = false;

/** Resolved against the page, not the worker: the worker has no `document`. */
const kernelDir = () => new URL("occt/", document.baseURI).href;

function settle(id, fn) {
  const entry = waiting.get(id);
  if (!entry) return;
  clearTimeout(entry.timer);
  waiting.delete(id);
  fn(entry);
}

function failAll(error) {
  for (const id of [...waiting.keys()]) settle(id, (e) => e.reject(error));
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

/** A step reached, or bytes arrived: the job is alive, so restart its clock. */
function advance(id, progress) {
  const entry = waiting.get(id);
  if (!entry) return;
  entry.progress = { ...entry.progress, ...progress };
  entry.onProgress?.(entry.progress);
  clearTimeout(entry.timer);
  entry.timer = setTimeout(() => expire(id), entry.timeout);
}

function expire(id) {
  const entry = waiting.get(id);
  if (!entry) return;
  // The geometry only hangs on a thread that never arrives. Do without.
  if (entry.progress?.phase === "working") safeMode = true;
  const stalled = describeStall(entry.progress, entry.timeout);
  console.error("OpenCASCADE stalled:", stalled.message, entry.progress);
  settle(id, (e) => e.reject(stalled));
  // Nothing it is doing is worth the core it is doing it on.
  terminateKernel();
  failAll(new Error("the kernel was restarted after a stall"));
}

/**
 * Send one job to the kernel. `transfer` moves the caller's buffers; results
 * come back transferred the same way. `onProgress` is called with
 * `{ phase, loaded, isolated }` as the job moves.
 */
export function callKernel(op, payload, { timeout = LOAD_TIMEOUT_MS, transfer = [], onProgress, signal } = {}) {
  return new Promise((resolve, reject) => {
    const id = ++seq;
    waiting.set(id, {
      resolve, reject, onProgress, timeout,
      // Nothing assumed. A job that starts life saying "fetching" reports the
      // same thing whether the worker got that far or never spoke at all, and
      // those are different faults with different fixes.
      progress: {},
      timer: setTimeout(() => expire(id), timeout),
    });
    // A superseded job must be dropped, not merely ignored. Left in the queue
    // it keeps its watchdog, and a job nobody is waiting for that times out
    // still tears down the worker and every healthy job with it.
    signal?.addEventListener("abort", () => settle(id, (e) =>
      e.reject(new Error("superseded"))), { once: true });
    try {
      ensureWorker().postMessage({ id, op, dir: kernelDir(), payload: { ...payload, safeMode } }, transfer);
    } catch (error) {
      settle(id, (e) => e.reject(describeFailure(error)));
    }
  });
}

/** Whether the last stall made us stop asking for threads. */
export const inSafeMode = () => safeMode;

/** How many jobs are outstanding — the UI shows nothing else about the worker. */
export const pendingJobs = () => waiting.size;
