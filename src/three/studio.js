// §19 The studio: a light, a backdrop, and the arithmetic behind both.
//
// A rendered view is not a better-shaded 3D view. It is a photograph of an
// object, and what makes a photograph read as one is almost never the shading
// model — it is that the object sits on something, casts a shadow onto it, and
// is lit by a room rather than by a bare bulb at the camera.
//
// So this builds a studio. A seamless sweep for the box to stand on, and an
// environment to light it with: a gradient sky, a soft box off to one side, and
// a weaker fill opposite. The same environment lights both the quick view and
// the path-traced one, so refining a render changes how carefully the light is
// followed, not what the light is.
//
// Everything here is numbers rather than three.js objects, so the light can be
// checked without a GPU — which matters, because "the render looks wrong" is
// otherwise a sentence with nowhere to go.

/** Where the key light sits: azimuth and elevation in radians, and how hard. */
/**
 * The key sits well round to one side of where the camera stands (§19 frames it
 * at -0.68), because a light next to the lens lights both visible faces the
 * same and a box with two identical faces reads as a flat shape with a line
 * drawn down it.
 */
export const KEY = { azimuth: -1.95, elevation: 0.62, radius: 0.34, intensity: 16 };

/** And the fill, opposite and much weaker — enough to keep a shadow side readable. */
export const FILL = { azimuth: 2.1, elevation: 0.3, radius: 0.85, intensity: 0.9 };

/** The ground and sky of the environment, as linear RGB. */
export const SKY = [0.45, 0.5, 0.6];
export const HORIZON = [0.4, 0.4, 0.42];
export const GROUND = [0.10, 0.10, 0.11];

/** Filmic exposure. Higher is brighter; ACES rolls the highlights off. */
export const EXPOSURE = 1.0;

const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

/**
 * A direction on the sphere, from an equirectangular pixel.
 *
 * `u` runs right around the horizon, `v` from the top of the sky (0) to
 * straight down (1) — which is how three maps an equirectangular texture, and
 * getting it upside down puts the light under the floor.
 */
export function directionAt(u, v) {
  const phi = (u - 0.5) * 2 * Math.PI;
  const theta = v * Math.PI;
  return [Math.sin(theta) * Math.sin(phi), Math.cos(theta), Math.sin(theta) * Math.cos(phi)];
}

/** A lamp's direction, from the same angles a person would describe it in. */
export function lampDirection({ azimuth, elevation }) {
  const c = Math.cos(elevation);
  return [c * Math.sin(azimuth), Math.sin(elevation), c * Math.cos(azimuth)];
}

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/**
 * How much a lamp contributes in a given direction: full on axis, nothing past
 * its radius, and a smooth shoulder between — a soft box has an edge, but not a
 * hard one, and a hard one shows up as a rim on every highlight.
 */
export function lampFalloff(direction, lamp) {
  const angle = Math.acos(Math.min(1, Math.max(-1, dot(direction, lampDirection(lamp)))));
  if (angle >= lamp.radius) return 0;
  const t = 1 - angle / lamp.radius;
  return t * t * (3 - 2 * t);                  // smoothstep, so the edge is soft
}

/**
 * The environment as an equirectangular image: `[width, height]` of linear RGB.
 *
 * Float rather than bytes, and the lamps go well above 1: the difference
 * between a light and a bright grey is that a light has more energy than white,
 * and a path tracer can tell.
 */
