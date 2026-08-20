// §6.1 the sheet, §6.2 view arrangement, §6.7 dimensioning.

import { buildOrthoView } from "./views.js";
import { PROJECTIONS } from "./hlr.js";
import { fittingGeometry } from "./fittings.js";
import { buildSection, cuttingPlaneOnPlan, HATCH } from "./section.js";
import { buildIsometric } from "./iso.js";
import { EDGES, edgeAxis } from "../model/constants.js";
import { fmt } from "../cutlist/cutlist.js";

export const SHEET = { w: 420, h: 297, margin: 10, filingMargin: 20 };
export const TITLE_BLOCK = { w: 180, h: 40, cols: [0, 90, 140, 180], rows: 20 };

// §6.1 ISO 5455 preferred scales.
export const PREFERRED_SCALES = [10, 5, 2, 1, 0.5, 0.2, 0.1, 0.05, 0.02, 0.01];

export const LW = { visible: 0.7, hidden: 0.45, dim: 0.25, cut: 0.45, frame: 0.7, hatch: 0.16 };
export const TS = { dim: 3.2, label: 2.9, value: 4, key: 2.2, note: 2.4 };
export const HIDDEN_DASH = "3 1.4";
export const CUT_DASH = "12 2 2 2";

export const GAP_H = [22, 40], GAP_V = [22, 46];

const clamp = (v, [lo, hi]) => Math.min(hi, Math.max(lo, v));
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const n2 = (v) => (Math.round(v * 1000) / 1000).toString();

export function frameRect() {
  return {
    x: SHEET.filingMargin, y: SHEET.margin,
    w: SHEET.w - SHEET.filingMargin - SHEET.margin,
    h: SHEET.h - 2 * SHEET.margin,
  };
}

/**
 * §6.1 Pick a real scale: the largest ISO 5455 preferred scale that fits, with
 * the minimum gaps allowed for. Never "to fit" — a fixed scale makes a size
 * change visible instead of hiding it behind a rescale.
 */
export function pickScale(need, avail, scales = PREFERRED_SCALES) {
  const fits = (s) => s * need.w + 2 * GAP_H[0] <= avail.w && s * need.h + GAP_V[0] <= avail.h;
  return scales.find(fits) ?? scales[scales.length - 1];
}

export function scaleLabel(s) {
  if (s === 1) return "1:1";
  return s > 1 ? `${fmt(s)}:1` : `1:${fmt(1 / s)}`;
}

/** §6.2 Columns W, D, D; rows H, D. Centre the block in the frame. */
export function layout(E) {
  const frame = frameRect();
  const avail = { w: frame.w, h: frame.h - TITLE_BLOCK.h };
  const need = { w: E.x + 2 * E.y, h: E.z + E.y };
  const chosen = pickScale(need, avail);

  const cols = [E.x, E.y, E.y].map((d) => d * chosen);
  const rows = [E.z, E.y].map((d) => d * chosen);
  const gapH = clamp((avail.w - cols.reduce((a, b) => a + b, 0)) / 3, GAP_H);
  const gapV = clamp((avail.h - rows.reduce((a, b) => a + b, 0)) / 2, GAP_V);

  const blockW = cols.reduce((a, b) => a + b, 0) + 2 * gapH;
  const blockH = rows.reduce((a, b) => a + b, 0) + gapV;
  const x0 = frame.x + (avail.w - blockW) / 2;
  const y0 = frame.y + (avail.h - blockH) / 2;

  const cx = [x0, x0 + cols[0] + gapH, x0 + cols[0] + gapH + cols[1] + gapH];
  const cy = [y0, y0 + rows[0] + gapV];

  return {
    frame, scale: chosen, gapH, gapV, cols, rows,
    cells: {
      front:   { x: cx[0], y: cy[0], w: cols[0], h: rows[0] },
      end:     { x: cx[1], y: cy[0], w: cols[1], h: rows[0] },
      section: { x: cx[2], y: cy[0], w: cols[2], h: rows[0] },
      plan:    { x: cx[0], y: cy[1], w: cols[0], h: rows[1] },
      iso:     { x: cx[1], y: cy[1], w: cols[1] + gapH + cols[2], h: rows[1] },
    },
    tooLargeForSheet: chosen === PREFERRED_SCALES[PREFERRED_SCALES.length - 1] &&
      (chosen * need.w + 2 * GAP_H[0] > avail.w || chosen * need.h + GAP_V[0] > avail.h),
  };
}

