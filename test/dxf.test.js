/**
 * §14 The sheet layouts as DXF.
 *
 * The file is for a machine and for whoever sets it up, so the tests are about
 * the two things that would waste their day: geometry in the wrong place, and
 * anything in the file that was not meant to be cut.
 */
import { describe, it, expect } from "vitest";
import { DEFAULT_DESIGN, derive } from "../src/ui/design.js";
import { sheetsDxf, placeOnSheet, partHoles, partRebates, partEdgeMarks, partNotes,
  fittingNotes, bevelText, LAYERS, SHEET_GAP, DIA, DEG } from "../src/cutlist/dxf.js";
import { blankBevels } from "../src/model/bevel.js";
import { blankNotches } from "../src/model/rebate.js";
import { panelBlank } from "../src/model/solver.js";
import { PROMINENCE_PRESETS } from "../src/model/constants.js";
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
    // §48 The rule that lets a shop import the cutting layers and machine them:
    // OUTLINE, HOLES and REBATE are paths and nothing else, and every word in
    // the file is on LABEL or NOTES, neither of which is cut.
    const dxf = dxfOf(withDriver());
    for (const e of dxf.entities.filter((x) => ["OUTLINE", "HOLES", "REBATE"].includes(x.layer))) {
      expect(e.type === "POLYLINE" || e.type === "CIRCLE" || e.type === "VERTEX"
        || e.type === "SEQEND").toBe(true);
    }
    for (const e of dxf.entities.filter((x) => x.type === "TEXT")) {
      expect(["LABEL", "NOTES"]).toContain(e.layer);
    }
    for (const e of dxf.entities.filter((x) => x.type === "LINE")) expect(e.layer).toBe("NOTES");
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

describe("§45 rebates in the file", () => {
  const letIn = () => derive({
    ...DEFAULT_DESIGN, preset: "sides", order: PROMINENCE_PRESETS[1].order,
    rebate: { front: { depth: 6, sides: { left: true, right: true, top: true, bottom: true } } },
  });

  it("puts them on a layer of their own", () => {
    // A groove is not a through cut, and a machine that runs it at the profile
    // depth has made scrap. It goes on a layer the setter can order.
    expect(LAYERS.map((l) => l.name)).toContain("REBATE");
    const dxf = dxfOf(letIn());
    expect(dxf.layers).toContain("REBATE");
    const grooves = dxf.entities.filter((e) => e.layer === "REBATE");
    // Four panels take the baffle: left, right, top and bottom.
    expect(grooves).toHaveLength(4);
    for (const g of grooves) expect(g.type).toBe("POLYLINE");
  });

  it("draws nothing at all when nothing is rebated", () => {
    const plain = readDxf(sheetsDxf(derive(DEFAULT_DESIGN).sheets));
    expect(plain.entities.filter((e) => e.layer === "REBATE")).toHaveLength(0);
    // The layer is still declared, so a template that switches layers on and
    // off does not have one appear from nowhere between one job and the next.
    expect(plain.layers).toContain("REBATE");
  });

  it("keeps a groove inside the part it is cut in, turned or not", () => {
    const d = letIn();
    const row = d.rows.find((r) => r.panel.notches?.length);
    for (const rotated of [false, true]) {
      const part = { row, x: 300, y: 120,
        w: rotated ? row.width : row.length, h: rotated ? row.length : row.width, rotated };
      const cut = partRebates(part, 2440);
      expect(cut).toHaveLength(1);
      expect(cut[0].depth).toBe(6);
      for (const [x, y] of cut[0].points) {
        expect(x).toBeGreaterThanOrEqual(part.x - 1e-9);
        expect(x).toBeLessThanOrEqual(part.x + part.w + 1e-9);
        expect(y).toBeGreaterThanOrEqual(2440 - (part.y + part.h) - 1e-9);
        expect(y).toBeLessThanOrEqual(2440 - part.y + 1e-9);
      }
      // A groove is a rectangle wherever it is put: four corners, two widths.
      const xs = new Set(cut[0].points.map(([x]) => Math.round(x * 1e6)));
      const ys = new Set(cut[0].points.map(([, y]) => Math.round(y * 1e6)));
      expect(xs.size).toBe(2);
      expect(ys.size).toBe(2);
    }
  });

  it("goes through the same placement the holes do", () => {
    // One rule for where a feature lands, so a rotated part cannot come out
    // with its holes right and its grooves wrong.
    const d = letIn();
    const row = d.rows.find((r) => r.panel.notches?.length);
    const part = { row, x: 40, y: 90, w: row.width, h: row.length, rotated: true };
    const blank = blankNotches(row.panel, panelBlank(row.panel))[0];
    const corner = placeOnSheet(part, blank.x, blank.y, 2440);
    expect(partRebates(part, 2440)[0].points).toContainEqual(corner);
  });
});

