// §60 Undo, over the whole design.
//
// Every change to the box is one click — a face sent to the back, a doubler
// taken off, a ring of four mitres — and every one of them wrote straight to
// storage. Direct manipulation is only safe with a way back, so the design is
// kept as a history: what it is now, what it was, and what it was before the
// last undo.
//
// Typing is coalesced. A number field fires a change per keystroke, and an
// undo that took "163.5" back to "163." and then to "16" is not an undo
// anybody asked for. A change that lands within `coalesce` ms of the last one
// *and touches the same fields of the design* replaces the present without
// pushing the past — so a burst of keystrokes is one step, and a click that
// changes something else straight after is another.

import { useCallback, useMemo, useState } from "react";

/** How many steps are kept. Plenty for an afternoon; bounded so it is not a leak. */
export const HISTORY_LIMIT = 200;

/** Changes closer together than this, in ms, are one step. */
export const COALESCE_MS = 400;

/** The initial state of a history around `present`. */
export const initialHistory = (present) => ({ past: [], present, future: [], at: 0, keys: "" });

/** The top-level fields that differ between two designs, as one string. */
export function changedKeys(a, b) {
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return "*";
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].filter((k) => a[k] !== b[k]).sort().join(",");
}

/**
 * The next history after `present` changes to `next`.
 *
 * `now` is when it happened; a change within `coalesce` of the previous one
 * that touches the same fields merges into it. A change to the very same
 * object is no change at all.
 */
export function push(h, next, now = Date.now(), coalesce = COALESCE_MS) {
  if (next === h.present) return h;
  const keys = changedKeys(h.present, next);
  const merge = h.past.length > 0 && now - h.at < coalesce && keys === h.keys;
  const past = merge ? h.past : [...h.past, h.present].slice(-HISTORY_LIMIT);
  return { past, present: next, future: [], at: now, keys };
}

export function undo(h) {
  if (!h.past.length) return h;
  return {
    past: h.past.slice(0, -1),
    present: h.past[h.past.length - 1],
    future: [h.present, ...h.future],
    at: 0,
    keys: "",
  };
}

export function redo(h) {
  if (!h.future.length) return h;
  return {
    past: [...h.past, h.present],
    present: h.future[0],
    future: h.future.slice(1),
    at: 0,
    keys: "",
  };
}

/**
 * The design as React state with a past and a future.
 *
 * `set` takes a value or an updater, the way `useState`'s does, so the callers
 * that wrote `setDesign((d) => …)` go on working. `undo` and `redo` are stable.
 */
export function useHistory(initial) {
  const [h, setH] = useState(() => initialHistory(typeof initial === "function" ? initial() : initial));
  // `set(next, { step: true })` is always its own step, however soon it comes:
  // a reset or a file opened is not a keystroke, whatever fields it touches.
  const set = useCallback((next, opts) => setH((cur) =>
    push(cur, typeof next === "function" ? next(cur.present) : next,
      Date.now(), opts?.step ? 0 : COALESCE_MS)), []);
  const back = useCallback(() => setH(undo), []);
  const forward = useCallback(() => setH(redo), []);
  const api = useMemo(() => ({
    undo: back, redo: forward, canUndo: h.past.length > 0, canRedo: h.future.length > 0,
  }), [back, forward, h.past.length, h.future.length]);
  return [h.present, set, api];
}