const VIEW_TITLE = {
  front: "FRONT ELEVATION", end: "END VIEW FROM LEFT",
  section: "SECTION A–A", plan: "PLAN FROM ABOVE", iso: "ISOMETRIC",
};

// ---------------------------------------------------------------- primitives

const path = (d, attrs) => `<path d="${d}" ${attrs}/>`;

const strokeAttrs = (visible) => visible
  ? `fill="none" stroke="var(--ink)" stroke-width="${LW.visible}" stroke-linecap="square"`
  : `fill="none" stroke="var(--ink)" stroke-width="${LW.hidden}" stroke-dasharray="${HIDDEN_DASH}" stroke-linecap="butt"`;

/** §10 Circles are cut lines; the bolt circle is a chain line, not a cut. */
function drawFittings(g, place) {
  const out = [];
  for (const c of g.boltCircles ?? []) {
    const p = place(c.at);
    out.push(`<circle cx="${n2(p[0])}" cy="${n2(p[1])}" r="${n2(c.r * place.scale)}" fill="none" ` +
      `stroke="var(--ink-2)" stroke-width="${LW.dim}" stroke-dasharray="${CUT_DASH}"/>`);
  }
  for (const c of g.circles ?? []) {
    const p = place(c.at);
    const attrs = c.visible
      ? `fill="none" stroke="var(--ink)" stroke-width="${LW.visible}"`
      : `fill="none" stroke="var(--ink)" stroke-width="${LW.hidden}" stroke-dasharray="${HIDDEN_DASH}"`;
    out.push(`<circle cx="${n2(p[0])}" cy="${n2(p[1])}" r="${n2(c.r * place.scale)}" ${attrs}/>`);
  }
  return out;
}

function drawGeometry(g, place) {
  const out = [];
  for (const l of g.lines) {
    const a = place(l.a), b = place(l.b);
    out.push(path(`M${n2(a[0])} ${n2(a[1])}L${n2(b[0])} ${n2(b[1])}`, strokeAttrs(l.visible)));
  }
  for (const a of g.arcs) {
    const p1 = place(a.from), p2 = place(a.to);
    const r = a.r * place.scale;
    out.push(path(`M${n2(p1[0])} ${n2(p1[1])}A${n2(r)} ${n2(r)} 0 0 ${a.sweep} ${n2(p2[0])} ${n2(p2[1])}`,
      strokeAttrs(true)));
  }
  return out;
}

function placer(cell, scale) {
  const f = ([h, v]) => [cell.x + h * scale, cell.y + v * scale];
  f.scale = scale;
  return f;
}

function label(cell, text, sub, offset = 7) {
  const x = cell.x + cell.w / 2, y = cell.y + cell.h + offset;
  const main = `<text x="${n2(x)}" y="${n2(y)}" text-anchor="middle" font-size="${TS.label}" letter-spacing="0.35" fill="var(--ink)">${esc(text)}</text>`;
  if (!sub) return main;
  return main + `<text x="${n2(x)}" y="${n2(y + 4)}" text-anchor="middle" font-size="${TS.key}" fill="var(--ink-2)">${esc(sub)}</text>`;
}

// §6.7 Aligned dimensions: 0.8 mm gap, 1.2 mm past the arrow, 1.5 mm arrowheads.
const DIM = { gap: 0.8, over: 1.2, arrow: 1.5 };

function arrowHead(x, y, dx, dy) {
  const L = DIM.arrow, W = L * 0.32;
  const px = -dy, py = dx;
  const p = (a, b) => `${n2(a)},${n2(b)}`;
  return `<polygon points="${p(x, y)} ${p(x + dx * L + px * W, y + dy * L + py * W)} ${p(x + dx * L - px * W, y + dy * L - py * W)}" fill="var(--ink)"/>`;
}

