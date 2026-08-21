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
 * §19 A three-point rig, in **camera-relative** angles.
 *
 * The whole studio — sweep and lamps together — turns with the view, so every
 * angle of the box is the same photograph of it. Azimuth is measured from where
 * the camera stands: 0 is a light beside the lens, which is the one place a
 * light must never be.
 *
 * Key, fill, rim, and each doing one job:
 *
 * - the **key** is nearly two thirds of a radian round and well up, so one face
 *   is lit and the next one along is not — that difference is the whole of what
 *   makes a box read as a solid rather than as a flat shape with a line down it;
 * - the **fill** sits opposite and low and cool, at a fifth of the key, to keep
 *   the shaded face readable without pretending it is lit;
 * - the **rim** is behind the box and high, and does the thing a sweep cannot:
 *   it puts a bright edge along the top and the far corner so the box separates
 *   from a backdrop that is nearly the same tone.
 *
 * Warm key against cool fill, because daylight through a window and the sky it
 * bounces off are not the same colour, and a render where they are looks like a
 * render.
 */
export const RIG = {
  key: { azimuth: -1.25, elevation: 0.62, colour: "#fff3e4", intensity: 2.7, casts: true },
  fill: { azimuth: 1.42, elevation: 0.22, colour: "#dae6ff", intensity: 0.8, casts: false },
  rim: { azimuth: 2.85, elevation: 0.78, colour: "#ffffff", intensity: 1.7, casts: false },
};

/** The one that draws the shadow. A single soft shadow reads; three overlap. */
export const KEY = RIG.key;


/** The ground and sky of the environment, as linear RGB. */
export const SKY = [0.52, 0.57, 0.66];
export const HORIZON = [0.44, 0.45, 0.47];
export const GROUND = [0.10, 0.10, 0.11];

/** Filmic exposure. Higher is brighter; ACES rolls the highlights off. */
export const EXPOSURE = 0.95;

/**
 * The sweep, and how it darkens away from the subject.
 *
 * A real cyclorama is not one flat tone. It is lit from the front, so it falls
 * off with distance, and that gradient is most of what makes a backdrop read as
 * a lit space rather than as a grey rectangle behind the object. Directional
 * lights give no falloff at all — they are parallel and infinitely far away —
 * so it is painted into the sweep's own vertex colours, where the rasteriser
 * and the path tracer both find it.
 *
 * Measured in box diagonals from the middle of the box, not as a fraction of
 * the sheet: the sheet is enormous so that its edges are never in shot, and a
 * gradient spread over the whole of it is a gradient nobody can see. Anchored
 * to the box, the pool of light lands around the box wherever the camera is.
 */
export const SWEEP = { colour: "#e8e8e5", near: 0.7, far: 4.5, dark: 0.22 };

/**
 * How bright the sweep is `distance` box-diagonals from the middle of the box.
 *
 * Full brightness out to `near`, then down to `dark` by `far`, on a smooth
 * shoulder — a linear ramp puts a visible line across the backdrop where it
 * starts, which is the one thing a seamless sweep exists to avoid.
 */
export function sweepShade(distance) {
  const d = Math.max(0, distance);
  if (d <= SWEEP.near) return 1;
  const t = Math.min(1, (d - SWEEP.near) / (SWEEP.far - SWEEP.near));
  const eased = t * t * (3 - 2 * t);
  return 1 - (1 - SWEEP.dark) * eased;
}

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

/**
 * A lamp's direction, from the same angles a person would describe it in.
 *
 * Camera-relative: the rig lives inside the group that turns with the view, so
 * these are the angles as seen from behind the lens.
 */
export function lampDirection({ azimuth, elevation }) {
  const c = Math.cos(elevation);
  return [c * Math.sin(azimuth), Math.sin(elevation), c * Math.cos(azimuth)];
}

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/**
 * The environment as an equirectangular image: `[width, height]` of linear RGB.
 *
 * A gradient and nothing else: sky above, ground below, a soft band between.
 * There are no lamps painted into it any more, and that is the point — an image
 * with a bright patch in it has to be turned when the studio turns, and three
 * r160 has no way to rotate `scene.environment`. Even all the way round, it
 * needs no turning, and every lamp is a real light in the rig instead, which
 * the path tracer follows as carefully as it follows anything else.
 *
 * Float rather than bytes because the sky is a light: it is what fills the
 * shadow side and what a matte face reflects, and eight bits of it bands.
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
      const lit = h >= 0
        ? mix(HORIZON, SKY, Math.min(1, h / 0.55) ** 0.7)
        : mix(HORIZON, GROUND, Math.min(1, -h / 0.35) ** 0.6);

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
export function sweepProfile(radius, floorRun, wallRise, back = 0, steps = 24) {
  // [z, y], z toward the camera. Floor in, quarter circle up, wall away.
  //
  // `back` is where the floor stops being flat. It has to be behind the box, or
  // the curve rises through it: the box is centred on the origin, so a curve
  // starting there cuts off its back half — reported as "the box is slightly
  // cut off by the curve on the floor", which is exactly what it was.
  const points = [[floorRun, 0]];
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * (Math.PI / 2);
    points.push([-back - radius * Math.sin(a), radius - radius * Math.cos(a)]);
  }
  points.push([-back - radius, wallRise]);
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
    // Looking down enough to see the floor the box stands on. With the sweep
    // turned to sit behind it (§19), a camera on the level sees nothing but
    // wall, and a box against a wall with no ground under it floats.
    polar: 1.02,
    // Big enough to fill the frame from any angle the view allows. A sweep
    // whose edge is in shot is a sheet of card, not a studio.
    //
    // The curve starts a clear half-diagonal behind the box, so that turning
    // the view right round never brings the box into the part of the floor that
    // is on its way up.
    // The curve is wide and well back, so what fills the frame is floor with
    // the box standing on it, and the wall is only ever the top of the picture.
    // A tight radius close behind puts the camera nose-to-nose with a wall.
    sweep: {
      radius: diagonal * 3,
      back: diagonal * 1.6,
      floorRun: diagonal * 12,
      wallRise: diagonal * 5,
      width: diagonal * 16,
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
