import { describe, it, expect } from "vitest";
import { solve } from "../src/model/solver.js";
import { uniformEdges, noEdges, edgeOwners, fullLengthEdges, applicableEdges, panelBevels } from "../src/model/bevel.js";
import { DEFAULT_DESIGN, derive, addPanel, setRebateSides, setLayerOrder } from "../src/ui/design.js";
import { buildOrthoView, classifyEdges, FACE_SIDE } from "../src/drawing/views.js";
import { buildSection, HATCH } from "../src/drawing/section.js";
import { buildIsometric, isoProject, ISO_Z, ISO_X, ISO_Y, ISO_EYE, inFront, paintOrder,
  panelQuads, isoSurfaces } from "../src/drawing/iso.js";
import { explodeShift, explodedBox } from "../src/model/explode.js";
import { newFitting } from "../src/model/fittings.js";
import { VIEW_EXTENT } from "../src/drawing/hlr.js";
import { EDGES, FACES, PROMINENCE_PRESETS } from "../src/model/constants.js";
import { panelSolidVolume, subtractCells, subtractBoxes, rebateSides } from "../src/model/rebate.js";
import { buildSheet, HIDDEN_DASH } from "../src/drawing/sheet.js";

const box = () => solve({
  envelope: { x: 236, y: 286, z: 356 }, thickness: 18, cladding: 6,
  order: ["front", "left", "right", "bottom", "back", "top"],
});

// §38 The views a bevel can appear in. The isometric is drawn from panel
// boxes and carries no bevel geometry at all, so counting its lines here only
// ever measured how the isometric was built — it has its own block below.
const allViews = (sol, edges) => [
  ...["front", "end", "plan"].map((v) => buildOrthoView(v, sol, edges)),
  buildSection(sol),
];
const tally = (vs) => ({
  lines: vs.reduce((a, v) => a + v.lines.length, 0),
  arcs: vs.reduce((a, v) => a + v.arcs.length, 0),
});

describe("§9.5 bevel line counts", () => {
  const sol = box();
  // As the sheet draws them: only the edges one panel runs the whole length of.
  const cont = fullLengthEdges(sol.env, sol.panels, edgeOwners(sol.env, sol.panels));
  const cut = (type) => applicableEdges(type === "none" ? noEdges() : uniformEdges(type, 12), cont);
  const CONTINUOUS = 6;

  it("cuts six of the twelve edges on this box", () => {
    expect(Object.values(cont).filter(Boolean)).toHaveLength(CONTINUOUS);
  });
  it("no bevel → 48 lines, 0 arcs", () => {
    expect(tally(allViews(sol, cut("none")))).toEqual({ lines: 48, arcs: 0 });
  });
  it("fillet → 48 lines, one arc per cut edge: arcs without extra lines", () => {
    expect(tally(allViews(sol, cut("fillet")))).toEqual({ lines: 48, arcs: CONTINUOUS });
  });
  it("chamfer → 61 lines, 0 arcs", () => {
    expect(tally(allViews(sol, cut("chamfer")))).toEqual({ lines: 61, arcs: 0 });
  });
  it("a chamfer adds a diagonal per cut edge, plus its tangent lines", () => {
    const plain = tally(allViews(sol, cut("none"))).lines;
    const chamfered = allViews(sol, cut("chamfer"));
    const corners = chamfered.reduce((a, v) => a + v.lines.filter((l) => l.kind === "chamfer-corner").length, 0);
    const tangents = chamfered.reduce((a, v) => a + v.lines.filter((l) => l.kind === "chamfer-tangent").length, 0);
    expect(corners).toBe(CONTINUOUS);
    expect(tally(chamfered).lines).toBe(plain + corners + tangents);
  });
  it("with every edge forced, still adds no line for a fillet", () => {
    // classifyEdges in isolation: twelve corners, twelve arcs, no extra lines.
    expect(tally(allViews(sol, uniformEdges("fillet", 12)))).toEqual({ lines: 48, arcs: 12 });
  });
});