/** A linear dimension between two points, offset perpendicular by `off`. */
function dimension(p1, p2, off, text, { horizontal = true, reference = false } = {}) {
  const out = [];
  const [x1, y1] = p1, [x2, y2] = p2;
  const lx = horizontal ? 0 : off, ly = horizontal ? off : 0;
  const a = [x1 + lx, y1 + ly], b = [x2 + lx, y2 + ly];
  const s = Math.sign(off) || 1;
  const ext = (from, to) => {
    const g = horizontal ? [0, s * DIM.gap] : [s * DIM.gap, 0];
    const o = horizontal ? [0, s * DIM.over] : [s * DIM.over, 0];
    return path(`M${n2(from[0] + g[0])} ${n2(from[1] + g[1])}L${n2(to[0] + o[0])} ${n2(to[1] + o[1])}`,
      `stroke="var(--ink-2)" stroke-width="${LW.dim}" fill="none"`);
  };
  out.push(ext(p1, a), ext(p2, b));
  out.push(path(`M${n2(a[0])} ${n2(a[1])}L${n2(b[0])} ${n2(b[1])}`,
    `stroke="var(--ink-2)" stroke-width="${LW.dim}" fill="none"`));
  const d = horizontal ? [Math.sign(x2 - x1), 0] : [0, Math.sign(y2 - y1)];
  out.push(arrowHead(a[0], a[1], d[0], d[1]), arrowHead(b[0], b[1], -d[0], -d[1]));

  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
  const t = reference ? `(${text})` : text;
  if (horizontal) {
    out.push(`<text x="${n2(mx)}" y="${n2(my - 1.3)}" text-anchor="middle" font-size="${TS.dim}" fill="var(--ink)">${esc(t)}</text>`);
  } else {
    out.push(`<text x="${n2(mx - 1.3)}" y="${n2(my)}" text-anchor="middle" font-size="${TS.dim}" fill="var(--ink)" transform="rotate(-90 ${n2(mx - 1.3)} ${n2(my)})">${esc(t)}</text>`);
  }
  return out.join("");
}

// ---------------------------------------------------------------- the sheet

export function buildSheet(sol, edges, opts = {}) {
  const { title = "SHEET BOX", material = "MDF 18 mm", rev = "A", sheetNo = "1 OF 1" } = opts;
  const cx = opts.sectionAt ?? sol.E.x / 2;
  const L = layout(sol.E);
  const s = L.scale;

  // §11 The seam: anything that produces { view, ext, lines, arcs } can supply
  // the views. The analytic engine does by default; the OCCT path passes its
  // own, and the frame, title block, scale, dimensions and hatching are the
  // same either way.
  const geo = opts.geometry ?? {
    front: buildOrthoView("front", sol, edges),
    end: buildOrthoView("end", sol, edges),
    plan: buildOrthoView("plan", sol, edges),
    section: buildSection(sol, cx),
    iso: buildIsometric(sol),
  };

  // §10 Fittings. The bolt circle is an annotation either way — it is a
  // setting-out circle, not something the router follows. The cut circles are
  // added only when the geometry does not already contain the holes: the
  // analytic engine sees boxes and cannot know about them, while the kernel
  // cuts them for real and its HLR emits them itself.
  const fittings = opts.fittings ?? [];
  const fittingPanels = opts.fittingPanels ?? {};
  for (const key of ["front", "end", "plan"]) {
    geo[key] = withFittings(
      geo[key],
      fittingGeometry(key, fittings, sol.panels, fittingPanels, sol.E),
      opts.holesInGeometry === true,
    );
  }

  const body = [];

  // Frame and filing margin.
  const f = L.frame;
  body.push(`<rect x="${f.x}" y="${f.y}" width="${f.w}" height="${f.h}" fill="none" stroke="var(--ink)" stroke-width="${LW.frame}"/>`);

  // Views.
  for (const key of ["front", "end", "plan", "section"]) {
    const cell = L.cells[key];
    const place = placer(cell, s);
    body.push(`<g data-view="${key}">`);
    if (key === "section") body.push(...hatching(geo.section, place));
    body.push(...drawGeometry(geo[key], place));
    body.push(...drawFittings(geo[key], place));
    // The plan carries the cutting-plane symbol, so its label drops clear of it.
    body.push(label(cell, VIEW_TITLE[key], null, key === "plan" ? 15 : 7));
    body.push(`</g>`);
  }

  // §6.5 The cutting-plane symbol goes on the plan.
  body.push(cuttingPlane(L.cells.plan, s, cuttingPlaneOnPlan(sol, cx)));

  // §6.6 The isometric usually needs its own preferred scale.
  const isoCell = L.cells.iso;
  const isoScale = PREFERRED_SCALES.find((k) =>
    geo.iso.ext.h * k <= isoCell.w - 6 && geo.iso.ext.v * k <= isoCell.h - 6) ?? s;
  const isoOx = isoCell.x + (isoCell.w - geo.iso.ext.h * isoScale) / 2;
  const isoOy = isoCell.y + (isoCell.h - geo.iso.ext.v * isoScale) / 2;
  const isoPlace = ([h, v]) => [isoOx + h * isoScale, isoOy + v * isoScale];
  isoPlace.scale = isoScale;
  body.push(`<g data-view="iso">`, ...drawGeometry(geo.iso, isoPlace),
    label(isoCell, VIEW_TITLE.iso, isoScale === s ? null : `SCALE ${scaleLabel(isoScale)}`), `</g>`);

  // §6.7 Dimensions.
  body.push(`<g data-dims="1">`, ...dimensions(sol, L), `</g>`);

  // Notes and keys.
  body.push(notes(L, edges, sol.panels));

  // Title block.
  body.push(titleBlock(L, { title, material, rev, sheetNo, scale: s }));

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SHEET.w} ${SHEET.h}" width="100%" `,
    `preserveAspectRatio="xMidYMid meet" font-family="ui-monospace, 'DejaVu Sans Mono', monospace" `,
    `style="--ink:#12161c;--ink-2:#4a5561;--paper:#f3f1ea">`,
    defs(),
    `<rect x="0" y="0" width="${SHEET.w}" height="${SHEET.h}" fill="var(--paper)"/>`,
    body.join(""),
    `</svg>`,
  ].join("");

  return { svg, scale: s, isoScale, layout: L, geometry: geo, sectionAt: cx };
}

