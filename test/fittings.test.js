/** §10 Drivers and ports: the holes that make a box a speaker. */
import { describe, it, expect } from "vitest";
import { solve, panelBlank } from "../src/model/solver.js";
import {
  newFitting, fittingCircles, fittingExtent, fittingOwners, fittingOrigin,
  fittingStack, innermostOn, hasTube, DEFAULT_PORT,
  fittingIssues, describeFitting, fittingNote, faceAxes, toBlank, blankCircles,
  portOuterRadius, DEFAULT_DRIVER,
} from "../src/model/fittings.js";
import { fittingGeometry, fittingDimensions, FACE_ON, toView } from "../src/drawing/fittings.js";
import { DEFAULT_DESIGN, derive } from "../src/ui/design.js";
import { PROMINENCE_PRESETS } from "../src/model/constants.js";

const E = { x: 236, y: 286, z: 356 };
const carcass = () => solve({ envelope: E, thickness: 18,
  order: ["front", "back", "left", "right", "top", "bottom"] });
const centred = (type, face = "front") => newFitting(type, face, { a: 118, b: 240 });

describe("the shape of a driver", () => {
  it("is a cutout plus a ring of bolt holes", () => {
    const d = centred("driver");
    const circles = fittingCircles(d);
    expect(circles).toHaveLength(1 + DEFAULT_DRIVER.bolts);
    expect(circles[0]).toMatchObject({ role: "cutout", d: DEFAULT_DRIVER.cutout });
    expect(circles.filter((c) => c.role === "bolt")).toHaveLength(5);
    for (const c of circles.filter((c) => c.role === "bolt")) expect(c.d).toBe(DEFAULT_DRIVER.boltHole);
  });

  it("defaults to five holes of 5 mm", () => {
    expect(DEFAULT_DRIVER.bolts).toBe(5);
    expect(DEFAULT_DRIVER.boltHole).toBe(5);
  });

  it("puts every bolt on the pitch circle", () => {
    const d = centred("driver");
    for (const c of fittingCircles(d).filter((x) => x.role === "bolt")) {
      expect(Math.hypot(c.at.a - d.at.a, c.at.b - d.at.b)).toBeCloseTo(d.pcd / 2, 9);
    }
  });

  it("starts at top dead centre and runs clockwise", () => {
    const d = centred("driver");
    const bolts = fittingCircles(d).filter((c) => c.role === "bolt");
    expect(bolts[0].at.a).toBeCloseTo(d.at.a, 9);
    expect(bolts[0].at.b).toBeCloseTo(d.at.b + d.pcd / 2, 9);   // straight up
    expect(bolts[1].at.a).toBeGreaterThan(d.at.a);              // then to the right
  });

  it("spaces any number of bolts evenly", () => {
    for (const bolts of [3, 4, 6, 8]) {
      const d = { ...centred("driver"), bolts };
      const ring = fittingCircles(d).filter((c) => c.role === "bolt");
      expect(ring).toHaveLength(bolts);
      const angles = ring.map((c) => Math.atan2(c.at.b - d.at.b, c.at.a - d.at.a));
      const gaps = angles.slice(1).map((a, i) => ((angles[i] - a) + 2 * Math.PI) % (2 * Math.PI));
      for (const g of gaps) expect(g).toBeCloseTo((2 * Math.PI) / bolts, 9);
    }
  });

  it("reaches as far as the bolt circle, not just the cutout", () => {
    const d = centred("driver");
    expect(fittingExtent(d)).toBe(d.pcd / 2 + d.boltHole / 2);
    expect(fittingExtent({ ...d, cutout: 400 })).toBe(200);   // ...unless the cutout is bigger
  });
});

describe("the shape of a port", () => {
  it("is one hole, with a tube standing off behind it", () => {
    const p = centred("port");
    expect(fittingCircles(p)).toEqual([{ role: "bore", d: DEFAULT_PORT.diameter, at: p.at }]);
    expect(portOuterRadius(p)).toBe(p.diameter / 2 + p.wall);
    expect(fittingExtent(p)).toBe(p.diameter / 2);
  });
});

