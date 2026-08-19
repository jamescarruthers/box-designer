import { describe, it, expect } from "vitest";
import { solve } from "../src/model/solver.js";
import { noEdges, uniformEdges, edgeOwners } from "../src/model/bevel.js";
import { buildCutList, cutListCsv, cutListTotals } from "../src/cutlist/cutlist.js";
import { nest, sheetYield } from "../src/cutlist/nest.js";
import { panelColour, FACE_COLOUR } from "../src/three/palette.js";

const sol = solve({ envelope: { x: 300, y: 240, z: 420 }, thickness: 18, cladding: { front: 6 },
  order: ["front", "back", "left", "right", "top", "bottom"] });
const owners = edgeOwners(sol.env, sol.panels);
const rows = buildCutList(sol, noEdges(), owners, { material: "Birch ply", grainLocked: false });

describe("§5 cut list", () => {
  it("sorts by layer, then by area descending, and numbers after sorting", () => {
    const layerOrder = rows.map((r) => ["cladding", "shell", "doubler"].indexOf(r.layer));
    expect(layerOrder).toEqual([...layerOrder].sort((a, b) => a - b));
    for (let i = 1; i < rows.length; i++)
      if (rows[i].layer === rows[i - 1].layer) expect(rows[i].area).toBeLessThanOrEqual(rows[i - 1].area);
    expect(rows.map((r) => r.id)).toEqual(rows.map((_, i) => `P${String(i + 1).padStart(2, "0")}`));
  });

  it("carries every column the spec asks for", () => {
    for (const r of rows)
      for (const k of ["id", "face", "layer", "length", "width", "thickness", "material", "grain", "edgeWork"])
        expect(r[k] === 0 || Boolean(r[k])).toBe(true);
  });

  it("records edge work as a note, never as a smaller panel", () => {
    const bevelled = buildCutList(sol, uniformEdges("fillet", 10), owners, { material: "Birch ply", grainLocked: false });
    expect(bevelled.map((r) => [r.length, r.width])).toEqual(rows.map((r) => [r.length, r.width]));
    expect(bevelled.some((r) => r.edgeWork.includes("R10"))).toBe(true);
  });

  it("exports CSV with a header and one line per part", () => {
    const lines = cutListCsv(rows).split("\n");
    expect(lines).toHaveLength(rows.length + 1);
    expect(lines[0]).toMatch(/^Part,Face,Layer/);
  });

  it("reports closure as exact", () => {
    const sheets = nest(rows, { stock: [2440, 1220] });
    const t = cutListTotals(rows, sheets, sol.closure);
    expect(t.closure).toBe("exact");
    expect(t.parts).toBe(rows.length);
    expect(t.area).toBeCloseTo(rows.reduce((a, r) => a + r.area, 0) / 1e6, 9);
  });
});

describe("§5 nesting", () => {
  it("never mixes thicknesses on one sheet", () => {
    for (const s of nest(rows, { stock: [2440, 1220] }))
      expect(new Set(s.parts.map((p) => p.row.thickness)).size).toBeLessThanOrEqual(1);
  });

  it("places every part exactly once, inside the sheet", () => {
    const sheets = nest(rows, { stock: [2440, 1220] });
    const placed = sheets.flatMap((s) => s.parts);
    expect(placed).toHaveLength(rows.length);
    expect(new Set(placed.map((p) => p.row.id)).size).toBe(rows.length);
    for (const s of sheets)
      for (const p of s.parts) {
        expect(p.x + p.w).toBeLessThanOrEqual(s.stock[0] + 1e-9);
        expect(p.y + p.h).toBeLessThanOrEqual(s.stock[1] + 1e-9);
      }
  });

  it("leaves a kerf between neighbours on a shelf", () => {
    const kerf = 3.2;
    for (const s of nest(rows, { stock: [2440, 1220], kerf })) {
      const byShelf = new Map();
      for (const p of s.parts) { if (!byShelf.has(p.y)) byShelf.set(p.y, []); byShelf.get(p.y).push(p); }
      for (const list of byShelf.values()) {
        list.sort((a, b) => a.x - b.x);
        for (let i = 1; i < list.length; i++)
          expect(list[i].x - (list[i - 1].x + list[i - 1].w)).toBeGreaterThanOrEqual(kerf - 1e-9);
      }
    }
  });

  it("rotates parts only when the grain is free", () => {
    const locked = nest(rows, { stock: [2440, 1220], grainLocked: true });
    expect(locked.flatMap((s) => s.parts).every((p) => !p.rotated)).toBe(true);
  });

  it("reports a yield between 0 and 1", () => {
    for (const s of nest(rows, { stock: [2440, 1220] })) {
      expect(sheetYield(s)).toBeGreaterThan(0);
      expect(sheetYield(s)).toBeLessThanOrEqual(1);
    }
  });

  it("opens a new sheet only when a part will not fit the current one", () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ id: `X${i}`, length: 1200, width: 600, thickness: 18 }));
    const sheets = nest(many, { stock: [2440, 1220], kerf: 0 });
    expect(sheets.length).toBe(3);      // four 1200 × 600 parts per 2440 × 1220 sheet
  });
});

describe("§4 colour modes", () => {
  it("keeps the face hue and shifts lightness by layer", () => {
    for (const face of Object.keys(FACE_COLOUR)) {
      const shell = panelColour({ face, layer: "shell" });
      expect(shell.toLowerCase()).toBe(FACE_COLOUR[face].toLowerCase());
      expect(panelColour({ face, layer: "cladding" })).not.toBe(shell);
      expect(panelColour({ face, layer: "doubler" })).not.toBe(shell);
    }
  });
});
