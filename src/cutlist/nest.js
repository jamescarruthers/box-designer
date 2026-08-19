// §5 Nesting: shelf packing, first fit decreasing, grouped by material and thickness.

import { DEFAULT_KERF } from "../model/constants.js";

/**
 * Shelf packing. Sort by width descending, place along the current shelf, open
 * a new shelf when it will not fit, open a new sheet when that fails.
 * Kerf is added after each placement. Parts rotate unless the grain is locked.
 *
 * `stockFor(materialId)` gives the sheet size for each group; a single `stock`
 * pair is accepted for the one-material case.
 */
export function nest(rows, { stock, stockFor, kerf = DEFAULT_KERF, grainLocked = false }) {
  const sizeOf = stockFor ?? (() => stock);
  const sheets = [];

  // 6 mm cladding cannot share a sheet with an 18 mm carcass, and 18 mm MDF
  // cannot share one with 18 mm ply either.
  const groups = new Map();
  for (const r of rows) {
    const k = `${r.materialId ?? "default"}|${r.thickness}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }

  const ordered = [...groups.entries()].sort((a, b) =>
    b[1][0].thickness - a[1][0].thickness || String(a[0]).localeCompare(String(b[0])));

  for (const [, group] of ordered) {
    const { materialId, thickness, material } = group[0];
    const [SL, SW] = sizeOf(materialId);
    const queue = [...group].sort((a, b) => b.width - a.width || b.length - a.length);
    const made = [];
    for (const r of queue) {
      // Rows carry their own lock, already allowing for whether the sheet has a grain.
      const options = (r.grainLocked ?? grainLocked)
        ? [[r.length, r.width, false]]
        : [[r.length, r.width, false], [r.width, r.length, true]];
      if (!place(made, r, options, SL, SW, kerf)) {
        made.push({ materialId, material, thickness, stock: [SL, SW], shelves: [], parts: [] });
        if (!place(made, r, options, SL, SW, kerf)) {
          made[made.length - 1].overflow = true;             // larger than the sheet
        }
      }
    }
    sheets.push(...made);
  }

  return sheets.map((s, i) => ({ ...s, index: i + 1, used: usedArea(s), stockArea: s.stock[0] * s.stock[1] }));
}

function place(sheets, r, options, SL, SW, kerf) {
  for (const sheet of sheets) {
    for (const [w, h, rotated] of options) {
      if (w > SL || h > SW) continue;
      for (const shelf of sheet.shelves) {
        if (h <= shelf.height && shelf.cursor + w <= SL) {
          sheet.parts.push({ row: r, x: shelf.cursor, y: shelf.y, w, h, rotated });
          shelf.cursor += w + kerf;
          return true;
        }
      }
      const top = sheet.shelves.length ? sheet.shelves[sheet.shelves.length - 1] : null;
      const y = top ? top.y + top.height + kerf : 0;
      if (y + h <= SW) {
        const shelf = { y, height: h, cursor: 0 };
        sheet.shelves.push(shelf);
        sheet.parts.push({ row: r, x: 0, y, w, h, rotated });
        shelf.cursor = w + kerf;
        return true;
      }
    }
  }
  return false;
}

const usedArea = (s) => s.parts.reduce((a, p) => a + p.w * p.h, 0);

export const sheetYield = (s) => s.used / s.stockArea;
