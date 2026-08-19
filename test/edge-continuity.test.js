/** §3 A bevel can only be cut along an edge one panel runs the whole length of. */
import { describe, it, expect } from "vitest";
import { solve } from "../src/model/solver.js";
import { EDGES, FACES, PAIR, PROMINENCE_PRESETS, edgeAxis } from "../src/model/constants.js";
import {
  edgeOwners, fullLengthEdges, applicableEdges, partialEdgeIssues,
  panelBevels, uniformEdges, noEdges,
} from "../src/model/bevel.js";
import { ringAt } from "../src/three/panelGeometry.js";
import { buildOrthoView } from "../src/drawing/views.js";
import { DEFAULT_DESIGN, derive } from "../src/ui/design.js";

const E = { x: 236, y: 286, z: 356 };
const box = (order, extra = {}) => solve({ envelope: E, thickness: 18, order, ...extra });
const continuity = (sol) => fullLengthEdges(sol.env, sol.panels, edgeOwners(sol.env, sol.panels));
const full = (sol) => EDGES.filter((k) => continuity(sol)[k]);

describe("which edges are continuous", () => {
  it("front & back wrap: the four edges behind the wrapping panels are broken", () => {
    expect(full(box(PROMINENCE_PRESETS[0].order))).toEqual([
      "front|left", "back|left", "front|right", "back|right",
      "front|bottom", "front|top", "back|bottom", "back|top",
    ]);
  });

  it("sides wrap: the broken edges move to the top and bottom", () => {
    expect(full(box(PROMINENCE_PRESETS[1].order))).toEqual([
      "front|left", "back|left", "front|right", "back|right",
      "left|bottom", "left|top", "right|bottom", "right|top",
    ]);
  });

  it("a broken edge is one whose owner stops short of the envelope", () => {
    const sol = box(PROMINENCE_PRESETS[0].order);
    const owners = edgeOwners(sol.env, sol.panels);
    const cont = continuity(sol);
    for (const k of EDGES) {
      const a = edgeAxis(k), b = sol.panels[owners[k]].box[a];
      expect(cont[k]).toBe(b[0] === sol.env[a][0] && b[1] === sol.env[a][1]);
    }
    // The left panel owns left|top but is inset front and back by the wrap.
    expect(cont["left|top"]).toBe(false);
    expect(sol.panels[owners["left|top"]].face).toBe("left");
  });

  it("never leaves all twelve continuous, and reaches eight only when the two most prominent faces are opposite", () => {
    const perm = (a) => (a.length <= 1 ? [a] : a.flatMap((x, i) =>
      perm([...a.slice(0, i), ...a.slice(i + 1)]).map((r) => [x, ...r])));
    const opposite = Object.fromEntries(Object.values(PAIR).flatMap(([m, p]) => [[m, p], [p, m]]));
    const seen = new Set();
    for (const order of perm(FACES)) {
      const n = full(box(order)).length;
      seen.add(n);
      expect(n).toBeLessThanOrEqual(8);
      expect(n === 8).toBe(opposite[order[0]] === order[1]);
    }
    expect([...seen].sort()).toEqual([5, 6, 8]);
  });

  it("follows the cladding, which owns the edge once a face is clad", () => {
    const clad = box(PROMINENCE_PRESETS[0].order, { cladding: { front: 6 } });
    const owners = edgeOwners(clad.env, clad.panels);
    expect(clad.panels[owners["front|top"]].layer).toBe("cladding");
    expect(continuity(clad)["front|top"]).toBe(true);
  });
});

describe("dropping what cannot be cut", () => {
  const sol = box(PROMINENCE_PRESETS[0].order);
  const cont = continuity(sol);
  const asked = uniformEdges("fillet", 12);
  const got = applicableEdges(asked, cont);

  it("keeps the continuous edges and squares the rest", () => {
    for (const k of EDGES) {
      expect(got[k]).toEqual(cont[k] ? { type: "fillet", radius: 12 } : { type: "none", radius: 0 });
    }
  });

  it("gives the panel no bevel where the edge is broken", () => {
    const owners = edgeOwners(sol.env, sol.panels);
    const i = sol.panels.findIndex((p) => p.face === "left");
    // The left panel owns left|top and left|bottom, but neither runs its length.
    expect(panelBevels(i, sol.panels[i], asked, owners)).not.toEqual({});
    expect(panelBevels(i, sol.panels[i], got, owners)).toEqual({});
  });

  it("leaves that panel's outer face full width, with nothing to run into", () => {
    const owners = edgeOwners(sol.env, sol.panels);
    const i = sol.panels.findIndex((p) => p.face === "left");
    const panel = sol.panels[i];
    const outer = ringAt(panel, panelBevels(i, panel, got, owners), 0);
    expect(outer.y).toEqual(panel.box.y);
    expect(outer.z).toEqual(panel.box.z);
  });

  it("draws no arc for a broken edge", () => {
    const keys = ["front", "end", "plan"].flatMap((v) => buildOrthoView(v, sol, got).arcs.map((a) => a.key));
    expect(keys.sort()).toEqual(EDGES.filter((k) => cont[k]).sort());
    expect(keys).not.toContain("left|top");
  });

  it("warns, naming the edges it left square", () => {
    const [msg] = partialEdgeIssues(asked, cont);
    expect(msg.level).toBe("warning");
    for (const k of ["left/top", "left/bottom", "right/top", "right/bottom"]) expect(msg.text).toContain(k);
    expect(msg.text).not.toContain("front/left");   // continuous, so not named
    expect(msg.text).toContain("Reorder prominence");
  });

  it("says nothing when every requested edge can be cut", () => {
    expect(partialEdgeIssues(noEdges(), cont)).toEqual([]);
    const onlyContinuous = applicableEdges(uniformEdges("chamfer", 6), cont);
    expect(partialEdgeIssues(onlyContinuous, cont)).toEqual([]);
  });
});

describe("through the app", () => {
  const filleted = derive({ ...DEFAULT_DESIGN, edge: { ...DEFAULT_DESIGN.edge, type: "fillet", radius: 10 } });

  it("surfaces the warning and cuts only the continuous edges", () => {
    expect(filleted.messages.some((m) => m.level === "warning" && m.text.includes("Left square"))).toBe(true);
    expect(EDGES.filter((k) => filleted.edges[k].type !== "none")).toHaveLength(8);
    expect(filleted.messages.some((m) => m.level === "error")).toBe(false);
  });

  it("puts eight arcs on the drawing, not twelve", () => {
    const arcs = ["front", "end", "plan"].reduce((a, v) => a + filleted.sheet.geometry[v].arcs.length, 0);
    expect(arcs).toBe(8);
  });

  it("stays silent with no treatment asked for", () => {
    expect(derive(DEFAULT_DESIGN).messages.filter((m) => m.text.includes("Left square"))).toEqual([]);
  });
});
