// §39 Board texture for the rendered view.
//
// Valchromat is dyed all the way through: wood fibres coloured before the board
// is pressed, so what you see is not a printed face but the fibres themselves,
// a few millimetres long, lying every which way. Rendered as a flat colour it
// comes out as plastic — the one material in the list where that is most wrong,
// because the fibre is the reason anybody chooses it.
//
// So the surface is generated rather than photographed: no image to fetch, no
// licence to honour, seamless by construction, and the same every time because
// the numbers come from a seeded generator rather than Math.random.

/** How much board one tile of the texture covers, and how finely it is drawn. */
export const TILE_MM = 96;
export const TILE_PX = 512;

/**
 * Where 1.0 sits in the tint map's 0–255.
 *
 * The map multiplies the material's colour, so a mean below 1 would darken
 * every board by the amount the texture happens to average. Encoding 1.0 at
 * 236 leaves the light side of the fleck somewhere to go and gives the render
 * an exact number to divide the colour back up by.
 */
export const TINT_ONE = 236;

/** Deterministic, so a render is the same render twice. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * §39 The fibre field: a value per pixel, mean 1, that everything else is made
 * from — the tint, the tooth and the sheen all vary together because on a real
 * board they are one thing.
 *
 * Three scales, which is what fibreboard looks like close up:
 *
 *  - a slow mottle over tens of millimetres, from the press
 *  - the fibres themselves, half a millimetre to two and a half, dark more
 *    often than light, lying at any angle
 *  - a fine per-pixel grain, so the flat between fibres is not actually flat
 *
 * Everything wraps: a fibre that runs off the right of the tile comes back on
 * the left, so the tile repeats across a two-metre panel without a seam.
 */
export function fibreField({ size = TILE_PX, mm = TILE_MM, seed = 20250824 } = {}) {
  const rand = rng(seed);
  const v = new Float32Array(size * size).fill(1);
  const px = size / mm;                       // pixels per millimetre
  const at = (x, y) => ((y % size) + size) % size * size + (((x % size) + size) % size);

  // The press mottle. Wrapping cosines rather than value noise: three of them
  // at whole numbers of cycles per tile is already unreadable as a pattern,
  // and it cannot help but tile.
  for (let i = 0; i < 3; i++) {
    const kx = 1 + Math.floor(rand() * 3), ky = 1 + Math.floor(rand() * 3);
    const phase = rand() * Math.PI * 2, amp = 0.004 + rand() * 0.004;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        v[y * size + x] += amp *
          Math.cos((2 * Math.PI * kx * x) / size + phase) *
          Math.cos((2 * Math.PI * ky * y) / size - phase);
      }
    }
  }

  // The fibres. One per twenty pixels of tile: dense enough to read as a mat
  // rather than as scattered hairs, and dense enough that shrinking the tile
  // into the distance averages them into a fine tooth instead of a cloud.
  const fibres = Math.round((size * size) / 20);
  for (let i = 0; i < fibres; i++) {
    const x0 = rand() * size, y0 = rand() * size;
    const angle = rand() * Math.PI * 2;
    const length = (0.5 + rand() * 2) * px;
    // Dark twice as often as light: a fibre catches the light along its length
    // and shadows itself everywhere else.
    const dark = rand() < 0.68;
    const delta = (dark ? -1 : 1) * (0.03 + rand() * 0.08);
    const dx = Math.cos(angle), dy = Math.sin(angle);
    const steps = Math.max(2, Math.round(length));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      // Fade out at both ends, so a fibre tapers instead of stopping dead.
      const fade = Math.sin(Math.PI * t);
      const x = Math.round(x0 + dx * length * (t - 0.5));
      const y = Math.round(y0 + dy * length * (t - 0.5));
      v[at(x, y)] += delta * fade;
      // A half-weight neighbour across the fibre, which is what stops it
      // reading as a one-pixel scratch.
      v[at(x + Math.round(-dy), y + Math.round(dx))] += delta * fade * 0.5;
    }
  }

  for (let i = 0; i < v.length; i++) v[i] += (rand() - 0.5) * 0.04;

  // Mean exactly 1: the texture varies the colour, it does not shift it.
  let sum = 0;
  for (let i = 0; i < v.length; i++) sum += v[i];
  const mean = sum / v.length;
  for (let i = 0; i < v.length; i++) v[i] /= mean;
  return { size, mm, v };
}

const clamp255 = (n) => (n < 0 ? 0 : n > 255 ? 255 : Math.round(n));

/**
 * §39 The three maps a board needs, from one field.
 *
 * `tint` multiplies the colour, `bump` gives the surface its tooth, and
 * `rough` scatters the highlight where the fibre is proud — the same places,
 * because it is the same fibre.
 */
export function boardMaps(options = {}) {
  const { size, mm, v } = fibreField(options);
  const tint = new Uint8Array(size * size * 4);
  const bump = new Uint8Array(size * size * 4);
  const rough = new Uint8Array(size * size * 4);

  let lo = Infinity, hi = -Infinity;
  for (const x of v) { if (x < lo) lo = x; if (x > hi) hi = x; }
  const span = hi - lo || 1;

  for (let i = 0; i < v.length; i++) {
    const t = clamp255(v[i] * TINT_ONE);
    const height = clamp255(((v[i] - lo) / span) * 255);
    // Rougher in the hollows: 0.86–1.0 of whatever roughness the material has.
    const r = clamp255((1 - 0.14 * (1 - (v[i] - lo) / span)) * 255);
    const j = i * 4;
    tint[j] = tint[j + 1] = tint[j + 2] = t; tint[j + 3] = 255;
    bump[j] = bump[j + 1] = bump[j + 2] = height; bump[j + 3] = 255;
    // Roughness is read from green, metalness from blue. Blue stays at zero:
    // there is no metal in a sheet of dyed fibreboard.
    rough[j] = 0; rough[j + 1] = r; rough[j + 2] = 0; rough[j + 3] = 255;
  }
  return { size, mm, tint, bump, rough };
}

/** Which sheets are drawn with a texture, and what it is made of. */
export const TEXTURED = {
  valchromat: { seed: 20250824, mm: TILE_MM, bump: 0.35 },
};

export const textureFor = (materialId) => TEXTURED[materialId] ?? null;

/**
 * §39 Box mapping: give a panel UVs from where it is, not from how it is built.
 *
 * A panel is a prism, and its faces point along the axes, so each vertex takes
 * the two coordinates that are not its normal's biggest. Measured in
 * millimetres and divided by the tile, which is what keeps the fibre the same
 * size on the baffle as on the back — one texture at one scale over the whole
 * box, exactly as it would be if the box were cut from one sheet.
 */
export function boxUV(positions, normals, mm = TILE_MM) {
  const uv = new Float32Array((positions.length / 3) * 2);
  for (let i = 0, j = 0; i < positions.length; i += 3, j += 2) {
    const nx = Math.abs(normals[i]), ny = Math.abs(normals[i + 1]), nz = Math.abs(normals[i + 2]);
    let u, w;
    if (nx >= ny && nx >= nz) { u = positions[i + 2]; w = positions[i + 1]; }
    else if (ny >= nz) { u = positions[i]; w = positions[i + 2]; }
    else { u = positions[i]; w = positions[i + 1]; }
    uv[j] = u / mm;
    uv[j + 1] = w / mm;
  }
  return uv;
}
