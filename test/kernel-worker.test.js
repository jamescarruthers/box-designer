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
import { buffersOf } from "../src/occt/worker.js";

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
  it("rejects on the deadline instead of waiting for a kernel that has stopped", async () => {
    const call = client.callKernel("mesh", {}, { timeout: 1000 });
    const settled = expect(call).rejects.toThrow(/did not answer within 1 s/);
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
