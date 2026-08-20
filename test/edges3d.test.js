/**
 * §4 Hidden edges in the 3D view.
 *
 * Drawn at the same weight as visible ones, a box has no front and no back —
 * every edge is equally present and the eye has nothing to sort them by. These
 * are the decisions that fix that, kept out of the renderer so they can be
 * checked without a GPU.
 */
import { describe, it, expect } from "vitest";
import {
  edgePasses, showsFaces, needsDepth, HIDDEN_OPACITY, VISIBLE_OPACITY,
} from "../src/three/edges.js";
import { RENDER_STYLES } from "../src/ui/Viewport.jsx";

const STYLES = RENDER_STYLES.map((s) => s.id);
const pass = (style, name) => edgePasses(style).find((p) => p.name === name);

describe("§4 hidden edges are drawn faintly, not equally", () => {
  it("draws the far half of every edge, and draws it fainter", () => {
    for (const style of ["shaded-edges", "wireframe"]) {
      const hidden = pass(style, "hidden");
      expect(hidden, style).toBeTruthy();
      expect(hidden.opacity).toBeLessThan(pass(style, "visible").opacity);
      expect(hidden.opacity).toBe(HIDDEN_OPACITY);
    }
  });

  it("keeps the faint pass faint enough to survive stacking", () => {
    // Panels are drawn separately and their edges coincide along every joint,
    // so several faint lines composite onto the same pixels. Measured off the
    // render, 0.16 came back at 0.61 of a visible line — the calibration is
    // what makes this number look arbitrary, and it is not.
    const stacked = (a, n) => 1 - (1 - a) ** n;
    expect(stacked(HIDDEN_OPACITY, 5)).toBeLessThan(VISIBLE_OPACITY / 2);
  });

  it("inverts the depth test for the far pass, so it draws only what is behind", () => {
    expect(pass("shaded-edges", "hidden").depthFunc).toBe("greater");
    expect(pass("shaded-edges", "visible").depthFunc).toBe("less-equal");
  });

  it("keeps the far pass out of the depth buffer, so it cannot occlude anything", () => {
    expect(pass("shaded-edges", "hidden").depthWrite).toBe(false);
  });

  it("leaves an edge lying on a surface at full weight", () => {
    // Equal depth passes less-equal and fails greater, so a silhouette or a
    // crease is drawn once, by the near pass. Nothing on the surface goes grey.
    const [near, far] = edgePasses("shaded-edges");
    expect(near.depthFunc).toBe("less-equal");
    expect(far.depthFunc).toBe("greater");
    expect(near.opacity).toBe(VISIBLE_OPACITY);
  });

  it("still removes them entirely where that is the point of the style", () => {
    expect(edgePasses("wireframe-hlr").map((p) => p.name)).toEqual(["visible"]);
  });

  it("draws none at all on the plain shaded style", () => {
    expect(edgePasses("shaded")).toEqual([]);
  });

  it("puts a selection in front of everything rather than fading it", () => {
    for (const style of STYLES) {
      const [only, ...rest] = edgePasses(style, { accent: true });
      expect(rest, style).toEqual([]);
      expect(only.depthTest, style).toBe(false);
      expect(only.opacity, style).toBe(1);
    }
  });
});

describe("§4 the faces are in the depth buffer even when they are not shown", () => {
  it("shows faces only on the shaded styles", () => {
    expect(STYLES.filter(showsFaces)).toEqual(["shaded", "shaded-edges"]);
  });

  it("still renders them, depth-only, wherever edges have to be hidden by them", () => {
    // Without this the wireframe has no depth, nothing is behind anything, and
    // every edge is a visible one.
    for (const style of STYLES) {
      const hasHidden = edgePasses(style).some((p) => p.name === "hidden");
      const canHide = showsFaces(style) || needsDepth(style);
      expect(canHide, `${style} draws hidden edges with nothing to hide them`)
        .toBe(canHide || !hasHidden);
      if (hasHidden) expect(canHide, style).toBe(true);
    }
  });

  it("gives the hidden-removed style depth as well, which is what removes them", () => {
    expect(needsDepth("wireframe-hlr")).toBe(true);
  });
});