describe("which panel a fitting is cut into", () => {
  it("is the outermost one on that face", () => {
    const clad = solve({ envelope: E, thickness: 18, cladding: { front: 6 },
      order: ["front", "back", "left", "right", "top", "bottom"] });
    const owners = fittingOwners(clad.panels, ["front"]);
    expect(owners.front.layer).toBe("cladding");
    // ...and without cladding it is the carcass panel.
    expect(fittingOwners(carcass().panels, ["front"]).front.layer).toBe("shell");
  });

  it("sits on the outer surface of that panel", () => {
    const sol = carcass();
    const panel = fittingOwners(sol.panels, ["front"]).front;
    const o = fittingOrigin(centred("driver"), panel);
    expect(o.y).toBe(panel.box.y[0]);    // the front face's outer surface
    expect([o.x, o.z]).toEqual([118, 240]);
  });
});

describe("§8 fittings that will not cut", () => {
  const sol = carcass();
  const owners = fittingOwners(sol.panels, ["front"]);
  const issues = (f) => fittingIssues([f].flat(), sol.panels, owners, sol.cavity);

  it("passes a driver that fits", () => {
    expect(issues(centred("driver"))).toEqual([]);
  });

  it("errors when the fitting runs off the panel", () => {
    const msgs = issues(newFitting("driver", "front", { a: 40, b: 240 }));
    expect(msgs.some((m) => m.level === "error" && m.text.includes("runs off the panel"))).toBe(true);
  });

  it("warns when it leaves too little material at the edge", () => {
    // Extent 76 at a = 80 leaves 4 mm of material: on the panel, but only just.
    const msgs = issues(newFitting("driver", "front", { a: 80, b: 240 }));
    expect(msgs.some((m) => m.level === "warning" && m.text.includes("10 mm"))).toBe(true);
  });

  it("warns when the bolt holes break into the cutout", () => {
    const msgs = issues({ ...centred("driver"), cutout: 150, pcd: 147 });
    expect(msgs.some((m) => m.text.includes("break into the cutout"))).toBe(true);
  });

  it("warns when the port tube is longer than the cavity", () => {
    const msgs = issues({ ...centred("port"), length: 500 });
    expect(msgs.some((m) => m.text.includes("longer than"))).toBe(true);
  });

  it("errors when two fittings overlap", () => {
    const a = newFitting("driver", "front", { a: 118, b: 200 });
    const b = newFitting("driver", "front", { a: 118, b: 210 });
    expect(issues([a, b]).some((m) => m.level === "error" && m.text.includes("overlaps"))).toBe(true);
  });

  it("does not mind two fittings on different faces at the same spot", () => {
    const a = newFitting("port", "front", { a: 118, b: 200 });
    const b = newFitting("port", "back", { a: 118, b: 200 });
    const both = fittingIssues([a, b], sol.panels, fittingOwners(sol.panels, ["front", "back"]), sol.cavity);
    expect(both.filter((m) => m.text.includes("overlaps"))).toEqual([]);
  });

  it("errors when the face has no panel at all", () => {
    const open = solve({ envelope: E, thickness: { front: 0, back: 18, left: 18, right: 18, top: 18, bottom: 18 },
      order: ["front", "back", "left", "right", "top", "bottom"] });
    const msgs = fittingIssues([centred("driver")], open.panels, fittingOwners(open.panels, ["front"]), open.cavity);
    expect(msgs.some((m) => m.text.includes("no panel on that face"))).toBe(true);
  });
});