describe("§6.4 edges in the views", () => {
  const sol = box();
  it("makes every edge a corner in exactly one view", () => {
    const per = Object.fromEntries(EDGES.map((k) => [k, 0]));
    for (const v of ["front", "end", "plan"]) {
      const ext = VIEW_EXTENT[v](sol.E);
      for (const c of classifyEdges(v, uniformEdges("fillet", 12), ext).corners) per[c.key]++;
    }
    expect(Object.values(per)).toEqual(Array(12).fill(1));
  });

  it("makes every edge a tangent in the other two views", () => {
    const per = Object.fromEntries(EDGES.map((k) => [k, 0]));
    for (const v of ["front", "end", "plan"]) {
      const ext = VIEW_EXTENT[v](sol.E);
      for (const t of classifyEdges(v, uniformEdges("chamfer", 12), ext).tangents) per[t.key]++;
    }
    expect(Object.values(per)).toEqual(Array(12).fill(2));
  });

  it("gives a fillet no tangent line — it meets the flat face tangentially", () => {
    for (const v of ["front", "end", "plan"]) {
      const built = buildOrthoView(v, sol, uniformEdges("fillet", 12));
      expect(built.lines.filter((l) => l.kind === "chamfer-tangent")).toHaveLength(0);
      expect(built.arcs).toHaveLength(4);
    }
  });

  it("trims the outline back by R at each cut corner", () => {
    const R = 12;
    const plain = buildOrthoView("front", sol, noEdges());
    const filled = buildOrthoView("front", sol, uniformEdges("fillet", R));
    const top = (b) => b.lines.find((l) => l.a[1] === 0 && l.b[1] === 0 && l.kind === "hlr");
    expect(top(plain).a[0]).toBe(0);
    expect(top(plain).b[0]).toBe(sol.E.x);
    expect(top(filled).a[0]).toBe(R);
    expect(top(filled).b[0]).toBe(sol.E.x - R);
  });

  it("sets the sweep flag from dh · dv", () => {
    const built = buildOrthoView("front", sol, uniformEdges("fillet", 12));
    const byKey = Object.fromEntries(built.arcs.map((a) => [a.key, a.sweep]));
    expect(byKey["left|top"]).toBe(0);      // dh +1, dv +1
    expect(byKey["right|top"]).toBe(1);     // dh −1, dv +1
    expect(byKey["left|bottom"]).toBe(1);
    expect(byKey["right|bottom"]).toBe(0);
  });

  it("maps faces to view sides as specified", () => {
    expect(FACE_SIDE.end.back).toEqual(["h", 0]);   // first angle: back on the left edge
    expect(FACE_SIDE.plan.back).toEqual(["v", 0]);  // ...and along the plan's top edge
  });
});

describe("§6.2 first angle", () => {
  const sol = solve({ envelope: { x: 100, y: 200, z: 300 }, thickness: 10,
    order: ["front", "back", "left", "right", "top", "bottom"] });

  it("puts the back of the object on the left edge of the end view", () => {
    const back = sol.panels.find((p) => p.face === "back");
    const r = buildOrthoView("end", sol, noEdges());
    expect(r.ext).toEqual({ h: 200, v: 300 });
    // The back panel occupies y 190..200, which projects to h 0..10.
    expect(back.box.y).toEqual([190, 200]);
    expect(r.lines.some((l) => l.a[0] === 0 && l.b[0] === 0)).toBe(true);
  });

  it("puts the back of the object along the top edge of the plan", () => {
    const r = buildOrthoView("plan", sol, noEdges());
    expect(r.ext).toEqual({ h: 100, v: 200 });
    // Back panel y 190..200 → v 0..10, the top of the plan.
    const seg = r.lines.filter((l) => l.a[1] === 10 && l.b[1] === 10);
    expect(seg.length).toBeGreaterThan(0);
  });
});

describe("§6.5 section A–A", () => {
  const sol = solve({ envelope: { x: 236, y: 286, z: 356 }, thickness: 18,
    doubler: { front: 18 }, order: ["front", "back", "left", "right", "top", "bottom"] });

  it("omits hidden detail", () => {
    expect(buildSection(sol).lines.every((l) => l.visible)).toBe(true);
  });

  it("hatches each cut panel by layer, opposed for doublers", () => {
    const s = buildSection(sol);
    const layers = new Set(s.hatches.map((h) => h.panel.layer));
    expect(layers.has("shell")).toBe(true);
    expect(layers.has("doubler")).toBe(true);
    expect(HATCH.shell.angle).toBe(45);
    expect(HATCH.doubler.angle).toBe(-45);
    expect(HATCH.cladding.pitch).toBeLessThan(HATCH.shell.pitch);
  });

  it("shows the front doubler, which the front elevation cannot", () => {
    const s = buildSection(sol);
    const doubler = s.hatches.find((h) => h.panel.layer === "doubler");
    expect(doubler).toBeTruthy();
    // 18 mm doubler behind the 18 mm front panel: h from 286−(18+18) to 286−18.
    expect(doubler.h).toEqual([250, 268]);
  });

  it("cuts only the panels the plane passes through", () => {
    const s = buildSection(sol, sol.E.x / 2);
    for (const h of s.hatches) expect(h.panel.box.x[0] < 118 && 118 < h.panel.box.x[1]).toBe(true);
    expect(s.hatches.some((h) => h.panel.face === "left")).toBe(false);
  });

  it("takes a movable cut plane", () => {
    expect(buildSection(sol, 9).cx).toBe(9);
    expect(buildSection(sol, 9).hatches.some((h) => h.panel.face === "left")).toBe(true);
  });
});

