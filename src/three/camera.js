// §51 Perspective or parallel, in one place for both 3D views.
//
// The 3D view and the rendered view each build their own camera and each place
// it the same way: on a sphere about a target, at a distance. Parallel
// projection is that same orbit with the perspective taken out — the eye is
// where it was and looking where it was, and only the rays change from a fan
// to a bundle. So what is shared is the camera and the size of its frustum;
// the depth planes are not, because the two views want different things from
// them (§17's fat lines need the precision, a photograph does not).
//
// Why anybody wants it: a perspective picture of a box is a picture of a box
// seen from somewhere, and the far end is smaller than the near one. A parallel
// one is the box itself — two panels the same size are drawn the same size, and
// a proportion can be judged by eye rather than allowed for.

import * as THREE from "three";

export const PROJECTIONS = [
  { id: "perspective", name: "Perspective" },
  { id: "parallel", name: "Parallel" },
];

/** A camera of the projection asked for, at the field of view the view uses. */
export const makeCamera = (parallel, fov) => (parallel
  ? new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 100000)
  : new THREE.PerspectiveCamera(fov, 1, 1, 100000));

export const isParallel = (camera) => Boolean(camera?.isOrthographicCamera);

/**
 * Size a parallel camera's frustum to what the perspective one sees.
 *
 * At the target, a perspective camera of field `fov` at distance `dist` sees
 * `2·dist·tan(fov/2)` of height. Giving the parallel camera exactly that means
 * a box that filled the frame still fills it, and the toggle reads as a change
 * of projection rather than as a jump to somewhere else.
 */
export function frameParallel(camera, dist, aspect, fov) {
  const h = 2 * dist * Math.tan((fov * Math.PI) / 360);
  camera.top = h / 2;
  camera.bottom = -h / 2;
  camera.left = (-h * aspect) / 2;
  camera.right = (h * aspect) / 2;
}

/**
 * The depth planes for a parallel camera, which may sit behind the eye — and
 * have to.
 *
 * With parallel rays the eye's position along the view axis decides nothing
 * about the picture, only what is clipped. Clamping the near plane to a
 * positive number, the way a perspective camera must, cuts the front off the
 * box the moment somebody zooms in past its own radius.
 */
export const parallelPlanes = (dist, radius) => ({
  near: dist - radius * 2,
  far: dist + radius * 2,
});
