// §1 Coordinate system and naming.
// x = width (left/right), y = depth (front/back), z = height (bottom/top).
// All lengths in millimetres. Boxes are { x:[lo,hi], y:[lo,hi], z:[lo,hi] }
// in envelope coordinates, origin at the front-left-bottom corner.

export const FACES = ["front", "back", "left", "right", "top", "bottom"];

export const AXIS = {
  left: ["x", -1], right: ["x", 1],
  front: ["y", -1], back: ["y", 1],
  bottom: ["z", -1], top: ["z", 1],
};

export const PAIR = { x: ["left", "right"], y: ["front", "back"], z: ["bottom", "top"] };

export const AXES = ["x", "y", "z"];

export const AXIS_LABEL = { x: "width", y: "depth", z: "height" };

const faceIndex = Object.fromEntries(FACES.map((f, i) => [f, i]));

export function edgeKey(a, b) {
  return faceIndex[a] < faceIndex[b] ? `${a}|${b}` : `${b}|${a}`;
}

// The twelve edges: each pair of distinct axes, each combination of their faces.
export const EDGES = (() => {
  const out = [];
  for (let i = 0; i < AXES.length; i++) {
    for (let j = i + 1; j < AXES.length; j++) {
      const [a, b] = [AXES[i], AXES[j]];
      for (const fa of PAIR[a]) for (const fb of PAIR[b]) out.push(edgeKey(fa, fb));
    }
  }
  return out;
})();

// The axis an edge runs along: the one neither of its faces is normal to.
export function edgeAxis(key) {
  const [a, b] = key.split("|");
  return AXES.find((ax) => ax !== AXIS[a][0] && ax !== AXIS[b][0]);
}

/** The four edges a face is one side of. */
export const edgesOfFace = (face) => EDGES.filter((k) => k.split("|").includes(face));

/** The other face along an edge, from the point of view of one of them. */
export const otherFace = (key, face) => key.split("|").find((f) => f !== face);

export const LAYERS = ["cladding", "shell", "doubler", "lagging"];

/** What each layer is called where a person reads it. */
export const LAYER_LABEL = {
  cladding: "Cladding", shell: "Carcass", doubler: "Doubler", lagging: "Lagging",
};

// §2.1 Prominence presets. Rank 0 is most prominent.
export const PROMINENCE_PRESETS = [
  { id: "fb", name: "Front & back wrap", order: ["front", "back", "left", "right", "top", "bottom"] },
  { id: "sides", name: "Sides wrap", order: ["left", "right", "top", "bottom", "front", "back"] },
  { id: "tb", name: "Top & bottom wrap", order: ["top", "bottom", "front", "back", "left", "right"] },
  { id: "baffle", name: "Baffle wraps sides", order: ["front", "left", "right", "bottom", "back", "top"] },
  { id: "plinth", name: "Plinth & lid", order: ["bottom", "top", "left", "right", "front", "back"] },
];

export function rankFromOrder(order) {
  const rank = {};
  order.forEach((f, i) => { rank[f] = i; });
  return rank;
}

export function orderFromRank(rank) {
  return [...FACES].sort((a, b) => rank[a] - rank[b]);
}

export const FACE_LABEL = {
  front: "Front", back: "Back", left: "Left",
  right: "Right", top: "Top", bottom: "Bottom",
};

// §5 Stock sizes, with the thicknesses each material is normally sold in.
// `thickness` is the standard a new panel of this material starts at.
export const MATERIALS = [
  { id: "mdf", name: "MDF", colour: "#b08a63", grained: false,
    stock: [[2440, 1220], [3050, 1220]],
    thickness: 18, thicknesses: [3, 6, 9, 12, 15, 18, 22, 25, 30] },
  { id: "birch", name: "Birch ply", colour: "#e0c48c", grained: true,
    stock: [[2440, 1220], [1525, 1525]],
    thickness: 18, thicknesses: [4, 6, 9, 12, 15, 18, 24, 30] },
  { id: "oakply", name: "Oak-faced ply", colour: "#c69a5e", grained: true,
    stock: [[2440, 1220]],
    thickness: 18, thicknesses: [6, 9, 12, 15, 18, 22, 25] },
  { id: "pine", name: "Pine", colour: "#d9b485", grained: true,
    stock: [[2440, 1220]],
    thickness: 18, thicknesses: [12, 15, 18, 20, 22, 25] },
  // Valchromat is 19 mm as standard, not 18, and it is the one sheet here that
  // comes in a colour range rather than a colour.
  { id: "valchromat", name: "Valchromat", colour: "#7c7679", grained: false,
    stock: [[2440, 1220]],
    thickness: 19, thicknesses: [8, 12, 16, 19, 25, 30],
    palette: "valchromat" },
];

