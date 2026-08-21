// Drivers and ports: the holes that make a box a speaker.
//
// §10 recorded the absence of these as the biggest gap in the model — without
// them the part templates are rectangles and not worth printing at 1:1.
//
// A fitting sits on one face, positioned in that face's two planar axes and
// measured from the envelope's origin corner, so its position reads straight
// off the face-on view. Everything is a circle or a ring of circles, which is
// what a router or a hole saw actually makes.

import { AXIS, AXES, FACE_LABEL } from "./constants.js";
import { panelAxes } from "./solver.js";

/** The two planar axes of a face, in x, y, z order. */
export const faceAxes = (face) => panelAxes(face).planar;

export const DEFAULT_DRIVER = {
  type: "driver",
  cutout: 116,        // the hole the cone moves through
  outer: 162,         // §22 the frame's outside diameter — what sits on the panel
  pcd: 147,           // pitch circle diameter of the mounting holes
  bolts: 5,           // "a set number of mounting holes"
  boltHole: 5,        // 5 mm clearance holes
  // §24 Behind the baffle. `depth` is overall, measured from the mounting face
  // the way a datasheet measures it — the Pluvia 7P's 71.5 mm runs from the
  // front of its frame to the back of its magnet, not from the baffle.
  depth: 78,
  magnet: 90,         // magnet diameter
  magnetDepth: 32,    // how much of the depth the magnet block takes
  // §27 Cone depth is deliberately *not* here. Left unset it follows the
  // cutout, so a 15 inch driver starts with a 15 inch driver's cone rather
  // than a 6 inch one's — and typing a number still overrides it for good.
};

/**
 * §22 The outside diameter of a driver's frame.
 *
 * The one dimension a datasheet always gives that the model did not hold. It is
 * what decides whether two drivers foul each other and whether one clears the
 * edge of the panel — the bolt circle is not the widest part of a driver, the
 * flange is, and a check against the bolts alone passes a driver whose rim is
 * already over the edge.
 *
 * Read with a fallback rather than as a plain field, so a design saved before
 * this existed still draws and still gets checked. The fallback is the bolt
 * circle plus enough material to put a bolt through: on a Markaudio Pluvia 7P,
 * whose datasheet says 112 PCD with 3.1 mm holes and a 122.3 mm frame, it comes
 * out at 121.3 — within a millimetre of the real thing.
 */
export function driverOuter(f) {
  if (Number.isFinite(f?.outer) && f.outer > 0) return f.outer;
  return f.pcd + f.boltHole * 3;
}

export const DEFAULT_PORT = {
  type: "port",
  tube: true,         // whether a tube is fitted behind the hole
  diameter: 68,       // inside diameter: the bore, through the panel and the tube alike
  length: 150,        // tube length, measured from the inner face of the panel
  wall: 3,            // tube wall thickness, which gives the outside diameter
};

/**
 * Whether a port carries a tube.
 *
 * Not every port does. A short one in a thick baffle is a plain hole, and a
 * bought tube is often left off the drawing and fitted on assembly. The bore is
 * the same either way — it is the tube's inside diameter, continuous from the
 * outer face of the panel to the end of the tube — so this changes what is
 * drawn and modelled behind the panel, and nothing about the hole.
 *
 * Read as "not false" rather than "true" so a port saved before the option
 * existed keeps its tube instead of quietly losing it.
 */
export const hasTube = (f) => f?.type === "port" && f.tube !== false;

export const FITTING_DEFAULTS = { driver: DEFAULT_DRIVER, port: DEFAULT_PORT };

let nextId = 0;
export const newFitting = (type, face, at) => ({
  // A position of its own, always. Without one `at.a` is undefined, the bore is
  // built at NaN and the boolean does not fail — it grinds.
  ...FITTING_DEFAULTS[type], id: `f${++nextId}`, face, at: { a: 0, b: 0, ...at },
});