describe("§48 the edge treatments, marked on the edge they are on", () => {
  const VERTICALS = ["front|left", "back|left", "front|right", "back|right"];
  const mitred = (extra = {}) => derive({ ...DEFAULT_DESIGN,
    edge: { type: "none", radius: 12, perEdge: true,
      by: { ...Object.fromEntries(VERTICALS.map((k) => [k, { type: "mitre", radius: 18 }])), ...extra } } });

  it("puts a treatment on the blank edge it actually falls on", () => {
    // The mapping, on its own: a bevel is named by the face across the corner
    // from it, and a blank has two ends and two long edges. `toBlank` flips the
    // width axis so a template is not mirrored, which puts the *high* end of
    // that axis at the top of the blank — the one thing here worth a test.
    const panel = { face: "front", box: { x: [0, 300], y: [0, 18], z: [0, 200] } };
    const blank = panelBlank(panel);              // 300 along x, 200 across z
    const sides = blankBevels(panel, {
      left: { type: "mitre", radius: 18 },
      right: { type: "chamfer", radius: 6 },
      top: { type: "fillet", radius: 8 },
      bottom: { type: "mitre", radius: 18 },
    }, blank);
    expect(sides.map((s) => `${s.side}:${s.face}`))
      .toEqual(["top:top", "bottom:bottom", "left:left", "right:right"]);
    // Each mark runs along its own edge and nowhere else.
    const seg = (side) => sides.find((s) => s.side === side).seg;
    expect(seg("top")).toEqual([[0, 0], [300, 0]]);
    expect(seg("bottom")).toEqual([[0, 200], [300, 200]]);
    expect(seg("left")).toEqual([[0, 0], [0, 200]]);
    expect(seg("right")).toEqual([[300, 0], [300, 200]]);
  });

  it("marks a mitre on the sheet, inside the part it belongs to", () => {
    const d = mitred();
    const marked = d.rows.filter((r) => Object.keys(r.bevels ?? {}).length);
    expect(marked.length).toBeGreaterThan(0);

    let seen = 0;
    for (const sheet of d.sheets) {
      for (const part of sheet.parts) {
        const marks = partEdgeMarks(part, sheet.stock[1]);
        expect(marks).toHaveLength(Object.keys(part.row.bevels ?? {}).length);
        for (const m of marks) {
          seen++;
          expect(m.text).toBe(`MITRE 45${DEG} THIS EDGE`);
          // The mark and its words are on the board, not beside it.
          for (const [x, y] of [...m.points, m.at]) {
            expect(x).toBeGreaterThanOrEqual(part.x - 1e-6);
            expect(x).toBeLessThanOrEqual(part.x + part.w + 1e-6);
            expect(y).toBeGreaterThanOrEqual(sheet.stock[1] - (part.y + part.h) - 1e-6);
            expect(y).toBeLessThanOrEqual(sheet.stock[1] - part.y + 1e-6);
          }
        }
      }
    }
    expect(seen).toBe(marked.reduce((a, r) => a + Object.keys(r.bevels).length, 0));
  });

  it("turns the mark with the part, the way the holes turn", () => {
    const d = mitred();
    const row = d.rows.find((r) => Object.keys(r.bevels ?? {}).length);
    const marks = (rotated) => partEdgeMarks({ row, x: 60, y: 30,
      w: rotated ? row.width : row.length, h: rotated ? row.length : row.width, rotated }, 2440);
    const flat = marks(false), turned = marks(true);
    expect(turned).toHaveLength(flat.length);
    // A mark that ran across the sheet now runs down it, and the other way
    // round: a quarter turn is a quarter turn.
    for (let i = 0; i < flat.length; i++) {
      const run = (m) => Math.abs(m.points[1][0] - m.points[0][0]);
      const rise = (m) => Math.abs(m.points[1][1] - m.points[0][1]);
      expect(run(turned[i])).toBeCloseTo(rise(flat[i]), 6);
      expect(rise(turned[i])).toBeCloseTo(run(flat[i]), 6);
      expect(Math.abs(turned[i].rotation - flat[i].rotation)).toBeCloseTo(90, 6);
    }
  });

  it("never writes a note upside down", () => {
    const d = mitred();
    for (const sheet of d.sheets) {
      for (const part of sheet.parts) {
        for (const m of partEdgeMarks(part, sheet.stock[1])) {
          expect(m.rotation).toBeGreaterThan(-90.001);
          expect(m.rotation).toBeLessThanOrEqual(90.001);
        }
      }
    }
  });

  it("says which treatment it is, in the words a shop uses", () => {
    expect(bevelText({ type: "mitre", radius: 18 })).toBe(`MITRE 45${DEG} THIS EDGE`);
    expect(bevelText({ type: "fillet", radius: 8 })).toBe("R8 ROUND THIS EDGE");
    expect(bevelText({ type: "chamfer", radius: 6 })).toBe("6 CHAMFER THIS EDGE");
  });

  it("writes the mark into the file, on the layer that cuts nothing", () => {
    const dxf = readDxf(sheetsDxf(mitred().sheets));
    const lines = dxf.entities.filter((e) => e.type === "LINE");
    expect(lines.length).toBeGreaterThan(0);
    for (const l of lines) expect(l.layer).toBe("NOTES");
    expect(dxf.entities.some((e) => e.type === "TEXT" && e.text === `MITRE 45${DEG} THIS EDGE`)).toBe(true);
  });
});

