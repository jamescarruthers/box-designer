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
// A mitre or a bevel is not cut here and cannot be: a blank is a rectangle, and
// the 45° is a saw set over after the parts come off the sheet. §48 marks the
// edge it goes on all the same — a note beside that edge of that blank, which
// is the difference between "P04 has a mitre somewhere" and knowing which way
// round to feed the board.
//
// §45 Rebates *are* cut here, on a layer of their own — a groove is machined
// while the board is still on the sheet, and it is the one operation in the
// file that is not a through cut.
//
// §48 And everything that is cut says what it is: a hole's diameter, whether it
// goes through or stops at a depth, how many there are and on what circle, how
// deep a groove is, and which edge is mitred. All of it on NOTES, which cuts
// nothing — the geometry layers stay geometry, so a CAM seat importing OUTLINE,
// HOLES and REBATE gets paths and not a wall of text to filter out.

import { panelBlank } from "../model/solver.js";
import { blankCircles, cutoutFlare } from "../model/fittings.js";
import { blankNotches } from "../model/rebate.js";
import { blankBevels } from "../model/bevel.js";
import { fmt } from "./cutlist.js";

/**
 * Layers, so the shop can order the work: holes before the profile, or the
 * profile alone with everything else switched off. Colours are AutoCAD indices.
 */
export const LAYERS = [
  { name: "OUTLINE", colour: 7 },     // white — the part profiles
  { name: "HOLES", colour: 1 },       // red — cutouts and bolt holes
  { name: "SHEET", colour: 8 },       // grey — the stock boundary, for reference
  { name: "LABEL", colour: 3 },       // green — text, cuts nothing
  // §45 Its own layer, because it is its own operation: a rebate is cut to a
  // depth with the board still whole, and a machine that runs it at the
  // through-cut depth has made scrap. Cyan, as everywhere else it is drawn.
  { name: "REBATE", colour: 4 },      // cyan — grooves, cut to a depth
  // §48 What each feature is, in words. Nothing on this layer is cut: switch
  // it off and the file is exactly the paths it was before.
  { name: "NOTES", colour: 2 },       // yellow — annotation
];

/**
 * §48 The two escapes R12 has for characters a shop needs and ASCII has not.
 *
 * `%%C` is a diameter sign and `%%D` a degree sign, and every reader of this
 * format since 1985 knows them. The literal characters would be a gamble on the
 * code page the far end happens to open the file in.
 */
export const DIA = "%%C";
export const DEG = "%%D";

/** How big annotation is drawn, in millimetres, at 1:1, and how small it may get. */
export const NOTE_HEIGHT = 6;
export const LEAST_NOTE = 3;

/** How big a part's number is drawn: enough of the board to read across a shop. */
const idHeight = (part) => Math.min(part.w, part.h) * 0.18;

/** Small parts get smaller words, so a note stays on the board it is about. */
const noteHeight = (blank) =>
  Math.max(2.5, Math.min(NOTE_HEIGHT, Math.min(blank.length, blank.width) * 0.09));

/** How far in from the edge an edge mark is drawn. */
const edgeInset = (blank) =>
  Math.max(2, Math.min(10, Math.min(blank.length, blank.width) * 0.08));

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

const line = (layer, [x1, y1], [x2, y2]) => [
  pair(0, "LINE"), pair(8, layer),
  pair(10, n(x1)), pair(20, n(y1)), pair(11, n(x2)), pair(21, n(y2)),
];

const text = (layer, x, y, height, value, rotation = 0) => [
  pair(0, "TEXT"), pair(8, layer), pair(10, n(x)), pair(20, n(y)), pair(40, n(height)),
  pair(1, value),
  // Rotation before the justification pair, which is the order R12 readers
  // expect; 72 = 1 is centred, and a centred TEXT takes its position from 11/21.
  ...(rotation ? [pair(50, n(rotation))] : []),
  pair(72, 1), pair(11, n(x)), pair(21, n(y)),
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

/**
 * §45 Every groove this part carries, placed on the sheet as a closed profile.
 *
 * Turned with the part when the nest laid it on its side, by the same
 * `placeOnSheet` the holes go through — one rule for where a feature ends up,
 * so a rotated part cannot have its holes right and its grooves wrong.
 */
export function partRebates(part, stockWidth, originX = 0) {
  const row = part.row;
  if (!row.panel?.notches?.length) return [];
  return blankNotches(row.panel, panelBlank(row.panel)).map((r) => ({
    depth: r.depth,
    points: [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]]
      .map(([bx, by]) => {
        const [X, Y] = placeOnSheet(part, bx, by, stockWidth);
        return [X + originX, Y];
      }),
  }));
}

/**
 * §48 What a fitting cuts in this panel, in the words a shop needs.
 *
 * One note per operation rather than one per hole: five identical bolt holes
 * are one line of drilling, and five copies of the same sentence around a
 * circle is a drawing nobody reads.
 *
 * "THRU" and a depth are the only two things a hole can be, and which of them
 * this is has already been decided upstream — `row.fittings` are the fittings
 * *as this panel gets them* (§33, §36), so a bolt hole that ran out of depth
 * two layers ago is not here to be described at all, and one that is here
 * carries what is left of its depth.
 */