/** Fold the fitting geometry into a view, so the sheet renders one thing. */
function withFittings(view, f, holesInGeometry) {
  if (holesInGeometry) return { ...view, circles: [], boltCircles: f.boltCircles };
  return { ...view, lines: [...view.lines, ...f.lines], circles: f.circles, boltCircles: f.boltCircles };
}

function defs() {
  const pats = Object.entries(HATCH).map(([, h]) => {
    const p = h.pitch;
    return `<pattern id="${h.id}" patternUnits="userSpaceOnUse" width="${p}" height="${p}" patternTransform="rotate(${h.angle})">` +
      `<line x1="0" y1="0" x2="0" y2="${p}" stroke="var(--ink-2)" stroke-width="${LW.hatch}"/></pattern>`;
  }).join("");
  return `<defs>${pats}</defs>`;
}

function hatching(section, place) {
  return section.hatches.map((h) => {
    const a = place([h.h[0], h.v[0]]), b = place([h.h[1], h.v[1]]);
    return `<rect x="${n2(a[0])}" y="${n2(a[1])}" width="${n2(b[0] - a[0])}" height="${n2(b[1] - a[1])}" fill="url(#${h.hatch.id})"/>`;
  });
}

/** §6.5 Chain line, arrowheads pointing in the direction of sight, letter A at each end. */
function cuttingPlane(cell, s, cp) {
  const x = cell.x + cp.h * s;
  const y0 = cell.y - 6, y1 = cell.y + cp.v1 * s + 6;
  const out = [path(`M${n2(x)} ${n2(y0)}L${n2(x)} ${n2(y1)}`,
    `stroke="var(--ink)" stroke-width="${LW.cut}" stroke-dasharray="${CUT_DASH}" fill="none"`)];
  for (const y of [y0, y1]) {
    out.push(arrowHead(x + 4, y, -1, 0));
    out.push(path(`M${n2(x)} ${n2(y)}L${n2(x + 4)} ${n2(y)}`, `stroke="var(--ink)" stroke-width="${LW.cut}" fill="none"`));
    out.push(`<text x="${n2(x - 2)}" y="${n2(y + (y === y0 ? -1.5 : 3.4))}" text-anchor="end" font-size="${TS.label}" fill="var(--ink)">A</text>`);
  }
  return out.join("");
}