/**
 * Every circle a fitting cuts, in the face's planar coordinates.
 *
 * The bolt ring starts at top dead centre and runs clockwise, which is how
 * anyone marks out by hand. "Top" is +b, the face's second planar axis, which
 * for the four upright faces is z — so this is genuinely up on the object, not
 * merely up on the sheet.
 */
export function fittingCircles(f) {
  // Nothing downstream can do anything sensible with a hole at NaN, least of
  // all a boolean, so it never gets that far.
  if (![f.at?.a, f.at?.b].every(Number.isFinite)) return [];
  if (f.type === "port") return [{ role: "bore", d: f.diameter, at: f.at }];
  const out = [{ role: "cutout", d: f.cutout, at: f.at }];
  for (let i = 0; i < f.bolts; i++) {
    const theta = Math.PI / 2 - (i / f.bolts) * 2 * Math.PI;
    out.push({
      role: "bolt", d: f.boltHole, index: i,
      at: { a: f.at.a + (f.pcd / 2) * Math.cos(theta), b: f.at.b + (f.pcd / 2) * Math.sin(theta) },
    });
  }
  return out;
}

/**
 * The radius of the smallest circle containing everything a fitting occupies.
 *
 * §22 For a driver that is the frame, not the holes. It used to be the bolt
 * circle, which is what the panel has cut into it — but what has to fit is the
 * driver, and its flange overhangs the bolts by a few millimetres on every
 * driver ever made. The cutout and the bolt circle stay in the reckoning
 * because nothing says a frame has to be the widest of the three, and a rule
 * that quietly stopped checking two of them would be a worse rule.
 */
export function fittingExtent(f) {
  if (f.type === "port") return f.diameter / 2;
  return Math.max(f.cutout / 2, f.pcd / 2 + f.boltHole / 2, driverOuter(f) / 2);
}

/** The outside radius of a port's tube, which is what has to clear the cavity. */
export const portOuterRadius = (f) => f.diameter / 2 + f.wall;

/**
 * Every panel a fitting is cut through, outermost first.
 *
 * A hole goes all the way. Cladding, carcass, doubler: a driver bolted to the
 * front of a clad and doubled panel passes through all three, and cutting only
 * the outermost left a 116 mm cutout opening onto solid material behind. The
 * layers are stacked along the face's own axis, so a bore that enters the first
 * enters all of them — there is nothing to work out beyond the order.
 */
export function fittingStack(panels, face) {
  const [a, s] = AXIS[face];
  const outerness = (p) => (s < 0 ? p.box[a][0] : -p.box[a][1]);
  return panels.filter((p) => p.face === face).sort((x, y) => outerness(x) - outerness(y));
}

/** Fittings cut into a given panel: every fitting on that panel's face. */
export function fittingsFor(fittings, panel) {
  return fittings.filter((f) => f.face === panel.face);
}

/**
 * The panel a fitting is set out from: the outermost on that face, since that
 * is the face a driver bolts to and the surface the position is measured on.
 * Returns { face: panel } for the faces in use.
 */
export function fittingOwners(panels, faces) {
  const owners = {};
  for (const face of faces) {
    const [outer] = fittingStack(panels, face);
    if (outer) owners[face] = outer;
  }
  return owners;
}

/**
 * The panel a port's tube hangs off: the innermost, since the tube stands into
 * the cavity. One tube per port however many layers the bore went through.
 */
export function innermostOn(panels, face) {
  return fittingStack(panels, face).at(-1);
}

/**
 * §20 Where a fitting sits, in model coordinates, whichever way it was given.
 *
 * `units: "ratio"` means `at` is a **percentage** across the panel on each of
 * its two planar axes — 50/50 is the middle of the face. Anything else means
 * millimetres in model coordinates, which is what everything downstream reads.
 *
 * Percentages are stored as the number typed rather than as a fraction: a
 * design that says 50 and a control that shows 50 are the same number, and
 * nothing has to be multiplied by a hundred on the way in or out.
 *
 * The point of offering both: a driver is usually *centred*, or a third of the
 * way up, and that is a proportion. It should stay where it was put when the
 * box changes size, and an absolute position does not.
 */
