import { describe, it, expect } from "vitest";
import { fibreField, boardMaps, boxUV, textureFor, TEXTURED, TILE_MM, TILE_PX, TINT_ONE }
  from "../src/three/texture.js";

describe("§39 the board texture", () => {
  const small = { size: 128, mm: 24, seed: 1234 };

  it("averages exactly one, so the texture varies the colour without shifting it", () => {
    const { v } = fibreField(small);
    const mean = v.reduce((a, b) => a + b, 0) / v.length;
    expect(mean).toBeCloseTo(1, 6);
    // And it is a texture, not a flat field: something actually varies.
    const spread = Math.max(...v) - Math.min(...v);
    expect(spread).toBeGreaterThan(0.15);
    expect(spread).toBeLessThan(1);            // never near black, never blown
  });

  it("is the same texture every time", () => {
    const a = fibreField(small).v, b = fibreField(small).v;
    expect(Array.from(a)).toEqual(Array.from(b));
    // A different seed is a different board off the same press.
    const other = fibreField({ ...small, seed: 99 }).v;
    expect(Array.from(other)).not.toEqual(Array.from(a));
  });

  it("tiles without a seam", () => {
    const { size, v } = fibreField(small);
    // Across the join is no more of a step than anywhere else: a fibre that
    // runs off one edge comes back on the other.
    const step = (x1, x2) => {
      let sum = 0;
      for (let y = 0; y < size; y++) sum += Math.abs(v[y * size + x1] - v[y * size + x2]);
      return sum / size;
    };
    const seam = step(size - 1, 0);
    const inside = [10, 40, 70, 100].map((x) => step(x, x + 1));
    const typical = inside.reduce((a, b) => a + b, 0) / inside.length;
    expect(seam).toBeLessThan(typical * 1.5);
    // Same down the other pair of edges.
    const rowStep = (y1, y2) => {
      let sum = 0;
      for (let x = 0; x < size; x++) sum += Math.abs(v[y1 * size + x] - v[y2 * size + x]);
      return sum / size;
    };
    expect(rowStep(size - 1, 0)).toBeLessThan(typical * 1.5);
  });

  it("packs a tint, a height and a roughness from the one field", () => {
    const { size, tint, bump, rough } = boardMaps(small);
    for (const map of [tint, bump, rough]) expect(map).toHaveLength(size * size * 4);

    // The tint's mean is where 1.0 was encoded, which is the number the render
    // divides the colour back up by. Within half a level, since it is rounded.
    let sum = 0;
    for (let i = 0; i < tint.length; i += 4) sum += tint[i];
    expect(sum / (tint.length / 4)).toBeCloseTo(TINT_ONE, 0);
    // Grey, and opaque: it modulates a colour, it does not tint one.
    for (let i = 0; i < 400; i += 4) {
      expect(tint[i]).toBe(tint[i + 1]);
      expect(tint[i]).toBe(tint[i + 2]);
      expect(tint[i + 3]).toBe(255);
    }

    // Roughness is read from green and metalness from blue, and there is no
    // metal in a sheet of dyed fibreboard.
    for (let i = 0; i < rough.length; i += 4) {
      if (rough[i] !== 0 || rough[i + 2] !== 0) throw new Error("roughness map is not green-only");
    }
    let lo = 255, hi = 0;
    for (let i = 1; i < rough.length; i += 4) { lo = Math.min(lo, rough[i]); hi = Math.max(hi, rough[i]); }
    expect(hi).toBe(255);
    expect(lo).toBeGreaterThan(200);            // 0.86 of the material's own
  });

  it("textures the sheet that needs it and leaves the others alone", () => {
    expect(textureFor("valchromat")).toBeTruthy();
    expect(textureFor("birch")).toBe(null);
    expect(textureFor("mdf")).toBe(null);
    expect(TEXTURED.valchromat.mm).toBe(TILE_MM);
    // A tile that covers a hand's width of board, drawn finely enough that a
    // fibre is a few pixels rather than one.
    expect(TILE_PX / TILE_MM).toBeGreaterThan(4);
  });
});

describe("§39 box mapping", () => {
  // One vertex per face direction, at a known place on the box.
  const positions = new Float32Array([
    200, 40, 90,      // on a face normal to x
    200, 40, 90,      // the same point, on a face normal to y
    200, 40, 90,      // and on one normal to z
  ]);
  const normals = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);

  it("takes the two coordinates that are not the normal's", () => {
    const uv = boxUV(positions, normals, 100);
    const pair = (i) => [uv[i * 2], uv[i * 2 + 1]];
    for (const [i, want] of [[0, [0.9, 0.4]], [1, [2, 0.9]], [2, [2, 0.4]]]) {
      expect(pair(i)[0]).toBeCloseTo(want[0], 6);    // z,y then x,z then x,y
      expect(pair(i)[1]).toBeCloseTo(want[1], 6);
    }
  });

  it("measures in millimetres, so the fibre is one size over the whole box", () => {
    const coarse = boxUV(positions, normals, 200);
    const fine = boxUV(positions, normals, 100);
    for (let i = 0; i < fine.length; i++) expect(coarse[i]).toBeCloseTo(fine[i] / 2, 9);
    // Two panels a long way apart still line up: the mapping is of the box,
    // not of the panel, so a texture does not restart at every joint.
    const far = boxUV(new Float32Array([200, 40, 90 + 100]), new Float32Array([1, 0, 0]), 100);
    expect(far[0]).toBeCloseTo(boxUV(positions, normals, 100)[0] + 1, 9);
  });

  it("gives every vertex a pair", () => {
    const uv = boxUV(positions, normals, TILE_MM);
    expect(uv).toHaveLength((positions.length / 3) * 2);
    expect(Array.from(uv).every(Number.isFinite)).toBe(true);
  });
});