export function equirectStudio(width = 128, height = 64) {
  const data = new Float32Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    // Row 0 of a texture is the *bottom* of the image, and `v` here means the
    // angle down from straight up — so the rows are filled from the bottom of
    // the sky upward. Getting this the other way round is not subtle and not
    // obvious either: the box lights from below, its top goes dark, and the
    // picture reads as "flat lighting" rather than as "upside down".
    const v = 1 - (y + 0.5) / height;
    for (let x = 0; x < width; x++) {
      const u = (x + 0.5) / width;
      const dir = directionAt(u, v);

      // Sky above, ground below, with the horizon a soft band rather than a
      // line: a hard horizon in an environment map reads as a seam in every
      // reflection.
      const h = dir[1];
      const base = h >= 0
        ? mix(HORIZON, SKY, Math.min(1, h / 0.55) ** 0.7)
        : mix(HORIZON, GROUND, Math.min(1, -h / 0.35) ** 0.6);

      const lit = base.slice();
      for (const lamp of [KEY, FILL]) {
        const amount = lampFalloff(dir, lamp) * lamp.intensity;
        for (let i = 0; i < 3; i++) lit[i] += amount;
      }

      const at = (y * width + x) * 4;
      data[at] = lit[0]; data[at + 1] = lit[1]; data[at + 2] = lit[2]; data[at + 3] = 1;
    }
  }
  return { data, width, height };
}

/**
 * Read the environment back in a given direction.
 *
 * The inverse of how it was written, and the reason it exists: an environment
 * map written upside down looks like flat lighting rather than like a mistake —
 * the box lights from underneath, its top face goes dark, and every explanation
 * you reach for is about the shading model. Sampling it back is how that gets
 * caught by a test rather than by staring.
 */
export function sampleStudio(env, direction) {
  const [x, y, z] = direction;
  const length = Math.hypot(x, y, z) || 1;
  const theta = Math.acos(Math.min(1, Math.max(-1, y / length)));
  const phi = Math.atan2(x, z);
  const u = phi / (2 * Math.PI) + 0.5;
  const v = theta / Math.PI;

  const col = Math.min(env.width - 1, Math.max(0, Math.floor(u * env.width)));
  const row = Math.min(env.height - 1, Math.max(0, Math.floor((1 - v) * env.height)));
  const at = (row * env.width + col) * 4;
  return [env.data[at], env.data[at + 1], env.data[at + 2]];
}

/**
 * The profile of a seamless sweep, in the plane: along the floor, up through a
 * quarter circle, and on up the wall.
 *
 * Returned as points so the curve can be checked rather than eyeballed — the
 * whole point of a cyclorama is that there is no visible join, and a join is
 * exactly what a coarse curve or a mismatched tangent produces.
 */
export function sweepProfile(radius, floorRun, wallRise, steps = 24) {
  // [z, y], z toward the camera. Floor in, quarter circle up, wall away.
  const points = [[floorRun, 0]];
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * (Math.PI / 2);
    points.push([-radius * Math.sin(a), radius - radius * Math.cos(a)]);
  }
  points.push([-radius, wallRise]);
  return points;
}

/**
 * Where to stand and how far back, for a box `E` across.
 *
 * A little above the top of the box and round to one side: the three-quarter
 * view a product is photographed in, because it shows three faces and their
 * proportions at once.
 */
export function framing(E) {
  const diagonal = Math.hypot(E.x, E.y, E.z);
  return {
    distance: diagonal * 2.5,
    target: [0, E.z * 0.42, 0],
    azimuth: -0.68,
    polar: 1.16,
    // Big enough to fill the frame from any angle the view allows. A sweep
    // whose edge is in shot is a sheet of card, not a studio.
    sweep: {
      radius: diagonal * 1.2,
      floorRun: diagonal * 12,
      wallRise: diagonal * 6,
      width: diagonal * 14,
    },
  };
}

/**
 * How a sheet behaves in light.
 *
 * Dyed fibreboard is matte and slightly open. Ply with a sanded face is a
 * little tighter; neither is anywhere near a mirror, and a render that gives
 * them a mirror finish is the surest way to make a box look fake.
 *
 * Roughness and nothing else, which is not a compromise here: clearcoat and
 * sheen are for lacquer and cloth, and asking for them costs 56 kB of shader
 * that every visit downloads whether it opens this view or not.
 */
export function surfaceOf({ grained = false } = {}) {
  return { roughness: grained ? 0.62 : 0.78, metalness: 0 };
}