export function resolveAt(f, panel) {
  if (f?.units !== "ratio" || !panel) return f.at;
  const [p, q] = faceAxes(f.face);
  const along = (axis, percent) => {
    const [lo, hi] = panel.box[axis];
    return lo + (hi - lo) * (percent / 100);
  };
  return { a: along(p, f.at.a), b: along(q, f.at.b) };
}

/** The same fitting with its position in millimetres, whatever it was authored in. */
export const inMillimetres = (f, panel) =>
  (f?.units === "ratio" ? { ...f, at: resolveAt(f, panel), units: "mm" } : f);

/**
 * Every fitting, resolved against the panel it is set out from.
 *
 * Done once, where the design is derived, so that the twenty places that read
 * `f.at.a` go on reading a millimetre and never learn that there is another way
 * to write one down.
 */
export const resolveFittings = (fittings, owners) =>
  (fittings ?? []).map((f) => inMillimetres(f, owners?.[f.face]));

/** Turn a position into the other units, so switching keeps the fitting still. */
export function convertAt(f, panel, units) {
  if (!panel || units === f.units) return f.at;
  const [p, q] = faceAxes(f.face);
  // Unrounded, both ways. A percentage is shown to one decimal place, but a
  // stored one that has been rounded is a fitting that shifts a tenth of a
  // millimetre every time somebody looks at the units control.
  if (units === "ratio") {
    const back = (axis, mm) => {
      const [lo, hi] = panel.box[axis];
      return hi === lo ? 0 : ((mm - lo) / (hi - lo)) * 100;
    };
    return { a: back(p, f.at.a), b: back(q, f.at.b) };
  }
  return resolveAt({ ...f, units: "ratio" }, panel);
}

/**
 * §22 The shape of a driver, as a profile to revolve.
 *
 * Points are `[radius, height]` in millimetres, height measured from the outer
 * face of the panel: positive is proud of it, negative is down inside the
 * cutout. Revolved about the axis they make the driver you can see once it is
 * bolted on — frame, surround, cone, dust cap — and the back of it is closed
 * off flat, because everything behind the baffle is inside a sealed box and is
 * never in shot.
 *
 * Two of these numbers come from the datasheet: the cutout and the frame. The
 * rest are proportions of them. That is a deliberate limit rather than a gap
 * waiting to be filled — a datasheet gives a cone depth about as often as it
 * gives the colour of the terminals, and asking somebody to measure their dust
 * cap to get a picture of their box is a poor trade. They are chosen against
 * the Markaudio Pluvia 7P drawing, which is a typical enough full-range driver
 * to set them by.
 */
export const DRIVER_SHAPE = {
  flange: 0.037,      // frame thickness, of the frame diameter: 4.5 on a 122.3
  surround: 0.16,     // the roll around the cone, of the cutout radius
  cone: 0.42,         // how deep the cone sits, of the cutout radius
  cap: 0.3,           // dust cap radius, of the cutout radius
  dome: 0.5,          // how far the cap domes, of its own radius
  // Millimetres, not a proportion. The part of the frame that goes through the
  // hole cannot be exactly the size of the hole: coincident surfaces flicker
  // against each other wherever both are drawn, and a driver is not a push fit
  // anyway. Half a millimetre of slop, which is what one has in the workshop.
  slop: 0.5,
};

/**
 * Where the cone starts in the profile.
 *
 * Everything before it is frame and surround — cast, pressed or moulded, and
 * black on nearly every driver made. Everything from it on is the cone and its
 * dust cap, which are paper. Defined here beside the profile so the two cannot
 * drift: a boundary counted somewhere else is a boundary that goes wrong the
 * first time a point is added.
 */
export const driverConeFrom = (steps = 8) => 7 + steps;

