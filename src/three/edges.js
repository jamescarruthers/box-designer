// §4 How a panel's edges are drawn, per render style.
//
// Kept apart from the renderer because it is a set of decisions, not a set of
// three.js calls, and decisions are worth testing.
//
// The interesting one is hidden edges. Drawing them at the same weight as
// visible ones — which is what "Shaded + hidden edges" did — gives a box with
// no front and no back: every edge is equally present and the eye has nothing
// to sort them by. Drawing them faintly is the whole convention of a pictorial
// view, and it is the same idea ISO 128 has in the elevations, where hidden
// detail is dashed rather than omitted.
//
// It takes two passes over the same geometry. The near pass depth-tests as
// usual and draws what is in front. The far pass inverts the comparison and
// draws only where something is already nearer — which is exactly the hidden
// part of every edge, and nothing else. An edge lying *on* a surface has equal
// depth, so it fails the inverted test and is drawn once, at full weight, by
// the near pass alone: silhouettes and creases do not go grey.

export const EDGE_COLOUR = "#c6d2de";

/**
 * Faint enough to read as behind, strong enough to follow round a corner.
 *
 * Lower than it looks like it should be, because hidden edges stack. Each panel
 * is drawn separately and their edges coincide along every joint, so four or
 * five faint lines land on the same pixels and composite: at 0.16 the hidden
 * edges came back at 0.61 of a visible one, which is not faint at all. Measured
 * off the render — the pixels lit in Wireframe but not in Wireframe, hidden
 * removed, which are by definition the hidden ones:
 *
 *     0.16 → 0.61    0.10 → 0.46    0.07 → 0.37
 *
 * A third of a visible line is about right: present, clearly behind, and it
 * does not compete with the outline.
 */
export const HIDDEN_OPACITY = 0.07;
export const VISIBLE_OPACITY = 0.85;

/**
 * Whether a style needs the faces in the depth buffer even though it does not
 * show them. Without depth there is nothing to be hidden by, and every edge is
 * a visible one.
 */
export const needsDepth = (style) => style === "wireframe" || style === "wireframe-hlr";

/** Whether the faces are drawn as faces rather than only into the depth buffer. */
export const showsFaces = (style) => style === "shaded" || style === "shaded-edges";

/**
 * The passes to draw a panel's edges in, outermost first.
 *
 * `depthFunc` is `less-equal` for the near pass and `greater` for the far one;
 * the renderer maps those onto three's constants. An empty list means this
 * style draws no edges for this panel at all.
 */
export function edgePasses(style, { accent = false } = {}) {
  // Selection has to be findable behind other panels, so it ignores depth
  // entirely rather than going faint — being hard to see is the one thing a
  // highlight must not be.
  if (accent) return [{ name: "accent", depthTest: false, opacity: 1, accent: true }];
  if (style === "shaded") return [];

  const near = { name: "visible", depthTest: true, depthFunc: "less-equal", opacity: VISIBLE_OPACITY };
  if (style === "wireframe-hlr") return [near];

  return [near, {
    name: "hidden",
    depthTest: true,
    depthFunc: "greater",
    // Never into the depth buffer: one panel's hidden edges must not occlude
    // another's, or the far side of the box competes with itself.
    depthWrite: false,
    opacity: HIDDEN_OPACITY,
  }];
}