describe("§10 on the part template", () => {
  const sol = carcass();
  const panel = fittingOwners(sol.panels, ["front"]).front;
  const blank = panelBlank(panel);

  it("lands every circle inside the blank", () => {
    const circles = blankCircles([centred("driver"), newFitting("port", "front", { a: 118, b: 80 })], panel, blank);
    expect(circles.length).toBe(1 + 5 + 1);
    for (const c of circles) {
      expect(c.x - c.d / 2).toBeGreaterThanOrEqual(0);
      expect(c.x + c.d / 2).toBeLessThanOrEqual(blank.length);
      expect(c.y - c.d / 2).toBeGreaterThanOrEqual(0);
      expect(c.y + c.d / 2).toBeLessThanOrEqual(blank.width);
    }
  });

  it("keeps the two axes distinct, so the template is not mirrored", () => {
    const [p, q] = faceAxes("front");
    const one = toBlank({ a: 100, b: 100 }, panel, blank, "front");
    const more = toBlank({ a: 120, b: 100 }, panel, blank, "front");
    expect([p, q]).toEqual(["x", "z"]);
    // Moving along a moves exactly one template axis.
    expect(more.x === one.x).not.toBe(more.y === one.y);
  });
});

describe("§10 in the views", () => {
  const sol = carcass();
  const owners = fittingOwners(sol.panels, ["front"]);
  const fittings = [centred("driver"), newFitting("port", "front", { a: 118, b: 80 })];

  it("draws circles only in the view that looks at the face square-on", () => {
    expect(FACE_ON.front).toBe("front");
    expect(FACE_ON.left).toBe("end");
    expect(FACE_ON.top).toBe("plan");
    const front = fittingGeometry("front", fittings, sol.panels, owners, sol.E);
    expect(front.circles.length).toBe(6 + 1 + 1);   // driver, port bore, port tube
    expect(front.boltCircles).toHaveLength(1);
    expect(front.lines).toHaveLength(0);
  });

  it("draws the bore as lines through the panel in the other views", () => {
    for (const view of ["end", "plan"]) {
      const g = fittingGeometry(view, fittings, sol.panels, owners, sol.E);
      expect(g.circles).toHaveLength(0);
      expect(g.lines.length).toBeGreaterThan(0);
      expect(g.lines.every((l) => l.visible === false)).toBe(true);
    }
  });

  it("shows a fitting on a far face as hidden", () => {
    const back = fittingGeometry("front", [centred("driver", "back")], sol.panels,
      fittingOwners(sol.panels, ["back"]), sol.E);
    expect(back.circles.every((c) => c.visible === false)).toBe(true);
  });

  it("puts a point where the face-on projection says it should be", () => {
    // Front face: h is x, v is measured down from the top.
    expect(toView({ a: 118, b: 240 }, "front", "front", sol.E)).toEqual([118, sol.E.z - 240]);
  });
});

describe("through the app", () => {
  const design = {
    ...DEFAULT_DESIGN,
    fittings: [newFitting("driver", "front", { a: 110, b: 240 }), newFitting("port", "front", { a: 110, b: 80 })],
  };
  const r = derive(design);

  it("attaches the fittings to the front panel's cut list row", () => {
    const front = r.rows.find((x) => x.face === "front" && x.layer === "shell");
    expect(front.fittings).toHaveLength(2);
    expect(front.fittingNote).toBe(fittingNote(design.fittings));
    expect(front.fittingNote).toContain("Driver ⌀116, 5 × ⌀5 on 147 PCD");
    expect(front.fittingNote).toContain("Port ⌀68 × 150");
  });

  it("leaves every other row without fittings", () => {
    for (const row of r.rows.filter((x) => x.face !== "front")) expect(row.fittings).toEqual([]);
  });

  it("draws them on the sheet", () => {
    expect((r.sheet.svg.match(/<circle/g) || []).length).toBeGreaterThan(2);   // 2 is the projection symbol
    expect(r.sheet.geometry.front.circles.length).toBe(8);
    expect(r.sheet.geometry.front.boltCircles).toHaveLength(1);
  });

  it("still closes on volume — a hole is not part of the panel model", () => {
    expect(r.totals.closure).toBe("exact");
  });

  it("describes a fitting the way a cut list should", () => {
    expect(describeFitting(design.fittings[0])).toBe("Driver ⌀116, 5 × ⌀5 on 147 PCD");
    expect(describeFitting(design.fittings[1])).toBe("Port ⌀68 × 150");
  });
});