/**
 * §24 The three numbers behind the baffle, each with a fallback.
 *
 * Read the same way as the frame diameter (§22): a design saved before these
 * existed still draws, and a datasheet that gives only some of them still
 * works. The fallbacks are plausible rather than exact — depth in particular
 * does not scale with diameter across driver classes, because a small
 * full-range driver is relatively deep and a big woofer relatively shallow — so
 * they are a starting point to correct, not an answer.
 */
export function driverDepth(f) {
  if (Number.isFinite(f?.depth) && f.depth > 0) return f.depth;
  return driverOuter(f) * 0.55;
}

export function driverMagnet(f) {
  if (Number.isFinite(f?.magnet) && f.magnet > 0) return f.magnet;
  // Through the hole it was posted through, with room to spare: on the Pluvia
  // this gives 75 against a real 75.8.
  return Math.max(1, f.cutout) * 0.75;
}

export function driverMagnetDepth(f) {
  if (Number.isFinite(f?.magnetDepth) && f.magnetDepth > 0) return f.magnetDepth;
  return driverDepth(f) * 0.5;
}

/**
 * §27 How deep the cone is, from the surround down to the dust cap.
 *
 * The last of the proportions to become a number somebody can give. It was
 * 0.42 of the cutout radius, which suits a typical full-range driver and draws
 * a 15 inch pro woofer noticeably too shallow — real ones are half as deep
 * again. The fallback keeps that ratio, so nothing that was drawn before
 * changes unless it is told to.
 */
export function driverCone(f) {
  if (Number.isFinite(f?.coneDepth) && f.coneDepth > 0) return f.coneDepth;
  return (Math.max(0, f.cutout) / 2) * DRIVER_SHAPE.cone;
}

export function driverProfile(f, steps = 8) {
  const Rc = Math.max(0, f.cutout) / 2;
  // A frame is never narrower than the hole it sits over — but a number being
  // typed passes through every value on its way, and "8" on the road to "80" on
  // a 100 mm cutout turned the profile inside out: the contour doubled back on
  // itself and the body came out as a knot. Clamped, so what is drawn is always
  // a driver; `fittingIssues` says the number is wrong.
  const Ro = Math.max(driverOuter(f) / 2, Rc);
  const flange = driverOuter(f) * DRIVER_SHAPE.flange;
  const roll = Rc * DRIVER_SHAPE.surround;
  const cone = driverCone(f);
  const Rd = Rc * DRIVER_SHAPE.cap;
  const dome = Rd * DRIVER_SHAPE.dome;
  // Clear of the deepest thing in front of it, so the flat back never cuts
  // through the cone it is supposed to be behind.
  const back = Math.max(0, cone - flange) + roll;

  const points = [];
  // §24 Back first, from the axis out: the flat back of the magnet, up its
  // side, out along the basket to the wall of the hole, and along the face to
  // the rim of the frame. That is the silhouette of a motor and a cast basket,
  // which is all of the driver anybody sees from behind.
  const Rb = Math.max(0.1, Rc - DRIVER_SHAPE.slop);
  const Rm = Math.min(Math.max(0.1, driverMagnet(f) / 2), Rb);
  // Everything behind the mounting face. A datasheet measures depth from the
  // front of the frame, and the baffle is a frame's thickness behind that.
  const deep = Math.max(back, driverDepth(f) - flange);
  // The basket needs somewhere to be: the magnet cannot fill the whole depth,
  // or the frame would spring straight from the hole to the back of the motor.
  const motor = Math.min(driverMagnetDepth(f), deep * 0.8);
  points.push([0, -deep], [Rm, -deep], [Rm, -deep + motor], [Rb, 0], [Ro, 0]);
  // Then the front, from the rim inward: up the edge of the frame, in across
  // its top, over the surround, down the cone, and up the dome of the cap.
  points.push([Ro, flange], [Rc, flange]);
  for (let i = 1; i <= steps; i++) {
    // A half roll, bulging proud of the frame the way a rubber surround does.
    const a = (i / steps) * Math.PI;
    points.push([Rc - (roll / 2) * (1 - Math.cos(a)), flange + (roll / 2) * Math.sin(a)]);
  }
  points.push([Rd, flange - cone]);
  for (let i = 1; i <= steps; i++) {
    const a = (i / steps) * (Math.PI / 2);
    points.push([Rd * Math.cos(a), flange - cone + dome * Math.sin(a)]);
  }
  return points;
}

