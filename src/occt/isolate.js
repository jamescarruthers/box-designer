// Register the cross-origin isolation worker, and reload once so the page it
// controls is isolated. A no-op wherever the headers already arrive from the
// server, which is the Vite dev and preview case.

const KEY = "coi-reloaded";

export function ensureCrossOriginIsolated() {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.crossOriginIsolated) return Promise.resolve(true);
  if (!("serviceWorker" in navigator)) return Promise.resolve(false);
  // One reload only: without this a worker that fails to isolate loops forever.
  if (sessionStorage.getItem(KEY)) return Promise.resolve(false);

  const scope = new URL(".", document.baseURI).href;
  return navigator.serviceWorker
    .register(new URL("coi-serviceworker.js", scope).href, { scope })
    .then((reg) => reg.update().then(() => reg))
    .then(() => {
      sessionStorage.setItem(KEY, "1");
      window.location.reload();
      return false;
    })
    .catch(() => false);
}