/**
 * §10 A fitting with no position.
 *
 * `at.a` undefined put the bore at NaN, and every check passed: a comparison
 * against NaN is false, so it read as perfectly placed. The kernel then ground
 * on it for minutes. Three guards, because a silent NaN deserves all three.
 */
describe("§10 a fitting has to be somewhere", () => {
  it("gives a new fitting a position even when none is asked for", () => {
    const f = newFitting("driver", "front");
    expect(Number.isFinite(f.at.a)).toBe(true);
    expect(Number.isFinite(f.at.b)).toBe(true);
  });

  it("reports one without a position as an error rather than passing it on", () => {
    const sol = solve({ envelope: { x: 236, y: 286, z: 356 }, thickness: 18, order: PROMINENCE_PRESETS[0].order });
    const owners = fittingOwners(sol.panels, ["front"]);
    const f = { ...newFitting("driver", "front"), at: {} };
    const msgs = fittingIssues([f], sol.panels, owners, sol.cavity);
    expect(msgs.some((m) => m.level === "error" && /no position/.test(m.text))).toBe(true);
  });

  it("cuts no circles for one, so the kernel is never handed a NaN", () => {
    expect(fittingCircles({ ...newFitting("driver", "front"), at: { a: NaN, b: 0 } })).toEqual([]);
    expect(fittingCircles({ ...newFitting("driver", "front"), at: {} })).toEqual([]);
  });
});


/**
 * §10 A hole goes all the way.
 *
 * Cutting only the outermost panel left a 116 mm cutout opening onto solid
 * material behind it, which is not a hole — it is a recess.
 */
describe("§10 a fitting punches through every layer of its face", () => {
  const clad = () => derive({
    ...DEFAULT_DESIGN,
    cladding: { front: { material: "birch", thickness: 6 } },
    doubler: { front: { material: "mdf", thickness: 12 } },
    fittings: [{ id: "d1", type: "driver", face: "front", at: { a: 108.85, b: 163.35 },
      cutout: 116, pcd: 147, bolts: 5, boltHole: 5 }],
  });

  it("stacks the panels of a face outermost first", () => {
    const { sol } = clad();
    expect(fittingStack(sol.panels, "front").map((p) => p.layer))
      .toEqual(["cladding", "shell", "doubler"]);
  });

  it("cuts the cladding, the carcass and the doubler alike", () => {
    const d = clad();
    const cut = d.rows.filter((r) => r.fittings.length);
    expect(cut.map((r) => r.layer).sort()).toEqual(["cladding", "doubler", "shell"]);
    for (const r of cut) expect(r.fittingNote).toMatch(/Driver ⌀116/);
  });

  it("leaves the other faces alone", () => {
    expect(clad().rows.filter((r) => r.face !== "front").every((r) => !r.fittings.length)).toBe(true);
  });

  it("still sets the fitting out from the outermost panel, which is what it bolts to", () => {
    const { sol, fittingPanels } = clad();
    expect(fittingPanels.front.layer).toBe("cladding");
    expect(fittingOwners(sol.panels, ["front"]).front).toBe(fittingPanels.front);
  });

  it("hangs a port's tube off the innermost layer, once", () => {
    const d = derive({
      ...DEFAULT_DESIGN,
      doubler: { back: { material: "mdf", thickness: 12 } },
      fittings: [{ id: "p1", type: "port", face: "back", at: { a: 108.85, b: 80 },
        diameter: 68, length: 150, wall: 3 }],
    });
    const withTube = d.sol.panels.filter((p) => d.tubesOn(p).length);
    expect(withTube).toHaveLength(1);
    expect(withTube[0].layer).toBe("doubler");
    expect(innermostOn(d.sol.panels, "back")).toBe(withTube[0]);
  });

  it("catches a bore that fits the carcass but runs off the doubler behind it", () => {
    // The doubler is inset from the panel it backs, so this is a real way to
    // end up with a hole opening into fresh air — and it used to pass.
    const sol = solve({ envelope: E, thickness: 18, order: PROMINENCE_PRESETS[0].order });
    const front = sol.panels.find((p) => p.face === "front");
    const inset = {
      ...front, layer: "doubler",
      box: { ...front.box, x: [front.box.x[0] + 60, front.box.x[1] - 60] },
    };
    const f = newFitting("driver", "front", { a: 40, b: 240 });
    const panels = [...sol.panels, inset];
    const msgs = fittingIssues([f], panels, fittingOwners(panels, ["front"]), sol.cavity);
    expect(msgs.some((m) => m.level === "error" && /doubler/.test(m.text))).toBe(true);
  });
});


