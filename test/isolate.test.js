/**
 * Cross-origin isolation has to be settled before the app mounts.
 *
 * The regression: this ran lazily, on the first request for the kernel. On an
 * origin that cannot send COOP/COEP — GitHub Pages — it registered the service
 * worker and reloaded, which threw away the click that asked for the kernel.
 * The engine toggle sprang back to Analytic and it read as a freeze.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const load = async () => {
  vi.resetModules();
  return (await import("../src/occt/isolate.js")).ensureCrossOriginIsolated;
};

const store = () => {
  const map = new Map();
  return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => map.set(k, String(v)), _map: map };
};

let reloaded;
beforeEach(() => {
  reloaded = 0;
  vi.stubGlobal("window", { crossOriginIsolated: false, location: { reload: () => { reloaded++; } } });
  vi.stubGlobal("sessionStorage", store());
  vi.stubGlobal("document", { baseURI: "https://example.github.io/box-designer/" });
  vi.stubGlobal("navigator", {
    serviceWorker: { register: vi.fn(() => Promise.resolve({ update: () => Promise.resolve() })) },
  });
});
afterEach(() => vi.unstubAllGlobals());

const settles = (p, ms = 40) =>
  Promise.race([p.then(() => "settled"), new Promise((r) => setTimeout(() => r("pending"), ms))]);

describe("ensureCrossOriginIsolated", () => {
  it("does nothing where the server already sends the headers", async () => {
    window.crossOriginIsolated = true;
    await expect((await load())()).resolves.toBe(true);
    expect(navigator.serviceWorker.register).not.toHaveBeenCalled();
    expect(reloaded).toBe(0);
  });

  it("registers the worker under the page's own scope, not the origin root", async () => {
    const fn = await load();
    fn();
    await new Promise((r) => setTimeout(r, 10));
    const [url, opts] = navigator.serviceWorker.register.mock.calls[0];
    expect(url).toBe("https://example.github.io/box-designer/coi-serviceworker.js");
    expect(opts.scope).toBe("https://example.github.io/box-designer/");
  });

  it("never settles once it has decided to reload, so no caller mounts a doomed page", async () => {
    // This is the fix. Resolving here let main.jsx render, and let a kernel
    // request proceed, into a document that was about to be replaced.
    expect(await settles((await load())())).toBe("pending");
    expect(reloaded).toBe(1);
  });

  it("reloads once per session and then gives up rather than looping", async () => {
    const fn = await load();
    fn();
    await new Promise((r) => setTimeout(r, 10));
    expect(reloaded).toBe(1);
    // Second call in the same session: the guard is set, so it answers false.
    await expect(fn()).resolves.toBe(false);
    expect(reloaded).toBe(1);
  });

  it("answers false, without reloading, where there is no service worker at all", async () => {
    vi.stubGlobal("navigator", {});
    await expect((await load())()).resolves.toBe(false);
    expect(reloaded).toBe(0);
  });

  it("answers false rather than throwing when registration is refused", async () => {
    vi.stubGlobal("navigator", { serviceWorker: { register: () => Promise.reject(new Error("blocked")) } });
    await expect((await load())()).resolves.toBe(false);
    expect(reloaded).toBe(0);
  });
});

describe("the entry point settles isolation before mounting", () => {
  it("does not render until isolation has answered", async () => {
    vi.unstubAllGlobals();          // this one needs jsdom's real document
    vi.resetModules();
    let settle;
    const gate = new Promise((r) => { settle = r; });
    vi.doMock("../src/occt/isolate.js", () => ({ ensureCrossOriginIsolated: () => gate }));

    const render = vi.fn();
    vi.doMock("react-dom/client", () => ({ createRoot: vi.fn(() => ({ render })) }));
    vi.doMock("../src/ui/App.jsx", () => ({ default: () => null }));
    vi.doMock("../src/styles.css", () => ({}));

    document.body.innerHTML = '<div id="root"></div>';
    await import("../src/main.jsx");
    await new Promise((r) => setTimeout(r, 10));

    // The whole point: nothing is on screen while a reload may still happen.
    expect(render).not.toHaveBeenCalled();

    settle(true);
    await new Promise((r) => setTimeout(r, 10));
    expect(render).toHaveBeenCalledTimes(1);
  });
});

/**
 * A stall must always end somewhere. Before this, a kernel that never
 * instantiated left the status chip on "fetching the kernel" indefinitely.
 */
describe("the kernel loader gives up rather than hanging", () => {
  const loadKernelModule = async (factory, isolate = () => Promise.resolve(true)) => {
    vi.resetModules();
    vi.doMock("../src/occt/isolate.js", () => ({ ensureCrossOriginIsolated: isolate }));
    vi.stubGlobal("document", { baseURI: "https://example.test/app/" });
    const mod = await import("../src/occt/kernel.js");
    return mod;
  };

  it("has a timeout long enough for a slow connection but not unbounded", async () => {
    const { LOAD_TIMEOUT_MS } = await loadKernelModule();
    expect(LOAD_TIMEOUT_MS).toBeGreaterThanOrEqual(30_000);
    expect(LOAD_TIMEOUT_MS).toBeLessThanOrEqual(180_000);
  });

  it("names an allocation failure, rather than passing a bare RangeError through", async () => {
    const { describeFailure } = await loadKernelModule();
    // A shared memory that will not fit surfaces as a RangeError from
    // WebAssembly.Memory, which on its own tells the user nothing.
    const oom = describeFailure(new RangeError("Out of memory: wasm memory"));
    expect(oom.message).toMatch(/could not reserve the memory/);
    expect(oom.message).toContain("Out of memory");

    expect(describeFailure(new Error("cannot allocate 512MB")).message)
      .toMatch(/could not reserve the memory/);
  });

  it("passes an unrelated failure through untouched, so it is not mislabelled", async () => {
    const { describeFailure } = await loadKernelModule();
    const original = new TypeError("factory is not a function");
    expect(describeFailure(original)).toBe(original);
  });
});
