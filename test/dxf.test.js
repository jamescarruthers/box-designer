/**
 * §14 The sheet layouts as DXF.
 *
 * The file is for a machine and for whoever sets it up, so the tests are about
 * the two things that would waste their day: geometry in the wrong place, and
 * anything in the file that was not meant to be cut.
 */
import { describe, it, expect } from "vitest";
import { DEFAULT_DESIGN, derive } from "../src/ui/design.js";
import { sheetsDxf, placeOnSheet, partHoles, LAYERS, SHEET_GAP } from "../src/cutlist/dxf.js";
import { faceAxes } from "../src/model/fittings.js";

/** Enough of a DXF reader to check one. Pairs in, entities out. */
function readDxf(text) {
  const lines = text.split("\n");
  const pairs = [];
  for (let i = 0; i + 1 < lines.length; i += 2) pairs.push([Number(lines[i]), lines[i + 1]]);

  const out = { header: {}, layers: [], entities: [] };
  let section = null, entity = null;
  for (let i = 0; i < pairs.length; i++) {
    const [code, value] = pairs[i];
    if (code === 0 && value === "SECTION") { section = pairs[i + 1][1]; continue; }
    if (code === 0 && value === "ENDSEC") { section = null; continue; }
    if (section === "HEADER" && code === 9) { out.header[value] = pairs[i + 1][1]; continue; }
    if (section === "TABLES" && code === 0 && value === "LAYER") { out.layers.push(pairs[i + 1][1]); continue; }
    if (section !== "ENTITIES") continue;
    if (code === 0) { entity = { type: value, vertices: [] }; out.entities.push(entity); continue; }
    if (!entity) continue;
    if (entity.type === "VERTEX" && code === 10) entity.x = Number(value);
    else if (entity.type === "VERTEX" && code === 20) entity.y = Number(value);
    else if (code === 8) entity.layer = value;
    else if (code === 10) entity.x = Number(value);
    else if (code === 20) entity.y = Number(value);
    else if (code === 40) entity.r = Number(value);
    else if (code === 1) entity.text = value;
  }
  // Fold each POLYLINE's VERTEX run back into it.
  const folded = [];
  for (const e of out.entities) {
    if (e.type === "VERTEX" && folded.at(-1)?.type === "POLYLINE") folded.at(-1).vertices.push([e.x, e.y]);
    else if (e.type !== "SEQEND") folded.push(e);
  }
  out.entities = folded;
  return out;
}

const driver = { id: "d1", type: "driver", face: "front", at: { a: 108.85, b: 163.35 },
  cutout: 116, pcd: 147, bolts: 5, boltHole: 5 };

const withDriver = () => derive({ ...DEFAULT_DESIGN, fittings: [driver] });
const dxfOf = (d) => readDxf(sheetsDxf(d.sheets));

describe("§14 the file itself", () => {
  it("is R12 in millimetres, which is what everything reads", () => {
    const dxf = dxfOf(withDriver());
    expect(dxf.header.$ACADVER).toBe("AC1009");
    expect(dxf.header.$INSUNITS).toBe("4");
  });

  it("declares every layer it draws on", () => {
    const dxf = dxfOf(withDriver());
    expect(dxf.layers.sort()).toEqual(LAYERS.map((l) => l.name).sort());
    const used = new Set(dxf.entities.map((e) => e.layer));
    for (const layer of used) expect(dxf.layers).toContain(layer);
  });

  it("closes every part outline, because a profile that is not closed is not a profile", () => {
    const dxf = dxfOf(withDriver());
    const outlines = dxf.entities.filter((e) => e.layer === "OUTLINE");
    expect(outlines.length).toBe(withDriver().rows.length);
    for (const o of outlines) {
      expect(o.type).toBe("POLYLINE");
      expect(o.vertices).toHaveLength(4);
    }
  });

  it("draws one outline per part and one boundary per sheet", () => {
    const d = withDriver();
    const dxf = dxfOf(d);
    expect(dxf.entities.filter((e) => e.layer === "SHEET")).toHaveLength(d.sheets.length);
    expect(dxf.entities.filter((e) => e.layer === "OUTLINE")).toHaveLength(
      d.sheets.reduce((a, s) => a + s.parts.length, 0));
  });
});