describe("§6.6 isometric", () => {
  const sol = solve({ envelope: { x: 236, y: 286, z: 356 }, thickness: 18, cladding: { front: 6 },
    order: ["front", "back", "left", "right", "top", "bottom"] });

  it("foreshortens every axis to √(2/3)", () => {
    const o = isoProject({ x: 0, y: 0, z: 0 });
    for (const u of [{ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 1 }]) {
      const p = isoProject(u);
      expect(Math.hypot(p.x - o.x, p.y - o.y)).toBeCloseTo(ISO_Z, 12);
    }
  });

  const drawn = (iso) => iso.groups.reduce((a, g) => a + g.lines.length, 0);

  it("shows the joint pattern, including cladding lines, not a bare box", () => {
    const iso = buildIsometric(sol);
    const bare = buildIsometric(solve({ envelope: { x: 236, y: 286, z: 356 }, thickness: 18,
      order: ["front", "back", "left", "right", "top", "bottom"] }));
    // §38 One group per panel, painted back to front, so the front cladding is
    // a panel of its own and its edges are drawn where it sits.
    expect(iso.groups).toHaveLength(sol.panels.length);
    expect(drawn(iso)).toBeGreaterThan(drawn(bare));
    expect(drawn(bare)).toBeGreaterThan(12);
  });

  it("paints back to front, so a panel in front covers what is behind it", () => {
    // Along the line of sight the eye is front-right-above: x − y + z. The back
    // panel is furthest, the front panel nearest, and they are drawn in that
    // order — the isometric has no hidden-line removal but does not need one.
    const order = buildIsometric(sol).groups.map((g) => g.face);
    expect(order.indexOf("back")).toBeLessThan(order.indexOf("front"));
    expect(order.indexOf("left")).toBeLessThan(order.indexOf("right"));
    expect(order.indexOf("bottom")).toBeLessThan(order.indexOf("top"));
  });

  it("carries no hidden detail", () => {
    const built = buildSheet(sol, noEdges(), {});
    const iso = built.svg.slice(built.svg.indexOf('<g data-view="iso">'));
    expect(iso.slice(0, iso.indexOf("</g>"))).not.toContain(HIDDEN_DASH);
  });

  it("deduplicates shared edges", () => {
    // Three quadrilaterals meeting at a corner share three of their sides.
    for (const g of buildIsometric(sol).groups) {
      const keys = g.lines.filter((l) => !l.closed)
        .map((l) => JSON.stringify([l.pts[0], l.pts.at(-1)].sort()));
      expect(new Set(keys).size).toBe(keys.length);
      expect(keys).toHaveLength(9);
    }
  });
});