/**
 * §6.7 Where each dimension goes.
 *
 * An internal dimension measures the cavity, so its extension lines come off
 * the cavity's faces — not the envelope's. Anchoring both to the envelope draws
 * the overall width twice and prints a different number on the second one.
 *
 * Shorter dimensions sit nearer the object and the overall outside them, so
 * extension lines never cross a dimension line (ISO 129).
 */
export function planDimensions(sol, L) {
  const { E, cavity, internal } = sol;
  const s = L.scale, c = L.cells;
  const cavFront = PROJECTIONS.front(cavity, E);
  const cavEnd = PROJECTIONS.end(cavity, E);
  const NEAR = 9, FAR = 17;

  const hDim = (cell, [a, b], off, text, reference) => ({
    kind: "h", span: [a, b],
    from: [cell.x + a * s, cell.y], to: [cell.x + b * s, cell.y],
    off, text, reference,
  });
  const vDim = (cell, [a, b], off, text, reference, atRight = false) => ({
    kind: "v", span: [a, b],
    from: [cell.x + (atRight ? cell.w : 0), cell.y + a * s],
    to: [cell.x + (atRight ? cell.w : 0), cell.y + b * s],
    off, text, reference,
  });

  return [
    // Front elevation: internal width and height against the cavity, overall outside.
    hDim(c.front, cavFront.h, -NEAR, fmt(internal.x), true),
    hDim(c.front, [0, E.x], -FAR, fmt(E.x), false),
    vDim(c.front, cavFront.v, -NEAR, fmt(internal.z), true),
    vDim(c.front, [0, E.z], -FAR, fmt(E.z), false),
    // End view: internal and overall depth.
    hDim(c.end, cavEnd.h, -NEAR, fmt(internal.y), true),
    hDim(c.end, [0, E.y], -FAR, fmt(E.y), false),
    // Section: internal height on the right, where the wall build-up is shown.
    vDim(c.section, cavEnd.v, NEAR, fmt(internal.z), true, true),
  ].filter((d) => d.span[1] - d.span[0] > 1e-9);
}

function dimensions(sol, L) {
  return planDimensions(sol, L).map((d) =>
    dimension(d.from, d.to, d.off, d.text, { horizontal: d.kind === "h", reference: d.reference }));
}

const NOTE = "ALL DIMENSIONS IN MILLIMETRES. BRACKETED DIMENSIONS ARE FOR REFERENCE. " +
  "HIDDEN DETAIL DASHED. HATCHING IN SECTION: COARSE = CARCASS, OPPOSED = DOUBLER, FINE = CLADDING.";

/** §6.4 One note when every edge shares a treatment, leadered labels otherwise. */
export function edgeNote(edges) {
  const live = EDGES.map((k) => edges[k]).filter((t) => t && t.type !== "none" && t.radius > 0);
  if (!live.length) return "ALL EXTERNAL EDGES SQUARE.";
  const kinds = new Set(live.map((t) => `${t.type}:${t.radius}`));
  if (live.length === 12 && kinds.size === 1) {
    const t = live[0];
    return `ALL EXTERNAL EDGES ${t.type === "fillet" ? `R${fmt(t.radius)}` : `CHAMFER ${fmt(t.radius)}`}.`;
  }
  return `EDGE TREATMENTS: ${[...kinds].map((k) => {
    const [type, r] = k.split(":");
    return type === "fillet" ? `R${r}` : `CHAMFER ${r}`;
  }).join(", ")} — SEE VIEWS.`;
}

/**
 * §12 Mitred joints, named. A mitre is joinery rather than an edge treatment,
 * so it gets its own line: the edges themselves are square, and the note that
 * says so would otherwise be the only thing a reader saw about the corners.
 */
export function mitreDrawingNote(panels = []) {
  const keys = [...new Set(panels.flatMap((p) => (p.mitres ?? []).map((m) => m.edge)))].sort();
  if (!keys.length) return null;
  if (keys.length === 4 && keys.every((k) => edgeAxis(k) === "z")) {
    return "ALL VERTICAL CORNERS MITRED 45°.";
  }
  return `MITRED 45°: ${keys.map((k) => k.replace("|", "/").toUpperCase()).join(", ")}.`;
}

