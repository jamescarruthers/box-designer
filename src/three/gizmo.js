// §61 The orientation cube: a small box in the corner of the 3D view that
// turns with the camera and names its faces.
//
// A box seen from an odd angle is six planes of the same colour, and which of
// them is the front is a thing the eye cannot tell. The cube says so — FRONT,
// BACK, LEFT, RIGHT, TOP, BOTTOM — and clicking a face turns the box to look
// at it, which is what the camera presets do with words.
//
// The arithmetic is here, without three, so it can be tested: which face goes
// in which material slot, which way the camera turns for a face, and where in
// the canvas the cube is drawn and hit.

import * as THREE from "three";
import { FACE_LABEL } from "../model/constants.js";

/**
 * Faces in the order `BoxGeometry` takes its six materials: +x, −x, +y, −y,
 * +z, −z. In three's frame (§4: x right, y up, z towards the viewer) that is
 * right, left, top, bottom, front, back.
 */
export const GIZMO_FACES = ["right", "left", "top", "bottom", "front", "back"];

/** The face a hit's outward normal belongs to. */
export function faceOfNormal(n) {
  const [x, y, z] = n;
  const ax = Math.abs(x), ay = Math.abs(y), az = Math.abs(z);
  if (ax >= ay && ax >= az) return x > 0 ? "right" : "left";
  if (ay >= ax && ay >= az) return y > 0 ? "top" : "bottom";
  return z > 0 ? "front" : "back";
}

/**
 * Where the camera goes to look straight at a face: [azimuth, polar], in the
 * viewport's spherical frame (position = dist · (sin pol sin az, cos pol,
 * sin pol cos az)). The top and bottom are square-on with the front at the
 * foot of the screen, the way the plan is drawn on the sheet.
 */
export function viewOf(face, { polarMin = 0.06, polarMax = Math.PI - 0.06 } = {}) {
  switch (face) {
    case "front": return [0, Math.PI / 2];
    case "back": return [Math.PI, Math.PI / 2];
    case "right": return [Math.PI / 2, Math.PI / 2];
    case "left": return [-Math.PI / 2, Math.PI / 2];
    case "top": return [0, Math.max(polarMin, 0.08)];
    case "bottom": return [0, Math.min(polarMax, Math.PI - 0.08)];
    default: return null;
  }
}

/**
 * The square the cube is drawn in: bottom right, in CSS pixels, with the
 * origin at the bottom left the way `renderer.setViewport` wants it.
 */
export function gizmoRect(width, height, size = 110, margin = 10) {
  const s = Math.min(size, Math.floor(Math.min(width, height) / 3));
  return { x: width - margin - s, y: margin, w: s, h: s };
}

/**
 * A pointer position (CSS pixels from the top left of the canvas) as
 * normalised device coordinates inside the cube's square, or null if it is
 * outside.
 */
export function gizmoNdc(px, py, rect, height) {
  const fromBottom = height - py;
  if (px < rect.x || px > rect.x + rect.w || fromBottom < rect.y || fromBottom > rect.y + rect.h) return null;
  return [((px - rect.x) / rect.w) * 2 - 1, ((fromBottom - rect.y) / rect.h) * 2 - 1];
}

/** The word on a face, as the rest of the app names it. */
export const gizmoLabel = (face) => FACE_LABEL[face].toUpperCase();

/**
 * A face of the cube: the word on a dark ground, as a texture. Falls back to a
 * plain material where there is no 2D canvas (jsdom), so the tests that mount
 * the viewport do not need one.
 */
function faceMaterial(face, { ink, ground, edge }) {
  const canvas = typeof document !== "undefined" ? document.createElement("canvas") : null;
  const ctx = canvas?.getContext?.("2d");
  const shade = ground[face] ?? ground.side;
  if (!ctx) return new THREE.MeshBasicMaterial({ color: new THREE.Color(shade) });
  // Drawn at twice the size it is shown, so the lettering is crisp on a 2x display.
  const size = 256;
  canvas.width = size;
  canvas.height = size;
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = edge;
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, size - 6, size - 6);
  ctx.fillStyle = ink;
  ctx.font = "600 38px ui-monospace, 'SF Mono', 'DejaVu Sans Mono', Menlo, Consolas, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(gizmoLabel(face), size / 2, size / 2 + 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return new THREE.MeshBasicMaterial({ map: texture });
}

/**
 * The cube's colours, matched to the stylesheet. The top is lit and the
 * underside is in shadow, so the cube reads as a solid and not as a hexagon
 * with words in it.
 */
export const GIZMO_COLOURS = {
  ink: "#dfe6ee", edge: "#6b7d90",
  ground: { top: "#2f3946", side: "#232a34", bottom: "#181d24" },
};

/**
 * The cube, its edges and its own scene and camera. `place(az, pol)` turns
 * the camera to match the main one; `dispose()` frees the lot.
 */
export function makeGizmo(colours = GIZMO_COLOURS) {
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1.15, 1.15, 1.15, -1.15, 0.1, 10);
  const materials = GIZMO_FACES.map((face) => faceMaterial(face, colours));
  const cube = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), materials);
  scene.add(cube);
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(cube.geometry),
    new THREE.LineBasicMaterial({ color: new THREE.Color(colours.edge) }));
  scene.add(edges);

  const place = (az, pol) => {
    camera.position.set(3 * Math.sin(pol) * Math.sin(az), 3 * Math.cos(pol), 3 * Math.sin(pol) * Math.cos(az));
    camera.lookAt(0, 0, 0);
  };
  const dispose = () => {
    cube.geometry.dispose();
    for (const m of materials) { m.map?.dispose(); m.dispose(); }
    edges.geometry.dispose();
    edges.material.dispose();
  };
  return { scene, camera, cube, place, dispose };
}
