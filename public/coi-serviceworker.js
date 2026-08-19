// Cross-origin isolation without server headers.
//
// SharedArrayBuffer -- and so the threaded OpenCASCADE build -- needs the page
// to be cross-origin isolated, which normally means COOP and COEP response
// headers. GitHub Pages serves static files and cannot set headers, so this
// worker re-serves every response with them attached.
//
// The Vite dev and preview servers set the headers directly, so this is only
// load-bearing on Pages. It is registered by src/occt/isolate.js.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  const request = event.request;
  // A cache-only request from another origin must be passed through untouched.
  if (request.cache === "only-if-cached" && request.mode !== "same-origin") return;

  event.respondWith(
    fetch(request).then((response) => {
      if (response.status === 0) return response;          // opaque; leave it alone
      const headers = new Headers(response.headers);
      headers.set("Cross-Origin-Embedder-Policy", "require-corp");
      headers.set("Cross-Origin-Opener-Policy", "same-origin");
      headers.set("Cross-Origin-Resource-Policy", "cross-origin");
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }),
  );
});
