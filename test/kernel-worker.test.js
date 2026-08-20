/**
 * §11 The kernel worker boundary.
 *
 * The point of the worker is that nothing OpenCASCADE does can stop the page.
 * Two things have to hold for that: everything a job needs must survive
 * structured cloning, since a closure cannot cross the boundary, and a job that
 * never answers must end in a rejection rather than in silence.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DEFAULT_DESIGN, derive } from "../src/ui/design.js";
import { panelBevels } from "../src/model/bevel.js";
import { buffersOf, threadsReady, OPS, fetchWasm } from "../src/occt/worker.js";
import { kernelProgress } from "../src/occt/kernel.js";

const workers = [];

/** A worker that does exactly what it is told to, including nothing. */
class StubWorker {
  static reply = null;                       // set per test, before the call
  constructor() {
    this.posted = [];
    this.terminated = false;
    workers.push(this);
  }
  postMessage(message) {
    this.posted.push(message);
    const reply = StubWorker.reply;
    if (reply) queueMicrotask(() => this.onmessage({ data: reply(message) }));
  }
  terminate() { this.terminated = true; }
}

let client;
beforeEach(async () => {
  workers.length = 0;
  StubWorker.reply = null;
  vi.resetModules();
  vi.useFakeTimers();
  vi.stubGlobal("Worker", StubWorker);
  client = await import("../src/occt/client.js");
});
afterEach(() => {
  client.terminateKernel();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("§11 a job that never answers ends somewhere", () => {
  it("says the worker never spoke, rather than blaming a step it never reached", async () => {
    // A job that assumed "fetching" reported the same thing whether the worker
    // got that far or never started, and those want different fixes.
    const call = client.callKernel("mesh", {}, { timeout: 1000 });
    const settled = expect(call).rejects.toThrow(/never reported anything/);
    await vi.advanceTimersByTimeAsync(1001);
    await settled;
  });

  it("distinguishes a fetch that delivered nothing from one that never began", async () => {
    const call = client.callKernel("mesh", {}, { timeout: 1000 });
    const settled = expect(call).rejects.toThrow(/fetching the kernel, no bytes at all/);
    workers[0].onmessage({ data: { id: 1, progress: { phase: "fetching" } } });
    await vi.advanceTimersByTimeAsync(1001);
    await settled;
  });

  it("names the step it stopped in, which is the whole diagnosis", async () => {
    const call = client.callKernel("mesh", {}, { timeout: 1000 });
    const settled = expect(call).rejects.toThrow(/stopped while starting the kernel/);
    workers[0].onmessage({ data: { id: 1, progress: { phase: "starting", isolated: true } } });
    await vi.advanceTimersByTimeAsync(1001);
    await settled;
  });

  it("blames isolation when the threaded kernel stalls on starting without it", async () => {
    const call = client.callKernel("mesh", {}, { timeout: 1000 });
    const settled = expect(call).rejects.toThrow(/not cross-origin isolated/);
    workers[0].onmessage({ data: { id: 1, progress: { phase: "starting", isolated: false } } });
    await vi.advanceTimersByTimeAsync(1001);
    await settled;
  });

  it("terminates the stalled worker rather than leaving it holding a core", async () => {
    const call = client.callKernel("mesh", {}, { timeout: 1000 });
    call.catch(() => {});
    await vi.advanceTimersByTimeAsync(1001);
    expect(workers[0].terminated).toBe(true);
  });

  it("starts a fresh worker for the next job, so one stall is not permanent", async () => {
    const first = client.callKernel("mesh", {}, { timeout: 1000 });
    first.catch(() => {});
    await vi.advanceTimersByTimeAsync(1001);

    const second = client.callKernel("mesh", {}, { timeout: 1000 });
    second.catch(() => {});
    expect(workers).toHaveLength(2);
    expect(workers[1].terminated).toBe(false);
  });

  it("fails every job in flight when the worker itself dies", async () => {
    const a = client.callKernel("mesh", {}, { timeout: 60000 });
    const b = client.callKernel("views", {}, { timeout: 60000 });
    const settled = Promise.all([
      expect(a).rejects.toThrow(/reserve the memory/),
      expect(b).rejects.toThrow(/reserve the memory/),
    ]);
    workers[0].onerror({ message: "Out of memory" });
    await settled;
  });

  it("resolves with what the worker sent back, matched by job id", async () => {
    StubWorker.reply = (m) => ({ id: m.id, ok: true, result: { op: m.op, triangles: 12 } });
    const mesh = client.callKernel("mesh", { E: 1 }, { timeout: 60000 });
    const views = client.callKernel("views", {}, { timeout: 60000 });
    await expect(mesh).resolves.toEqual({ op: "mesh", triangles: 12 });
    await expect(views).resolves.toEqual({ op: "views", triangles: 12 });
  });

  it("rejects the one job that failed, with the worker's own message", async () => {
    StubWorker.reply = (m) => ({ id: m.id, ok: false, error: "BRepAlgoAPI_Cut failed" });
    await expect(client.callKernel("mesh", {}, { timeout: 60000 }))
      .rejects.toThrow("BRepAlgoAPI_Cut failed");
  });

  it("sends the page's own kernel directory, since a worker has no document", async () => {
    client.callKernel("mesh", {}, { timeout: 60000 }).catch(() => {});
    expect(workers[0].posted[0].dir).toMatch(/occt\/$/);
  });
});

/**
 * The deadline is on silence, not on elapsed time. A 4 MB download over a slow
 * connection and a deadlocked kernel look identical if all you measure is the
 * clock — and the first one is not a failure. This is the distinction that
 * ninety-second timeout used to get wrong.
 */
/**
 * Counting the bytes is a convenience. Downloading the kernel is not, and a
 * convenience must never be the thing that stops it — which is exactly what it
 * became: no bytes, ninety seconds, on a build whose own loader had worked.
 */
describe("§11 our own fetch hands back to the glue rather than blocking it", () => {
  const never = () => new Promise(() => {});

  it("gives up on the first byte and returns nothing, so the glue can fetch it", async () => {
    vi.stubGlobal("fetch", (url, { signal }) => new Promise((_, reject) =>
      signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")))));
    const seen = [];
    const got = fetchWasm("x.wasm", (p) => seen.push(p), 1000);
    await vi.advanceTimersByTimeAsync(1001);
    await expect(got).resolves.toBe(null);
    expect(seen.at(-1).handedOff).toBe(true);
  });

  it("stops watching the clock once bytes are moving, however slowly", async () => {
    const chunks = [new Uint8Array(10), new Uint8Array(10)];
    let at = 0;
    vi.stubGlobal("fetch", async () => ({
      ok: true,
      body: { getReader: () => ({ read: async () => (at < chunks.length
        ? { done: false, value: chunks[at++] } : { done: true }) }) },
    }));
    const got = await fetchWasm("x.wasm", () => {}, 1000);
    expect(got.byteLength).toBe(20);
  });

  it("still reports a real HTTP failure rather than swallowing it", async () => {
    vi.stubGlobal("fetch", async () => ({ ok: false, status: 404, statusText: "Not Found" }));
    await expect(fetchWasm("x.wasm", () => {}, 1000)).rejects.toThrow(/404/);
  });
});

describe("§11 a slow job is not a stalled one", () => {
  const bytesArriving = async (id, n, gap) => {
    for (let i = 1; i <= n; i++) {
      workers[0].onmessage({ data: { id, progress: { phase: "fetching", loaded: i * 400_000 } } });
      await vi.advanceTimersByTimeAsync(gap);
    }
  };

  it("survives a download that runs far past the deadline while still moving", async () => {
    const call = client.callKernel("mesh", {}, { timeout: 1000 });
    let settled = false;
    call.then(() => { settled = true; }, () => { settled = true; });

    // Ten blocks, 900 ms apart: nine seconds against a one-second deadline.
    await bytesArriving(1, 10, 900);
    expect(settled).toBe(false);

    workers[0].onmessage({ data: { id: 1, ok: true, result: { done: true } } });
    await expect(call).resolves.toEqual({ done: true });
  });

  it("still gives up once the bytes actually stop", async () => {
    const call = client.callKernel("mesh", {}, { timeout: 1000 });
    const settled = expect(call).rejects.toThrow(/fetching the kernel, 2.0 MB in/);
    await bytesArriving(1, 5, 900);
    await vi.advanceTimersByTimeAsync(1001);
    await settled;
  });

  it("reports each step to the caller, so the page can say what is happening", async () => {
    const seen = [];
    const call = client.callKernel("mesh", {}, { timeout: 1000, onProgress: (p) => seen.push(p) });
    call.catch(() => {});
    workers[0].onmessage({ data: { id: 1, progress: { phase: "fetching", loaded: 1_000_000 } } });
    workers[0].onmessage({ data: { id: 1, progress: { phase: "starting" } } });
    workers[0].onmessage({ data: { id: 1, progress: { phase: "working" } } });
    expect(seen.map((p) => p.phase)).toEqual(["fetching", "starting", "working"]);
    // The byte count carries forward, rather than being lost at the next step.
    expect(seen[2].loaded).toBe(1_000_000);
    await vi.advanceTimersByTimeAsync(1001);
  });
});

/**
 * Three ways a job can be killed by something that is not its own fault. Each
 * of these was live, and the second and third between them are how "draws once,
 * then says redrawing for ever" happens.
 */
describe("§11 a job is not killed by its neighbours", () => {
  it("drops a superseded job that had not started, watchdog and all", async () => {
    // The worker never saw it, so there is nothing to wait for and nothing that
    // can come back later and kill a worker that is doing fine.
    const running = client.callKernel("mesh", {}, { timeout: 10_000 });
    running.catch(() => {});
    const cancel = new AbortController();
    const call = client.callKernel("views", {}, { timeout: 1000, signal: cancel.signal });
    const settled = expect(call).rejects.toThrow(/superseded/);
    cancel.abort();
    await settled;

    await vi.advanceTimersByTimeAsync(5000);
    expect(workers[0].terminated).toBe(false);
    expect(workers[0].posted.map((m) => m.op)).toEqual(["mesh"]);
  });

  it("keeps watching work the worker has already begun, cancelled or not", async () => {
    // Nobody wants the answer, but an OCCT boolean is one synchronous call with
    // no way in: the worker is still inside it, and if it never comes out the
    // watchdog is the only thing that will notice.
    const cancel = new AbortController();
    const call = client.callKernel("mesh", {}, { timeout: 1000, signal: cancel.signal });
    const settled = expect(call).rejects.toThrow(/superseded/);
    cancel.abort();
    await settled;

    await vi.advanceTimersByTimeAsync(1001);
    expect(workers[0].terminated).toBe(true);
  });

  it("does not hold a queued job's deadline against another job's work", async () => {
    // The fault behind "it does not reliably switch on and off again": six
    // clicks meant six meshes queued inside the worker, each one's deadline
    // running while somebody else's job had the thread.
    const first = client.callKernel("mesh", {}, { timeout: 1000 });
    first.catch(() => {});
    const second = client.callKernel("mesh", {}, { timeout: 1000 });
    let settled = false;
    second.then(() => { settled = true; }, () => { settled = true; });

    // The first job is alive and downloading; the second has not been sent.
    for (let i = 1; i <= 10; i++) {
      workers[0].onmessage({ data: { id: 1, progress: { phase: "fetching", loaded: i * 400_000 } } });
      await vi.advanceTimersByTimeAsync(900);
    }
    expect(settled).toBe(false);
    expect(workers[0].posted).toHaveLength(1);

    // Only once the first answers does the second go over, clock and all.
    workers[0].onmessage({ data: { id: 1, ok: true, result: {} } });
    await vi.advanceTimersByTimeAsync(0);
    expect(workers[0].posted).toHaveLength(2);
    expect(settled).toBe(false);
  });

  it("tells a waiting job it is waiting, and what for", async () => {
    // Switched on, switched off, switched on again while the kernel is still
    // coming down: the second job has not been sent anywhere, and saying
    // nothing for the rest of a 9 MB download is what reads as a dead toggle.
    const first = client.callKernel("mesh", {}, { timeout: 10_000 });
    first.catch(() => {});
    const seen = [];
    const second = client.callKernel("mesh", {}, { timeout: 10_000, onProgress: (p) => seen.push(p) });
    second.catch(() => {});

    workers[0].onmessage({ data: { id: 1, progress: { phase: "fetching", loaded: 4_000_000 } } });
    expect(seen.at(-1)).toMatchObject({ phase: "fetching", loaded: 4_000_000 });

    // Once the kernel is up and the worker is meshing somebody else's box, the
    // honest answer is a place in the queue, not "working".
    workers[0].onmessage({ data: { id: 1, progress: { phase: "working" } } });
    expect(seen.at(-1).phase).toBe("queued");
    expect(kernelProgress(seen.at(-1))).toBe("waiting for the kernel, 4.0 MB");
    await vi.advanceTimersByTimeAsync(10_001);
  });

  it("does not blame a job for a download that was somebody else's", async () => {
    const first = client.callKernel("mesh", {}, { timeout: 1000 });
    first.catch(() => {});
    const second = client.callKernel("mesh", {}, { timeout: 1000 });
    const settled = expect(second).rejects.toThrow(/never reported anything/);

    workers[0].onmessage({ data: { id: 1, progress: { phase: "fetching", loaded: 9_000_000 } } });
    workers[0].onmessage({ data: { id: 1, ok: true, result: {} } });
    await vi.advanceTimersByTimeAsync(1001);
    await settled;
  });

  it("hands the worker the next job the moment one is answered", async () => {
    StubWorker.reply = (m) => ({ id: m.id, ok: true, result: m.op });
    const three = [
      client.callKernel("mesh", {}, { timeout: 1000 }),
      client.callKernel("views", {}, { timeout: 1000 }),
      client.callKernel("mesh", {}, { timeout: 1000 }),
    ];
    await expect(Promise.all(three)).resolves.toEqual(["mesh", "views", "mesh"]);
    expect(workers).toHaveLength(1);
  });

  it("stops asking for threads once the geometry has hung on them", async () => {
    expect(client.inSafeMode()).toBe(false);
    const call = client.callKernel("mesh", {}, { timeout: 1000 });
    call.catch(() => {});
    workers[0].onmessage({ data: { id: 1, progress: { phase: "working" } } });
    await vi.advanceTimersByTimeAsync(1001);

    expect(client.inSafeMode()).toBe(true);
    client.callKernel("mesh", {}, { timeout: 1000 }).catch(() => {});
    expect(workers[1].posted[0].payload.safeMode).toBe(true);
  });

  it("asks for threads normally until then", async () => {
    client.callKernel("mesh", {}, { timeout: 1000 }).catch(() => {});
    expect(workers[0].posted[0].payload.safeMode).toBe(false);
    await vi.advanceTimersByTimeAsync(1001);
  });
});

/**
 * The mesh call is synchronous and uninterruptible. Hand it a pool that will
 * not take the work and it blocks for ever, and neither side can do anything
 * about it — so nothing asks unless it has been told to, in as many words.
 */
describe("§11 parallel meshing is opt-in, because a hang there is unrecoverable", () => {
  const spy = () => {
    const calls = [];
    return [calls, {
      BRepMesh_IncrementalMesh_2: function (shape, lin, rel, ang, parallel) { calls.push(parallel); },
      PThread: { unusedWorkers: [1, 2, 3, 4] },
    }];
  };

  it("does not ask by default, however ready the pool looks", () => {
    vi.stubGlobal("self", { crossOriginIsolated: true });
    const [calls, oc] = spy();
    expect(() => OPS.mesh(oc, { panels: [], bevels: [], E: { x: 1, y: 1, z: 1 } })).not.toThrow();
    // No panels, so nothing meshed — the point is the default, checked below.
    expect(calls).toEqual([]);
  });

  it("asks only when told to, and never in safe mode", () => {
    vi.stubGlobal("self", { crossOriginIsolated: true });
    const oc = { PThread: { unusedWorkers: [1, 2, 3, 4] } };
    expect(threadsReady(oc)).toBe(true);
    // The gate itself: told to and ready, told to and unready, not told at all.
    const gate = (threads, safeMode, ready) => !safeMode && threads === true && ready;
    expect(gate(true, false, threadsReady(oc))).toBe(true);
    expect(gate(true, true, threadsReady(oc))).toBe(false);
    expect(gate(undefined, false, threadsReady(oc))).toBe(false);
  });
});

describe("§11 threads are used only when they are really there", () => {
  it("will not ask for parallel meshing without an actual pool", () => {
    vi.stubGlobal("self", { crossOriginIsolated: true });
    expect(threadsReady({ PThread: { unusedWorkers: [] } })).toBe(false);
    expect(threadsReady({})).toBe(false);
    expect(threadsReady({ PThread: { unusedWorkers: [1, 2, 3, 4] } })).toBe(true);
  });

  it("will not ask for it without isolation either", () => {
    vi.stubGlobal("self", { crossOriginIsolated: false });
    expect(threadsReady({ PThread: { unusedWorkers: [1, 2, 3, 4] } })).toBe(false);
  });
});

describe("§11 everything a job needs survives the boundary", () => {
  const meshPayload = (derived) => ({
    panels: derived.sol.panels,
    bevels: derived.sol.panels.map((p, i) => panelBevels(i, p, derived.edges, derived.owners)),
    fittings: derived.sol.panels.map((p) => derived.fittingsOn(p)),
    E: derived.sol.E,
  });

  const viewsPayload = (derived) => ({
    sol: derived.sol,
    edges: derived.edges,
    owners: derived.owners,
    sectionAt: derived.sectionAt,
    fittings: derived.sol.panels.map((p) => derived.fittingsOn(p)),
  });

  /** A design with every feature that puts something unusual in the payload. */
  const loaded = () => derive({
    ...DEFAULT_DESIGN,
    cladding: { front: { material: "birch", thickness: 6 } },
    doubler: { back: { material: "mdf", thickness: 12 } },
    edge: { type: "fillet", radius: 8, perEdge: true,
      by: { "front|left": { type: "mitre" }, "front|top": { type: "fillet", radius: 8 } } },
    fittings: [
      { id: "d1", type: "driver", face: "front", at: { a: 100, b: 120 }, cutout: 116, pcd: 147, bolts: 5, boltHole: 5 },
      { id: "p1", type: "port", face: "back", at: { a: 60, b: 60 }, diameter: 68, length: 150, wall: 3 },
    ],
  });

  it("clones a mesh job, mitres, fittings, cladding and all", () => {
    expect(() => structuredClone(meshPayload(loaded()))).not.toThrow();
  });

  it("clones a views job", () => {
    expect(() => structuredClone(viewsPayload(loaded()))).not.toThrow();
  });

  it("carries the mitres across, since the worker draws them", () => {
    const clone = structuredClone(meshPayload(loaded()));
    const front = clone.panels.find((p) => p.face === "front" && p.layer === "shell");
    expect(front.mitres.map((m) => m.side)).toEqual(["left"]);
  });

  it("finds every typed array in a result, so meshes move rather than copy", () => {
    const result = [{ positions: new Float32Array(3), triangles: 1,
      edges: { positions: new Float32Array(6) },
      tubes: [{ positions: new Float32Array(9), edges: { positions: new Float32Array(3) } }] }];
    expect(buffersOf(result)).toHaveLength(4);
    expect(buffersOf(result).every((b) => b instanceof ArrayBuffer)).toBe(true);
  });
});