/**
 * §27 What the driver takes out of the box, in cubic millimetres.
 *
 * The part of it behind the baffle: the basket and the motor, and the back of
 * the cone with them. Integrated exactly over the profile that is drawn (§24)
 * rather than guessed at — each segment of the closed loop below the mounting
 * plane contributes a slice of a solid of revolution, which is the shell
 * theorem applied to a polygon and comes out to a sum over its edges.
 *
 * It is an **upper bound**, and deliberately so. The profile draws a basket as
 * a closed cone frustum where a real one is half air between the spokes, so
 * this over-states a real driver's displacement by a good margin. Where a
 * datasheet publishes the real figure, `displaces` takes it and this is not
 * used.
 *
 * Not **Vd**, whatever a search engine suggests. Vd is a Thiele-Small
 * parameter, Sd × Xmax: the air the cone sweeps at full excursion while the
 * driver is working. This is the lump of magnet, basket and cone standing
 * still in the box, taking volume away from the air inside it. Two different
 * quantities that happen to both be volumes of a driver, and only this one
 * belongs in a cabinet's net capacity.
 */
/**
 * §28 Whether this driver's displacement was given or worked out.
 *
 * Worth being able to ask, because the two are not equally good and the net
 * volume rests on whichever it got. A published displacement is a measurement;
 * the arithmetic below is an over-estimate with a known reason.
 */
export const hasDisplacement = (f) => Number.isFinite(f?.displaces) && f.displaces >= 0;

export function driverDisplacement(f, steps = 8) {
  if (hasDisplacement(f)) return f.displaces;
  const profile = driverProfile(f, steps);
  // Clipped at the mounting face: everything in front of it is outside the box.
  const clipped = clipBelow(profile, 0);
  return Math.abs(revolvedVolume(clipped));
}

/**
 * The volume swept by revolving a closed polygon about the axis r = 0.
 *
 * For each edge the swept solid is a conical frustum, and the signed sum round
 * a closed loop leaves exactly what is enclosed. Signed, so the direction the
 * loop is traced does not have to be known — the caller takes the modulus.
 */
export function revolvedVolume(points) {
  let v = 0;
  for (let i = 0; i < points.length; i++) {
    const [r1, h1] = points[i];
    const [r2, h2] = points[(i + 1) % points.length];
    v += (Math.PI / 3) * (r1 * r1 + r1 * r2 + r2 * r2) * (h2 - h1);
  }
  return v;
}

/** The part of a closed profile at or below `cut`, closed off along that line. */
export function clipBelow(points, cut = 0) {
  const out = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const aIn = a[1] <= cut;
    const bIn = b[1] <= cut;
    if (aIn) out.push(a);
    if (aIn !== bIn) {
      // Where the edge crosses the plane, so the cut face is flat and closed.
      const t = (cut - a[1]) / (b[1] - a[1]);
      out.push([a[0] + (b[0] - a[0]) * t, cut]);
    }
  }
  return out;
}

/** §27 What a port takes out of the box: its whole outside, bore and all. */
export function portDisplacement(f) {
  if (!hasTube(f)) return 0;
  return Math.PI * portOuterRadius(f) ** 2 * Math.max(0, f.length);
}

/** How far a driver stands proud of the panel it is bolted to. */
export function driverStandoff(f) {
  const flange = driverOuter(f) * DRIVER_SHAPE.flange;
  return flange + (f.cutout / 2) * DRIVER_SHAPE.surround / 2;
}

