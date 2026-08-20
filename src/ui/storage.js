// §13 The design, kept between visits.
//
// One key in localStorage holding the whole design. Not a document store and
// not a project manager: the app has one box open at a time, and the point is
// only that closing the tab does not throw the afternoon away.
//
// The interesting part is reading it back. A design saved last week was written
// by last week's app, and this week's has fields it never heard of — mitres,
// a port's tube flag, a per-face thickness map. Restoring it verbatim leaves
// those undefined and the app reads undefined as false, zero, or a crash. So
// what comes back is merged **over the defaults**, one level into the objects
// that carry per-face entries, and anything unrecognised is dropped.

import { DEFAULT_DESIGN } from "./design.js";

export const STORAGE_KEY = "sheet-box-designer/design/1";

const isPlain = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/**
 * Saved over default, recursively, keeping the default's shape.
 *
 * A key the defaults do not have is not ours and is dropped — that is what
 * keeps a stale save from reintroducing a field the app has since retired.
 * Arrays are taken whole: `fittings` and `order` are lists, not records, and
 * merging them element-wise would be nonsense.
 */
export function mergeDesign(defaults, saved) {
  if (!isPlain(saved)) return defaults;
  const out = { ...defaults };
  for (const [k, v] of Object.entries(saved)) {
    if (!(k in defaults)) {
      // Except the free-form records, whose keys are faces and edges rather
      // than a fixed set: those the user fills in, so anything goes.
      continue;
    }
    out[k] = isPlain(defaults[k]) && isPlain(v) ? mergeRecord(defaults[k], v) : v;
  }
  return out;
}

/**
 * The records keyed by face or edge — `cladding`, `edge.by`, `thicknessBy` —
 * are open: their keys come from the user, not from the defaults. Merge each
 * entry over the default entry where there is one, and keep the rest.
 */
function mergeRecord(defaults, saved) {
  const out = { ...defaults };
  for (const [k, v] of Object.entries(saved)) {
    const d = defaults[k];
    out[k] = isPlain(d) && isPlain(v) ? { ...d, ...v } : v;
  }
  return out;
}

/** The design to open with: what was saved, over the defaults, or the defaults. */
export function loadDesign(store = safeStorage()) {
  try {
    const raw = store?.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_DESIGN;
    return mergeDesign(DEFAULT_DESIGN, JSON.parse(raw));
  } catch (e) {
    // A corrupt or unreadable save must never stop the app opening. It is one
    // box, and the defaults are a perfectly good one.
    console.warn("Could not read the saved design; starting from the defaults.", e);
    return DEFAULT_DESIGN;
  }
}

export function saveDesign(design, store = safeStorage()) {
  try {
    store?.setItem(STORAGE_KEY, JSON.stringify(design));
    return true;
  } catch (e) {
    // Private browsing, a full quota, storage turned off. Losing the save is a
    // disappointment; losing the edit that triggered it would not be.
    console.warn("Could not save the design.", e);
    return false;
  }
}

export function forgetDesign(store = safeStorage()) {
  try { store?.removeItem(STORAGE_KEY); } catch { /* nothing to do about it */ }
}

/** localStorage, or nothing — reading it throws outright in some settings. */
export function safeStorage() {
  try { return typeof localStorage === "undefined" ? null : localStorage; } catch { return null; }
}
