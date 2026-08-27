/**
 * §51 Perspective or parallel.
 *
 * The interesting part is not that a parallel camera exists — three makes one —
 * but that switching to it does not move the box. The frustum has to be sized
 * to what the perspective camera was already seeing, and the depth planes have
 * to be allowed behind the eye, which is the one thing a perspective camera
 * must never do.
 */
import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { makeCamera, frameParallel, parallelPlanes, isParallel, PROJECTIONS, panBy }
  from "../src/three/camera.js";

const FOV = 35;

describe("§51 the two projections", () => {
  it("builds the camera that was asked for", () => {
    const persp = makeCamera(false, FOV);
    expect(persp.isPerspectiveCamera).toBe(true);
    expect(persp.fov).toBe(FOV);
    expect(isParallel(persp)).toBe(false);

    const flat = makeCamera(true, FOV);
    expect(flat.isOrthographicCamera).toBe(true);
    expect(isParallel(flat)).toBe(true);

    expect(PROJECTIONS.map((p) => p.id)).toEqual(["perspective", "parallel"]);
  });

  it("frames the parallel camera on what the perspective one saw", () => {
    // Both cameras at the same place looking at the same target. A point on the
    // top edge of what the perspective camera sees *at the target* has to land
    // on the top edge of the parallel one too, or switching jumps.
    const dist = 1200, aspect = 16 / 9;
    const target = new THREE.Vector3(0, 150, 0);
    const eye = new THREE.Vector3(0, 150, dist);

    const persp = makeCamera(false, FOV);
    persp.aspect = aspect;
    persp.position.copy(eye);
    persp.lookAt(target);
    persp.updateMatrixWorld(true);
    persp.updateProjectionMatrix();

    const flat = makeCamera(true, FOV);
    frameParallel(flat, dist, aspect, FOV);
    flat.position.copy(eye);
    flat.lookAt(target);
    flat.updateMatrixWorld(true);
    flat.updateProjectionMatrix();

    // The top of the frame at the target's own depth.
    const h = 2 * dist * Math.tan((FOV * Math.PI) / 360);
    for (const [dx, dy] of [[0, h / 2], [0, -h / 2], [(h * aspect) / 2, 0], [-(h * aspect) / 2, 0]]) {
      const at = target.clone().add(new THREE.Vector3(dx, dy, 0));
      const a = at.clone().project(persp);
      const b = at.clone().project(flat);
      expect(b.x).toBeCloseTo(a.x, 6);
      expect(b.y).toBeCloseTo(a.y, 6);
    }
    // And the frustum is the shape of the viewport, not a square.
    expect((flat.right - flat.left) / (flat.top - flat.bottom)).toBeCloseTo(aspect, 9);
  });

  it("lets the parallel camera's near plane sit behind the eye", () => {
    // Zoomed in closer than the box is wide. A perspective camera has to keep
    // its near plane in front of it and accepts the clipping; parallel rays do
    // not care where along them the camera sits, so nothing need be cut off.
    const { near, far } = parallelPlanes(300, 900);
    expect(near).toBeLessThan(0);
    // The whole box is between the planes, front and back.
    expect(near).toBeLessThan(300 - 900);
    expect(far).toBeGreaterThan(300 + 900);
  });

  it("keeps the box between the planes at any distance", () => {
    for (const dist of [200, 900, 1200, 5000]) {
      for (const radius of [50, 400, 2000]) {
        const { near, far } = parallelPlanes(dist, radius);
        expect(near).toBeLessThanOrEqual(dist - radius);
        expect(far).toBeGreaterThanOrEqual(dist + radius);
      }
    }
  });
});

/**
 * §55 Panning.
 *
 * Dragging must move the box across the frame and nowhere else: along the
 * camera's own right and up, never towards or away from it, and by the same
 * amount of picture however far back the camera is standing.
 */
describe("§55 panning the view", () => {
  /** A camera at `dist`, looking at the origin from an arbitrary angle. */
  const posed = (dist, az = -0.68, pol = 1.02) => {
    const cam = makeCamera(false, FOV);
    cam.position.set(dist * Math.sin(pol) * Math.sin(az), dist * Math.cos(pol),
      dist * Math.sin(pol) * Math.cos(az));
    cam.lookAt(0, 0, 0);
    cam.updateMatrixWorld(true);
    return cam;
  };

  it("moves the target across the screen and never along the view", () => {
    const dist = 1200;
    const cam = posed(dist);
    const eye = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion).normalize();
    for (const [dx, dy] of [[100, 0], [0, 100], [-40, 70], [13, -9]]) {
      const moved = panBy(cam, dist, dx, dy, new THREE.Vector3());
      expect(moved.length()).toBeGreaterThan(0);
      // Nothing along the line of sight: panning is not zooming.
      expect(moved.dot(eye)).toBeCloseTo(0, 9);
    }
  });

  it("drags the picture the way the pointer went", () => {
    const dist = 1200;
    const cam = posed(dist);
    const right = new THREE.Vector3().setFromMatrixColumn(cam.matrix, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(cam.matrix, 1);
    // Pointer right: the target goes left, so the box appears to follow the hand.
    expect(panBy(cam, dist, 60, 0, new THREE.Vector3()).dot(right)).toBeLessThan(0);
    // Pointer down: the target goes up, and the box comes down the screen.
    expect(panBy(cam, dist, 0, 60, new THREE.Vector3()).dot(up)).toBeGreaterThan(0);
  });

  it("drags the same amount of picture at every zoom", () => {
    // The distance is in millimetres of box; what has to be constant is what
    // that is as a fraction of the frame, or panning is unusable close in and
    // useless far out.
    const share = (dist) => {
      const cam = posed(dist);
      const h = 2 * dist * Math.tan((FOV * Math.PI) / 360);
      return panBy(cam, dist, 100, 0, new THREE.Vector3()).length() / h;
    };
    const near = share(300), far = share(6000);
    expect(near).toBeCloseTo(far, 9);
  });

  it("accumulates, so a drag is the sum of its moves", () => {
    const dist = 900, cam = posed(dist);
    const once = panBy(cam, dist, 90, -30, new THREE.Vector3());
    const thrice = new THREE.Vector3();
    for (let i = 0; i < 3; i++) panBy(cam, dist, 30, -10, thrice);
    expect(thrice.x).toBeCloseTo(once.x, 9);
    expect(thrice.y).toBeCloseTo(once.y, 9);
    expect(thrice.z).toBeCloseTo(once.z, 9);
  });
});