describe("§14 what is in it is what gets cut", () => {
  it("cuts the driver's bore and every bolt hole", () => {
    const holes = dxfOf(withDriver()).entities.filter((e) => e.type === "CIRCLE");
    expect(holes).toHaveLength(1 + driver.bolts);
    expect(holes.map((h) => h.r * 2).sort((a, b) => b - a))
      .toEqual([driver.cutout, ...Array(driver.bolts).fill(driver.boltHole)]);
  });

  it("cuts a port's bore, and does not draw the tube behind it", () => {
    const d = derive({ ...DEFAULT_DESIGN, fittings: [
      { id: "p1", type: "port", face: "back", at: { a: 108.85, b: 80 }, diameter: 68, length: 150, wall: 3 },
    ] });
    const holes = dxfOf(d).entities.filter((e) => e.type === "CIRCLE");
    expect(holes).toHaveLength(1);
    expect(holes[0].r * 2).toBe(68);
  });

  it("leaves the bolt circle out — it is a setting-out circle, not a path", () => {
    const holes = dxfOf(withDriver()).entities.filter((e) => e.type === "CIRCLE");
    expect(holes.some((h) => Math.abs(h.r * 2 - driver.pcd) < 1e-6)).toBe(false);
  });

  it("puts nothing on the cutting layers but geometry", () => {
    const dxf = dxfOf(withDriver());
    for (const e of dxf.entities.filter((x) => x.layer === "OUTLINE" || x.layer === "HOLES")) {
      expect(e.type === "POLYLINE" || e.type === "CIRCLE").toBe(true);
    }
    for (const e of dxf.entities.filter((x) => x.type === "TEXT")) expect(e.layer).toBe("LABEL");
  });
});

