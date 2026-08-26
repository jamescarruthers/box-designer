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
import { BEVEL_MARGIN } from "./bevel.js";

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
  // §36 A bolt hole may be blind: drilled a given depth from the mounting face
  // for a screw or an insert rather than run right through. Carried on the
  // circle so the kernel can bore it and the flat views can ignore it — a
  // blind hole is still a hole to mark out and drill.
  const deep = Number.isFinite(f.boltDeep) && f.boltDeep > 0 ? f.boltDeep : undefined;
  for (let i = 0; i < f.bolts; i++) {
    const theta = Math.PI / 2 - (i / f.bolts) * 2 * Math.PI;
    out.push({
      role: "bolt", d: f.boltHole, index: i, deep,
      at: { a: f.at.a + (f.pcd / 2) * Math.cos(theta), b: f.at.b + (f.pcd / 2) * Math.sin(theta) },
    });
  }
  return out;
}

/**
 * §33 How deep a hole goes, in layers from the outside.
 *
 * `null` is every layer, which is what a hole did before there was a choice
 * and what most holes want: a driver's cutout has to reach the cavity or the
 * cone is firing into a pocket. A number is a count of panels from the
 * outermost of the face inward — 1 is the panel the driver bolts to and
 * nothing behind it.
 *
 * Counted rather than named because a bore enters at the face and stops: it
 * cannot skip the carcass and reappear in the doubler, so there is no set of
 * layers to pick from, only a depth to stop at.
 */
export const reaches = (depth, through) => through == null || depth < through;

/**
 * §33 What a fitting cuts into the panel `depth` layers in, or null for
 * nothing at all.
 *
 * The one place the choice is applied. Everything downstream — the kernel's
 * booleans, the part templates, the DXF, the cut list note — asks which
 * fittings are on a panel and then reads the circles off them, so a fitting
 * handed back with no bolts has no bolt holes anywhere, in every one of them
 * at once.
 */
export function fittingAt(f, depth, { ahead = 0 } = {}) {
  const cutout = reaches(depth, f.through);
  // Bolts never go deeper than the hole they surround: a panel with the
  // clearance holes but no cutout is a panel the cone cannot get through, and
  // that is a mistake rather than an option.
  const bolts = f.type === "driver" && f.bolts > 0
    && cutout && reaches(depth, boltDepth(f));
  if (!cutout) return null;
  // No bolts here, and so no depth for them either: a fitting handed on with
  // nought bolts and a bolt depth is two facts that disagree.
  if (!bolts) return f.bolts > 0 || f.boltDeep != null ? { ...f, bolts: 0, boltDeep: null } : f;
  // §36 A given depth is measured from the mounting face, so what is left for
  // this panel is that depth less the material in front of it. Run out, and
  // the panel has no bolt holes at all; still going, and it carries what
  // remains — which the bore reads as a length and the overshoot makes a
  // clean through-hole of when it is more than the panel is thick.
  if (!Number.isFinite(f.boltDeep) || !(f.boltDeep > 0)) return f;
  const left = Number((f.boltDeep - ahead).toFixed(4));
  if (left <= 0) return { ...f, bolts: 0, boltDeep: null };
  return { ...f, boltDeep: left };
}

/** §33 How deep the mounting holes go: their own figure, capped by the cutout's. */
export function boltDepth(f) {
  const cut = f?.through ?? null;
  const bolt = f?.boltsThrough ?? null;
  if (bolt == null) return cut;
  return cut == null ? bolt : Math.min(bolt, cut);
}

/** §33 The layers a face has, which is how many a hole in it can go through. */
export const stackDepth = (panels, face) => fittingStack(panels, face).length;

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
export function fittingExtent(f, { mounted = true } = {}) {
  if (f.type === "port") return f.diameter / 2;
  // §33 What has to fit on a panel is what that panel carries. The frame is
  // the driver itself sitting on the outside of the box, so it is asked of the
  // panel it bolts to and of no other; the bolt circle is asked only where the
  // bolt holes are actually cut.
  const bolts = f.bolts > 0 ? f.pcd / 2 + f.boltHole / 2 : 0;
  return Math.max(f.cutout / 2, bolts, mounted ? driverOuter(f) / 2 : 0);
}

