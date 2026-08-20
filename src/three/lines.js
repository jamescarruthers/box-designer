// §17 Drawing a line that looks like a line.
//
// WebGL's own lines are one device pixel wide, always: `linewidth` on
// `LineBasicMaterial` is ignored by every browser, and the driver here reports
// an aliased line width range of exactly 1 to 1. On a 2× display that is half a
// CSS pixel — a thin, dim, stepped line, and the thing that makes a box drawn
// this way look worse than the same box drawn in the A3 view beside it.
//
// So the edges are drawn as screen-space quads instead (three's `Line2`
// family), which gives them a width in pixels and an antialiased boundary of
// their own, independent of whatever the driver does with multisampling.
//
// The arithmetic lives here rather than in the renderer so it can be checked
// without a GPU: how wide a line is at a given pixel ratio, and where the depth
// planes go — which is the other half of the problem, and the half nobody
// suspects.

/**
 * Line width in **CSS** pixels.
 *
 * 1.4 rather than 1: a hairline is right on paper, where the ink is 600 dpi and
 * the line has an edge. On screen a one-pixel line has no edge to speak of, and
 * the drawing conventions of §6 are not what the 3D view is for anyway — it is
 * for reading the shape.
 */
export const LINE_WIDTH = 1.4;

/**
 * The same width in device pixels, which is what the shader wants.
 *
 * `LineMaterial.linewidth` is in the units of the `resolution` it is given, and
 * the resolution has to be the drawing buffer — so the width has to be scaled
 * by the pixel ratio or a 2× display draws everything half as thick as a 1×
 * one, which is precisely the bug being fixed.
 */
export const lineWidthFor = (pixelRatio = 1) => LINE_WIDTH * Math.max(1, pixelRatio);

/**
 * Where to put the near and far planes for a camera `dist` from its target,
 * looking at something `radius` across.
 *
 * The depth buffer's precision is spent on the ratio between the two, not on
 * the distance between them: 1 to 100000 — which is what this was — leaves so
 * little of it near the far plane that coincident surfaces cannot be told
 * apart. That is what makes an edge lying on a panel flicker in and out along
 * its length as the box turns, and no amount of line quality fixes it, because
 * the line is not the thing that is wrong.
 *
 * Fitted to what is actually in front of the camera, the ratio is about three,
 * and the same edge is either in front or behind, all the way along, every
 * frame.
 */
export function nearFar(dist, radius) {
  const near = Math.max(0.5, (dist - radius) * 0.8);
  const far = Math.max(near + 1, (dist + radius) * 1.5);
  return { near, far };
}

/**
 * How far the box reaches from its own centre, exploded panels included.
 *
 * Whatever the view has been panned to is added on top of this, at the point of
 * use: panning moves the target off the box, so the far corner gets further
 * away, and a far plane fitted to the box alone would clip it.
 */
export const sceneRadius = (E, explode = 0) =>
  Math.hypot(E.x, E.y, E.z) / 2 + Math.max(0, explode) * 3;