/** A fitting's position in model space, on the outer surface of its panel. */
export function fittingOrigin(f, panel) {
  const [a, s] = AXIS[f.face];
  const [p, q] = faceAxes(f.face);
  const v = {};
  v[a] = s < 0 ? panel.box[a][0] : panel.box[a][1];
  v[p] = f.at.a;
  v[q] = f.at.b;
  return { x: v.x, y: v.y, z: v.z, axis: a, sign: s };
}

const round1 = (v) => Math.round(v * 10) / 10;

/** How a layer reads in a message about a hole going through it. */
const LAYER_WORD = { cladding: "cladding", shell: "carcass panel", doubler: "doubler" };

/** §8 Fittings that will not cut cleanly. */
export function fittingIssues(fittings, panels, owners, cavity) {
  const msgs = [];
  const seen = [];

  for (const f of fittings) {
    const panel = owners[f.face];
    const label = `${describeFitting(f)} on the ${FACE_LABEL[f.face].toLowerCase()}`;
    if (!panel) {
      msgs.push({ level: "error", text: `${label}: there is no panel on that face.` });
      continue;
    }

    const [p, q] = faceAxes(f.face);
    const r = fittingExtent(f);
    if (![f.at?.a, f.at?.b].every(Number.isFinite)) {
      msgs.push({ level: "error", text: `${label} has no position on the panel.` });
      continue;
    }
    // Every layer, not only the one it is set out from. A doubler is inset from
    // the carcass panel it backs, so a bore can sit comfortably in the carcass
    // and run off the edge of the doubler behind it — and the bore goes through
    // both, so that is a hole opening into fresh air.
    for (const through of fittingStack(panels, f.face)) {
      const where = through === panel ? "the panel"
        : `the ${LAYER_WORD[through.layer] ?? through.layer} behind it`;
      for (const [axis, at] of [[p, f.at.a], [q, f.at.b]]) {
        const lo = through.box[axis][0], hi = through.box[axis][1];
        if (at - r < lo || at + r > hi) {
          msgs.push({ level: "error",
            text: `${label} runs off ${where}: it needs ${round1(r)} mm clearance and it spans ${round1(lo)}–${round1(hi)}.` });
        } else if (at - r < lo + 10 || at + r > hi - 10) {
          msgs.push({ level: "warning",
            text: `${label} leaves under 10 mm of material at the edge of ${where}.` });
        }
      }
    }

    // §22 A frame narrower than the hole it covers is not a driver.
    if (f.type === "driver" && driverOuter(f) < f.cutout) {
      msgs.push({ level: "error",
        text: `${label}: the ⌀${round1(driverOuter(f))} frame is narrower than its own ⌀${f.cutout} cutout — it would fall through the hole.` });
    }
    // §22 A frame narrower than its own bolt circle cannot be bolted down.
    if (f.type === "driver" && driverOuter(f) < f.pcd + f.boltHole) {
      msgs.push({ level: "warning",
        text: `${label}: the ⌀${round1(driverOuter(f))} frame is too small for a ${f.pcd} PCD — the bolt holes fall outside it.` });
    }
    if (f.type === "driver" && f.pcd / 2 - f.boltHole / 2 < f.cutout / 2) {
      msgs.push({ level: "warning",
        text: `${label}: the bolt holes break into the cutout — PCD ${f.pcd} against a ${f.cutout} mm hole.` });
    }
    // §24 A driver goes in through its own hole and stands in the cavity. Both
    // of those can fail, and neither shows up in any of the flat views.
    if (f.type === "driver") {
      if (driverMagnet(f) > f.cutout) {
        msgs.push({ level: "warning",
          text: `${label}: the ⌀${round1(driverMagnet(f))} magnet will not pass through a ${f.cutout} mm cutout — it would have to be fitted from behind.` });
      }
      // §24 A depth shallower than the driver's own cone is not a depth. The
      // profile clamps so the body is still drawn, but the number is wrong and
      // saying so is more use than quietly drawing something else.
      const flange = driverOuter(f) * DRIVER_SHAPE.flange;
      const least = flange + (f.cutout / 2) * DRIVER_SHAPE.cone;
      if (driverDepth(f) < least) {
        msgs.push({ level: "warning",
          text: `${label}: ${round1(driverDepth(f))} mm is shallower than its own cone, which needs about ${round1(least)} — check the depth against the datasheet.` });
      }
      const room = cavity ? cavity[AXIS[f.face][0]][1] - cavity[AXIS[f.face][0]][0] : Infinity;
      // What sits inside the box: everything but the frame on the outside face.
      const inside = driverDepth(f) - driverOuter(f) * DRIVER_SHAPE.flange;
      if (inside > room) {
        msgs.push({ level: "error",
          text: `${label} is ${round1(inside)} mm deep behind the baffle and the cavity is only ${round1(room)} mm — it will not fit in the box.` });
      } else if (inside > room - 15) {
        msgs.push({ level: "warning",
          text: `${label} leaves ${round1(room - inside)} mm between its magnet and the back of the box.` });
      }
    }
    if (hasTube(f)) {
      const depth = cavity ? cavity[AXIS[f.face][0]][1] - cavity[AXIS[f.face][0]][0] : Infinity;
      if (f.length > depth) {
        msgs.push({ level: "warning",
          text: `${label}: the ${f.length} mm tube is longer than the ${round1(depth)} mm cavity — it will need a bend or a shorter tune.` });
      }
    }

    for (const other of seen) {
      if (other.face !== f.face) continue;
      const d = Math.hypot(f.at.a - other.at.a, f.at.b - other.at.b);
      if (d < fittingExtent(f) + fittingExtent(other)) {
        msgs.push({ level: "error",
          text: `${label} overlaps the ${describeFitting(other).toLowerCase()} beside it.` });
      }
    }
    seen.push(f);
  }
  return msgs;
}