/**
 * §29 The bevel run round the back of a cutout, where one is asked for.
 *
 * A driver's hole is cut square through the baffle, and the rear corner of it
 * is right where the cone's back wave leaves. Chamfering or rounding that
 * corner opens the throat out into the box instead of leaving the driver
 * breathing through a square-edged tube of baffle. On a doubled baffle it
 * matters more, because the tube is twice as long.
 *
 * Only the cutout gets it. Bolt holes are clearance holes and a flare round
 * one is a way of losing the bolt.
 */
/**
 * §34 How much of the thickness a flare may take: all but a hundredth of it.
 *
 * §29 swept in half-millimetres and stopped at `thickness - 0.5`, which was the
 * §26 rule borrowed from a different shape. Swept finely, the refusal turns out
 * to sit exactly on the thickness and nowhere before it: on 9, 12, 18 and 25 mm
 * panels, fillet and chamfer alike, `t - 0.01` builds and `t` does not. Which
 * stands to reason — a fillet whose radius is the whole thickness runs its
 * tangency out at the front face and leaves a knife edge, and a router with a
 * full-thickness roundover bit would do the same.
 *
 * So a full fillet is available, to within a hundredth of a millimetre. That is
 * two orders below anything anybody cuts to, and it means the control's limit
 * is the sheet thickness as read.
 */
export const FLARE_MARGIN = 0.01;

/**
 * §36 The bolt circle used to be the other limit, and it is not a limit at all.
 *
 * §29 measured OCCT refusing a flare whose rim landed among the bolt holes and
 * capped the radius short of them. That refusal was never about the shape: it
 * was about *order*. Filleting an edge whose sweep crosses holes already
 * drilled is what OCCT will not do. Cut the cutout, flare it while the face
 * around it is still solid, and drill the bolts through the flared surface
 * afterwards, and every radius up to the thickness builds — measured across the
 * whole band the old cap forbade.
 *
 * So the thickness is the only limit, and a flare that runs into the bolt holes
 * is allowed and warned about (`fittingIssues`) rather than prevented. It is a
 * real thing to want: the bolts then land on the slope, which is a decision for
 * whoever is holding the driver, not for this.
 */
export function largestFlare(f, thickness) {
  if (!(thickness > 0)) return 0;
  return Math.max(0, Number((thickness - FLARE_MARGIN).toFixed(4)));
}

/** §36 How far out the flare opens the rim, and where the bolt holes start. */
export const flareReaches = (f) => f.cutout / 2 + (cutoutFlare(f)?.radius ?? 0);
export const boltRingInner = (f) => f.pcd / 2 - f.boltHole / 2;

/** §36 Whether a flare opens out far enough to break into the bolt holes. */
export function flareHitsBolts(f) {
  if (!cutoutFlare(f) || !(f?.bolts > 0) || !(f.pcd > 0) || !(f.boltHole > 0)) return false;
  return flareReaches(f) > boltRingInner(f);
}

export const cutoutFlare = (f) => {
  const flare = f?.flare;
  if (f?.type !== "driver" || !flare) return null;
  if (flare.type !== "fillet" && flare.type !== "chamfer") return null;
  return flare.radius > 0 ? flare : null;
};

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
 * The panel a port's tube hangs off, and the one whose cutout is flared: the
 * innermost, since the tube stands into the cavity and the flare is cut where
 * the hole comes out. One tube per port however many layers the bore went
 * through.
 *
 * §30 The lining does not count. A tube is glued into the hole in the board and
 * passes through the felt on its way; a flare is routed, and felt is not
 * routed. Both belong to the innermost thing made of board — which is what this
 * returns, falling back to the whole stack in the case where a face is lining
 * and nothing else.
 */
