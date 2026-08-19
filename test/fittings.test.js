/** §10 Drivers and ports: the holes that make a box a speaker. */
import { describe, it, expect } from "vitest";
import { solve, panelBlank } from "../src/model/solver.js";
import {
  newFitting, fittingCircles, fittingExtent, fittingOwners, fittingOrigin,
  fittingIssues, describeFitting, fittingNote, faceAxes, toBlank, blankCircles,
  portOuterRadius, DEFAULT_DRIVER, DEFAULT_PORT,
} from "../src/model/fittings.js";
import { fittingGeometry, FACE_ON, toView } from "../src/drawing/fittings.js";
import { DEFAULT_DESIGN, derive } from "../src/ui/design.js";

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
