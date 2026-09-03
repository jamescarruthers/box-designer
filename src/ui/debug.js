// §60 The developer's view of the app.
//
// Which engine drew the box, how many triangles it came to, how long it took
// and on how many threads are answers to questions a developer asks. Nobody
// designing a box asks them, and every one of them was on the screen. They are
// still there — behind `?debug` on the URL — for the one person who wants them.

/** Whether the page was opened with `?debug` (or `&debug`) in its query. */
export function isDebug(search = typeof location === "undefined" ? "" : location.search) {
  return /[?&]debug(?:=[^&]*)?(?:&|$)/.test(search);
}