describe("§38 cutouts and explode in the isometric", () => {
  const driver = { ...newFitting("driver", "front"), at: { a: 118, b: 178 } };
  const sol = solve({ envelope: { x: 236, y: 286, z: 356 }, thickness: 18, doubler: { front: 18 },
    order: ["front", "back", "left", "right", "top", "bottom"] });
  const front = (layer) => sol.panels.find((p) => p.face === "front" && p.layer === layer);
  const on = (panel) => (panel.face === "front" ? [driver] : []);
  const holesIn = (iso, layer) => {
    const g = iso.groups.find((x) => x.face === "front" && x.layer === layer);
    return g.lines.filter((l) => l.closed);
  };

  it("cuts the fittings into the panel that carries them", () => {
    const bare = buildIsometric(sol);
    const cut = buildIsometric(sol, { fittingsOn: on });
    expect(holesIn(bare, "shell")).toHaveLength(0);
    // The cutout and five bolt holes, drawn as closed rings on the face.
    expect(holesIn(cut, "shell")).toHaveLength(1 + driver.bolts);
    // And the bore's far rim, an open arc showing the wall through the hole.
    const arcs = cut.groups.find((g) => g.face === "front" && g.layer === "shell")
      .lines.filter((l) => !l.closed).length;
    expect(arcs).toBeGreaterThan(9);          // nine box edges, plus the wall
  });

  it("draws the hole in every panel the fitting goes through", () => {
    const cut = buildIsometric(sol, { fittingsOn: on });
    expect(holesIn(cut, "doubler")).toHaveLength(1 + driver.bolts);
    // §33 A fitting the depth rule stopped at the baffle is not in the doubler.
    const baffleOnly = (panel) =>
      panel.face === "front" && panel.layer === "shell" ? [driver] : [];
    expect(holesIn(buildIsometric(sol, { fittingsOn: baffleOnly }), "doubler")).toHaveLength(0);
  });

  it("§36 leaves a blind hole off the face it never reaches", () => {
    // Bolts 6 mm into an 18 mm baffle: on the front of it, not the back.
    const blind = { ...driver, boltDeep: 6 };
    const iso = buildIsometric(sol, { fittingsOn: (p) => (p.face === "front" ? [blind] : []) });
    expect(holesIn(iso, "shell")).toHaveLength(1 + blind.bolts);
    // The same driver on the back face is seen from inside the box, where the
    // bolt holes stop short — only the cutout goes through.
    const back = { ...blind, face: "back" };
    const fromInside = buildIsometric(sol, { fittingsOn: (p) => (p.face === "back" ? [back] : []) });
    const g = fromInside.groups.find((x) => x.face === "back" && x.layer === "shell");
    expect(g.lines.filter((l) => l.closed)).toHaveLength(1);
  });

  it("moves every panel out along its own face normal", () => {
    const still = buildIsometric(sol);
    const apart = buildIsometric(sol, { explode: 60 });
    expect(apart.ext.h).toBeGreaterThan(still.ext.h);
    expect(apart.ext.v).toBeGreaterThan(still.ext.v);
    // The panels themselves are unchanged: an exploded view is the same box.
    const size = (iso, face, layer) => {
      const pts = iso.groups.find((g) => g.face === face && g.layer === layer)
        .fills.flatMap((f) => f.pts);
      const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
      return [Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)];
    };
    expect(size(apart, "front", "shell")[0]).toBeCloseTo(size(still, "front", "shell")[0], 9);
    expect(size(apart, "front", "shell")[1]).toBeCloseTo(size(still, "front", "shell")[1], 9);
  });

  it("explodes the cladding furthest and the lining least", () => {
    const clad = solve({ envelope: { x: 236, y: 286, z: 356 }, thickness: 18,
      cladding: { front: 6 }, lagging: { front: 10 },
      order: ["front", "back", "left", "right", "top", "bottom"] });
    const moved = (layer) => {
      const at = (amount) => buildIsometric(clad, { explode: amount })
        .groups.find((g) => g.face === "front" && g.layer === layer).fills[0].pts[0];
      // Against the box's own extent, which grows as the panels move.
      const [a, b] = [at(0), at(100)];
      return Math.hypot(b[0] - a[0], b[1] - a[1]);
    };
    expect(explodeShift({ face: "front", layer: "cladding" }, 100).y)
      .toBeLessThan(explodeShift({ face: "front", layer: "shell" }, 100).y);
    expect(explodeShift({ face: "front", layer: "lagging" }, 100).y)
      .toBeGreaterThan(explodeShift({ face: "front", layer: "doubler" }, 100).y);
    expect(moved("cladding")).toBeGreaterThan(0);
  });

  it("orders a long thin panel by where it is, not where its middle is", () => {
    // The bottom panel runs the whole depth of the box, so its centre is well
    // behind the front panel's — but every part of it is below, and the front
    // panel stands in front of it. Comparing centres got that wrong.
    const boxes = {
      front:  { x: [0, 236], y: [0, 18], z: [0, 356] },
      bottom: { x: [18, 218], y: [18, 268], z: [0, 18] },
    };
    expect(inFront(boxes.front, boxes.bottom)).toBe(true);
    expect(inFront(boxes.bottom, boxes.front)).toBe(false);
    const order = paintOrder([{ box: boxes.bottom }, { box: boxes.front }]);
    expect(order[1].box).toBe(boxes.front);
  });
});

