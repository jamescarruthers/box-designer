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

export const LAYERS = ["cladding", "shell", "doubler"];

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
  // Valchromat is 19 mm as standard, not 18.
  { id: "valchromat", name: "Valchromat", colour: "#5a5f66", grained: false,
    stock: [[2440, 1220]],
    thickness: 19, thicknesses: [8, 12, 16, 19, 25, 30] },
];

export const materialById = (id) => MATERIALS.find((m) => m.id === id) ?? MATERIALS[0];

export const DEFAULT_KERF = 3.2;