/**
 * §10 A port with no tube.
 *
 * Not every port has one: a short port in a thick baffle is a plain hole, and a
 * bought tube is often left off the drawing and fitted on assembly. The bore is
 * the same either way, so this changes what is behind the panel and nothing
 * about the hole.
 */
describe("§10 the tube behind a port is optional", () => {
  const port = (tube) => ({ id: "p1", type: "port", face: "back", at: { a: 108.85, b: 80 },
    diameter: 68, length: 150, wall: 3, ...(tube === undefined ? {} : { tube }) });
  const withPort = (tube) => derive({ ...DEFAULT_DESIGN, fittings: [port(tube)] });

  it("fits one by default", () => {
    expect(DEFAULT_PORT.tube).toBe(true);
    expect(hasTube(newFitting("port", "back", { a: 60, b: 60 }))).toBe(true);
  });

  it("keeps the tube on a port saved before the option existed", () => {
    // `tube` undefined must not quietly mean "no tube".
    expect(hasTube(port(undefined))).toBe(true);
  });

  it("builds no tube body when it is turned off", () => {
    const off = withPort(false);
    expect(off.sol.panels.reduce((a, p) => a + off.tubesOn(p).length, 0)).toBe(0);
    const on = withPort(true);
    expect(on.sol.panels.reduce((a, p) => a + on.tubesOn(p).length, 0)).toBe(1);
  });

  it("still cuts the same hole", () => {
    const holes = (d) => d.rows.find((r) => r.fittings.length).fittings[0].diameter;
    expect(holes(withPort(false))).toBe(holes(withPort(true)));
  });

  it("says so in the cut list rather than quoting a length it has not got", () => {
    expect(describeFitting(port(false))).toBe("Port ⌀68, no tube");
    expect(describeFitting(port(true))).toBe("Port ⌀68 × 150");
  });

  it("quotes the length on the drawing only when there is a tube", () => {
    const dim = (tube) => fittingDimensions("front", [port(tube)], E)[0].text;
    expect(dim(true)).toBe("⌀68 × 150");
    expect(dim(false)).toBe("⌀68");
  });

  it("draws no tube circle in the face-on view without one", () => {
    const roles = (tube) => fittingGeometry("front", [port(tube)],
      solve({ envelope: E, thickness: 18, order: PROMINENCE_PRESETS[0].order }).panels,
      { back: solve({ envelope: E, thickness: 18, order: PROMINENCE_PRESETS[0].order })
        .panels.find((p) => p.face === "back") }, E).circles.map((c) => c.role);
    expect(roles(true)).toContain("tube");
    expect(roles(false)).not.toContain("tube");
  });

  it("does not warn that a tube it has not got is longer than the cavity", () => {
    const long = { ...port(false), length: 10_000 };
    const sol = solve({ envelope: E, thickness: 18, order: PROMINENCE_PRESETS[0].order });
    const msgs = fittingIssues([long], sol.panels, fittingOwners(sol.panels, ["back"]), sol.cavity);
    expect(msgs.some((m) => /longer than/.test(m.text))).toBe(false);

    const fitted = { ...long, tube: true };
    expect(fittingIssues([fitted], sol.panels, fittingOwners(sol.panels, ["back"]), sol.cavity)
      .some((m) => /longer than/.test(m.text))).toBe(true);
  });
});