export function innermostOn(panels, face) {
  const stack = fittingStack(panels, face);
  const board = stack.filter((p) => p.layer !== "lagging");
  return (board.length ? board : stack).at(-1);
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

/**
 * §31 The rest of the set a datasheet gives, each with the proportion it
 * replaces as its fallback.
 *
 * A box program asks a driver for eight numbers — thickness, depth, magnet
 * depth, magnet, basket, outer, voice coil, displacement — and until now three
 * of those were proportions the app made up. Given, they are used; left alone,
 * nothing that was drawn before changes by a thousandth.
 *
 * `thick` is the frame's own thickness, the plate that sits on the baffle. It
 * is what a depth is measured from — a datasheet's depth runs from the front of
 * that plate, so the part behind the baffle is the depth less this.
 */
export function driverThick(f) {
  if (Number.isFinite(f?.thick) && f.thick > 0) return f.thick;
  return driverOuter(f) * DRIVER_SHAPE.flange;
}

/**
 * §31 The basket where it goes through the hole.
 *
 * This is the number a cutout is chosen to clear, and the app had been guessing
 * it as the cutout less half a millimetre — right in spirit, since that is how
 * a hole is sized, and never the driver's own figure. Clamped to the hole when
 * it is drawn, because a basket wider than the cutout does not go in and a
 * profile that says otherwise is drawing a lie; `fittingIssues` says so in
 * words instead.
 */
export function driverBasket(f) {
  if (Number.isFinite(f?.basket) && f.basket > 0) return f.basket;
  return Math.max(0, f.cutout - 2 * DRIVER_SHAPE.slop);
}

/**
 * §31 The voice coil, which is where the cone ends.
 *
 * The cone is a frustum, not a point: it stops at the former the coil is wound
 * on, and the dust cap covers that junction. So the coil diameter is what sets
 * the small end of the cone, and where a datasheet gives it the drawn cone
 * narrows to the real thing rather than to three tenths of the cutout.
 */
export function driverVoiceCoil(f) {
  if (Number.isFinite(f?.vc) && f.vc > 0) return f.vc;
  return Math.max(0, f.cutout) * DRIVER_SHAPE.cap;
}

export function driverProfile(f, steps = 8) {
  const Rc = Math.max(0, f.cutout) / 2;
  // A frame is never narrower than the hole it sits over — but a number being
  // typed passes through every value on its way, and "8" on the road to "80" on
  // a 100 mm cutout turned the profile inside out: the contour doubled back on
  // itself and the body came out as a knot. Clamped, so what is drawn is always
  // a driver; `fittingIssues` says the number is wrong.
  const Ro = Math.max(driverOuter(f) / 2, Rc);
  const flange = driverThick(f);
  const roll = Rc * DRIVER_SHAPE.surround;
  const cone = driverCone(f);
  // §31 The cone stops at the coil former, and the cap covers that. Clamped
  // inside the cutout for the same reason the frame is clamped outside it: a
  // number on its way to another number must not turn the profile inside out.
  const Rd = Math.min(Math.max(0.1, driverVoiceCoil(f) / 2), Math.max(0.2, Rc * 0.9));
  const dome = Rd * DRIVER_SHAPE.dome;
  // Clear of the deepest thing in front of it, so the flat back never cuts
  // through the cone it is supposed to be behind.
  const back = Math.max(0, cone - flange) + roll;

  const points = [];
  // §24 Back first, from the axis out: the flat back of the magnet, up its
  // side, out along the basket to the wall of the hole, and along the face to
  // the rim of the frame. That is the silhouette of a motor and a cast basket,
  // which is all of the driver anybody sees from behind.
  // §31 What goes through the hole: the basket's own diameter where a datasheet
  // gives it, and never wider than the hole it has to pass.
  const Rb = Math.min(Math.max(0.1, driverBasket(f) / 2), Math.max(0.1, Rc - DRIVER_SHAPE.slop));
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
  // §31 The same thickness the profile uses, so a frame given a real thickness
  // stands proud by it in the views as well as in the shape.
  return driverThick(f) + (f.cutout / 2) * DRIVER_SHAPE.surround / 2;
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
const LAYER_WORD = { cladding: "cladding", shell: "carcass panel", doubler: "doubler", lagging: "lagging" };

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
    if (![f.at?.a, f.at?.b].every(Number.isFinite)) {
      msgs.push({ level: "error", text: `${label} has no position on the panel.` });
      continue;
    }
    // §31 A cutout is sized to pass the basket. Given both, the app can say
    // when they do not agree — and it says it rather than drawing a basket
    // squeezed through a hole it would not go through.
    if (f.type === "driver" && Number.isFinite(f.basket) && f.basket > 0
        && f.basket > f.cutout - 2 * DRIVER_SHAPE.slop) {
      msgs.push({ level: f.basket > f.cutout ? "error" : "warning",
        text: `${label}: a ⌀${round1(f.basket)} basket will not pass a ⌀${round1(f.cutout)} cutout — `
          + `cut it at ⌀${round1(f.basket + 2 * DRIVER_SHAPE.slop)} or more.` });
    }
    // Every layer, not only the one it is set out from. A doubler is inset from
    // the carcass panel it backs, so a bore can sit comfortably in the carcass
    // and run off the edge of the doubler behind it — and the bore goes through
    // both, so that is a hole opening into fresh air.
    //
    // §33 Every layer it *reaches*, that is, and it is asked for the clearance
    // that layer actually needs: a doubler behind a driver whose bolts stop at
    // the baffle has a hole in it and no bolt circle, and a panel no hole
    // reaches at all is none of this fitting's business.
    fittingStack(panels, f.face).forEach((through, depth) => {
      const here = fittingAt(f, depth);
      if (!here) return;
      const r = fittingExtent(here, { mounted: through === panel });
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
    });

    // §36 A flare wide enough to break into the bolt holes is allowed — the
    // kernel builds it once the flare is cut before the bolts are drilled — but
    // it is worth knowing, because the bolts then land on a slope rather than
    // on a flat, and a washer will not sit square on it.
    if (flareHitsBolts(f)) {
      const flare = cutoutFlare(f);
      msgs.push({ level: "warning",
        text: `${label}: the R${round1(flare.radius)} ${flare.type} opens the cutout to `
          + `⌀${round1(flareReaches(f) * 2)}, which breaks into the ⌀${f.boltHole} bolt holes at `
          + `${f.pcd} PCD — they will open onto the flare rather than onto a flat face.` });
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

/**
 * §48 `thickness` is the board this fitting is being described *on*, where the
 * caller knows it. It decides one thing: whether a bolt hole's depth is worth
 * saying. §36 hands a panel the depth that is left for it rather than clamping,
 * so a hole given 30 mm from the mounting face arrives at an 18 mm board still
 * carrying 30 — which is a through hole, and reading "30 deep" off a note is an
 * instruction to drill the bench. Without a thickness the depth is the user's
 * own figure from the mounting face, and that is worth saying as it stands.
 */
export function describeFitting(f, thickness = null) {
  if (f.type !== "port") {
    // §24 The depth is in the line because it is the number that decides
    // whether the driver fits the box at all, and it is the one dimension of a
    // driver that none of the flat views can show.
    const flare = cutoutFlare(f);
    // §29 In the line because it is a cut somebody has to make, and the only
    // one of a driver's holes that is not simply a diameter.
    const back = flare ? `, ${flare.type === "fillet" ? "R" : ""}${round1(flare.radius)}${flare.type === "fillet" ? "" : " mm"} ${flare.type} inside` : "";
    // §33 A panel the bolts do not reach has a cutout and nothing else, and
    // reading "0 × ⌀5 on 147 PCD" off a cut list is worse than reading nothing.
    // §36 A blind hole says how deep it is; a through hole says nothing, which
    // is what a hole has always said here.
    const blind = Number.isFinite(f.boltDeep) && f.boltDeep > 0
      && !(thickness > 0 && f.boltDeep >= thickness - 1e-9);
    const deep = blind ? ` × ${round1(f.boltDeep)} deep` : "";
    const ring = f.bolts > 0 ? `, ${f.bolts} × ⌀${f.boltHole}${deep} on ${f.pcd} PCD` : ", cutout only";
    return `Driver ⌀${f.cutout} in a ⌀${round1(driverOuter(f))} frame, ${round1(driverDepth(f))} deep`
      + `${ring}${back}`;
  }
  return hasTube(f) ? `Port ⌀${f.diameter} × ${f.length}` : `Port ⌀${f.diameter}, no tube`;
}

/** A short note for the cut list, about the board it is a note on. */
export function fittingNote(fittings, thickness = null) {
  if (!fittings.length) return "";
  return fittings.map((f) => describeFitting(f, thickness)).join("; ");
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