describe("§40 the isometric draws the edge treatments", () => {
  const sol = solve({ envelope: { x: 236, y: 286, z: 356 }, thickness: 18,
    order: ["front", "back", "left", "right", "top", "bottom"] });
  const owners = edgeOwners(sol.env, sol.panels);
  const cont = fullLengthEdges(sol.env, sol.panels, owners);
  const bevels = (type, r = 12) => {
    const edges = applicableEdges(type === "none" ? noEdges() : uniformEdges(type, r), cont);
    return (panel, index) => panelBevels(index, panel, edges, owners);
  };
  const iso = (type, r) => buildIsometric(sol, { bevelsOf: bevels(type, r) });
  const drawn = (g) => g.groups.reduce((a, x) => a + x.lines.length, 0);
  const faces = (g) => g.groups.reduce((a, x) => a + x.fills.length, 0);

  it("rounds the box off instead of drawing it square", () => {
    const square = iso("none"), round = iso("fillet");
    // A fillet takes the corner off, so the drawing is smaller across.
    expect(round.ext.h).toBeLessThan(square.ext.h);
    expect(round.ext.v).toBeLessThan(square.ext.v);
    // And the panels it is cut into have a surface where the corner was.
    expect(faces(round)).toBeGreaterThan(faces(square));
  });

  it("draws a fillet as two lines along its length and nothing between them", () => {
    const round = iso("fillet"), chamfer = iso("chamfer"), square = iso("none");
    const perFace = (g) => g.groups.find((x) => x.face === "front" && x.layer === "shell");
    const span = (l) => Math.hypot(l.pts.at(-1)[0] - l.pts[0][0], l.pts.at(-1)[1] - l.pts[0][1]);
    // The lines that run the length of the panel: its outline, and the two
    // where a bevel becomes tangent to the face beside it. A chamfer and a
    // fillet each add the same two per bevelled side — the round itself is
    // smooth, and a line across it is a line the box does not have.
    const runs = (g) => perFace(g).lines.filter((l) => span(l) > 40).length;
    expect(runs(chamfer)).toBeGreaterThan(runs(square));

    // A round can also carry a silhouette of its own, where it turns away from
    // the eye part-way along — a real line, and at most one per rounded edge.
    // What there is never is one line per facet.
    const index = sol.panels.findIndex((x) => x.face === "front" && x.layer === "shell");
    const rounded = Object.keys(bevels("fillet")(sol.panels[index], index)).length;
    expect(rounded).toBeGreaterThan(0);
    expect(runs(round)).toBeGreaterThanOrEqual(runs(chamfer));
    expect(runs(round)).toBeLessThanOrEqual(runs(chamfer) + rounded);

    // What the fillet does add is the quarter circle where the round runs out
    // into the square end of the panel — an arc, so it comes in facets.
    const facets = (g) => perFace(g).lines.filter((l) => span(l) <= 40).length;
    expect(facets(round)).toBeGreaterThan(facets(chamfer) * 4);
    expect(perFace(round).fills.length).toBeGreaterThan(perFace(chamfer).fills.length);
  });

  it("grows the round with the radius", () => {
    const small = iso("fillet", 4), large = iso("fillet", 16);
    expect(large.ext.h).toBeLessThan(small.ext.h);
    expect(drawn(large)).toBe(drawn(small));   // the same lines, further in
  });

  it("is the box again when nothing is bevelled", () => {
    const none = iso("none");
    const bare = buildIsometric(sol);
    expect(drawn(none)).toBe(drawn(bare));
    expect(faces(none)).toBe(faces(bare));
    expect(none.ext).toEqual(bare.ext);
  });

  it("reaches the sheet through the design", () => {
    let d = { ...DEFAULT_DESIGN, edge: { type: "fillet", radius: 12, perEdge: false, by: {} } };
    const square = derive({ ...d, edge: { ...d.edge, type: "none" } }).sheet;
    const round = derive(d).sheet;
    const isoOf = (b) => {
      const at = b.svg.indexOf('<g data-view="iso">');
      return b.svg.slice(at, b.svg.indexOf("</g>", at));
    };
    expect(isoOf(round)).not.toBe(isoOf(square));
    // More filled faces on the sheet: the rounds are surfaces of their own.
    const fills = (svg) => (svg.match(/fill="var\(--paper\)"/g) ?? []).length;
    expect(fills(isoOf(round))).toBeGreaterThan(fills(isoOf(square)));
  });
});

/**
 * §49 The isometric of a rebated board.
 *
 * Two invariants, and they are the same two that caught §44: the surface the
 * drawing builds has to be a closed one, and it has to enclose the volume the
 * model gives the panel. A drawing that fails either is drawing a shape the box
 * does not have — faces inside the material, holes where a face is missing —
 * and it shows up as boards that look like they cross through each other.
 */
