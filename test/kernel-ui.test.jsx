/**
 * §11 The engine toggle, from the page's side.
 *
 * Reported from the field: the kernel "is not reliably switching on and off
 * again". Two of the three faults behind that are in the client (a queue that
 * held every job's deadline against the one job the worker was actually doing,
 * and a waiting job that said nothing while it waited); this covers the third,
 * which is that once a job had failed there was no way back to it except
 * knowing to switch the engine off and on again.
 */
import React from "react";
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, act, waitFor } from "@testing-library/react";

vi.mock("three", async (importOriginal) => {
  const actual = await importOriginal();
  const { StubRenderer } = await import("./stub-renderer.js");
  return { ...actual, WebGLRenderer: StubRenderer };
});

// The worker itself is covered in kernel-worker.test.js; here it only has to
// answer, or not, on demand.
const calls = [];
vi.mock("../src/occt/client.js", () => ({
  callKernel: (op, payload, opts) => {
    const job = { op, opts, signal: opts?.signal };
    calls.push(job);
    return new Promise((resolve, reject) => { job.resolve = resolve; job.reject = reject; });
  },
  inSafeMode: () => false,
  pendingJobs: () => calls.length,
  terminateKernel: () => {},
}));

import App from "../src/ui/App.jsx";

beforeAll(() => {
  global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  Element.prototype.setPointerCapture = () => {};
});
beforeEach(() => { localStorage.clear(); calls.length = 0; });
afterEach(cleanup);

const quiet = () => vi.spyOn(console, "error").mockImplementation(() => {});
const kernelOn = () => fireEvent.click(screen.getByRole("button", { name: "OpenCASCADE" }));
const kernelOff = () => fireEvent.click(screen.getByRole("button", { name: "Analytic" }));

// §23 The kernel is the default engine, so mounting the app already asks it for
// a mesh: these start from one job in flight rather than from none.

describe("§11 the engine toggle", () => {
  it("§23 asks the kernel for a mesh as soon as the app opens", async () => {
    render(<App />);
    expect(calls).toHaveLength(1);
    expect(calls[0].op).toBe("mesh");
    // And says so, rather than looking like a page that has not finished.
    expect(screen.getByRole("button", { name: "OpenCASCADE" }).className).toContain("on");
  });

  it("drops the job when the engine is switched off", async () => {
    render(<App />);
    expect(calls).toHaveLength(1);

    kernelOff();
    // Off means off: the answer is no longer wanted, and the client is told so
    // rather than being left to deliver it into a view that has moved on.
    expect(calls[0].signal.aborted).toBe(true);
  });

  it("says it is waiting rather than showing nothing at all", async () => {
    const { container } = render(<App />);
    expect(container.querySelector(".solid-state").textContent).toMatch(/waiting for the kernel/);

    await act(async () => calls[0].opts.onProgress({ phase: "fetching", loaded: 4_000_000 }));
    expect(container.querySelector(".solid-state").textContent).toMatch(/fetching the kernel, 4.0 MB/);
  });

  it("offers a way back when a job fails, and takes it", async () => {
    const hush = quiet();
    const { container } = render(<App />);
    await act(async () => {
      calls[0].reject(new Error("the kernel stopped while working: nothing for 90 s"));
      await Promise.resolve();
    });

    expect(container.querySelector(".solid-state").textContent).toMatch(/nothing for 90 s/);
    const again = screen.getByRole("button", { name: "Try again" });

    fireEvent.click(again);
    await waitFor(() => expect(calls).toHaveLength(2));
    // A retry is a new job, not the old one's ghost.
    expect(calls[1].signal.aborted).toBe(false);
    hush.mockRestore();
  });

  it("switches back on after a failure without needing the design to change", async () => {
    const hush = quiet();
    render(<App />);
    await act(async () => {
      calls[0].reject(new Error("the kernel was restarted after a stall"));
      await Promise.resolve();
    });

    kernelOff();
    kernelOn();
    await waitFor(() => expect(calls).toHaveLength(2));
    hush.mockRestore();
  });

  it("shows the mesh once it lands, and what it cost", async () => {
    const { container } = render(<App />);
    await act(async () => {
      calls[0].opts.onProgress({ phase: "working", isolated: true, threaded: false });
      calls[0].resolve([{ positions: new Float32Array(9), triangles: 4 }]);
      await Promise.resolve();
    });
    expect(container.querySelector(".solid-state").textContent).toMatch(/B-Rep, 4 triangles/);
    expect(container.querySelector(".solid-state").textContent).toMatch(/one thread/);
  });
});
