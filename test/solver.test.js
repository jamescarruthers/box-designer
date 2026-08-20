import { describe, it, expect } from "vitest";
import { FACES, PROMINENCE_PRESETS, rankFromOrder } from "../src/model/constants.js";
import { solve, boxSize, boxVolume, panelBlank, boxesOverlap, deriveEnvelope, wallOf, fillFaces,
  snapTo, ROUND_STEPS, DEFAULT_ROUND, panelThickness } from "../src/model/solver.js";

// A deterministic integer PRNG so failures reproduce.
function lcg(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

const shuffle = (arr, rnd) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

describe("§2.4 invariants", () => {
  // Integer millimetres throughout, so every coordinate and every product of
  // three coordinates is an exact double — closure is exact, not within tolerance.
  it("closes on volume and never overlaps, over 30,000 random cases", () => {
    const rnd = lcg(20250819);
    let cases = 0, populated = 0;
    for (let n = 0; n < 30000; n++) {
      const E = { x: 150 + Math.floor(rnd() * 850), y: 150 + Math.floor(rnd() * 850), z: 150 + Math.floor(rnd() * 850) };
      const pick = (max, chance) => Object.fromEntries(
        FACES.map((f) => [f, rnd() < chance ? 1 + Math.floor(rnd() * max) : 0]));
      const thickness = Object.fromEntries(FACES.map((f) => [f, 1 + Math.floor(rnd() * 24)]));
      const cladding = pick(9, 0.8);
      const doubler = pick(15, 0.8);
      const order = shuffle(FACES, rnd);

      const sol = solve({ envelope: E, thickness, cladding, doubler, order });
      const inner = boxSize(sol.cavity);
      if (inner.x <= 0 || inner.y <= 0 || inner.z <= 0) continue;
      cases++;
      if (sol.panels.length === 18) populated++;

      // 2. Volume closes, exactly.
      expect(sol.closure).toBe(0);

      // 1. No pair of panels overlaps.
      for (let i = 0; i < sol.panels.length; i++)
        for (let j = i + 1; j < sol.panels.length; j++)
          if (boxesOverlap(sol.panels[i].box, sol.panels[j].box))
            throw new Error(`overlap case ${n}: ${sol.panels[i].layer}/${sol.panels[i].face} and ${sol.panels[j].layer}/${sol.panels[j].face}`);

      // ...and none overlaps the cavity.
      for (const p of sol.panels) expect(boxesOverlap(p.box, sol.cavity)).toBe(false);
    }
    expect(cases).toBeGreaterThan(20000);
    expect(populated).toBeGreaterThan(1000);
  });

  it("panels tile the walls: every wall cell is covered exactly once", () => {
    const rnd = lcg(7);
    for (let n = 0; n < 400; n++) {
      const E = { x: 100 + Math.floor(rnd() * 200), y: 100 + Math.floor(rnd() * 200), z: 100 + Math.floor(rnd() * 200) };
      const thickness = Object.fromEntries(FACES.map((f) => [f, 3 + Math.floor(rnd() * 15)]));
      const cladding = Object.fromEntries(FACES.map((f) => [f, rnd() < 0.5 ? 3 + Math.floor(rnd() * 6) : 0]));
      const doubler = Object.fromEntries(FACES.map((f) => [f, rnd() < 0.5 ? 3 + Math.floor(rnd() * 9) : 0]));
      const sol = solve({ envelope: E, thickness, cladding, doubler, order: shuffle(FACES, rnd) });
      const inner = boxSize(sol.cavity);
      if (inner.x <= 0 || inner.y <= 0 || inner.z <= 0) continue;
      // Sample: any point in the envelope is in exactly one panel or in the cavity.
      for (let k = 0; k < 60; k++) {
        const p = { x: rnd() * E.x, y: rnd() * E.y, z: rnd() * E.z };
        const inBox = (b) => ["x", "y", "z"].every((a) => p[a] > b[a][0] && p[a] < b[a][1]);
        const hits = sol.panels.filter((q) => inBox(q.box)).length + (inBox(sol.cavity) ? 1 : 0);
        expect(hits).toBeLessThanOrEqual(1);
      }
    }
  });

  it("internal dimensions depend only on wall thicknesses, never on prominence", () => {
    const rnd = lcg(99);
    for (let n = 0; n < 500; n++) {
      const E = { x: 200 + Math.floor(rnd() * 400), y: 200 + Math.floor(rnd() * 400), z: 200 + Math.floor(rnd() * 400) };
      const thickness = Object.fromEntries(FACES.map((f) => [f, 3 + Math.floor(rnd() * 20)]));
      const cladding = Object.fromEntries(FACES.map((f) => [f, rnd() < 0.5 ? 3 + Math.floor(rnd() * 8) : 0]));
      const doubler = Object.fromEntries(FACES.map((f) => [f, rnd() < 0.5 ? 3 + Math.floor(rnd() * 12) : 0]));
      const ref = boxSize(solve({ envelope: E, thickness, cladding, doubler, order: FACES }).cavity);
      for (let k = 0; k < 6; k++) {
        const got = boxSize(solve({ envelope: E, thickness, cladding, doubler, order: shuffle(FACES, rnd) }).cavity);
        expect(got).toEqual(ref);
      }
    }
  });
});

describe("§2.4 Pluvia 7P Mica fixture", () => {
  const sol = solve({
    envelope: { x: 166, y: 187, z: 344 },
    thickness: 18,
    order: ["front", "left", "right", "bottom", "back", "top"],
  });
  const byFace = Object.fromEntries(sol.panels.map((p) => [p.face, panelBlank(p)]));

  it.each([
    ["front", 344, 166],
    ["left", 344, 169],
    ["right", 344, 169],
    ["back", 326, 130],
    ["bottom", 169, 130],
    ["top", 151, 130],
  ])("%s is %i × %i", (face, length, width) => {
    expect(byFace[face].length).toBe(length);
    expect(byFace[face].width).toBe(width);
  });

  it("cavity is 130 × 151 × 308 = 6.046 l", () => {
    expect(boxSize(sol.cavity)).toEqual({ x: 130, y: 151, z: 308 });
    expect(+(boxVolume(sol.cavity) / 1e6).toFixed(3)).toBe(6.046);
  });

  it("rank 0 is the full-size baffle", () => {
    expect(sol.rank.front).toBe(0);
    expect(byFace.front.length * byFace.front.width).toBe(344 * 166);
  });
});

describe("§2.3 envelope derivation", () => {
  const wall = wallOf(fillFaces(0), fillFaces(18), fillFaces(0));

  it("adds both walls on an internal basis", () => {
    expect(deriveEnvelope({ basis: "internal", mode: "dimensions", size: { x: 130, y: 151, z: 308 } }, wall))
      .toEqual({ x: 166, y: 187, z: 344 });
  });

  it("passes external dimensions through", () => {
    expect(deriveEnvelope({ basis: "external", mode: "dimensions", size: { x: 166, y: 187, z: 344 } }, wall))
      .toEqual({ x: 166, y: 187, z: 344 });
  });

  it("hits the target volume on the default 1 : 1.25 : 1.6 proportion", () => {
    const E = deriveEnvelope({ basis: "internal", mode: "volume", litres: 12 }, wall, false);
    const inner = { x: E.x - 36, y: E.y - 36, z: E.z - 36 };
    expect(inner.x * inner.y * inner.z / 1e6).toBeCloseTo(12, 6);
    expect(inner.y / inner.x).toBeCloseTo(1.25, 9);
    expect(inner.z / inner.x).toBeCloseTo(1.6, 9);
  });

  it("rounds the envelope to 0.1 mm", () => {
    const E = deriveEnvelope({ basis: "internal", mode: "volume", litres: 7 }, wall);
    for (const v of Object.values(E)) expect(Math.round(v * 10)).toBe(v * 10);
  });
});

/**
 * §16 A tenth of a millimetre is a number nobody can cut to and everybody has
 * to read. Rounding is allowed to move the cavity a little; it is not allowed
 * to move the panels relative to each other, which is why it happens once, on
 * the envelope, before anything is measured from it.
 */
describe("§16 rounding the sizes", () => {
  const wall = wallOf(fillFaces(0), fillFaces(18), fillFaces(0));
  const start = { basis: "internal", mode: "volume", litres: 12 };

  it.each(ROUND_STEPS)("lands every axis on a multiple of %s mm", (step) => {
    const E = deriveEnvelope(start, wall, step);
    for (const v of Object.values(E)) expect(snapTo(v, step)).toBe(v);
  });

  it("moves each axis by no more than half a step", () => {
    const exact = deriveEnvelope(start, wall, false);
    for (const step of ROUND_STEPS) {
      const E = deriveEnvelope(start, wall, step);
      for (const b of ["x", "y", "z"]) expect(Math.abs(E[b] - exact[b])).toBeLessThanOrEqual(step / 2 + 1e-9);
    }
  });

  it("does not leave the float dust it set out to remove", () => {
    // Math.round(236.44 / 0.1) * 0.1 is 236.40000000000003, which is a longer
    // number than the one it was shortening.
    expect(snapTo(236.44, 0.1)).toBe(236.4);
    expect(snapTo(0.35, 0.1)).toBe(0.4);
    expect(String(snapTo(217.712, 0.1))).toBe("217.7");
  });

  it("leaves a number alone when there is no step", () => {
    expect(snapTo(217.712059, 0)).toBe(217.712059);
    expect(deriveEnvelope(start, wall, false).x).toBeCloseTo(217.712059, 6);
  });

  it("still reads the older true and false", () => {
    expect(deriveEnvelope(start, wall, true)).toEqual(deriveEnvelope(start, wall, 0.1));
    expect(deriveEnvelope(start, wall, false).x % 0.1).not.toBe(0);
  });

  it("keeps every panel a whole number of millimetres, cladding and all", () => {
    const sol = solve({
      start, round: DEFAULT_ROUND,
      thickness: fillFaces(18), cladding: { front: 6 }, doubler: { back: 12 },
      order: PROMINENCE_PRESETS[0].order,
    });
    for (const p of sol.panels) {
      const { length, width } = panelBlank(p);
      for (const v of [length, width, panelThickness(p)]) expect(Number.isInteger(v)).toBe(true);
    }
  });

  it("still tiles the envelope exactly, at every step", () => {
    for (const step of ROUND_STEPS) {
      const sol = solve({
        start, round: step,
        thickness: fillFaces(18), cladding: { front: 6 }, doubler: { back: 12 },
        order: PROMINENCE_PRESETS[0].order,
      });
      const solid = sol.panels.reduce((a, p) => a + boxVolume(p.box), 0);
      expect(sol.envVolume - (solid + boxVolume(sol.cavity))).toBe(0);
      expect(sol.closureExact).toBe(true);
      for (const [a, b] of sol.panels.flatMap((p, i) => sol.panels.slice(i + 1).map((q) => [p, q]))) {
        expect(boxesOverlap(a.box, b.box)).toBe(false);
      }
    }
  });

  it("pays for it in capacity, and only in capacity", () => {
    const exact = solve({ start, round: false, thickness: fillFaces(18) });
    const rounded = solve({ start, round: 1, thickness: fillFaces(18) });
    const litres = (s) => boxVolume(s.cavity) / 1e6;
    // Under a tenth of a litre on a twelve-litre box: the point of the option.
    expect(Math.abs(litres(rounded) - litres(exact))).toBeLessThan(0.1);
    expect(litres(exact)).toBeCloseTo(12, 6);
  });
});

describe("§2.1 presets", () => {
  it.each(PROMINENCE_PRESETS)("$name is a strict rank over all six faces", (p) => {
    expect(new Set(p.order).size).toBe(6);
    const rank = rankFromOrder(p.order);
    expect(Object.values(rank).sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("reordering prominence changes panel sizes but not internal dimensions", () => {
    const base = { envelope: { x: 300, y: 240, z: 400 }, thickness: 18 };
    const a = solve({ ...base, order: PROMINENCE_PRESETS[0].order });
    const b = solve({ ...base, order: PROMINENCE_PRESETS[1].order });
    expect(boxSize(a.cavity)).toEqual(boxSize(b.cavity));
    const sizes = (s) => s.panels.map((p) => panelBlank(p)).map((k) => `${k.length}x${k.width}`).join();
    expect(sizes(a)).not.toBe(sizes(b));
  });
});
