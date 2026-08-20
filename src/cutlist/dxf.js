// §14 The sheet layouts as DXF, for whoever is going to cut them.
//
// R12 ASCII, because everything reads it — thirty-year-old CAM seats included —
// and nothing here needs anything newer. Millimetres, 1:1, no scaling anywhere:
// a drawing that arrives at the wrong size is worse than one that does not
// arrive.
//
// What goes in is what gets cut and nothing else. Part outlines, the fitting
// cutouts and bolt holes, the stock boundary, and text. The bolt circle is
// deliberately absent: it is a setting-out circle, not a path, and a file
// handed to a machine should not contain a circle nobody meant to cut. It is
// dimensioned on the A3 drawing instead.
//
// Bevels and mitres are not in here either, and cannot be: a blank is a
// rectangle, and the 45° is a saw set over after the parts come off the sheet.
// The cut list's edge column carries that work.

import { panelBlank } from "../model/solver.js";
import { blankCircles } from "../model/fittings.js";

/**
 * Layers, so the shop can order the work: holes before the profile, or the
 * profile alone with everything else switched off. Colours are AutoCAD indices.
 */
export const LAYERS = [
  { name: "OUTLINE", colour: 7 },     // white — the part profiles
  { name: "HOLES", colour: 1 },       // red — cutouts and bolt holes
  { name: "SHEET", colour: 8 },       // grey — the stock boundary, for reference
  { name: "LABEL", colour: 3 },       // green — text, cuts nothing
];

/** Space between one sheet and the next, so they read as separate sheets. */
export const SHEET_GAP = 120;

const n = (v) => (Math.round(v * 1000) / 1000).toString();
const pair = (code, value) => `${code}\n${value}`;

const circle = (layer, x, y, r) =>
  [pair(0, "CIRCLE"), pair(8, layer), pair(10, n(x)), pair(20, n(y)), pair(40, n(r))];

/** A closed polyline. R12 has no LWPOLYLINE, and a closed profile is the point. */
const polyline = (layer, points) => [
  pair(0, "POLYLINE"), pair(8, layer), pair(66, 1), pair(70, 1),
  ...points.flatMap(([x, y]) => [pair(0, "VERTEX"), pair(8, layer), pair(10, n(x)), pair(20, n(y))]),
  pair(0, "SEQEND"), pair(8, layer),
];

const text = (layer, x, y, height, value) => [
  pair(0, "TEXT"), pair(8, layer), pair(10, n(x)), pair(20, n(y)), pair(40, n(height)),
  pair(1, value), pair(72, 1), pair(11, n(x)), pair(21, n(y)),
];

/**
 * A point in a part's blank coordinates, placed on the sheet.
 *
 * Blank coordinates run x along the length and y **down** from the top edge,
 * which is how `toBlank` gives them and how the templates draw them. The nest
 * places parts in the same top-down frame. DXF is Y-up, so the whole sheet is
 * flipped once at the end rather than every point being reasoned about twice.
 *
 * A rotated part is turned a quarter turn clockwise: the blank's top-left
 * corner goes to the footprint's top-right, and its length runs down the sheet.
 */
export function placeOnSheet(part, bx, by, stockWidth) {
  const { x, y, w, rotated } = part;
  const [dx, dy] = rotated ? [w - by, bx] : [bx, by];
  return [x + dx, stockWidth - (y + dy)];
}

/** The four corners of a placed part, anticlockwise in DXF's Y-up frame. */
const partOutline = (part, stockWidth) => {
  const { x, y, w, h } = part;
  const top = stockWidth - y, bottom = stockWidth - (y + h);
  return [[x, bottom], [x + w, bottom], [x + w, top], [x, top]];
};

/** Every circle this part's fittings cut, placed on the sheet. */
export function partHoles(part, stockWidth, originX = 0) {
  const row = part.row;
  if (!row.fittings?.length) return [];
  const blank = panelBlank(row.panel);
  return blankCircles(row.fittings, row.panel, blank)
    .filter((c) => c.d > 0)
    .map((c) => {
      const [X, Y] = placeOnSheet(part, c.x, c.y, stockWidth);
      return { x: X + originX, y: Y, r: c.d / 2, role: c.role };
    });
}

/** One sheet's entities, offset to `originX`. */
function sheetEntities(sheet, originX) {
  const [SL, SW] = sheet.stock;
  const out = [];
  const shift = (points) => points.map(([x, y]) => [x + originX, y]);

  out.push(polyline("SHEET", shift([[0, 0], [SL, 0], [SL, SW], [0, SW]])));
  out.push(text("LABEL", originX + SL / 2, SW + 30, 24,
    `SHEET ${sheet.index} — ${sheet.material} ${sheet.thickness}mm — ${SL} x ${SW}`));

  for (const part of sheet.parts) {
    out.push(polyline("OUTLINE", shift(partOutline(part, SW))));
    for (const h of partHoles(part, SW, originX)) out.push(circle("HOLES", h.x, h.y, h.r));
    const [cx, cy] = [part.x + part.w / 2 + originX, SW - (part.y + part.h / 2)];
    out.push(text("LABEL", cx, cy, Math.min(part.w, part.h) * 0.18, part.row.id));
  }
  return out;
}

/**
 * The whole nest as one DXF: sheets laid left to right, each with its own
 * boundary and caption.
 *
 * One file rather than one per sheet, because a browser asking three times in a
 * row whether you would like to save a file is its own kind of unhelpful, and a
 * shop opening one file to find three labelled sheets side by side knows
 * exactly what it is looking at.
 */
export function sheetsDxf(sheets, { gap = SHEET_GAP } = {}) {
  const entities = [];
  let originX = 0;
  for (const sheet of sheets) {
    entities.push(...sheetEntities(sheet, originX));
    originX += sheet.stock[0] + gap;
  }

  const width = Math.max(0, originX - gap);
  const height = Math.max(0, ...sheets.map((s) => s.stock[1]));

  return [
    pair(0, "SECTION"), pair(2, "HEADER"),
    pair(9, "$ACADVER"), pair(1, "AC1009"),
    // 4 is millimetres. A CAM package that ignores it still reads 1:1, but the
    // ones that ask are told rather than left to guess.
    pair(9, "$INSUNITS"), pair(70, 4),
    pair(9, "$EXTMIN"), pair(10, 0), pair(20, 0),
    pair(9, "$EXTMAX"), pair(10, n(width)), pair(20, n(height + 60)),
    pair(0, "ENDSEC"),

    pair(0, "SECTION"), pair(2, "TABLES"),
    pair(0, "TABLE"), pair(2, "LAYER"), pair(70, LAYERS.length),
    ...LAYERS.flatMap((l) => [
      pair(0, "LAYER"), pair(2, l.name), pair(70, 0), pair(62, l.colour), pair(6, "CONTINUOUS"),
    ]),
    pair(0, "ENDTAB"), pair(0, "ENDSEC"),

    pair(0, "SECTION"), pair(2, "ENTITIES"),
    ...entities.flat(),
    pair(0, "ENDSEC"),
    pair(0, "EOF"),
  ].join("\n") + "\n";
}