export function fittingNotes(row) {
  return (row.fittings ?? []).flatMap((f) => {
    if (f.type === "port") return [{ fitting: f, lines: [`${DIA}${fmt(f.diameter)} BORE THRU`] }];
    const lines = [`${DIA}${fmt(f.cutout)} CUTOUT THRU`];
    // §29 The flare is cut in the back of the hole, in the one panel where the
    // cutout comes out into the box. Worth saying: it is a second setting-up on
    // a board that is otherwise finished, and it is cut from the other side.
    const flare = cutoutFlare(f);
    if (flare) {
      lines.push(flare.type === "fillet"
        ? `R${fmt(flare.radius)} FILLET IN BACK OF CUTOUT`
        : `${fmt(flare.radius)} CHAMFER IN BACK OF CUTOUT`);
    }
    if (f.bolts > 0 && f.boltHole > 0) {
      // A depth at or past the board is a through hole however it was typed:
      // §36 hands on the overshoot rather than clamping it, and "20 DEEP" on
      // an 18 mm board is an instruction to drill the bench.
      const deep = Number.isFinite(f.boltDeep) && f.boltDeep > 0 && f.boltDeep < row.thickness - 1e-9
        ? `${fmt(f.boltDeep)} DEEP` : "THRU";
      lines.push(`${f.bolts} x ${DIA}${fmt(f.boltHole)} ${deep} ON ${DIA}${fmt(f.pcd)} PCD`);
    }
    return [{ fitting: f, lines }];
  });
}

/**
 * §48 Every annotation a part carries, placed on the sheet.
 *
 * Notes are always horizontal in the sheet's own frame, whichever way the nest
 * turned the part, because the sheet is read one way up. The exception is a
 * groove, whose depth runs along it the way it would be written on the board.
 *
 * A fitting's notes sit under its holes where there is room and over them where
 * there is not, so a driver near the bottom edge of a board does not write its
 * diameter onto the part below.
 */
export function partNotes(part, stockWidth, originX = 0) {
  const row = part.row;
  const blank = panelBlank(row.panel);
  const h = noteHeight(blank);
  const step = h * 1.45;
  const out = [];
  // The band a note may sit in: inside the board, and clear of the edge marks
  // where there are any — two notes written over each other are one note fewer
  // than none, because neither can be read.
  const guard = Object.keys(row.bevels ?? {}).length ? edgeInset(blank) + h * 2.2 : h * 0.4;
  const top = stockWidth - part.y - guard, bottom = stockWidth - (part.y + part.h) + guard;
  const cx = part.x + part.w / 2 + originX;

  // What the board is, under its number: the one thing somebody at the saw
  // wants that the part outline cannot tell them. Clear of the number itself,
  // which is drawn large and centred by `sheetEntities`.
  const idBase = stockWidth - (part.y + part.h / 2) - idHeight(part) * 0.7 - h;
  out.push({ x: cx, y: idBase, height: h, rotation: 0,
    text: `${fmt(row.length)} x ${fmt(row.width)} x ${fmt(row.thickness)}` });
  if (row.grainLocked) {
    out.push({ x: cx, y: idBase - step, height: h, rotation: 0, text: "GRAIN ALONG LENGTH" });
  }

  if (row.fittings?.length) {
    const circles = blankCircles(row.fittings, row.panel, blank);
    for (const { fitting, lines } of fittingNotes(row)) {
      const mine = circles.filter((c) => c.fitting === fitting);
      if (!mine.length) continue;
      // The first circle is the fitting's own — the cutout or the bore — so it
      // is the centre the rest are set out from.
      const [X, Y] = placeOnSheet(part, mine[0].x, mine[0].y, stockWidth);
      const reach = Math.max(...mine.map((c) => {
        const [cX, cY] = placeOnSheet(part, c.x, c.y, stockWidth);
        return Math.hypot(cX - X, cY - Y) + c.d / 2;
      }));
      // Under the holes or over them, whichever side of the fitting has more
      // clear board. Where the block is taller than the room it closes up and
      // the words get smaller — down to a size somebody can still read, and no
      // further: a note nobody can read is one note fewer than none.
      const under = Y - reach - step - bottom;
      const over = top - (Y + reach + step);
      const down = under >= over;
      const room = Math.max(0, down ? under : over);
      const need = step * (lines.length - 1);
      const tight = need > room;
      const k = tight ? Math.max(LEAST_NOTE / h, room / (need || 1)) : 1;
      const gap = step * k, size = h * k;
      // A block that has to encroach on the edge-mark band moves off the middle
      // of the board, which is where the edge mark writes its own words.
      const x = tight
        ? part.x + originX + part.w * (X - originX - part.x < part.w / 2 ? 0.25 : 0.75)
        : X + originX;
      const start = down ? Y - reach - size * 1.45 : Y + reach + size * 1.45;
      lines.forEach((value, i) => out.push({
        x, height: size, rotation: 0, text: value,
        y: start + (down ? -1 : 1) * gap * (down ? i : lines.length - 1 - i),
      }));
    }
  }

  // §45 The groove's depth, along the groove, as it would be written on the
  // board — an 18 mm groove has no room for the words across it.
  for (const r of partRebates(part, stockWidth, originX)) {
    const xs = r.points.map((p) => p[0]), ys = r.points.map((p) => p[1]);
    const w = Math.max(...xs) - Math.min(...xs), tall = Math.max(...ys) - Math.min(...ys);
    out.push({
      x: (Math.min(...xs) + Math.max(...xs)) / 2,
      y: (Math.min(...ys) + Math.max(...ys)) / 2,
      height: Math.min(h, Math.max(w, tall) * 0.09, Math.min(w, tall) * 0.7),
      rotation: tall > w ? 90 : 0,
      text: `GROOVE ${fmt(r.depth)} DEEP`,
    });
  }
  return out;
}

