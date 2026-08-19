// §5 Nesting: shelf packing, first fit decreasing, grouped by thickness.

import { DEFAULT_KERF } from "../model/constants.js";

/**
 * Shelf packing. Sort by width descending, place along the current shelf, open
 * a new shelf when it will not fit, open a new sheet when that fails.
 * Kerf is added after each placement. Parts rotate unless grain is locked.
 */
export function nest(rows, { stock, kerf = DEFAULT_KERF, grainLocked = false }) {
  const [SL, SW] = stock;
  const sheets = [];

  // Group by thickness — 6 mm cladding cannot share a sheet with an 18 mm carcass.
  const groups = new Map();
  for (const r of rows) {
    const k = r.thickness;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }

  for (const [thickness, group] of [...groups.entries()].sort((a, b) => b[0] - a[0])) {
    const queue = [...group].sort((a, b) => b.width - a.width || b.length - a.length);
    const made = [];
    for (const r of queue) {
      const options = grainLocked
        ? [[r.length, r.width, false]]
        : [[r.length, r.width, false], [r.width, r.length, true]];
      if (!place(made, r, options, SL, SW, kerf, thickness)) {
        made.push({ index: sheets.length + made.length + 1, thickness, stock, shelves: [], parts: [] });
        if (!place(made, r, options, SL, SW, kerf, thickness)) {
          made[made.length - 1].overflow = true;             // larger than the sheet
        }
      }
    }
    sheets.push(...made);
  }

  return sheets.map((s, i) => ({ ...s, index: i + 1, used: usedArea(s), stockArea: s.stock[0] * s.stock[1] }));
}

function place(sheets, r, options, SL, SW, kerf, thickness) {
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
