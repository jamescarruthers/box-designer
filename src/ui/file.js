// §52 The design as a file on disk.
//
// §13 keeps one design in localStorage, which is what stops the tab being shut
// on an afternoon's work. It is not what stops a *browser* being shut on it,
// and it holds one box: there is no way to keep the two cabinets you are
// choosing between, to send one to somebody, or to put one in a repository
// beside the drawings it produced. A file does all four, and it is the same
// design either way — what is written here is what localStorage holds, with a
// name on the front saying what it is.
//
// The file is JSON on purpose. A box is a hundred numbers, a person may want to
// read them, and a format nobody else can open is a format that loses the work
// the first time this app is not to hand.

import { DEFAULT_DESIGN } from "./design.js";
import { mergeDesign } from "./storage.js";

export const FILE_FORMAT = "sheet-box-designer/design";
export const FILE_VERSION = 1;
export const FILE_TYPE = "application/json";
/** What the file picker offers. Not a filter that can hide the file you want. */
export const FILE_ACCEPT = "application/json,.json";

/** A filename that will not need renaming before it can be emailed. */
export const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "box";

export const designFileName = (title) => `${slug(title)}.json`;

/**
 * What gets written. Indented, because the point of JSON is that a person can
 * open it, and one 4 kB line is not something a person can open.
 *
 * The design goes in under a name rather than at the top level so the file can
 * say what it is. A bare design is a JSON object of six-letter keys that could
 * be anything; `format` is the line that tells the next reader — a person, a
 * script, this app in five years — what they are holding.
 */
export const designFileText = (design) =>
  `${JSON.stringify({ format: FILE_FORMAT, version: FILE_VERSION, design }, null, 2)}\n`;

const isPlain = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/**
 * Read a design back out of a file's text.
 *
 * What makes a file openable is not its `format` line — anyone can copy a
 * design out of localStorage, or hand-write one, and refusing those would be
 * refusing a design because of its wrapper. It is whether there is anything in
 * it this app understands. So: unwrap `design` if it is wrapped, keep the keys
 * the defaults have, and refuse only when that leaves nothing at all. That is
 * the same rule §13 reads storage by, and it is what makes an old file open in
 * a new app and a new file open in an old one.
 *
 * Refusals are thrown rather than returned, because there is one place that
 * cares and it has to stop what it was doing. What is *dropped* is returned:
 * a file written by a later version carries fields this one has never heard of,
 * and losing them silently is how somebody opens a design, saves it, and finds
 * the rebates gone.
 */
export function readDesignFile(text) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("That file is not JSON, so there is no design in it to open.");
  }
  const body = isPlain(raw) && isPlain(raw.design) ? raw.design : raw;
  if (!isPlain(body)) {
    throw new Error("That file holds a list, not a design.");
  }
  const keys = Object.keys(body);
  const kept = keys.filter((k) => k in DEFAULT_DESIGN);
  if (!kept.length) {
    throw new Error("Nothing in that file is part of a design this app knows how to open.");
  }
  return {
    design: mergeDesign(DEFAULT_DESIGN, body),
    kept,
    dropped: keys.filter((k) => !(k in DEFAULT_DESIGN)),
    version: isPlain(raw) && typeof raw.version === "number" ? raw.version : null,
  };
}

/** What to say about a file that opened. Nothing, when there is nothing to say. */
export function openedNote(name, { dropped, version }) {
  const parts = [`Opened ${name}.`];
  if (version != null && version > FILE_VERSION) {
    parts.push(`It was written by a later version of this app (${version}).`);
  }
  if (dropped.length) {
    parts.push(`${dropped.length} setting${dropped.length === 1 ? "" : "s"} `
      + `this version does not have ${dropped.length === 1 ? "was" : "were"} dropped: ${dropped.join(", ")}.`);
  }
  return parts.join(" ");
}

/**
 * Hand the browser some text to save. The one way this app writes a file, so
 * the DXF, the CSV, the SVG and the design all leave by the same door.
 */
export function download(text, name, type = "text/plain;charset=utf-8") {
  const blob = new Blob([text], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** The text of a file the user chose, or a rejection saying so in English. */
export function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error(`${file.name} could not be read.`));
    reader.readAsText(file);
  });
}
