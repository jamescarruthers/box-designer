/** §61 The orientation cube: which face is where, and where the camera goes. */
import { describe, it, expect } from "vitest";
import { GIZMO_FACES, faceOfNormal, viewOf, gizmoRect, gizmoNdc, gizmoLabel } from "../src/three/gizmo.js";
import { VIEW_PRESETS } from "../src/ui/Viewport.jsx";

describe("§61 the orientation cube", () => {
  it("puts the faces in BoxGeometry's material order, in three's frame", () => {
    // +x, −x, +y, −y, +z, −z: right, left, top, bottom, front, back.
    expect(GIZMO_FACES).toEqual(["right", "left", "top", "bottom", "front", "back"]);
    expect(faceOfNormal([1, 0, 0])).toBe("right");
    expect(faceOfNormal([-1, 0, 0])).toBe("left");
    expect(faceOfNormal([0, 1, 0])).toBe("top");
    expect(faceOfNormal([0, -1, 0])).toBe("bottom");
    expect(faceOfNormal([0, 0, 1])).toBe("front");
    expect(faceOfNormal([0, 0, -1])).toBe("back");
  });

  it("agrees with the camera presets about where a face is seen from", () => {
    expect(viewOf("front")).toEqual(VIEW_PRESETS.front);
    expect(viewOf("right")).toEqual(VIEW_PRESETS.right);
    expect(viewOf("top")).toEqual(VIEW_PRESETS.top);
    // The back and the left are the front and the right turned half way.
    expect(viewOf("back")[0]).toBeCloseTo(Math.PI);
    expect(viewOf("left")[0]).toBeCloseTo(-Math.PI / 2);
  });

  it("looks down and up square-on, and stays off the poles", () => {
    expect(viewOf("top")[0]).toBe(0);
    expect(viewOf("bottom")[0]).toBe(0);
    expect(viewOf("top", { polarMin: 0.2 })[1]).toBe(0.2);
    expect(viewOf("bottom", { polarMax: 3 })[1]).toBe(3);
    expect(viewOf("nonsense")).toBeNull();
  });

  it("sits in the bottom right, and shrinks for a small canvas", () => {
    expect(gizmoRect(1000, 600)).toEqual({ x: 880, y: 10, w: 110, h: 110 });
    const small = gizmoRect(200, 150);
    expect(small.w).toBe(50);
    expect(small.x + small.w).toBe(190);
  });

  it("turns a pointer over the cube into device coordinates, and nothing elsewhere", () => {
    const rect = gizmoRect(1000, 600);
    // Dead centre of the square: the middle of the cube.
    const [x, y] = gizmoNdc(880 + 55, 600 - 10 - 55, rect, 600);
    expect(x).toBeCloseTo(0);
    expect(y).toBeCloseTo(0);
    // Top-left corner of the square is (−1, +1).
    expect(gizmoNdc(880, 600 - 120, rect, 600)).toEqual([-1, 1]);
    expect(gizmoNdc(500, 300, rect, 600)).toBeNull();
    expect(gizmoNdc(950, 20, rect, 600)).toBeNull();
  });

  it("names the faces the way the rest of the app does, in capitals", () => {
    expect(GIZMO_FACES.map(gizmoLabel)).toEqual(["RIGHT", "LEFT", "TOP", "BOTTOM", "FRONT", "BACK"]);
  });
});