export function describeFitting(f) {
  if (f.type !== "port") {
    // §24 The depth is in the line because it is the number that decides
    // whether the driver fits the box at all, and it is the one dimension of a
    // driver that none of the flat views can show.
    return `Driver ⌀${f.cutout} in a ⌀${round1(driverOuter(f))} frame, ${round1(driverDepth(f))} deep, `
      + `${f.bolts} × ⌀${f.boltHole} on ${f.pcd} PCD`;
  }
  return hasTube(f) ? `Port ⌀${f.diameter} × ${f.length}` : `Port ⌀${f.diameter}, no tube`;
}

/** A short note for the cut list. */
export function fittingNote(fittings) {
  if (!fittings.length) return "";
  return fittings.map(describeFitting).join("; ");
}

/**
 * Where a point on a face lands on the part template, in blank coordinates.
 *
 * The template is drawn as the blank is cut — longest side across — which for
 * a tall baffle is the face-on view laid on its side. It is not the elevation
 * rotated to match, and it should not be: the templates share one scale keyed
 * to the longest part, and that only works if every blank lies the same way.
 *
 * The width axis is flipped so that the two axes stay right-handed, so a
 * template laid on the panel the way it is drawn has its holes in the right
 * places rather than mirrored.
 */
export function toBlank(at, panel, blank, face) {
  const [p, q] = faceAxes(face);
  const along = (axis) => (axis === p ? at.a : at.b);
  return {
    x: along(blank.lengthAxis) - panel.box[blank.lengthAxis][0],
    y: panel.box[blank.widthAxis][1] - along(blank.widthAxis),
  };
}

/** Every circle a panel's fittings cut, in that panel's blank coordinates. */
export function blankCircles(fittings, panel, blank) {
  return fittings.flatMap((f) =>
    fittingCircles(f).map((c) => ({ ...c, ...toBlank(c.at, panel, blank, f.face), fitting: f })));
}

/** The bolt circle itself, drawn as a centre line rather than cut. */
export function blankBoltCircles(fittings, panel, blank) {
  return fittings.filter((f) => f.type === "driver").map((f) => ({
    ...toBlank(f.at, panel, blank, f.face), d: f.pcd, fitting: f,
  }));
}