/**
 * §30 What a box is lined with.
 *
 * Kept apart from the sheets rather than added to them. A carcass cannot be cut
 * from felt, and a dropdown that offers it alongside birch invites exactly that
 * mistake — so the sheet list stays the sheet list and this one is offered only
 * where a lining is being chosen. Everything else about them matches: an id, a
 * colour, the thicknesses they come in, and a stock size to lay parts out on,
 * which for these is a roll's width and a length off it.
 */
export const LAGGINGS = [
  { id: "felt", name: "Acoustic felt", colour: "#5c5852", grained: false, lagging: true,
    stock: [[5000, 1000], [2000, 1000]],
    thickness: 10, thicknesses: [6, 10, 12, 16, 20, 25] },
  { id: "wadding", name: "Polyester wadding", colour: "#d5d2c8", grained: false, lagging: true,
    stock: [[5000, 1500]],
    thickness: 25, thicknesses: [12, 20, 25, 40, 50] },
  { id: "bitumen", name: "Bitumen pad", colour: "#2e2b28", grained: false, lagging: true,
    stock: [[1000, 500], [500, 250]],
    thickness: 4, thicknesses: [2, 3, 4, 6] },
  { id: "wool", name: "Long-fibre wool", colour: "#c9bfa8", grained: false, lagging: true,
    stock: [[3000, 1000]],
    thickness: 25, thicknesses: [15, 25, 30, 50] },
];

export const isLagging = (id) => LAGGINGS.some((m) => m.id === id);

/**
 * §18 Valchromat's twelve colours.
 *
 * Dyed through rather than faced, which is the whole point of the board and the
 * reason a colour belongs to the panel rather than to a finish applied to it
 * afterwards.
 *
 * Each hex is the **median of a supplier's swatch photograph**, sampled over the
 * middle half of the frame (`tools/spike/sample-swatches.mjs`). That means it is
 * the board as photographed in bright, even light: lighter and less saturated
 * than the pigment itself, and lighter than the same board will look on a shelf.
 * Black comes out a slate charcoal because that is genuinely what dyed black
 * fibre looks like flat-on, not because the sampling is wrong.
 *
 * They are for telling one panel from another and seeing what a scheme looks
 * like. Investwood say themselves that the board varies in tone, because the
 * wood it is made of does — take the real decision off a sample, under the light
 * the box will live in.
 */
export const PALETTES = {
  valchromat: [
    { id: "white-pearl", name: "White Pearl", hex: "#faf3e1" },
    { id: "white-grey", name: "White Grey", hex: "#b5b2a5" },
    { id: "light-grey", name: "Light Grey", hex: "#a49b96" },
    { id: "grey", name: "Grey", hex: "#7c7679" },
    { id: "black", name: "Black", hex: "#696870" },
    { id: "chocolate", name: "Chocolate", hex: "#81695f" },
    { id: "khaki", name: "Khaki", hex: "#9b9772" },
    { id: "green-mint", name: "Green Mint", hex: "#548772" },
    { id: "blue", name: "Blue", hex: "#597ba2" },
    { id: "red", name: "Red", hex: "#da646c" },
    { id: "orange", name: "Orange", hex: "#d38a6a" },
    { id: "yellow", name: "Yellow", hex: "#e3b869" },
  ],
};

/** The colours a material is sold in, or nothing if it is sold as it comes. */
export const paletteFor = (materialId) => PALETTES[materialById(materialId).palette] ?? null;

/** The name of a colour in a material's range, if it is one of them. */
export function colourName(materialId, hex) {
  const found = (paletteFor(materialId) ?? []).find((c) => c.hex.toLowerCase() === String(hex).toLowerCase());
  return found?.name ?? null;
}

export const materialById = (id) =>
  MATERIALS.find((m) => m.id === id) ?? LAGGINGS.find((m) => m.id === id) ?? MATERIALS[0];

export const DEFAULT_KERF = 3.2;
