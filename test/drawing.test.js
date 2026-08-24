import { describe, it, expect } from "vitest";
import { solve } from "../src/model/solver.js";
import { uniformEdges, noEdges, edgeOwners, fullLengthEdges, applicableEdges } from "../src/model/bevel.js";
import { buildOrthoView, classifyEdges, FACE_SIDE } from "../src/drawing/views.js";
import { buildSection, HATCH } from "../src/drawing/section.js";
import { buildIsometric, isoProject, ISO_Z, inFront, paintOrder } from "../src/drawing/iso.js";
import { explodeShift } from "../src/model/explode.js";
import { newFitting } from "../src/model/fittings.js";
import { VIEW_EXTENT } from "../src/drawing/hlr.js";
import { EDGES } from "../src/model/constants.js";
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