describe("§49 the isometric draws the board the model has", () => {
  const FACES = ["front", "back", "left", "right", "top", "bottom"];
  const every = (depth = 6) => ({ depth,
    sides: Object.fromEntries(FACES.map((s) => [s, true])) });
  const VERTICALS = ["front|left", "back|left", "front|right", "back|right"];
  const edgeSet = (type, keys, radius = 12) => ({ type: "none", radius: 12, perEdge: true,
    by: Object.fromEntries(keys.map((k) => [k, { type, radius }])) });

  const r6 = (n) => Math.round(n * 1e6) / 1e6;
  const key3 = (v) => `${r6(v.x)},${r6(v.y)},${r6(v.z)}`;

  /** Edges of the drawn surface that are not shared by exactly two faces. */
  const openEdges = (quads) => {
    const seen = new Map();
    for (const q of quads) {
      for (let i = 0; i < q.pts.length; i++) {
        const u = key3(q.pts[i]), v = key3(q.pts[(i + 1) % q.pts.length]);
        if (u === v) continue;
        const k = u < v ? `${u}|${v}` : `${v}|${u}`;
        seen.set(k, (seen.get(k) ?? 0) + 1);
      }
    }
    return [...seen.values()].filter((c) => c !== 2).length;
  };

  /** What the drawn surface encloses, each face turned to agree with its normal. */
  const drawnVolume = (quads) => {
    let out = 0;
    for (const q of quads) {
      const [a, b, c] = q.pts;
      const u = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
      const v = { x: c.x - a.x, y: c.y - a.y, z: c.z - a.z };
      const w = { x: u.y * v.z - u.z * v.y, y: u.z * v.x - u.x * v.z, z: u.x * v.y - u.y * v.x };
      const pts = w.x * q.normal.x + w.y * q.normal.y + w.z * q.normal.z >= 0
        ? q.pts : [...q.pts].reverse();
      for (let i = 1; i + 1 < pts.length; i++) {
        const [p0, p1, p2] = [pts[0], pts[i], pts[i + 1]];
        out += (p0.x * (p1.y * p2.z - p2.y * p1.z) - p0.y * (p1.x * p2.z - p2.x * p1.z)
          + p0.z * (p1.x * p2.y - p2.x * p1.y)) / 6;
      }
    }
    return Math.abs(out);
  };

  it("closes the surface of every panel of every box it can draw", () => {
    let checked = 0;
    for (const preset of PROMINENCE_PRESETS) {
      for (const edge of [edgeSet("mitre", []), edgeSet("mitre", VERTICALS),
        edgeSet("fillet", ["front|left", "front|right"], 8), edgeSet("chamfer", ["left|top"], 6)]) {
        for (const face of [null, ...FACES]) {
          const d = derive({ ...DEFAULT_DESIGN, preset: preset.id, order: preset.order,
            edge, rebate: face ? { [face]: every() } : {} });
          for (const explode of [0, 60]) {
            for (const [i, panel] of d.sol.panels.entries()) {
              const quads = panelQuads(panel, explodedBox(panel, explode), d.bevelsOf(panel, i));
              checked++;
              expect(openEdges(quads),
                `${preset.id} rebate:${face} explode:${explode} ${panel.layer}/${panel.face}`).toBe(0);
            }
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(1500);
  });

  it("draws the volume the model gives the panel", () => {
    // A fillet or a chamfer takes off material `panelSolidVolume` knows nothing
    // about — it reckons boxes, grooves and mitres — so the comparison is with
    // the panels that have neither.
    let checked = 0;
    for (const preset of PROMINENCE_PRESETS) {
      for (const keys of [[], VERTICALS, ["left|top", "right|top"]]) {
        for (const face of FACES) {
          const d = derive({ ...DEFAULT_DESIGN, preset: preset.id, order: preset.order,
            edge: edgeSet("mitre", keys), rebate: { [face]: every() } });
          if (!Object.keys(d.rebated).length) continue;
          for (const [i, panel] of d.sol.panels.entries()) {
            const quads = panelQuads(panel, panel.box, d.bevelsOf(panel, i));
            checked++;
            expect(drawnVolume(quads),
              `${preset.id} ${keys.length} mitres, rebate:${face}, ${panel.layer}/${panel.face}`)
              .toBeCloseTo(panelSolidVolume(panel), 3);
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(200);
  });

  it("keeps the faces inside the board out of the drawing", () => {
    // What went wrong: `subtractBoxes` glues its cells back together, so two
    // of them meet along part of a face rather than the whole of it — and a
    // face only partly shared cannot be cancelled against its neighbour. The
    // grooved panel came out with faces inside the material and holes in its
    // surface, which is why a rebated box looked like it was drawn inside out.
    const d = derive({ ...DEFAULT_DESIGN, rebate: { top: every() } });
    const i = d.sol.panels.findIndex((p) => p.face === "front" && p.layer === "shell");
    const panel = d.sol.panels[i];
    expect(panel.notches).toHaveLength(1);
    const quads = panelQuads(panel, panel.box, d.bevelsOf(panel, i));
    // No two faces of the drawing lie on top of each other.
    const keys = quads.map((q) => q.pts.map(key3).sort().join("|"));
    expect(new Set(keys).size).toBe(keys.length);
    // And every face is on the outside: nothing is drawn in the plane the
    // groove was cut from except the floor of the groove itself.
    expect(openEdges(quads)).toBe(0);
  });

  it("uses the cells the grid leaves, not the ones glued back together", () => {
    // The distinction the fix turns on, stated on its own.
    const box3 = { x: [0, 100], y: [0, 18], z: [0, 60] };
    const notch = [{ x: [40, 60], y: [12, 18], z: [50, 60] }];
    const cells = subtractCells(box3, notch);
    const merged = subtractBoxes(box3, notch);
    expect(cells.length).toBeGreaterThan(merged.length);
    const volume = (list) => list.reduce((a, b) =>
      a + (b.x[1] - b.x[0]) * (b.y[1] - b.y[0]) * (b.z[1] - b.z[0]), 0);
    // Same solid either way — only the way it is cut up differs.
    expect(volume(cells)).toBeCloseTo(volume(merged), 6);
    // Every face of every cell is met by a whole face of its neighbour, which
    // is the property a surface needs and merging destroys.
    const faceKeys = new Map();
    for (const c of cells) {
      for (const [ax, at] of [["x", 0], ["x", 1], ["y", 0], ["y", 1], ["z", 0], ["z", 1]]) {
        const rest = ["x", "y", "z"].filter((k) => k !== ax);
        const k = `${ax}=${c[ax][at]}|${rest.map((r) => `${c[r][0]}:${c[r][1]}`).join(",")}`;
        faceKeys.set(k, (faceKeys.get(k) ?? 0) + 1);
      }
    }
    // Shared faces come in pairs; the rest are the outside of the shape.
    for (const n of faceKeys.values()) expect(n).toBeLessThanOrEqual(2);
  });
});

/**
 * §54 Nothing is drawn in front of what stands in front of it.
 *
 * The isometric is a painter's algorithm: faces are drawn back to front and
 * whatever is painted last wins. §42's rebates broke that twice over, and the
 * only honest test is the one that asks the picture itself — sample points
 * across it, work out every face that covers each point and how far along the
 * eye it is, and check that the face painted LAST there is the NEAREST.
 */
describe("§54 the isometric paints back to front", () => {
  const depthAt = (v) => v.x - v.y + v.z;

  /** Is the projected point inside the projected polygon? */
  const inside = (pts, p) => {
    let hit = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const a = pts[i], b = pts[j];
      if ((a.y > p.y) !== (b.y > p.y) &&
          p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) hit = !hit;
    }
    return hit;
  };

  /** How deep along the eye a face is at a point in the picture. */
  function depthOnFace(pts, p) {
    const [A, B, C] = pts;
    const u = { x: B.x - A.x, y: B.y - A.y, z: B.z - A.z };
    const w = { x: C.x - A.x, y: C.y - A.y, z: C.z - A.z };
    const n = { x: u.y * w.z - u.z * w.y, y: u.z * w.x - u.x * w.z, z: u.x * w.y - u.y * w.x };
    // Any point that projects to p will do: fix z = 0 and invert the projection.
    const sum = p.x / ISO_X, diff = p.y / ISO_Y;
    const o = { x: (sum + diff) / 2, y: (sum - diff) / 2, z: 0 };
    const denom = n.x * ISO_EYE.x + n.y * ISO_EYE.y + n.z * ISO_EYE.z;
    if (Math.abs(denom) < 1e-12) return null;             // edge-on to the eye
    const t = ((A.x - o.x) * n.x + (A.y - o.y) * n.y + (A.z - o.z) * n.z) / denom;
    return depthAt({ x: o.x + ISO_EYE.x * t, y: o.y + ISO_EYE.y * t, z: o.z + ISO_EYE.z * t });
  }

  /**
   * Every visible face of the whole picture, in the order it is painted — from
   * the same function the drawing is built from, so this is what was drawn and
   * not a second opinion about what should have been.
   */
  function painted(sol, explode) {
    return isoSurfaces(sol, { explode }).flatMap(({ panel, visible }) =>
      visible.map((q) => ({ name: `${panel.layer}|${panel.face}`, pts: q.pts, flat: q.pts.map(isoProject) })));
  }

  /** Samples where something solid is showing through something in front. */
  function showingThrough(sol, explode = 0, grid = 90) {
    const faces = painted(sol, explode);
    const all = faces.flatMap((f) => f.flat);
    const lo = { x: Math.min(...all.map((p) => p.x)), y: Math.min(...all.map((p) => p.y)) };
    const hi = { x: Math.max(...all.map((p) => p.x)), y: Math.max(...all.map((p) => p.y)) };
    const bad = [];
    for (let gx = 0; gx < grid; gx++) {
      for (let gy = 0; gy < grid; gy++) {
        const p = { x: lo.x + ((hi.x - lo.x) * (gx + 0.5)) / grid,
                    y: lo.y + ((hi.y - lo.y) * (gy + 0.5)) / grid };
        let last = null, lastDepth = 0, best = -Infinity, bestFace = null;
        for (const f of faces) {
          if (!inside(f.flat, p)) continue;
          const d = depthOnFace(f.pts, p);
          if (d === null) continue;
          last = f; lastDepth = d;
          if (d > best) { best = d; bestFace = f; }
        }
        if (last && best - lastDepth > 1e-6) {
          bad.push({ over: last.name, under: bestFace.name, by: best - lastDepth });
        }
      }
    }
    return bad;
  }

  /** A box wearing `layers`, with the two least prominent faces rebated in. */
  function rebatedBox(preset, layers) {
    let d = setLayerOrder(DEFAULT_DESIGN, "shell", preset.order);
    for (const layer of layers) for (const f of FACES) d = addPanel(d, layer, f);
    for (const face of preset.order.slice(4)) {
      for (const key of [face, ...(layers.includes("doubler") ? [`doubler|${face}`] : [])]) {
        d = setRebateSides(d, key, Object.fromEntries(rebateSides(face).map((s) => [s, true])));
      }
    }
    return derive(d).sol;
  }

  it("draws a plain box with nothing showing through", () => {
    expect(showingThrough(box())).toEqual([]);
  });

  it("keeps a rebated board behind the panels standing in front of it", () => {
    // The bug: a rebate grows the panel into its neighbours, so its box is no
    // longer clear of theirs along any axis — and the sort that decides what
    // covers what is built on exactly that. The rebated top was painted last,
    // over the front and the side it is let into.
    const sol = rebatedBox(PROMINENCE_PRESETS[0], ["doubler"]);
    expect(sol.panels.filter((p) => p.notches?.length).length).toBeGreaterThan(0);
    const bad = showingThrough(sol);
    expect(bad.filter((b) => b.over.split("|")[1] !== b.under.split("|")[1])).toEqual([]);
  });

  it("keeps the inside of a groove behind the board it is cut into", () => {
    // The other half of the bug, within one panel: a grooved board is not
    // convex, so its own faces overlap on the paper, and the step at the bottom
    // of the rebate was painted over the face it is cut into.
    const sol = rebatedBox(PROMINENCE_PRESETS[0], ["doubler"]);
    const bad = showingThrough(sol).filter((b) => b.over === b.under);
    expect(bad).toEqual([]);
  });

  it("holds over every preset, layer stack and explode", () => {
    let worst = 0;
    for (const preset of PROMINENCE_PRESETS) {
      for (const layers of [[], ["doubler"], ["cladding", "doubler"]]) {
        const sol = rebatedBox(preset, layers);
        for (const explode of [0, 30, 80]) {
          const bad = showingThrough(sol, explode, 60);
          // What is left is the sliver where a groove wall meets the tongue
          // filling it: two panels interlock there, and no order of whole
          // panels is right for both. It is a line, not a face — never more
          // than a handful of samples out of 3,600.
          expect(bad.length).toBeLessThanOrEqual(4);
          worst = Math.max(worst, bad.length);
        }
      }
    }
    expect(worst).toBeLessThanOrEqual(4);
  });
});