function notes(L, edges, panels) {
  const f = L.frame;
  const x = f.x + 2, y = f.y + f.h - 3;
  const wrapped = wrap(NOTE, 78);
  const lines = [...wrapped, edgeNote(edges), mitreDrawingNote(panels)].filter(Boolean);
  return lines.map((t, i) =>
    `<text x="${n2(x)}" y="${n2(y - (lines.length - 1 - i) * 3.2)}" font-size="${TS.note}" fill="var(--ink-2)">${esc(t)}</text>`
  ).join("");
}

function wrap(text, cols) {
  const words = text.split(" "), out = [];
  let line = "";
  for (const w of words) {
    if ((line + " " + w).trim().length > cols) { out.push(line.trim()); line = w; }
    else line += ` ${w}`;
  }
  if (line.trim()) out.push(line.trim());
  return out;
}

function titleBlock(L, info) {
  const f = L.frame;
  const x = f.x + f.w - TITLE_BLOCK.w, y = f.y + f.h - TITLE_BLOCK.h;
  const out = [`<rect x="${n2(x)}" y="${n2(y)}" width="${TITLE_BLOCK.w}" height="${TITLE_BLOCK.h}" fill="var(--paper)" stroke="var(--ink)" stroke-width="${LW.frame}"/>`];
  out.push(path(`M${n2(x)} ${n2(y + TITLE_BLOCK.rows)}L${n2(x + TITLE_BLOCK.w)} ${n2(y + TITLE_BLOCK.rows)}`,
    `stroke="var(--ink)" stroke-width="${LW.dim}" fill="none"`));
  for (const c of TITLE_BLOCK.cols.slice(1, -1))
    out.push(path(`M${n2(x + c)} ${n2(y)}L${n2(x + c)} ${n2(y + TITLE_BLOCK.h)}`,
      `stroke="var(--ink)" stroke-width="${LW.dim}" fill="none"`));

  const key = (cx, cy, t) => `<text x="${n2(cx)}" y="${n2(cy)}" font-size="${TS.key}" fill="var(--ink-2)" letter-spacing="0.3">${esc(t)}</text>`;
  const val = (cx, cy, t) => `<text x="${n2(cx)}" y="${n2(cy)}" font-size="${TS.value}" fill="var(--ink)">${esc(t)}</text>`;

  out.push(key(x + 2, y + 5, "TITLE"), val(x + 2, y + 14, info.title));
  out.push(key(x + 92, y + 5, "MATERIAL"), val(x + 92, y + 14, info.material));
  out.push(key(x + 142, y + 5, "REV"), val(x + 142, y + 14, info.rev));
  out.push(key(x + 2, y + 25, "PROJECTION"));
  out.push(firstAngleSymbol(x + 34, y + 30));
  out.push(key(x + 92, y + 25, "SCALE"), val(x + 92, y + 34, scaleLabel(info.scale)));
  out.push(key(x + 142, y + 25, "SHEET"), val(x + 142, y + 34, info.sheetNo));
  return out.join("");
}

/** §6.7 A frustum in elevation, large end on the left, with its end view to the right. */
function firstAngleSymbol(cx, cy) {
  const h = 8, big = h / 2, small = h / 3.2, len = 11;
  const g = [];
  g.push(`<polygon points="${n2(cx)},${n2(cy - big)} ${n2(cx)},${n2(cy + big)} ${n2(cx + len)},${n2(cy + small)} ${n2(cx + len)},${n2(cy - small)}" fill="none" stroke="var(--ink)" stroke-width="${LW.dim}"/>`);
  const ox = cx + len + 8;
  g.push(`<circle cx="${n2(ox)}" cy="${n2(cy)}" r="${n2(big)}" fill="none" stroke="var(--ink)" stroke-width="${LW.dim}"/>`);
  g.push(`<circle cx="${n2(ox)}" cy="${n2(cy)}" r="${n2(small)}" fill="none" stroke="var(--ink)" stroke-width="${LW.dim}"/>`);
  return g.join("");
}