describe("§14 everything lands where it should", () => {
  const boundsOf = (poly) => ({
    x0: Math.min(...poly.vertices.map((v) => v[0])), x1: Math.max(...poly.vertices.map((v) => v[0])),
    y0: Math.min(...poly.vertices.map((v) => v[1])), y1: Math.max(...poly.vertices.map((v) => v[1])),
  });

  it("keeps every part inside its sheet", () => {
    const d = withDriver();
    const dxf = dxfOf(d);
    const sheet = boundsOf(dxf.entities.find((e) => e.layer === "SHEET"));
    for (const o of dxf.entities.filter((e) => e.layer === "OUTLINE")) {
      const b = boundsOf(o);
      expect(b.x0).toBeGreaterThanOrEqual(sheet.x0 - 1e-6);
      expect(b.x1).toBeLessThanOrEqual(sheet.x1 + 1e-6);
      expect(b.y0).toBeGreaterThanOrEqual(sheet.y0 - 1e-6);
      expect(b.y1).toBeLessThanOrEqual(sheet.y1 + 1e-6);
    }
  });

  it("keeps every hole inside the part it belongs to", () => {
    const dxf = dxfOf(withDriver());
    const outlines = dxf.entities.filter((e) => e.layer === "OUTLINE").map(boundsOf);
    for (const h of dxf.entities.filter((e) => e.type === "CIRCLE")) {
      const inside = outlines.some((b) =>
        h.x - h.r >= b.x0 - 1e-6 && h.x + h.r <= b.x1 + 1e-6 &&
        h.y - h.r >= b.y0 - 1e-6 && h.y + h.r <= b.y1 + 1e-6);
      expect(inside, `hole at ${h.x},${h.y} is not inside any part`).toBe(true);
    }
  });

  it("turns a rotated part a true quarter turn, holes and all", () => {
    // The nest may or may not rotate a given part, so this drives the mapping
    // directly: the same blank point, placed both ways, must keep its distances
    // to the four edges of the footprint — permuted, never changed.
    const flat = { x: 0, y: 0, w: 400, h: 200, rotated: false };
    const turned = { x: 0, y: 0, w: 200, h: 400, rotated: true };
    const [bx, by] = [90, 40];                    // a point in blank coordinates
    const SW = 1000;

    const edges = (part, [X, Y]) => {
      const top = SW - part.y, bottom = SW - (part.y + part.h);
      return [X - part.x, part.x + part.w - X, Y - bottom, top - Y].sort((a, b) => a - b);
    };
    expect(edges(turned, placeOnSheet(turned, bx, by, SW)))
      .toEqual(edges(flat, placeOnSheet(flat, bx, by, SW)));
  });

  it("places a rotated part's holes inside it", () => {
    const d = withDriver();
    const row = d.rows.find((r) => r.fittings.length);
    const part = { row, x: 300, y: 120, w: row.width, h: row.length, rotated: true };
    for (const h of partHoles(part, 2440)) {
      expect(h.x).toBeGreaterThan(part.x);
      expect(h.x).toBeLessThan(part.x + part.w);
      expect(h.y).toBeGreaterThan(2440 - (part.y + part.h));
      expect(h.y).toBeLessThan(2440 - part.y);
    }
  });

  it("cuts every part at the size the cut list says", () => {
    // The one thing a CNC file cannot get wrong.
    const d = withDriver();
    const dxf = dxfOf(d);
    const sizes = dxf.entities.filter((e) => e.layer === "OUTLINE").map((o) => {
      const b = boundsOf(o);
      return [b.x1 - b.x0, b.y1 - b.y0].sort((x, y) => x - y).map((v) => Math.round(v * 1000) / 1000);
    });
    const wanted = d.rows.map((r) => [r.length, r.width].sort((x, y) => x - y).map((v) => Math.round(v * 1000) / 1000));
    expect(sizes.sort().map(String)).toEqual(wanted.sort().map(String));
  });

  it("puts the driver where the model puts it, measured from the part's own edges", () => {
    // Cross-checked against the panel box rather than against the same
    // placement function, so this can actually disagree.
    const d = withDriver();
    const dxf = dxfOf(d);
    const row = d.rows.find((r) => r.fittings.length && r.layer === "shell");
    const panel = row.panel;
    const [p, q] = faceAxes("front");
    const wantEdges = [
      driver.at.a - panel.box[p][0], panel.box[p][1] - driver.at.a,
      driver.at.b - panel.box[q][0], panel.box[q][1] - driver.at.b,
    ].sort((a, b) => a - b).map((v) => Math.round(v * 100) / 100);

    const bore = dxf.entities.filter((e) => e.type === "CIRCLE")
      .find((c) => Math.abs(c.r * 2 - driver.cutout) < 1e-6);
    const outline = dxf.entities.filter((e) => e.layer === "OUTLINE").map(boundsOf)
      .find((b) => bore.x > b.x0 && bore.x < b.x1 && bore.y > b.y0 && bore.y < b.y1);
    const gotEdges = [bore.x - outline.x0, outline.x1 - bore.x, bore.y - outline.y0, outline.y1 - bore.y]
      .sort((a, b) => a - b).map((v) => Math.round(v * 100) / 100);

    expect(gotEdges).toEqual(wantEdges);
  });

  it("lays several sheets side by side, clear of each other", () => {
    const d = derive({ ...DEFAULT_DESIGN, start: { ...DEFAULT_DESIGN.start, mode: "volume", litres: 300 } });
    expect(d.sheets.length).toBeGreaterThan(1);
    const sheets = dxfOf(d).entities.filter((e) => e.layer === "SHEET").map(boundsOf);
    for (let i = 1; i < sheets.length; i++) {
      expect(sheets[i].x0 - sheets[i - 1].x1).toBeCloseTo(SHEET_GAP, 6);
    }
  });
});