/**
 * §48 The edge treatments, marked on the edges they belong to.
 *
 * A line just inside the edge and a word beside it, both on NOTES: none of this
 * is cut on the sheet — a mitre is a saw set over after the part comes off, and
 * a fillet is a cutter run round an assembled box. What the file could not say
 * before is *which* edge, and on a blank that has been turned to nest, which
 * edge is not something anybody should have to work out.
 */
export function partEdgeMarks(part, stockWidth, originX = 0) {
  const row = part.row;
  const bevels = row.bevels;
  if (!bevels || !Object.keys(bevels).length) return [];
  const blank = panelBlank(row.panel);
  const h = noteHeight(blank);
  const inset = edgeInset(blank);
  const at = (bx, by) => {
    const [X, Y] = placeOnSheet(part, bx, by, stockWidth);
    return [X + originX, Y];
  };
  // Which way is into the board from each edge, in blank coordinates.
  const inward = { top: [0, 1], bottom: [0, -1], left: [1, 0], right: [-1, 0] };

  return blankBevels(row.panel, bevels, blank).map((b) => {
    const [[x1, y1], [x2, y2]] = b.seg;
    const [ix, iy] = inward[b.side];
    // Pulled in off the edge, and short of both corners so two marks meeting at
    // a corner do not cross.
    const pull = (x, y, endX, endY) => [
      x + ix * inset + Math.sign(endX - x) * inset,
      y + iy * inset + Math.sign(endY - y) * inset,
    ];
    const a = at(...pull(x1, y1, x2, y2));
    const c = at(...pull(x2, y2, x1, y1));
    const mid = at((x1 + x2) / 2 + ix * (inset + h), (y1 + y2) / 2 + iy * (inset + h));
    // Along the mark, and never upside down: a note that reads bottom-to-top is
    // a note the shop turns the drawing round for.
    let angle = (Math.atan2(c[1] - a[1], c[0] - a[0]) * 180) / Math.PI;
    if (angle > 90) angle -= 180;
    if (angle <= -90) angle += 180;
    return { ...b, points: [a, c], at: mid, rotation: angle, height: h, text: bevelText(b) };
  });
}

/** What an edge treatment is called on a cutting file. */
export function bevelText(b) {
  if (b.type === "mitre") return `MITRE 45${DEG} THIS EDGE`;
  if (b.type === "fillet") return `R${fmt(b.radius)} ROUND THIS EDGE`;
  return `${fmt(b.radius)} CHAMFER THIS EDGE`;
}

/** One sheet's entities, offset to `originX`. */
function sheetEntities(sheet, originX) {
  const [SL, SW] = sheet.stock;
  const out = [];
  const shift = (points) => points.map(([x, y]) => [x + originX, y]);

  out.push(polyline("SHEET", shift([[0, 0], [SL, 0], [SL, SW], [0, SW]])));
  // §50 And which colour of it, where the sheet is sold in a range: the caption
  // is what tells somebody which board to put on the bed.
  const colour = sheet.colourNote ? ` ${sheet.colourNote.toUpperCase()}` : "";
  out.push(text("LABEL", originX + SL / 2, SW + 30, 24,
    `SHEET ${sheet.index} — ${sheet.material}${colour} ${sheet.thickness}mm — ${SL} x ${SW}`));

  for (const part of sheet.parts) {
    out.push(polyline("OUTLINE", shift(partOutline(part, SW))));
    for (const h of partHoles(part, SW, originX)) out.push(circle("HOLES", h.x, h.y, h.r));
    for (const r of partRebates(part, SW, originX)) out.push(polyline("REBATE", r.points));
    // §48 The marks first, then the words: the edge marks carry both.
    for (const e of partEdgeMarks(part, SW, originX)) {
      out.push(line("NOTES", e.points[0], e.points[1]));
      out.push(text("NOTES", e.at[0], e.at[1], e.height, e.text, e.rotation));
    }
    for (const t of partNotes(part, SW, originX)) {
      out.push(text("NOTES", t.x, t.y, t.height, t.text, t.rotation));
    }
    const [cx, cy] = [part.x + part.w / 2 + originX, SW - (part.y + part.h / 2)];
    out.push(text("LABEL", cx, cy, idHeight(part), part.row.id));
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