describe("§48 what each hole is", () => {
  const driverAt = (extra = {}) => ({ ...driver, boltDeep: null, ...extra });
  const withFittings = (fittings) => derive({ ...DEFAULT_DESIGN, fittings });
  const notesOf = (d, face = "front") =>
    fittingNotes(d.rows.find((r) => r.face === face && r.layer === "shell")).flatMap((f) => f.lines);

  it("gives a diameter, and says the hole goes through", () => {
    const lines = notesOf(withFittings([driverAt()]));
    expect(lines[0]).toBe(`${DIA}116 CUTOUT THRU`);
    expect(lines).toContain(`5 x ${DIA}5 THRU ON ${DIA}147 PCD`);
  });

  it("gives a blind hole its depth instead", () => {
    // §36 A bolt hole drilled 12 into an 18 mm board is not a through hole, and
    // a file that says THRU has told the shop to drill the bench.
    const lines = notesOf(withFittings([driverAt({ boltDeep: 12 })]));
    expect(lines).toContain(`5 x ${DIA}5 12 DEEP ON ${DIA}147 PCD`);
    expect(lines.join(" ")).not.toMatch(/5 x .*THRU/);
  });

  it("reads a depth at or past the board as through, because that is what it is", () => {
    // §36 hands on the overshoot rather than clamping it: 24 into an 18 mm
    // board is a through hole, and it should read like one.
    const lines = notesOf(withFittings([driverAt({ boltDeep: 24 })]));
    expect(lines).toContain(`5 x ${DIA}5 THRU ON ${DIA}147 PCD`);
  });

  it("names a port's bore and a driver's flare", () => {
    const port = withFittings([{ id: "p1", type: "port", face: "back",
      at: { a: 108.85, b: 80 }, diameter: 68, length: 150, wall: 3 }]);
    expect(notesOf(port, "back")).toEqual([`${DIA}68 BORE THRU`]);

    const flared = withFittings([driverAt({ flare: { type: "fillet", radius: 8 } })]);
    expect(notesOf(flared)).toContain("R8 FILLET IN BACK OF CUTOUT");
  });

  it("says nothing about a hole this panel does not have", () => {
    // §33 A cutout that goes through the baffle and no further leaves the
    // doubler behind it bare — and a note about bolt holes that are not there
    // is worse than no note at all.
    const d = derive({ ...DEFAULT_DESIGN,
      doubler: { front: { material: "birch", thickness: 18 } },
      fittings: [driverAt({ boltsThrough: 1 })] });
    const doubler = d.rows.find((r) => r.face === "front" && r.layer === "doubler");
    const lines = fittingNotes(doubler).flatMap((f) => f.lines);
    expect(lines).toEqual([`${DIA}116 CUTOUT THRU`]);
  });

  it("writes the size of the board under its number, and the groove's depth along it", () => {
    const d = derive({ ...DEFAULT_DESIGN, preset: "sides", order: PROMINENCE_PRESETS[1].order,
      rebate: { front: { depth: 6, sides: { left: true, right: true, top: true, bottom: true } } } });
    const sheet = d.sheets[0];
    const part = sheet.parts.find((p) => p.row.panel.notches?.length);
    const notes = partNotes(part, sheet.stock[1]);
    expect(notes[0].text).toBe(`${fmtOf(part.row.length)} x ${fmtOf(part.row.width)} x ${fmtOf(part.row.thickness)}`);
    const groove = notes.find((t) => /GROOVE/.test(t.text));
    expect(groove.text).toBe("GROOVE 6 DEEP");
    // Along the groove, which for a groove taller than it is wide means turned.
    expect([0, 90]).toContain(groove.rotation);
  });

  it("keeps every note on the sheet it belongs to", () => {
    const d = derive({ ...DEFAULT_DESIGN, fittings: [driverAt({ boltDeep: 12 })] });
    for (const sheet of d.sheets) {
      for (const part of sheet.parts) {
        for (const t of partNotes(part, sheet.stock[1])) {
          expect(t.x).toBeGreaterThanOrEqual(0);
          expect(t.x).toBeLessThanOrEqual(sheet.stock[0]);
          expect(t.y).toBeGreaterThanOrEqual(0);
          expect(t.y).toBeLessThanOrEqual(sheet.stock[1]);
        }
      }
    }
  });
});

/** The cut list's own number formatting, which the notes share. */
const fmtOf = (v) => (Math.abs(v - Math.round(v)) < 1e-9 ? String(Math.round(v)) : v.toFixed(1));
