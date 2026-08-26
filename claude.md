# Sheet Box Designer — implementation specification

A web app for designing boxes made from sheet material (plywood, MDF). It solves
panel sizes from a few parameters, shows the result in 3D, and produces a cut
list, sheet layouts and a technical drawing to British standards.

This document records the model, the algorithms and the conventions decided
during the prototype, so none of it has to be worked out twice. Everything
marked **verified** was checked numerically; the test that checked it is given.

---

## 1. Coordinate system and naming

| Axis | Meaning | Faces |
|---|---|---|
| `x` | width | `left` (x−), `right` (x+) |
| `y` | depth | `front` (y−), `back` (y+) |
| `z` | height | `bottom` (z−), `top` (z+) |

All lengths are millimetres. Every box is stored as
`{ x: [lo, hi], y: [lo, hi], z: [lo, hi] }` in envelope coordinates, origin at
the front-left-bottom corner.

Constants used throughout:

```js
const FACES = ["front", "back", "left", "right", "top", "bottom"];
const AXIS  = { left:["x",-1], right:["x",1], front:["y",-1],
                back:["y",1],  bottom:["z",-1], top:["z",1] };
const PAIR  = { x:["left","right"], y:["front","back"], z:["bottom","top"] };
```

The twelve edges are keyed by the two faces meeting there, e.g. `"front|top"`.
Build them by taking each pair of distinct axes and each combination of their
faces.

---

## 2. The core model

### 2.1 Prominence

A *prominent* face is one whose panel is full size, so no other panel's edge
shows on it. This is not a flag per face — it is a **strict rank over all six
faces**. A panel runs to the outer surface of a neighbour it outranks, and stops
at the inner surface of one it does not.

Rank 0 is most prominent. Pair-wise choices ("front and back wrap") are just
ranks that happen to sit adjacent, so presets and hand-ordering share one code
path.

Presets worth shipping:

| Name | Order |
|---|---|
| Front & back wrap | front, back, left, right, top, bottom |
| Sides wrap | left, right, top, bottom, front, back |
| Top & bottom wrap | top, bottom, front, back, left, right |
| Baffle wraps sides | front, left, right, bottom, back, top |
| Plinth & lid | bottom, top, left, right, front, back |

**Reordering prominence changes every panel size and no internal dimension.**
State this in the UI. It is a joinery choice, not a tuning knob.

### 2.2 One rule, applied three times

The box is three nested layers, each tiling the walls of the previous layer's
cavity with the same function:

```
envelope → cladding → shell → doubler → cavity
```

*Cladding* lies outside the carcass and grows the box. A *doubler* lies inside
and eats the cavity. Both are optional per face.

```js
// Tile the walls of `box` with panels of thickness `th`, ordered by `rank`.
function shellLayer(box, th, rank, name) {
  const parts = [], inner = {};
  for (const b of "xyz") {
    const [bm, bp] = PAIR[b];
    inner[b] = [box[b][0] + th[bm], box[b][1] - th[bp]];
  }
  for (const f of FACES) {
    if (!(th[f] > 0)) continue;            // omit the panel, keep the trimming
    const [a, s] = AXIS[f];
    const nb = {};
    nb[a] = s < 0 ? [box[a][0], box[a][0] + th[f]]
                  : [box[a][1] - th[f], box[a][1]];
    for (const b of "xyz") {
      if (b === a) continue;
      const [bm, bp] = PAIR[b];
      nb[b] = [ rank[f] < rank[bm] ? box[b][0] : box[b][0] + th[bm],
                rank[f] < rank[bp] ? box[b][1] : box[b][1] - th[bp] ];
    }
    parts.push({ face: f, layer: name, box: nb });
  }
  return { parts, inner };
}

const L0 = shellLayer(env,      cladding,  rank, "cladding");
const L1 = shellLayer(L0.inner, thickness, rank, "shell");
const L2 = shellLayer(L1.inner, doubler,   rank, "doubler");
// L2.inner is the cavity
```

That is the whole geometry engine. Everything else derives from it.

### 2.3 Deriving the envelope from the starting point

Four starting points, all supported:

```js
wall[f] = cladding[f] + thickness[f] + doubler[f];

// internal or external dimensions given directly
size = { x, y, z };

// internal or external volume given with a proportion
k    = Math.cbrt(litres * 1e6 / (ratio.x * ratio.y * ratio.z));
size = { x: ratio.x * k, y: ratio.y * k, z: ratio.z * k };

// then, per axis b with faces bm, bp:
E[b] = internalBasis ? size[b] + wall[bm] + wall[bp] : size[b];
```

Default proportion 1 : 1.25 : 1.6, which keeps the axial modes apart. Round the
envelope to 0.1 mm.

### 2.4 Invariants — **verified**

1. **Panels tile the walls exactly.** No gaps, no overlaps.
2. **Volume closes.** `Σ panel volumes + cavity volume = envelope volume`.
3. **Internal dimensions depend only on wall thicknesses**, never on prominence.

Tested over 29,920 random cases with all three layers populated, random
prominence orders and mixed thicknesses: zero failures. The Python version used
exact rational arithmetic (`fractions.Fraction`) so closure was exact, not
within tolerance.

**Cross-check against a real plan.** Envelope 166 × 187 × 344, 18 mm throughout,
rank `front 0, left 1, right 2, bottom 3, back 4, top 5` must return:

```
front   344 × 166      (baffle wraps the side edges)
left    344 × 169
right   344 × 169
back    326 × 130
bottom  169 × 130
top     151 × 130
cavity  130 × 151 × 308  = 6.046 l
```

Those are the published numbers for the Mark Audio Pluvia 7P Mica standmount.
Keep this as a fixture.

---

## 3. Edge treatments

Full-length external edges take a chamfer or a fillet, set globally or per edge.

- **Cut from the outer face.** The bevel starts at the external surface and works
  inward. Getting this backwards puts the bevel in the cavity.
- **Blank sizes are unchanged.** A bevel is an operation after assembly; the cut
  list carries it as a note, not as a smaller panel.
- A bevel attaches to a panel only where that panel is the outermost material at
  that edge. Clad a face and the bevel moves from the shell panel to the
  cladding panel.
- **Only full-length edges can be cut.** An edge is full length when one panel
  runs its whole length. Where the outermost material changes partway along —
  the left panel in the middle, the front and back panels at its ends — a
  fillet would die into the side of the next panel, so that edge stays square
  and the user is told which ones and why.

  The owner is found at the edge's midpoint, so the test is exact: the edge is
  full length precisely when the owner spans the envelope along the axis the
  edge runs. Panel bounds are copied from the envelope's where no inset applies,
  so this is an equality, not a tolerance.

  **A closed box never has twelve.** The two most prominent faces each own their
  four boundary edges, and the four edges behind them are always broken. Eight
  is the maximum, reached exactly when ranks 0 and 1 are opposite faces;
  otherwise it is five or six. Verified over all 720 prominence orders. This is
  the sharpest consequence of prominence being a joinery choice: it decides
  which edges you can put a router on.

Depth profile, `d` measured inward from the outer face:

```
chamfer: inset(d) = R − d
fillet:  inset(d) = R − sqrt(2Rd − d²)
```

Both give `inset(0) = R` and `inset(R) = 0`.

### Validation

```
wall[f] = cladding[f] + thickness[f] + doubler[f]
skin[f] = cladding[f] || thickness[f]

R > min(wall of the two faces)  → error: cuts through the wall
R > min(skin of the two faces)  → warning: cuts past the outer skin,
                                  the glue line will show
```

---

## 4. Panel geometry for the 3D view

Each panel is a prism from its inner surface to its outer surface, tapered at
any external edge carrying a bevel.

1. Build a stack of rings from the outer surface inward. One step for a chamfer,
   eight for a fillet. Each ring is a rectangle inset per side by `inset(d)`,
   clamped so opposite insets cannot cross. Add a final ring at full thickness
   with zero inset.
2. Loft the rings into quads, cap the first and last.
3. Transform into three.js coordinates. **Use a rotation, not an axis swap:**

   ```
   three.x =   model.x − E.x/2
   three.y =   model.z − E.z/2
   three.z = −(model.y − E.y/2)
   ```

   Swapping two axes is a reflection, determinant −1. It inverts every triangle
   winding and `computeVertexNormals` then points the lot inward — the model
   lights from the inside and transparent modes look wrong.
4. **Orient each triangle outward against the panel centroid.** A bevelled box is
   convex, so `dot(normal, triangleCentroid − panelCentroid) > 0` is exact. Doing
   this numerically removes a whole class of winding bugs — **verified**: 0 of 76
   triangles inward on a filleted side panel.
5. `computeVertexNormals`, `flatShading: true`.

Explode offsets move each panel along its face normal, scaled by layer:
cladding 1.5, shell 1.0, doubler 0.45. In three coordinates the normal is
`(x → s, z → s, y → −s)`; the sign flip on depth matters.

**Edges are not creases.** `EdgesGeometry` finds edges by dihedral angle, and
the 24° threshold is there to suppress a fillet's tessellation facets. But a
fillet meets the flat face it was cut from *tangentially* — zero dihedral — so
that boundary is suppressed too, and the wireframe comes out with a hole at
every round-over: the offset face has no outline.

Both engines therefore supply the edges explicitly. The kernel takes them from
the B-Rep topology, which is exactly right and costs nothing. The analytic path
adds the ring loops that are genuinely edges — the outer face, the inner face,
and the depth at which each bevel becomes tangent to its side — on top of the
creases `EdgesGeometry` does find.

### Render styles

Named after Fusion 360's visual styles:

| Style | Faces | Edges |
|---|---|---|
| Shaded | yes | none |
| Shaded + hidden edges | yes, 94% opacity | all, `depthTest: false` |
| Wireframe | none | all, `depthTest: false` |
| Wireframe, hidden removed | depth only, `colorWrite: false` | all, `depthTest: true` |

`EdgesGeometry(geom, 24)` suppresses the fillet's eight-step facets while keeping
chamfer creases.

### Colour modes

Material colour, or colour by face. The face palette encodes structure: hue is
the axis, light against dark is which end.

```
left  #74c47c   right  #2f8a52    (x, green)
front #5fadd8   back   #2c6c91    (y, blue)
top   #ac8bd8   bottom #6c4fa2    (z, violet)
```

Cladding and doublers keep the face hue and shift lightness (`+0.02/+0.09` and
`−0.05/−0.13` in HSL), so a clad front and the shell behind it read as the same
face at different depths.

Selection must **not** recolour the panel — that destroys what the colouring is
for. Use an emissive lift (`0x5f2110`) plus accent-coloured edges.

When face colouring is on, carry the swatch into the cut list, part list, sheet
layouts and the prominence list. Turn it off and every swatch goes. The two views
never disagree.

### Camera

Hand-rolled orbit; three r128 has no bundled `OrbitControls`. Spherical
coordinates, drag to orbit, shift-drag to pan, wheel to zoom, click to select.
Clamp polar angle to `[0.06, π − 0.06]` or `lookAt` degenerates.

View presets: iso `[−0.72, 1.08]`, front `[0, π/2]`, top `[0, 0.08]`,
right `[π/2, π/2]`; distance `2.7 × max(W, D, H)`.

Keep the viewport **mounted** when the user switches to another mode and hide it
with CSS, so the camera survives. Skip the render call while `clientWidth === 0`.

---

### Hidden edges are faded, not equal

Drawn at the same weight as visible ones — which is what "Shaded + hidden edges"
did — a box has no front and no back: every edge is equally present and the eye
has nothing to sort them by. Fading them is the whole convention of a pictorial
view, and the same idea §6.3 applies in the elevations, where hidden detail is
dashed rather than omitted.

Two passes over the same geometry. The near one depth-tests as usual and draws
what is in front; the far one inverts the comparison to `GreaterDepth` and so
draws only where something is already nearer — exactly the hidden part of every
edge, and nothing else. An edge lying *on* a surface has equal depth, fails the
inverted test, and is drawn once at full weight by the near pass: silhouettes
and creases do not go grey.

The far pass never writes depth, or one panel's hidden edges would occlude
another's and the far side of the box would compete with itself. And the
wireframe styles render their faces depth-only — `colorWrite = false` — because
without depth nothing is behind anything and every edge is a visible one.

The opacity is 0.07, which is lower than it looks like it should be, because
hidden edges **stack**: panels are drawn separately and their edges coincide
along every joint, so four or five faint lines land on the same pixels and
composite. Measured off the render, taking the pixels lit in *Wireframe* but not
in *Wireframe, hidden removed* — which are by definition the hidden ones:

| opacity | hidden / visible peak |
|---|---|
| 0.16 | 0.61 |
| 0.10 | 0.46 |
| 0.07 | 0.37 |

A third of a visible line is about right: present, clearly behind, and not
competing with the outline.

Which style gets what lives in `src/three/edges.js` rather than in the renderer,
because it is a set of decisions rather than a set of three.js calls, and
decisions are worth testing. Selection is the exception that stays sharp: it
ignores depth entirely, since being hard to see is the one thing a highlight
must not be.

## 5. Cut list, parts and sheets

Sort panels by layer (cladding, shell, doubler), then by area descending. Number
`P01`, `P02`, … after sorting so the numbering is stable.

Each row: part id, face, layer, length, width, thickness, material, grain, edge
work. Export as CSV. Show totals: part count, area in m², sheet count, and the
volume closure error — print `exact` when it is zero, which it should always be.
Where more than one sheet is in play, break the totals down by material and
thickness as well: that is the line you take to the merchant.

**Material is per panel, not per project.** The carcass sets the project sheet;
every cladding and doubler panel starts as that sheet and can then be changed.
A birch carcass with a Valchromat baffle and an MDF doubler is one box and three
orders.

**Part templates** must share one scale. Give every part the same viewBox width
keyed to the longest part in the set, so a 344 mm baffle and a 130 mm cleat do
not draw the same size. Set stroke width and font size as fractions of that
length, since the viewBox is in millimetres.

**Nesting.** Shelf packing, first fit decreasing: sort by width descending, place
along the current shelf, open a new shelf when it will not fit, open a new sheet
when that fails. Add the kerf (default 3.2 mm) after each placement. Rotate parts
unless grain is locked — and grain locking is a property of the sheet, so it
binds a ply panel and not the Valchromat one beside it. **Group by material and
thickness** — 6 mm cladding cannot share a sheet with an 18 mm carcass, and
18 mm MDF cannot share one with 18 mm ply.

| Material | Stock | Standard | Sold in | Grain |
|---|---|---|---|---|
| MDF | 2440 × 1220, 3050 × 1220 | 18 | 3, 6, 9, 12, 15, 18, 22, 25, 30 | no |
| Birch ply | 2440 × 1220, 1525 × 1525 | 18 | 4, 6, 9, 12, 15, 18, 24, 30 | yes |
| Oak-faced ply | 2440 × 1220 | 18 | 6, 9, 12, 15, 18, 22, 25 | yes |
| Pine | 2440 × 1220 | 18 | 12, 15, 18, 20, 22, 25 | yes |
| Valchromat | 2440 × 1220 | **19** | 8, 12, 16, 19, 25, 30 | no |

Valchromat is 19 mm as standard, not 18. A new panel of any material starts at
that material's standard thickness. Changing a panel's material moves it to the
new standard **only if it was still sitting on the old one** — a deliberate
25 mm survives the switch.

---

## 6. The technical drawing

### 6.1 Sheet

A3 landscape, 420 × 297, ISO 216 ratio. Margins 10 mm, except 20 mm on the left
for filing (ISO 5457). Title block 180 × 40 in the bottom-right corner of the
frame.

**Pick a real scale**, do not fit. Take the largest ISO 5455 preferred scale that
fits and print it in the title block:

```
[10, 5, 2, 1, 0.5, 0.2, 0.1, 0.05, 0.02, 0.01]
```

"To fit" hides size changes: the drawing rescales and looks identical when the
box grows. A fixed scale makes the change visible.

Line widths in sheet millimetres: visible outline 0.7, hidden 0.45 dashed 3/1.4,
dimension lines 0.25, cutting plane 0.45 chain, frame 0.7. Text: dimensions 3.2,
view labels 2.9, title block values 4, keys 2.2, notes 2.4.

Hidden lines at the strict ISO 0.35 are under a pixel wide once the sheet is
scaled into a browser pane and effectively vanish. 0.45 stays within the 1:2
thin-to-thick ratio and reads.

### 6.2 View arrangement

```
┌──────────────┬──────────────┬──────────────┐
│    FRONT     │  END VIEW    │  SECTION A–A │
│  ELEVATION   │  FROM LEFT   │              │
├──────────────┼──────────────┴──────────────┤
│     PLAN     │        ISOMETRIC            │
│  FROM ABOVE  │                             │
└──────────────┴─────────────────────────────┘
                              [ title block ]
```

Columns `W, D, D`; rows `H, D`. Centre the block in the frame with gaps clamped
to 22–40 mm horizontally, 22–46 mm vertically.

**First angle.** The projection plane sits beyond the object and hinges about its
line of intersection with the vertical plane. That line is at the **back**, so:

- the view from the left goes on the right, with the **back** of the object on
  its left edge (the side nearest the front elevation);
- the plan goes below, with the **back** of the object along its **top** edge.

The plan is easy to get backwards. Derive it from the hinge, not from intuition.

Projections, with `n` the nearness (smaller is nearer):

```js
front: b => ({ h: b.x,                     v: [Ez-b.z[1], Ez-b.z[0]], n: b.y[0] })
end:   b => ({ h: [Ey-b.y[1], Ey-b.y[0]],  v: [Ez-b.z[1], Ez-b.z[0]], n: b.x[0] })
plan:  b => ({ h: b.x,                     v: [Ey-b.y[1], Ey-b.y[0]], n: Ez-b.z[1] })
```

### 6.3 Hidden line removal

Every panel is an axis-aligned box, so it projects to a rectangle and visibility
is exact — no tolerance anywhere.

1. Emit the four boundary segments of every panel's projected rectangle.
2. Split each segment at every rectangle boundary coordinate, **including its own
   rectangle's**, so coincident segments split identically and dedupe cleanly.
3. A sub-segment is hidden if some **strictly nearer** rectangle **strictly**
   contains its midpoint. Strict on both counts: a segment lying on a nearer
   rectangle's boundary is a real visible joint line.
4. Dedupe by `(orientation, fixed, start, end)`; **visible wins**.
5. Merge collinear runs sharing orientation, position and visibility.

Step 5 matters: an outline assembled from four different panels must come out as
one continuous line.

**Verified.** A 236 × 286 × 356 carcass, 18 mm, front and back wrapping, in the
end view:

```
solid   horiz v=0    h 0..286     outline top
dashed  horiz v=18   h 18..268    top panel, inner face
dashed  horiz v=338  h 18..268    bottom panel, inner face
solid   horiz v=356  h 0..286     outline bottom
solid   vert  h=0                 outline back
solid   vert  h=18                back panel, inner face
solid   vert  h=268               front panel, inner face
solid   vert  h=286               outline front
```

Note how sparse a correct drawing is. When a hidden line falls exactly on a
visible one, convention draws the visible one, and in a box that happens
constantly — in a closed carcass the bottom panel's outline sits precisely under
the top panel's. A plan can legitimately carry almost no dashed line.

### 6.4 Edge treatments in the views

An edge behaves differently depending on how it runs relative to the view:

- **Parallel to the view direction** → a cut corner. Draw a quarter arc (fillet)
  or a diagonal (chamfer), and trim the outline segments back by `R`. SVG sweep
  flag: `dh · dv > 0 ? 0 : 1`.
- **Across the view** → for a **chamfer only**, a line inset from the outline by
  the leg length, stopping short at each end where a cut corner takes over.
  Visible when it sits on the near face, dashed when on the far one; the two
  usually coincide and dedupe to one solid line.

**A fillet gets no such line.** It meets the flat face tangentially, so there is
no edge there and ISO 128 omits it. Drawing one tells the reader the material
steps, which it does not. This was the single most confusing bug in the
prototype.

Each edge therefore appears as a corner in exactly one view and as a tangent line
(chamfers) in the other two — but only the edges that survive the full-length
test of §3 appear at all. Under front & back wrap the front elevation's four
corners are precisely the four broken edges, so that view carries no arc while
the end view and plan carry four each.

Dimensioning: one note when every edge shares a treatment — `ALL EXTERNAL EDGES
R12` — and leadered labels otherwise, once per distinct treatment per view.

Map faces to view sides:

```js
front: { left:["h",0], right:["h",1], top:["v",0], bottom:["v",1] }
end:   { back:["h",0], front:["h",1], top:["v",0], bottom:["v",1] }
plan:  { left:["h",0], right:["h",1], back:["v",0], front:["v",1] }
```

Both faces present → corner. Exactly one → tangent line, and the missing one is
the near/far face that decides visibility.

### 6.5 Section A–A

**This view is not optional.** Outline views cannot show a laminated wall. A
front doubler adds *nothing* to the front elevation — it sits exactly behind the
cavity outline — and in the other views it is an 18 mm strip 3.6 mm from the
panel it doubles at 1:5. Correct, and useless.

Cut a vertical plane at `x = W/2`, viewed from the left:

- **cut** = panels with `box.x[0] < cx < box.x[1]`;
- **beyond** = panels with `box.x[0] >= cx`;
- run the usual HLR over cut ∪ beyond with `n = max(box.x[0], cx)`, keep visible
  segments only — sections omit hidden detail;
- hatch each cut panel's cross-section by layer.

Hatching, as SVG patterns in user space: carcass 45° at 2.2 mm, doublers −45° at
2.2 mm, cladding 45° at 1.2 mm, 0.16 stroke. Opposed directions for adjacent
parts is the ISO convention and it makes a doubler read as its own band.

Put the cutting-plane symbol on the **plan**, not the front elevation — the front
elevation's centre lines and internal-width dimension are already there. Chain
line, arrowheads pointing in the direction of sight, letter `A` at each end.

The cut plane is currently fixed at half the width. Make it a control; a port or
an off-centre brace will need it moved.

### 6.6 Isometric

True isometric **projection**, eye front-right-above, each axis foreshortened to
√(2/3) — not the stretched isometric-drawing convention.

```js
const ISO_X = Math.SQRT1_2, ISO_Y = Math.sqrt(1/6), ISO_Z = Math.sqrt(2/3);
screen = { x: ISO_X * (v.x + v.y),
           y: ISO_Y * (v.x - v.y) - ISO_Z * v.z };
```

Build it from the three visible planes — front `y = 0`, right `x = E.x`, top
`z = E.z`. Every panel meeting one of those planes contributes the boundary of
its cross-section there. Deduplicate by rounded endpoint pair. That gives the
real joint pattern, including cladding lines, rather than a bare box. No hidden
detail.

It usually needs its own preferred scale, since a tall box leaves the quadrant
shorter than the pictorial wants. Label it when it differs from the sheet scale.

### 6.7 Dimensioning

Aligned system. Extension lines with a 0.8 mm gap from the object and 1.2 mm
past the arrow, filled arrowheads 1.5 mm. Overall width, depth and height solid;
internal dimensions bracketed as reference.

**An internal dimension measures the cavity.** Its extension lines come off the
cavity's faces, found by projecting the cavity box through the same `PROJECTIONS`
as everything else. Anchoring it to the envelope instead draws the overall width
a second time and prints a different number against it — which is worse than
omitting it, because it reads as correct.

Shorter dimensions sit nearer the object and the overall outside them, so an
extension line never crosses a dimension line (ISO 129). Drop any dimension
whose span is not positive rather than drawing a degenerate arrow.

Note on the sheet:

> ALL DIMENSIONS IN MILLIMETRES. BRACKETED DIMENSIONS ARE FOR REFERENCE. HIDDEN
> DETAIL DASHED. HATCHING IN SECTION: COARSE = CARCASS, OPPOSED = DOUBLER,
> FINE = CLADDING.

Title block, two rows of 20 mm, columns at 0 / 90 / 140 / 180:

```
TITLE          | MATERIAL | REV
PROJECTION ⊲◎  | SCALE    | SHEET
```

Draw the first-angle symbol properly: a frustum in elevation with the large end
on the left, and its end view — two concentric circles — placed to the right.

---

## 7. Interface

Two columns. Controls on the left (about 314 px), main area on the right
switching between three modes:

**3D view** — viewport with floating chips for render style, colour mode, view
presets, solid engine, edge tools (§15) and an explode slider.

**Cut list & sheets** — three columns side by side: cut list, part templates,
sheet layouts. Hovering a part highlights it in all three and in the 3D view.
These belong together; do not make the user flip tabs between things they read
against each other.

**Drawing** — the sheet, centred, on the dark ground.

Control groups, in order: starting point, material, prominence, reinforcement,
edge treatment, drawing. Warnings run along the bottom of the main area in every
mode.

**Reinforcement is a list, not a grid.** Twelve number boxes, ten of them zero,
is a form for a box that mostly has no cladding. Instead: one stack per layer,
each with a dropdown of the sides not yet used. Pick a side and a panel appears,
inheriting the project sheet, with its thickness and material editable in place
and a cross to drop it. The side picker empties as sides are used up.

**Edge treatments are applied by clicking the edge.** The chips arm a
treatment; the next click on an edge in the viewport applies it, and the
control's list holds what has been done rather than everything that could be
(§15).

**Prominence is a preset until it is not.** A preset covers most boxes, so the
six-face order stays folded away behind it. A summary line always shows the order
in force, so folding it back up never hides a hand-made one; hand-ordering sets
the preset to Custom, and a Custom order opens the list on load.

Below 1320 px the parts column drops out first; below 1000 px everything stacks.

Aesthetic: drawing-office instrument. Cool graphite ground, monospace with
tabular figures throughout, one saturated accent reserved for selection and
active state. Real material colours in the 3D view.

---

## 8. Validation messages

| Condition | Level |
|---|---|
| Internal dimension ≤ 0 | error |
| Internal dimension < 20 mm | warning |
| Any panel with a non-positive planar dimension | error |
| Bevel deeper than the thinner wall | error |
| Bevel deeper than the outer skin | warning |
| Bevel asked for on an edge no single panel runs the length of | warning, and the edge is left square |
| Volume closure non-zero | error — a bug, not user input |

---

## 9. Test suite to port

These are why the geometry is right. Write them first.

1. **Closure and overlap.** 30,000 random envelopes, thicknesses, cladding,
   doublers and prominence orders. Assert `Σ panel volumes + cavity = envelope`
   and no pair of panels overlaps. Use exact rational arithmetic if the language
   allows.
2. **Pluvia fixture.** The table in §2.4, exact.
3. **Triangle orientation.** Build a filleted side panel; assert every triangle
   normal points away from the panel centroid, and that the bevel appears at the
   outer face — sample the panel's extent at the outer and inner surfaces and
   check the outer one is inset by `R` while the inner is full width.
4. **HLR fixtures.** The end-view table in §6.3. Add a sides-wrap case, where the
   outline is assembled from four panels and must merge into four segments.
5. **Bevel line counts.** Count what the sheet actually draws, which is the
   treatments left after the full-length test — counting the unfiltered request
   tests a code path the app never takes. On a 236 × 286 × 356 box, 18 mm, 6 mm
   cladding, baffle prominence, six of the twelve edges survive: no bevel →
   74 lines, 0 arcs; fillet → 74 lines, 6 arcs; chamfer → 87 lines, 0 arcs.
   The fillet must add arcs without adding lines, and the chamfer must add one
   diagonal per cut edge plus its tangent lines.
6. **Render and look.** Render the drawing SVG to PNG and inspect it. This caught
   the reversed plan, a collided cutting-plane symbol and an unescaped en dash —
   none of which any assertion would have found.
7. **Drive the app.** Mount it in jsdom, stub `WebGLRenderer`, click through the
   modes and change inputs, assert the drawing and cut list update and that no
   React errors fire.

---

## 10. Known gaps

- **Cutouts cover drivers and ports only.** Hinge recesses, rebated flush
  mounts and slot ports are not modelled. See §12.
- **No rebates, dados or tongues.** Apart from the mitre of §12, every joint is a
  butt joint.
- **The isometric ignores edge treatments.** A fillet in isometric is an ellipse
  arc and the corner where three meet is a spherical patch. The pictorial shows
  hard corners while the elevations correctly show the radius.
- **Bevels do not shift interior hidden lines.** The outline corners are trimmed,
  but hidden lines terminating near those corners run a millimetre or two past
  where the material actually stops. Only visible when the radius approaches the
  wall thickness.
- **One sheet size.** A3 only; A2 for large boxes would need choosing.
- **Section plane fixed** at half the width.
- **No dimension collision avoidance.** Placements are hand-tuned.

---

## 11. OpenCASCADE

Adopted. OCCT provides the solids, the hidden line removal and — next — the
booleans for cutouts. The sheet, frame, title block, scale selection, view
arrangement, dimension placement, hatch standards and cut list stay where they
were, which is exactly where FreeCAD's TechDraw draws the same line.

### The kernel runs in a worker

Everything OpenCASCADE does — compiling 9.3 MB of wasm, instantiating it,
meshing panels, hidden line removal — happens in `src/occt/worker.js`, reached
through `src/occt/client.js`. None of it is interruptible and some of it blocks:
a `-pthread` build warns in as many words that blocking on the main browser
thread is dangerous.

It used to run on the main thread, and that is what "the page freezes" was. A
frozen tab cannot run the timer meant to rescue it, so the load watchdog was
theatre: it was set on the very thread the kernel was about to block. In a
worker the deadline is real, the page stays live while the kernel works, and a
job that stops answering is terminated rather than left holding a core. The next
request starts a fresh worker, so one stall is not permanent.

The boundary is data only. Kernel objects never cross it: panel boxes and
numbers go in, typed arrays and plain line lists come out, transferred rather
than copied. That is why `kernelViews` and `meshPanels` take fittings **by panel
index** rather than a closure over the derived state — a closure cannot be
cloned. Tests assert that a fully loaded design's job payloads survive
`structuredClone`, because a function that sneaks into one fails only in the
browser.

Two bugs came out of moving it, both of which had been live and invisible:

1. `kernelViews` read `opts.fittingsOn` off an `opts` that was never declared —
   a `ReferenceError` on the first panel, every time. Switching the drawing to
   the kernel had never once worked; it threw and fell back to the analytic
   sheet, which looks almost the same. The function had no test.
2. `BRepFilletAPI_MakeChamfer.Add_2` is the *symmetric* overload, `(distance,
   edge)`. The four-argument one is `Add_3`. Every kernel chamfer threw a
   binding error.

### The deadline is on silence, not on elapsed time

Ninety seconds used to be a total: a job that had not finished by then failed,
and the page said "kernel unavailable". But the kernel is about 4 MB gzipped —
10.6 MB on the wire once decompressed — and on a slow connection that download
alone runs past any total anyone would pick. A download in progress and a
deadlocked kernel are indistinguishable if the only thing you measure is the
clock, and only one of them is a failure. Reproduced by serving `dist/` at
60 kB/s: three minutes to fetch, dead at ninety seconds, every time.

So the worker now reports each step it reaches and each block of bytes as it
arrives, and the client restarts the clock on every one. The timeout means what
it should: **nothing has happened for ninety seconds**. A three-minute download
completes; a stalled one still fails at ninety, and says how far it got.

The wasm is fetched by the worker rather than by the emscripten glue, and handed
over as `wasmBinary` — the only way to count the bytes on the way past, and it
is still downloaded exactly once. Bytes are reported, never a percentage: the
body arrives decompressed while `Content-Length` is the gzipped figure, and a
progress bar that reads 260% is worse than none.

Every failure now names the step it died in, because those steps fail for
entirely unrelated reasons and "kernel unavailable" was the whole message for
all of them:

| step | what it means when it stalls here |
|---|---|
| `fetching` | the network, or the host |
| `starting` | nearly always cross-origin isolation — the threaded build needs it |
| `working` | the geometry: a boolean or a fillet that will not converge |

The page shows the live step while it waits — *fetching the kernel, 8.4 MB…* —
so a slow connection reads as progress rather than as a hang. That alone would
have made this report a one-line diagnosis instead of a bisection.

### Threads, and knowing whether you have them

`crossOriginIsolated` says SharedArrayBuffer is *allowed*. It does not say the
pthread pool came up. Ask `BRepMesh` for parallel meshing when it has not and it
blocks for ever waiting for a thread to take the work — the job reaches
`working` and never leaves. Meshing used to ask unconditionally.

So the worker counts the pool before trusting it (`threadsReady`), and if a job
ever does stall in `working` the client sets `safeMode` on everything after it
and stops asking. Threads are worth 18–22% of the mesh step and nothing at all
elsewhere; they are never worth a hang.

The status line says which it got — `threaded`, `one thread`, or `one thread,
not isolated`. That last one is the answer to why a Pages deployment behaves
differently from a local one, and there is no other way to see it.

**GitHub Pages cannot send COOP and COEP.** It serves static files and has no
header configuration at all, so `public/coi-serviceworker.js` is the only thing
supplying them, on the second load, after it has claimed the page. It can
quietly fail to: a private window, a browser that will not run service workers,
an extension, a hard reload that bypasses it. When it does, the kernel now says
so instead of running slower for no visible reason. To verify by hand, in the
page console:

```js
crossOriginIsolated          // true if the worker took
typeof SharedArrayBuffer     // "function"
```

Anywhere that can set response headers — Netlify, Cloudflare Pages, Vercel —
needs no service worker and no reload. That is the fix if the threads matter;
dropping `-pthread` is the fix if they do not.

### Counting the bytes must not stop the download

Fetching the wasm by hand, to count it, replaced a loader that worked. Reported
from the field, on the deployed build: `the kernel stopped while fetching the
kernel: nothing for 90 s` — no bytes at all, on a browser where the glue's own
loader had got as far as `working` the week before.

Not reproduced here, and said plainly rather than dressed up: the mechanism is
unknown. What is known is which change introduced it, and that the previous path
worked. So our fetch now gives itself twenty seconds to produce a first byte and
otherwise hands back — `wasmBinary` is simply absent and the glue fetches the
wasm the way it always did. Once bytes are moving the clock is dropped and the
download may take as long as it likes.

Counting the bytes is a convenience. Downloading the kernel is not, and a
convenience must never be the thing that stops it.

The stall message also used to assume its own first step. A job began life
saying `fetching`, so a worker that never sent a word and a fetch that delivered
nothing produced the same sentence — different faults, different fixes. A job
now starts with no phase at all, and says so: *the kernel worker never reported
anything in 90 s.*

### Parallel meshing is opt-in, and nothing opts in

`BRepMesh_IncrementalMesh` is synchronous and uninterruptible. Hand it a pool
that will not take the work and it blocks for ever; neither side of the worker
boundary can do a thing about that, and the only remedy is the watchdog, ninety
seconds later. Counting the pool first is not enough — emscripten lists workers
it has *created*, not workers that loaded, and on a host that cannot send COEP
the nested pthread scripts are precisely the ones liable to be blocked.

Threads are worth 18–22% of the mesh step, about 30 ms, and nothing at all
elsewhere. That is not worth a wager which can only be settled by hanging. The
flag defaults to off, the worker requires an explicit `threads: true` on top of
a counted pool, and nothing in the app passes it.

Which leaves `-pthread` as pure cost: the build still needs SharedArrayBuffer to
instantiate, and so still needs cross-origin isolation, the service worker and
the reload — for a thread pool nothing now uses. **The kernel should be rebuilt
without it.** That needs Docker, which this environment does not have.

### One job must not kill another

Two ways it could, both live, and between them they are how "draws once, then
says redrawing for ever" happens:

- **Load progress went only to the job that started the load.** Every other job
  waiting on the same download sat silent for its whole duration, and a silent
  job is one the watchdog kills — which terminates the worker out from under
  the download that was going perfectly well. Progress is broadcast now.
- **A superseded job was ignored rather than dropped.** Every input change
  re-runs the effect and posts a new job; the old one stayed in the queue with
  its watchdog armed, and a job nobody is waiting for still tore the worker down
  when it expired. Jobs take an `AbortSignal` and the hooks abort on cleanup.

Reproduced with `serve-plain.mjs dist 5095 90000` and one input changed
mid-download: before, dead at ninety seconds and never recovering; after, the
download runs to completion at 118 s.

### One job at a time, and it says so while it waits

Reported next: the engine *"is not reliably switching on and off again"*. Three
faults, all in what a waiting job does.

- **Every job was posted the moment it was asked for.** The worker is
  single-threaded and the work is synchronous, so six clicks of the toggle meant
  six full meshes queued inside the worker where nothing on this side could see
  them — each with its watchdog running against a silence that was somebody
  else's work. On a box big enough to spend seconds a mesh, the last one's
  deadline expires, the worker is torn down mid-job, and the toggle does nothing
  at all until the whole 9.3 MB kernel has been fetched again. `client.js` holds
  the queue itself now and hands the worker one job at a time. The deadline
  starts when the job is posted, not when it is asked for.
- **A waiting job said nothing.** Switch on, switch off, switch on again during
  the download and the second job has not been sent anywhere — so the status
  line froze on whatever it opened with for the rest of a minute-long fetch,
  which is exactly what a dead toggle looks like. A queued job now hears the
  load it is waiting on (`fetching the kernel, 7.6 MB…`) and, once the worker is
  busy with somebody else's geometry, its place in the queue (`waiting for the
  kernel…`).
- **A failure was a dead end.** The only way back was knowing to switch the
  engine off and on again. Both status lines offer *Try again*, which is a new
  attempt rather than a retry of the old job. `.solid-state` is
  `pointer-events: none` so the note does not sit in front of the box — which
  made the button unclickable until the button opted back in.

Cancelling is not what it looks like either. A job still waiting its turn is
dropped outright, watchdog and all. A job the worker has already begun cannot be
recalled — an OCCT boolean is one synchronous call with no way in — so it keeps
its place and its watchdog, and its answer is thrown away when it arrives. That
is why cancelling can still terminate a worker: not because the job was
cancelled, but because the worker really did stop.

Verified in a browser rather than argued about: `tools/spike/toggle-kernel.mjs`
flaps the toggle, pulls the rug part-way through a load and edits the box under
a running mesh; `tools/spike/toggle-slow.mjs` does it over a 250 kB/s line where
the kernel takes 45 s, and `tools/spike/kernel-retry.mjs` blocks the wasm
outright and then takes the way back. Six quick edits with two fittings fitted
cost 890 ms of meshing before and 324 ms after — five of the six were work
nobody was waiting for.

### A hole needs an inside

The cutouts had no wall. You looked into a driver's bore and saw straight
through the panel, because the only surface there was pointing away from you and
was culled.

§4.4 said "orient every triangle outward against the centroid", and the mesh
adapter did that literally: flip any triangle whose normal points back toward
the middle of the solid. That is exact **on a convex solid**, which a panel was
— until a hole went through it. The wall of a bore faces inward, at the axis of
the hole, so the test flipped every triangle on it and turned the one surface
that gives the hole an inside inside out.

Winding now comes from the face's own orientation, which is the only thing that
knows: `Orientation_1()` against `TopAbs_REVERSED`, and swap two indices. It is
right for any topology rather than for convex ones. (`toThree` is a rotation of
determinant +1, so it carries the winding across unchanged.)

The test that was meant to catch this was enforcing it. "Every normal points
away from the centroid" is the convexity assumption written down as an
assertion, so a bore that had been turned inside out passed. The invariant that
actually holds is the mesh's own **signed volume**: closed and consistently
wound means it equals the volume the kernel reports, and a wall the wrong way
round shows up as a shortfall. Checked plain, filleted, bored, and bored and
filleted, all within the chord height.

The analytic ring stack keeps the centroid test, and is right to: it has no
holes, so its panels really are convex.

### A hole goes all the way

A fitting was cut into the outermost panel of its face and no further. On a
clad, doubled panel that leaves a 116 mm cutout opening onto solid material —
not a hole, a recess. Every panel on the face is bored now: the layers are
stacked along the face's own axis, so a bore that enters the first enters all of
them and there is nothing to work out beyond the order.

Three things follow from the order rather than from the set:

- **The outermost is still what the fitting is set out from.** That is the face
  a driver bolts to and the surface its position is measured on, so
  `fittingOwners` keeps returning it and the drawing keeps placing from it.
- **The innermost carries a port's tube**, once. Taking the tubes from the
  fittings list gave a clad, doubled panel three concentric tubes.
- **Every layer is checked for clearance, not just the first.** A doubler is
  inset from the panel it backs, so a bore can sit comfortably in the carcass
  and run off the edge of the doubler behind it — and the bore goes through
  both, so that is a hole opening into fresh air. It used to pass.

### Dimensioning a fitting

The views had the circles and no numbers, which makes a picture of a driver
rather than instructions for cutting one. §6.7 now dimensions them in the view
that looks at the face square-on:

- **The bore, by diameter.** A hole is a diameter to whoever has to drill it,
  never a radius. The dimension line runs through the centre with its arrows on
  the circle, pointing outward — the convention when the circle is too small to
  hold them, and at 1:5 every one of these is.
- **The bolt circle, by diameter, marked PCD**, because that is the number a
  maker sets a compass to.
- **The bolt holes once, counted**: `5×⌀5`, on a leader off one of them. They
  are identical by construction, so dimensioning five of them says nothing five
  times.

The angles are fixed rather than fitted — §10 records that this sheet has no
dimension collision avoidance, and these three point into different quadrants,
which is as far as hand-tuning goes. A fitting on the far face turns its leaders
through half a turn, because front and back share the front elevation and two
sets of leaders in the same quadrant are unreadable.

The position is not dimensioned here. It is already on the cut-list template,
measured from the panel's own low corner, which is where it is wanted: the
elevation is for what the hole is, the template is for where to mark it.

### The tube behind a port is optional

Not every port has one. A short port in a thick baffle is a plain hole, and a
bought tube is often left off the drawing and fitted on assembly. So a port
carries a `tube` flag, and when it is off there is no tube body in the 3D view,
no tube circle in the face-on view, and the bore stops at the inner face like a
driver's cutout does.

The bore is the same either way. It **is** the tube's inside diameter,
continuous from the outer face of the panel to the end of the tube, which is why
the control now labels it *Inside ⌀* rather than *Bore ⌀*: one number, and it is
the one that tunes the port. Length and wall belong to the tube and are disabled
without one, and the length is quoted on the drawing — `⌀68 × 150` — only when
there is a tube to have it.

Read as `tube !== false` rather than `tube === true`, so a port saved before the
option existed keeps its tube instead of quietly losing it.

The tube also draws its own edges now. It is a separate body from the panel, and
the viewport was only ever adding edges for panels — so in both wireframe styles
the tube's faces went into the depth buffer and nowhere else, and the tube was
invisible in exactly the views where you would look for it.

### A fitting with no position

`newFitting(type, face)` used to leave `at.a` and `at.b` undefined, so `bore()`
built its cylinder at NaN and `BRepAlgoAPI_Cut` did not fail — it ground away
for minutes on end. Nothing caught it: `fittingIssues` compares the position
against the panel bounds, and every comparison against NaN is false, so the
fitting read as perfectly placed.

The app never hit this, because the control centres a new fitting on its panel.
A test that called `newFitting` without a position did, and looked for a while
like a kernel performance problem. It is worth knowing which it was:
`tools/spike/hlr-holes.mjs` puts hidden line removal over a panel with a driver
cut into it at **34 ms**, no worse than the 47 ms for plain boxes.

Closed at three levels, because a silent NaN deserves all three: the position
defaults to the panel origin, `fittingIssues` reports a non-finite one as an
error, and `fittingCircles` returns nothing for it so the kernel is never handed
it at all.

### The seam

`{ view, ext, lines, arcs }`. Whatever produces it, `sheet.js` renders it. The
analytic engine does by default and the kernel passes its own, so the drafting
layer never learns which one drew the views. That also means the analytic engine
is the instant-load path: the app paints before anyone asks for a B-Rep drawing,
and falls back to it if the kernel fails.

The analytic solver keeps deciding panel sizes. It is exact integer arithmetic
and the cut list rests on it; handing that to a B-Rep kernel would trade
exactness for nothing.

### What it costs

| | full prebuilt | trimmed |
|---|---|---|
| wasm | 48 MB | 9.3 MB |
| gzipped | 13.2 MB | 3.5 MB |

§11 originally guessed 7 MB and 2.4 MB compressed. The trimmed build is close on
the compressed figure and the remainder is `BRepMesh` and the booleans, wanted
for triangles and for cutouts. Fetched on demand, never in the first paint.

### Building it

`occt/box-designer.yml` lists the symbols; `tools/build-occt.sh` runs the
`donalffons/opencascade.js` image over it. Roughly fifteen minutes. Four things
cost a build each to find:

1. **Emscripten fetches ports over HTTPS** and dies on a TLS-intercepting
   proxy's certificate. Mount the CA into the container.
2. **`-sUSE_FREETYPE=0`.** No font symbols are bound, so it is dead weight — and
   leaving it on is what triggers that port fetch.
3. **Bind the base classes.** Listing `BRepPrimAPI_MakeBox` is not enough:
   `.Shape()` comes from `BRepBuilderAPI_MakeShape`, and without it embind fails
   at the first call with `UnboundTypeError`, naming a type you never wrote
   down. Same for `Standard_Transient`, without which the `HLRBRep_Algo` handle
   is never generated.
4. **Serve the artefacts as plain files.** The pthread worker resolves
   `./occt-box.js` against its own URL, so a hashed bundle filename breaks it.
   They live in `public/occt/` and are loaded by URL at run time.

### Threading

Built `-pthread` with a pool of 4, which needs cross-origin isolation. The Vite
dev and preview servers set COOP and COEP directly. GitHub Pages cannot set
headers at all, so `public/coi-serviceworker.js` re-serves every response with
them and the page reloads once under its control.

The generated glue spawns classic workers while the worker file it generates
uses `import()`. Only a module worker can, so the build script patches
`new Worker(x)` to `new Worker(x, {type:"module"})` — patched in the script
rather than by hand, or a rebuild silently undoes it.

### The 3D view

`BRepMesh_IncrementalMesh` and a walk over `Poly_Triangulation`, straight into a
`BufferGeometry`. §4.4 still applies: every triangle is oriented outward against
the solid's centroid rather than trusted from the face orientation, which is
load-bearing here — OCCT hands back both windings, and on a square carcass
exactly half the triangles come out inward.

Tessellation is driven by **angular** deflection, not chord height: at R12 the
linear tolerance is slack long before the angular one is.

A filleted carcass meshes to 312 triangles against the ring stack's 200. The
extra is the blend where two fillets meet, which a stack of rings cannot
represent at all.

### What it buys

- **The fillet-tangency rule of §6.4 stops being hand-coded.** HLRBRep separates
  smooth edges from sharp, so omitting the tangent line is a choice of which
  compound to draw rather than an argument about ISO 128.
- **Silhouettes**, which is what a fillet actually shows in the isometric —
  §10's standing gap.
- **Volume that knows about the bevels.** The analytic model carries them as
  notes, so it cannot: on the 236 × 286 × 356 carcass, 8028.6 cm³ square and
  7956.7 cm³ once R12 fillets are cut.
- **The 3D view and the drawing finally describe the same solid**, rather than a
  ring-stack approximation next to a B-Rep one.
- **Booleans**, which is the road to cutouts.

### The two engines agree

Given the merge of §6.3 applied to what the kernel emits — it runs over a
compound of separate solids, so every panel reports its own outline and a hidden
line often lies under a visible one — the verified end-view table comes out
identical from both. Eight segments, four of them dashed, from rectangle
arithmetic and from a B-Rep kernel. That is about as independent as two
implementations get, and it is the fixture worth keeping.

### Testing

Node-side tests run against the full prebuilt `opencascade.js` package, not the
trimmed build: the trimmed one is compiled `-pthread` and its worker calls
`require`, which Node rejects in a `"type": "module"` package. Both expose the
same API, and the adapter takes the kernel as an argument so either will do. The
trimmed build is checked in the browser instead.

---

## 12. Mitred edges

A butt joint shows one panel's edge grain on the other's face. A mitre brings
both panels out to the corner and cuts each back 45°, so no end grain shows and
the outer surface runs unbroken round the corner. Per edge, wherever it can be
cut.

### The whole idea

**A mitre is a chamfer whose leg is the panel's own thickness, cut the other
way round.** A decorative chamfer takes material off the outer corner and runs
out to nothing at depth R; a mitre keeps the outer corner and opens out to a
full leg at the inner face. One sign in `insetAt`, and every piece of machinery
that already draws a bevel draws a mitre: the ring stacks of §4, the corner
lines of §6.4, `BRepFilletAPI` — well, not that last one, see below.

So the model is two steps:

1. Grow the panel that was butting out to the envelope corner. The one that
   wrapped is already there.
2. Give both panels a `{ type: "mitre", radius: thickness }` on that side.

Only one of the two grows. Growing both double-counts the corner prism, and
§2.4 closure catches it immediately — which is how the first attempt was caught.

### When an edge can take one

Three conditions, all of them things a maker would say out loud:

1. **Both faces carry a panel in the same layer.** You cannot mitre to nothing.
2. **The two panels meet along the whole edge** — they start and end together.
   If one runs past the other, its 45° cut comes out into open air at that end,
   against the side of whatever panel is there.
3. **Both are the same thickness.** Then the cut is 45° and the two halves meet.
   Unequal thicknesses have a mitre at some other angle, but it stops being a
   saw set to 45 and starts being a calculation per joint.

Note what (2) does *not* ask: that the joint reach the envelope. The first
version did, and it was wrong. Under the standard prominence the front and back
wrap and the other four panels form a **tube** between them, whose four long
corners run from the front panel to the back one. Those coincide exactly, mitre
perfectly well and butt at each end — a whole class of real joints the envelope
test refused. With it corrected, a box offers eight mitrable edges rather than
four: two rings of four.

A mitre and a decorative bevel are **mutually exclusive on one edge**. The mitre
already cuts that corner at 45°; a fillet on top of it would have to be split
across two panels that each own half the corner. Choosing Mitre in the per-edge
control replaces the treatment rather than adding to it.

### Mitres rule each other out

Two rings are offered and only one can be cut, which took a broken volume to
notice. Mitring front/left grows the left panel forward to the envelope. That
lengthens it along y — and y is the axis the left/top joint runs along, so the
left panel now runs past the top panel and their mitre would have to stop
partway down it. The geometry cannot express a cut that stops, §3 refuses one
for exactly the same reason, and the arithmetic quietly over-counted the wedge
by one thickness cubed per conflicting pair.

The shape of it: **a panel takes mitres on opposite sides, not adjacent ones**
— unless every neighbour grows to match, which a strict prominence order never
arranges. A fully mitred box, where every panel is the full outer face size, has
no prominence at all and is a construction this model cannot express.

So the requested set is resolved before anything is cut, greedily in edge order:
each mitre is accepted only if it and everything already accepted still hold on
the grown boxes. Greedy rather than a fixed point, because two mitres that rule
each other out should leave one standing rather than neither; in edge order
rather than click order, so the answer never depends on how the user got there.
Whatever is dropped is named in §8 with the mitre that displaced it.

The per-edge control follows the same rule and closes options off as they are
taken, showing why. It offers an edge only if adding it is **additive** — an
option that silently undoes four mitres already chosen is not an option — and
the shortcut applies the largest consistent ring rather than every mitrable
edge, so it never fires a warning.

### What it does not change

The cavity. A mitre moves material between two panels and nowhere else, so
internal dimensions are identical to the butt-jointed box — the same invariant
§2.4 states for prominence. Closure is recomputed rather than adjusted: a mitre
both grows a box and cuts material off it, so the old residual is not a term in
the new sum.

The envelope, too. The outer corner stays sharp, so no outline moves in any
view. Blank sizes are the grown outer sizes: cut the panel full, then mitre it.

### In the views

Both panels now reach the corner, so their boxes overlap in a square the size of
their thickness. Exact rectangle HLR cannot represent a 45° face, so each view
resolves the overlap first:

- **Both faces on the sides of the view.** The square is in the plane of the
  drawing and the joint reads as a diagonal across it. The boxes stay
  overlapping, every line inside the square is trimmed away except the two
  envelope faces, and the diagonal is drawn in their place — as visible as the
  butt lines it replaces, since it is at the same place and the same depth.
- **One face toward the viewer.** The square is edge-on. The panel whose own
  face is toward the viewer keeps the corner; the other goes back to where it
  would have butted, which is exactly where its material now ends. Its depth
  then sorts correctly and the seam it used to draw disappears — which is the
  visible point of a mitre, seen from the side.

The isometric skips a panel on any plane it is mitred to: it touches that plane
along a line, not over an area.

### In the kernel

Not a chamfer. A mitre's leg is the whole thickness, so chamfering the inner
edge would have to consume the entire side face — the face disappears, and
`BRepFilletAPI` is entitled to refuse. Instead, a boolean against a box turned
45° about the outer corner line.

Measure `u` inward from the outer face and `v` inward from the mitred side, both
zero on the corner line; the material to remove is `u > v`. Start with the
quadrant `u ≥ 0, v ≤ 0` — a box hanging off the side of the panel, in free air —
and turn it 45° about the corner line, from `u` toward `v`. It sweeps to
−45°…+45°, whose half inside the panel is exactly `u > v`. The plane `v = 0`
ends up in the tool's interior rather than on its boundary, so the cut never has
to decide about a face lying in the panel's own side.

Verified against the arithmetic panel by panel: `volumeOf` matches
`boxVolume(box) − mitreLoss(panel)` to the last place, and a mitre composes with
a chamfer on the same panel — the chamfer comes up short by exactly R³/6, the
integral of the wedge against the sloped end.

### The one binding bug it turned up

`BRepFilletAPI_MakeChamfer.Add_2` is the *symmetric* overload — `(distance,
edge)`. The four-argument one is `Add_3(d1, d2, edge, face)`. The chamfer path
had been calling `Add_2` with four arguments since §3 was wired to the kernel,
which throws a binding error at the first chamfer and had no test to catch it.
Fixed, and covered.


---

## 13. The design, kept between visits

One key in localStorage holding the whole design, written after every change and
read once at startup. Not a document store and not a project manager: the app
has one box open at a time, and the point is only that closing the tab does not
throw the afternoon away.

The interesting half is reading it back. A design saved last week was written by
last week's app, and this week's has fields it never heard of — mitres, a port's
tube flag, a per-face thickness map. Restoring it verbatim leaves those
undefined, and undefined reads as false, as zero, or as a crash. So a save is
merged **over the defaults**, and:

- **A key the defaults do not have is dropped.** That is what stops a stale save
  reintroducing a field the app has since retired.
- **The open records are merged a level deeper.** `cladding`, `doubler`,
  `thicknessBy` and `edge.by` are keyed by face and by edge — their keys come
  from the user, not from the defaults — so each entry is merged over the
  default entry where there is one, and the rest are kept.
- **Lists are taken whole.** `fittings` and `order` are lists rather than
  records; merging them element-wise would be nonsense.

It saves after the render that used the design, not before, so a box that cannot
be solved is still kept — reload and carry on fixing it rather than losing it.
Storage that will not cooperate is never fatal: a corrupt save opens the
defaults, a refused write warns and carries on, and no storage at all works
fine. Losing a save is a disappointment; losing the edit that triggered it would
not be. Reset forgets as well as resets, because a design kept between visits
that you cannot get rid of is a trap.

The app's own tests clear storage between cases now. They had been getting a
fresh design for free, and the moment one persisted, nine of them started
reading whatever the previous test left behind.

### What it turned up

A test that saved a *fully loaded* design — cladding, a mitre, a driver — and
checked it still solved found that it did not, and had never done. A mitred
panel grows out to the corner it shares with its neighbour, and the code grew it
to the **envelope**. Those are the same thing on a bare carcass. Cladding sits
outside the shell, so the envelope is 6 mm further out than the shell's own
corner, and the mitred panel grew straight through the cladding. §2.4 had been
reporting it as a closure error the whole time, correctly, and nothing had put
the two features in the same box to see it.

It grows to the other panel's outer face now, which is what the corner always
was. Both targets are read before either panel moves, or growing the first would
shift the corner the second is aiming at.


---

## 14. The sheet layouts as DXF

R12 ASCII, because everything reads it — thirty-year-old CAM seats included —
and nothing here needs anything newer. Millimetres, 1:1, no scaling anywhere: a
file that arrives at the wrong size is worse than one that does not arrive.

**What goes in is what gets cut, and nothing else.** Part outlines as closed
polylines, the fitting cutouts and bolt holes as circles, the stock boundary for
reference, and text. Four layers, so the shop can order the work — holes before
the profile, or the profile alone with the rest switched off:

| layer | what it is |
|---|---|
| `OUTLINE` | the part profiles, closed |
| `HOLES` | cutouts and bolt holes |
| `SHEET` | the stock boundary, reference only |
| `LABEL` | part ids and a caption per sheet; cuts nothing |

Two things are deliberately absent. **The bolt circle**, because it is a
setting-out circle rather than a path, and a file handed to a machine should not
contain a circle nobody meant to cut — it is dimensioned on the A3 drawing
instead. And **the bevels and mitres**, which cannot be in it: a blank is a
rectangle, and the 45° is a saw set over after the parts come off the sheet. The
cut list's edge column carries that work.

One file rather than one per sheet, with the sheets laid left to right and each
captioned with its material and size. A browser asking three times in a row
whether you would like to save a file is its own kind of unhelpful, and a shop
opening one file to find three labelled sheets side by side knows exactly what
it is looking at.

### Coordinates

Blank coordinates run x along the length and **y down** from the top edge, which
is how `toBlank` gives them and how the templates draw them; the nest places
parts in the same top-down frame. DXF is Y-up, so the sheet is flipped once at
the end rather than every point being reasoned about twice. A rotated part is
turned a quarter turn clockwise — its top-left corner goes to the footprint's
top-right and its length runs down the sheet.

### Checking it

A DXF that parses can still put a hole in the wrong part, so the tests read the
file back and check the geometry: every part inside its sheet, every hole inside
its part, and every outline the size the cut list says. The driver's position is
cross-checked against the **panel box** rather than against the placement
function, so the test can actually disagree with the code. And
`tools/spike/dxf-preview.mjs` draws a DXF as an SVG, because some of this is
only obvious when looked at.

## 15. Applying an edge treatment by clicking the edge

The per-edge control used to list all twelve edges, every one of them offering
Square, Chamfer, Fillet and Mitre, and eleven of them saying Square. A list of
everything that could happen is not a list of anything. It is now a list of what
has been done to the box: an edge appears once it has a treatment and leaves
again when it goes back to square.

That needs a way in that is not the list, and the obvious one is the box itself.
Arm a treatment from the chips under the viewport, click an edge, and the edge
you clicked gets it. The armed tool is not part of the design — it is what the
pointer is for at this moment, not something about the box — so it lives in the
app's state and is gone on reload.

### Hitting a line

A line has no area, and the one pixel it does occupy moves as the box turns. So
every edge the armed tool can treat gets an invisible box around it and those
are what the ray hits: as long as the edge, `2r` square across it, where `r` is
4.5% of the box's smallest dimension, clamped to 4–30 mm. Below the clamp a
60 mm box is unhittable; above it a 3 m box has targets that swallow the corner
where two of them meet.

The proxies are invisible but present — three raycasts an object whatever its
material says and only skips it if the object is not in the scene at all — and
they are geometry rather than rendering, so `edgeProxies` is checkable without a
canvas.

An armed click takes the edge if it hits one, and changes nothing if it misses.
Falling through to the panel behind would select a part while the pointer is
plainly meant to be doing something else.

### The highlight has to have width

Drawn as a line, the highlight was invisible: WebGL gives every line one pixel
whatever `linewidth` asks for, and this one landed exactly on the panel edges
already drawn there. Photographed in the browser, there was nothing on screen at
all. It is a bar now — the proxy, slimmed to half its width across — drawn with
`depthTest: false` so the whole edge shows rather than half of it disappearing
behind a panel. `tools/spike/shoot-edge-hint.mjs` crops the same patch with the
pointer on an edge and off it, which is how the empty version was caught.

### What each tool may touch

Two different questions, and neither answer stands in for the other. A bevel
needs one panel running the whole edge (§3); a mitre needs the two panels to run
it together (§12). This box has edges that pass the first and fail the second,
so the tool asks for the answer it needs. Square reaches every edge, including
the ones nothing else can treat — otherwise an edge could be given a treatment
by one route and have no way back.

### Switching to per-edge without losing the box

Arming a tool on a box with a 12 mm fillet all round and clicking one edge
square must leave the other eleven filleted. So the per-edge map is seeded from
whatever the uniform setting was, rather than from nothing, and only then is the
clicked edge changed. `none` deletes the entry rather than storing a square one:
the list is what has been done, and a row saying "square" is a row saying
nothing.

### The other way in

The list carries an **Add an edge** select as well, listing the edges not yet
treated and disabling the ones that can take neither a bevel nor a mitre. The
pointer is the better way to reach an edge, but it is not the only one anybody
has, and it is not one a test in jsdom can use.

---

## 16. Rounding the sizes

A twelve-litre box on the default proportion comes out 217.712059 × 263.140074 ×
326.739295 mm. Rounded to a tenth that is 217.7 × 263.1 × 326.7, and a tenth of
a millimetre is a number nobody can cut to and everybody has to read. **Round
to** offers 0.1, 0.5, 1, 5 and 10 mm, and starts at 1.

### Rounded once, on the envelope

The rounding is applied to the envelope in `deriveEnvelope`, before a single
panel is laid out, and everything downstream is derived from the rounded figure.
That is the whole of the design: the panels still tile the envelope exactly
(§2.4 invariant 1), the volume still closes to zero (invariant 2), and the cut
list still adds up.

Rounding the panels instead would put the error *between* them, which is the one
place a box cannot take it: six panels each rounded to the nearest millimetre do
not meet, and the residual has nowhere to go.

So what moves is the cavity, by at most half a step on each axis — 11.995 l
becomes 12.022 l at 1 mm. That is the trade, and the readout shows it: envelope,
internal and cavity, all three, right under the control.

With whole-millimetre stock thicknesses — which every material in §5 has — a
whole-millimetre envelope makes every panel length, width and thickness a whole
number too, cladding, doublers and mitres included. Nothing else has to know
about the option at all.

### The step is the number, not a flag

`round` used to be a boolean meaning "to 0.1 mm or not at all"; it is a step in
millimetres now, and `true`/`false` still read as 0.1 and 0 so that a solve
written against the old signature keeps working. `solve` on its own still
defaults to 0.1: the library's behaviour is unchanged, and it is the *design*
that carries the 1 mm default.

### Rounding a number that is not the number

`Math.round(0.35 / 0.1)` is 3, because 0.35 / 0.1 is 3.4999999999999996. The
honest answer about the double is the wrong answer about the millimetre meant by
it, so `snapTo` settles the quotient to nine places before rounding it — and
trims the product back afterwards, since `Math.round(2364.4) * 0.1` is
236.40000000000003, a longer number than the one it was shortening.

---

## 17. The lines in the 3D view

Reported: *"the lines in the 3D view are slightly poor quality"*. Two separate
faults, neither of them about the colour or the geometry of the lines.

### A GL line is one device pixel, and that is that

`LineBasicMaterial.linewidth` is ignored by every browser — the driver here
reports an aliased line width range of exactly 1 to 1 — so every edge was one
device pixel wide. On a 2× display that is half a CSS pixel: thin, dim, and
stepped on any shallow angle, however much multisampling the context has.

Edges are drawn as screen-space quads now (three's `Line2` family), 1.4 CSS
pixels wide, with an antialiased boundary of their own rather than one borrowed
from the driver. The width is scaled by the pixel ratio, because the shader
measures in the units of the resolution it is given and that resolution has to
be the drawing buffer — get that wrong and a 2× display draws everything half as
thick, which is the bug being fixed.

Every fat-line material is kept on the renderer state so a resize can tell it
the new size. A material that thinks the canvas is the size it was two resizes
ago draws the wrong width, and nothing else in the app would ever correct it.

Measured on the wireframe styles, ink being how far each pixel sits above the
dark ground, summed:

| | lit pixels | ink | ink per lit pixel |
|---|---|---|---|
| GL lines, 1 device px | 4,234 | 1.07 M | 253 of a possible 692 |
| quads, 1.4 CSS px | 10,569 | 4.61 M | 436 of a possible 692 |

The second column is the width; the third is the aliasing. A line whose average
lit pixel is at 37% of full brightness is a line the eye reads as broken.

The faint pass was calibrated by measurement when lines were one pixel wide
(§4), so widening them meant measuring it again rather than trusting the number.
Hidden edges went from 63% of the visible pass's ink to 32% — the hierarchy the
faint pass exists for got *better*, so `HIDDEN_OPACITY` stays at 0.07.

### The other half was not the lines at all

The near and far planes were 1 and 100000, around a box a third of a metre
across seen from a metre away. The depth buffer's precision goes on the *ratio*
between the planes, not the distance between them, so at 1:100000 there was
almost none of it left where the box actually was — and a panel and the edge
drawn along that panel landed on the same depth value. That is what made an edge
flicker in and out along its length as the box turned, and no amount of line
quality fixes it, because the line was not the thing that was wrong.

`nearFar` fits the planes to what is in front of the camera: about 3:1 in
practice. The box's radius grows with the explode slider and with wherever the
view has been panned to, and both are counted, or a panned or exploded box
clips.

The faces also take a one-unit polygon offset, so an edge lying on a face wins
the depth test along its whole length rather than stippling in and out of the
shading it lies on.

### What it costs

19% more time per orbit frame under **software** rendering (SwiftShader, 2.2
megapixels a frame), where fill rate is the whole cost and a quad covers about
three times the pixels of a line. On a GPU the difference is not measurable
here. `tools/spike/measure-lines.mjs` measures the ink,
`tools/spike/lines-scenes.mjs` draws the awkward cases — fillets, the kernel's
own B-Rep edges, a port tube, an exploded box — and times the orbit.

### The stub that only took orders

The renderer is stubbed in jsdom, and the stub had `setPixelRatio` but no
`getPixelRatio`: it accepted orders and answered no questions, which is fine
until the code asks one. It lives in `test/stub-renderer.js` now, answering both.

---

## 18. Colour

Valchromat is dyed through rather than faced. The colour is a property of the
board, not of a finish applied to it afterwards — which is why it belongs to the
panel in the model and follows it into the cut list, the part templates and the
sheet layouts.

### Where a colour lives

Three levels, each a **fallback** rather than a copy:

1. `design.colourBy[face]`, when **Colour per panel** is on;
2. `design.colour`, the project's;
3. the colour the sheet comes in.

`design.colour` is null until something sets it, which is not the same as a hex
that happens to equal the default: one follows the sheet when the sheet changes
and the other does not. Cladding and doubler panels carry their own `colour`,
inherited from the project when they are added.

A colour belongs to a range, so changing a sheet drops it. Green Mint is not
something you can order in birch ply, and carrying the number across would leave
a design claiming a colour that cannot be bought.

### Valchromat's twelve

White Pearl, White Grey, Light Grey, Grey, Black, Chocolate, Khaki, Green Mint,
Blue, Red, Orange, Yellow. Named in a select where the sheet has names for its
colours; a picker beside it for everything else, because a design is allowed to
say "this one, painted" without the app arguing.

The hex values are **sampled**, not guessed: the median of a supplier's swatch
photograph over the middle half of the frame, by `tools/spike/sample-swatches.mjs`
(the photographs are not redistributed — only the numbers taken from them).

| | | | |
|---|---|---|---|
| White Pearl `#faf3e1` | White Grey `#b5b2a5` | Light Grey `#a49b96` | Grey `#7c7679` |
| Black `#696870` | Chocolate `#81695f` | Khaki `#9b9772` | Green Mint `#548772` |
| Blue `#597ba2` | Red `#da646c` | Orange `#d38a6a` | Yellow `#e3b869` |

That is the board **as photographed in bright, even light**: lighter and less
saturated than the pigment, and lighter than the same board on a shelf. Black
comes out a slate charcoal because that is genuinely what dyed black fibre looks
like flat-on, not because the sampling is wrong. Take the real decision off a
sample, under the light the box will live in.

The same spike measures how far the speckle strays from the median — ±43% of
mid-luminance on Black, ±1% on White Pearl. That is the fibre, and it is what a
rendered surface has to reproduce to look like the board rather than like paint.

### The swatch shows what the panel will be

A face that is following the project shows the project's colour, not the sheet's:
a grey square against a green box would be a plain lie about what is going to be
cut.

---

## 19. The rendered view

A photograph of the box, in two levels: a studio render that turns with the
mouse, and a path trace of the same scene for when it has to look like a
photograph rather than like a render.

Its own mode, its own canvas and its own scene. Almost nothing is shared with
§4: no edges to draw, a different framing, physical materials rather than flat
ones, and the box stands on a floor instead of floating at the origin.

### The studio

A seamless sweep — floor, quarter-radius, wall, extruded sideways as one surface
so there is no join anywhere in it — and an environment built in `studio.js`: a
sky gradient, a soft box well round to one side, a weaker fill opposite. Written
as a float equirectangular image, with the lamps well above 1, because the
difference between a light and a bright grey is that a light has more energy
than white and a path tracer can tell.

Both levels are lit by that same environment, so **Refine** changes how
carefully the light is followed, not what the light is.

Two decisions worth writing down:

- **The key is nearly 1.3 radians off the camera.** A light on the camera's
  shoulder lights both visible faces of a box the same, and a box with two
  identical faces reads as a flat shape with a line drawn down it.
- **Material colour, never the face colouring.** The face colours of §4 are a
  way of reading the joinery. This view is a photograph of a box somebody is
  going to make out of a real sheet.

### The environment was upside down

Row 0 of a texture is the bottom of the image; `v` in the generator is the angle
down from straight up. Filling rows straight from `v` put the sky underneath the
floor — and the symptom is not "the environment is inverted", it is that the top
face of the box goes dark and everything reads as flat lighting. Every
explanation that suggests itself is about the shading model.

`sampleStudio` reads the environment back in a given direction, which is what
makes "is the sky above the box" a test rather than a squint.

### Path tracing, on demand

`three-gpu-pathtracer` over the same scene, camera, materials and lights.
Averaged frames, refining while you watch: colour bleeds off the red front panel
onto the sweep, the inside of a driver's bore goes dark because most of the room
cannot see into it, and the shadow tightens where the box meets the floor. None
of those are things a rasteriser with one shadow map can do, and between them
they are most of what makes a photograph look like one.

Fetched by dynamic import the first time somebody presses Refine — 186 kB of it,
in its own chunk, never on the way to the first paint.

**Two copies of three.** `import("three")` inside the dynamically imported module
gave the async chunk its own copy: 200 kB of it twice in the build, and two sets
of classes that fail every `instanceof` against each other. three is imported
statically at the top of `pathtrace.js`; only the tracer is fetched on demand.
The main bundle grew by 7.6 kB for the whole feature.

**Measured here under software rendering** (SwiftShader): about 1.4 samples a
second at 520 × 420, 40 samples of a box with a driver cutout in 96 s. A real
GPU is enormously faster than this and the figures above say nothing useful
about one — what they do establish is that the integration is right, because the
picture converges to the right picture.

### Cost

| | |
|---|---|
| main bundle | +7.6 kB |
| render mode chunk | 10 kB, loaded when the mode is opened |
| path tracer chunk | 186 kB, loaded when Refine is pressed |

### The canvas was resized on every frame

Reported from an iPhone: Refine "only displays part of the screen and it flashes
on and off".

`renderer.domElement.width` is in **device** pixels and it was being compared
with `clientWidth`, which is in CSS pixels. On any display with a pixel ratio
above 1 the two never match, so every frame resized the canvas — and every
resize reset the path tracer. It never accumulated past its first sample, and
what showed was whichever tile had just been drawn into a target that was about
to be thrown away. On a phone, where the ratio is 3, that is a picture flashing
on and off with a piece of it arriving at a time.

Both views compare against the size they last set now. In the 3D view the same
mistake was only wasting a resize a frame, which is why nobody noticed it there.

### A phone asks for eleven megapixels

The same pixel ratio of 3 means a full-screen canvas asks for about 2.7 Mpx of
path tracing on a phone, and a desktop one for more. `traceSize` caps it at 2.2
Mpx and never traces above twice the CSS size; the result is scaled up to fill
the canvas. Softer, and the alternative is not a sharper picture but a browser
that gives up on the tab. The status line says the scale when it is not 1, since
a soft render nobody was told about reads as a broken one.

`tilesFor` splits a large frame so no single draw call runs long enough to make
the tab unanswerable, and leaves a small one whole so that a part-drawn frame is
never on screen.

### The studio turns with the camera

Asked for next: put the ramp behind the box. It was in a fixed world direction,
so it was behind the box from one angle and off to the side from every other.

Sweep and lamps are one group now, rotated by the camera's own azimuth, so the
backdrop is always behind the subject and the light always falls the same way
across it: every angle of the box is the same photograph of it, rather than a
different one taken in the same room.

Three consequences, each of which had to be dealt with:

- **A camera on the level then sees nothing but wall.** With the sweep squarely
  behind, the floor leaves the frame and the box floats against a grey field.
  The view looks down further (1.02 rather than 1.16 radians of polar), and the
  curve is wider and further back — a big radius well behind the subject is a
  backdrop; a tight one just behind it is a wall.
- **The path tracer bakes the scene into one world-space tree**, so a stage that
  has turned is a scene it no longer knows. `sceneMoved()` rebuilds it. Refitting
  — the cheap path, meant for geometry that moved a little — comes back with
  bands of environment through the floor after a thirty-degree swing.
- **`scene.environment` cannot be rotated in three r160**, so the environment
  had to become something that does not need rotating: an even gradient, with no
  lamp painted into it. Every lamp is a real light instead.

### A three-point rig, in camera-relative angles

Key, fill and rim, each doing one job, and all three defined by their angle from
where the camera stands rather than from north:

| | azimuth | elevation | | |
|---|---|---|---|---|
| key | −1.25 | 0.62 | warm, ×2.7 | one face lit and the next not — the whole of why a box reads as solid |
| fill | +1.42 | 0.22 | cool, ×0.8 | keeps the shaded face readable without pretending it is lit |
| rim | +2.85 | 0.78 | white, ×1.7 | a bright edge along the top and far corner, so the box leaves the backdrop |

Warm key against cool fill, because daylight and the sky it bounces off are not
the same colour and a render where they are looks like a render. Only the key
casts: one soft shadow reads, three overlap into mud.

The sweep carries its own falloff in vertex colours — full brightness within
0.7 box-diagonals, down to 22% by 4.5 — because directional lights are parallel
and infinitely far away and give none. Measured in **diagonals from the box**,
not as a fraction of the sheet: the sheet is enormous so its edges are never in
shot, and a gradient spread across the whole of it is a gradient nobody sees.

### Two that took a screenshot to find

**Emptying the stage emptied the rig.** The rebuild cleared the group the sweep
was in — and the lamps were in it too. What was left was a box lit by nothing
but the sky: flat, with no shadow at all, which reads as bad lighting rather
than as three lights that are no longer in the scene. The sweep has its own
group inside the stage now. The same loop was doing `children.pop()`, which
leaves every child still naming that group as its parent, so anything asking
"am I in the scene?" was told yes by an object nothing would draw. It uses
`remove()`.

**A shadow map fitted to the box cut the shadow off.** A 327 mm box lit from 27°
lays a shadow longer than itself; the map covered 610 mm of floor and the shadow
needed 630. It reached a few centimetres past the box and stopped dead. The
extent includes the throw now: `E.z / tan(elevation)`.

**One attribute, everywhere.** The tracer merges the whole scene into a single
geometry, and an attribute some parts carry and others do not comes out of that
merge as nonsense — bands of environment through the floor, coloured streaks
across the backdrop, light arriving from nowhere. The sweep grew vertex colours;
everything else needed white ones. `withColour` does that, and the rule has a
test, because the symptom looks like a path tracer bug and is not one.

### The floor curved through the box

Also reported: "the box is slightly cut off by the curve on the floor". The box
stands centred on the origin and the sweep's curve began there, so it rose
through the box's back half. The profile takes a `back` now — how far behind the
origin the floor stays flat — set to three quarters of the box's diagonal, which
clears its furthest corner whichever way the view is turned.

### Smoother, capped, and it keeps the picture

Three things reported together, all about the render being something you sit
with rather than something you glance at.

**The ramp had facets in it.** The sweep was built as loose triangles — three
fresh vertices per face — so `computeVertexNormals` had nothing to average
across: every triangle got its own flat normal and the curve came out as a
staircase of bands, most visible exactly where the light grazes it. The grid is
indexed now, 60 steps by 24 columns sharing their vertices, and the same call
averages the normals into one smooth surface. Roughly a quarter of the vertices
for a curve with no steps in it.

**A cap on the samples.** The render used to run until stopped, which is fine
watching it and useless leaving it. There is a Samples box; it starts at 30 and
the render stops itself there and says *done*. Thirty is a tenth of the work 300
was, and it lands under `DENOISE_UNTIL`, so the picture it stops on is one the
filter is still smoothing — soft rather than grainy. How long that actually
takes is the machine's business and not something to put a number on here: on
the software renderer in a headless container a single sample is about six
seconds, and on a real GPU thirty of them are gone before you look up. Raising it on a stopped render
starts it going again from where it got to — the average is still in the buffer
— and lowering it below the current count stops it where it is. The whole of the
bug worth guarding is `maxSamples > 0`: a cap of zero means *no cap*, and a cap
of zero compared with `>=` is a cap that has always already been reached, so an
uncapped render would report itself finished having drawn nothing.

**Stop keeps the picture.** Pressing Stop used to snap back to the studio
render, throwing away however long somebody had just spent watching it converge.
A stopped render is *held* now: the accumulated image stays on screen, drawn by
`present()` without taking another sample. It is let go of on one event only —
the view being turned — because that is the moment the picture somebody was
looking at stopped being a picture of anything. Turning it says so in the status
line rather than leaving it looking stuck.

**A denoiser for the first twenty seconds.** Below 80 samples the frame goes
through `DenoiseMaterial` on its way to the screen — a bilateral filter, one
full-screen pass — with its strength wound back as the average takes over, so
the picture sharpens rather than staying soft and then snapping. `stableNoise`
is on as well: the same sequence every time from a given camera, so a stopped
render is the same picture twice rather than two draws of it.

### The renderer is WebGL2, and that is the ceiling

Worth writing down because it will be asked again. `three-gpu-pathtracer` is a
fragment shader: the BVH, the materials and the environment all go to the GPU as
textures and every sample is a full-screen draw. There is no WebGPU path in it —
not in 0.0.24, not in any earlier version — and CPU threads do not apply, because
no part of the tracing happens on the CPU to be moved off it. Web Workers cannot
help either; a `WebGLRenderer` belongs to the context that created it.

So the levers are the ones being pulled: bounces (four — enough for a box on a
sweep, and every extra one is paid for on every sample), tiles (a big frame split
so the tab stays answerable, a small one not, because a part-drawn frame looks
like a fault), the resolution cap, stable noise, and the denoiser.
`filterGlossyFactor` is deliberately left off: it trades caustic noise for a
blurred highlight, and nothing in this scene is glossy enough to have either.

### The render's own camera

The render view and the 3D view are separate cameras — the 3D view is for
reading the box and the render is for photographing it, and they want different
angles. But leaving one to come back to it and finding it re-framed loses
whatever was set up. So each keeps its own angle, and each hands it back on the
way out: the render reports `{azimuth, polar, distance}` as it moves and when it
unmounts, and restores it on the first framing. Switching modes and switching
back is pixel-identical, which is how it is checked.

## 20. Where a fitting sits

A fitting's position was two millimetre offsets from the panel's corner. That is
the right answer for a hole that has to line up with something — a bolt pattern,
a connector body — and the wrong one for anything meant to *look* placed: a
driver in the middle of a front panel is at the middle of it whatever size the
box is, and re-typing 109 and 81.8 every time the box changes is not what the
number means.

So a position carries its units. `mm` is what it was; `ratio` stores a
proportion of the panel's width and height, resolved to millimetres once, in
`derive()`, before anything else sees it. Everything downstream — the templates,
the sheet layouts, the drawing, the kernel's boolean cuts — takes millimetres and
never learns there was a choice.

### Switching units moves the number, not the fitting

Changing the picker converts what is stored so the fitting stays exactly where it
is. `convertAt` does that in both directions and rounds neither: a percentage
rounded to a tenth moves a fitting on a 218 mm panel by a fifth of a millimetre,
and rounding it on the way back moves it again, so a fitting that had been put
somewhere deliberately drifts every time somebody looks at the units. The stored
number is unrounded and the field displays it rounded, which is the same
arrangement every other length in the app already has.

## 21. The panel you selected

The sidebar asks questions about the box: one thickness, one colour, a list of
every fitting on it. That is the right way round for setting a box up, and the
wrong way round once it exists and you are looking at it. The question in front
of you then is "this panel, thicker" — and answering it in the sidebar means
finding the face in a grid of six, having first found the switch that turns the
grid on.

So selecting a panel opens a second panel on the other side, about that face and
nothing else: its blank size, the sheet it is cut from, where it comes in the
prominence order, its four edges, the fittings on it, and whether it carries
cladding or a doubler. Shown in every mode, because the cut list and the drawing
select panels too and the same face is the same face from all three.

(§21 added the inspector beside the sidebar and left both; §47 finished the job
and moved every panel control out of the sidebar, so nothing is in two places.)

### The controls are the same controls

`Num`, `Colour`, `Segmented`, `Group` and the fitting editor moved out of
`Controls` into `fields.jsx` and `FittingEditor.jsx` before any of this was
written. Two copies of a number field is two places for a step, a suffix or an
aria-label to drift, and the difference shows up as "the colour picker behaves
differently over here", which is a bug nobody can name. The fitting editor in
particular numbers its labels by the fitting's place in the *design's* list, so
a fitting keeps the name it has in the sidebar when it is opened from the
inspector.

### One face, not six

The design keeps a single carcass thickness with a per-face override beside it,
and a single colour with the same. That is right for the sidebar — most boxes
are one thickness all round, and six numbers to keep in step is six chances to
get one wrong. It is the wrong shape for a control on one panel: with the
override off, writing to that face either does nothing or moves all six.

`setFaceThickness` and `setFaceColour` switch the override on, seed the other
five from the uniform value, and then change the one face. The same move
`setEdgeTreatment` makes when a click lands on an edge of a box that was uniform
(§15), and for the same reason: the edit you asked for happens and nothing else
does. Seeded from the *uniform* value rather than from whatever `thicknessBy`
happens to hold — a design edited before the override was ever switched on can
carry a stale set, and inheriting those would change five faces nobody touched.

Putting a face back to "as the project" is a real answer and not the same as
painting it the colour the project happens to be: the first moves when the sheet
changes and the second does not. So it stores null, and the per-panel switch
stays on — turning it off because one face went back to the default would drop
the other five.

### Cladding and doublers, on the face in front of you

The three layers of a face are listed as a stack: cladding outside, carcass,
doubler inside. Each is either there — with its thickness, and a way to step to
it without going back to the box — or not, with one button to add it. The
carcass has no × because the carcass is the box; the empty cell where the ×
would be is what keeps the three rows in line.

### Naming an edge from the face you are on

The twelve edges are keyed by the two faces that meet along them, which is the
right key and a poor label. From the front panel, `front|left` is "the left
edge", and reading it out as "front / left" asks somebody to work out which of
the two faces they are standing on. So the inspector names each edge by the face
across the corner, and `edgesOfFace` and `otherFace` do that arithmetic once.

It shows what the design *asks* for, mitre included, which is not what `edgeMap`
answers: that one drops a mitre to square, because a mitre is a joint rather
than a decoration, and it answers for all twelve at once. `authoredEdge` gives
one edge its own answer — with a radius to offer even where the treatment is
square, or switching an edge from square to fillet offers a fillet of nothing.

### Rank, in what it does rather than where it sits

"2 of 5" is a position in a list, and a position in a list is not what anybody
wants to know. What rank decides is which panel runs out to the corner and which
is fitted between two others, so that is what it says: *runs past 3, inside 2*.

### The column comes out of the middle

The inspector is a third column of the app grid, not a floating panel, so the
viewport gives up the width rather than having it drawn over. The cut list has
three columns of its own and cannot keep them all at the same time, so it drops
its parts column while the inspector is open — the same column the 1320 px
breakpoint drops first, for the same reason.

### The fitting fields had nowhere to put their digits

Reported as "the fittings panel is a bit tight — the numbers are not visible",
and it was worse than tight: every number input in the inspector showed nothing
at all, suffix only. Two causes stacked.

The first is specificity. `.inspector .field` and `.fitting-grid .field` have the
same weight, so the later one wins, and the inspector's wider label was later —
it took 22 px off every fitting input in the panel without touching the sidebar.
The second is that two columns does not fit in 300 px. Less a group's padding
that is 127 px a column, and a number input spends 33 px of its own width on
padding before a digit is drawn: 7 px on the left and 26 px reserved on the
right for the suffix. What was left was 50 px, and the value was not truncated
but pushed out of view entirely. So the inspector puts a fitting's numbers one
to a row, and restates the narrow label after the rule that widened it.

The sidebar was clipping too, marginally: `163.5` came out as `163.`. Measuring
the text said it fitted in the room the padding left — 36 px of digits in 44 px —
and the screenshot said it did not, which is the useful disagreement. Chromium
reserves about 7 px inside the content box for the number spinner, and the app
draws its "mm" over exactly that spot, so the arrows were never going to be seen
and were costing the width anyway. They are turned off, everywhere: arrow keys
still step the value, and every number field in the app gained 7 px.

## 22. Rendering the driver

A box with a hundred-millimetre hole in it is a box with a hole in it. The thing
being designed is a speaker, and the driver is what anybody looking at the
picture is looking for — so the rendered view draws one, and the 3D view will
too. A chip in both turns it off.

### The one dimension that was missing

Every datasheet gives it and the model did not hold it: the **frame diameter**,
the outside of the thing that sits on the panel. Without it there is nothing to
draw, and the checks were wrong as well — `fittingExtent` stopped at the bolt
circle, which is what the panel has cut into it rather than what has to fit on
it. A Markaudio Pluvia 7P is 112 PCD with 3.1 mm holes and a 122.3 mm frame:
checking the bolts alone passes a driver whose rim is already 4 mm over the edge
of the baffle. It is the frame now, with the cutout and the bolt circle still in
the reckoning because nothing says a frame has to be the widest of the three.

Read through `driverOuter` rather than as a plain field, so a design saved
before it existed still draws and still gets checked. The fallback is the bolt
circle plus enough material to put a bolt through, which on the Pluvia comes out
at 121.3 against a real 122.3.

### Two numbers from the datasheet, the rest in proportion

The profile that gets revolved — frame, surround, cone, dust cap — takes the
cutout and the frame diameter and derives everything else from them. That is a
deliberate limit rather than a gap waiting to be filled: a datasheet gives a
cone depth about as often as it gives the colour of the terminals, and asking
somebody to measure their dust cap to get a picture of their box is a poor
trade. The proportions are set against the Pluvia drawing — 0.037 of the frame
diameter gives 4.53 mm of frame against a real 4.5 ± 0.2.

The back is closed off flat because everything behind the baffle is inside a
sealed box and never in shot. The part that goes through the hole is half a
millimetre under it: coincident surfaces flicker against each other wherever
both are drawn, and a driver is not a push fit anyway.

Two tones out of one geometry, painted into the vertices rather than cut into
separate meshes. A lathe lays its vertices out as a grid — one row per profile
point — so which part of the driver a vertex belongs to is its position in the
profile, and nothing has to be worked out from triangle indices. Vertex colours
are how the rest of the scene carries this (§19), so the path tracer finds them
without being told.

### The scene is not in model coordinates

`toThree` is a rotation, not an axis swap: the model's z becomes the scene's
height and the model's y its −z, and it re-centres the box on the origin as it
goes (§4.3). A driver aimed and placed in the model's own coordinates comes out
lying on its side half a box away from the panel it is bolted to, which is
exactly what the first one did. Both the placing and the aiming go through the
same transform the panels go through, and the direction is derived from it
rather than written out six times — six faces as six rotations is six chances to
get a sign backwards, and the symptom of one is a driver aimed into the cavity,
where the only sign of it on screen is that nothing is there.

In the 3D view each driver goes in a group of its own, because the explode pass
sets `position` on everything it moves and would otherwise overwrite where on
the panel the driver sits.

### One shape, every driver

Asked directly: does it still look like a driver at 2 inches and at 15? It does,
because every part of it is a proportion of the two numbers a datasheet gives —
a 15 inch woofer, a 6.5 inch mid and a 2 inch tweeter on one baffle each read as
themselves. There is one length that is deliberately absolute, the half
millimetre of clearance into the hole, and a test says so by quadrupling a
driver and checking everything else quadruples with it.

The case that did break was not a size at all. A frame narrower than its own
cutout turns the profile inside out — the contour doubles back and the body
comes out as a knot — and it is not an exotic input: a number being typed passes
through every value on its way, so "8" on the road to "80" against a 100 mm
cutout produced exactly that. The drawn radius is clamped to the hole it covers,
so what is on screen is always a driver, and `fittingIssues` says the number is
wrong rather than the picture quietly being nonsense.

### It needs the hole to be cut

The cone is recessed below the baffle, which is where a cone is. The analytic
solids are ring-stack prisms with no fittings cut into them, so the baffle is
solid and hides it: what you get is the frame and the surround with the panel
showing through the middle. With the kernel on, the hole is there and the driver
reads properly — frame, surround, cone, dust cap.

That is not a fault in the driver. It is the analytic path being an
approximation that was never asked to carry fittings, and the first thing that
has made the difference plain.

## 23. OpenCASCADE by default

The analytic ring stacks were the default because they are instant and always
there. §22 made the cost of that plain: they cannot cut a hole, so a box with a
driver in it is drawn wrong by the engine that was drawing it — frame and
surround on a solid baffle, with the cone hidden behind the panel it is recessed
into. The kernel is not a second opinion any more. It is the one that models
what is being made.

So the app opens on it. The ring stacks are what is on screen while it loads and
what is left if it never arrives — a fallback rather than a peer.

### Nothing waits for it

The panels are drawn from the ring stacks on the first frame and swapped for
B-Rep when the kernel lands, which is machinery §11 already had for the toggle.
Measured cold against a server that compresses the way Pages does
(`tools/spike/serve-like-pages.mjs` — `vite preview` sends the kernel whole,
10.6 MB against the 4.0 MB a browser really downloads, which makes any timing
taken against it far too gloomy):

| connection | box on screen | kernel in |
| --- | --- | --- |
| unthrottled | 0.47 s | 1.0 s |
| 4G, 1.5 Mbit | 1.6 s | 22.4 s |
| slow 3G, 400 kbit | 5.2 s | 83.8 s |

The box is up and turnable in every one of those, with the download counting
itself out in the corner.

### Eighty-four seconds is not a stall

Slow 3G finishing at 83.8 s against a 90 s deadline looks like a fault waiting
to happen, and it is not one: the deadline is on **silence**, not on elapsed
time (§11). Every block of bytes restarts the clock, so a download that is
merely slow never trips it and a kernel that has actually deadlocked still does
after ninety seconds of nothing. Worth writing down because the arithmetic looks
alarming and the design is already right — the fix here was to check, not to
raise a number.

### What the tests had to learn

Every test that mounts the app now asks for a kernel, and none of them wants ten
megabytes of wasm in jsdom to find out whether a button works. `stubKernel`
answers the call and never resolves, which leaves those tests looking at exactly
what they looked at before: the analytic stacks, with the kernel still on its
way. The toggle's own tests start from one job in flight rather than from none.

## 24. The rest of the driver

§22 drew what is in front of the baffle, because that is what a rendered view
shows and because two numbers off a datasheet were enough for it. Behind it was
a flat disc — everything back there is inside a sealed box and never in shot.

Except that it is. The 3D view draws the panels see-through, so the inside of
the box is exactly what you are looking at; the box explodes; and whether a
driver *fits* is a question about the part that was not being drawn. So the
motor is modelled too, from three more numbers a datasheet gives.

**Depth is overall, measured from the mounting face**, which is how a datasheet
gives it — the Pluvia 7P's 71.5 mm runs from the front of its frame to the back
of its magnet, not from the baffle. The part inside the box is that less the
frame thickness. Getting this the other way round would put every driver 4 mm
too deep and no view would show it.

The profile picks up where the flat disc was: the back of the magnet, up its
side, out along the basket to the wall of the hole, and along the face to the
rim of the frame. A cone frustum and a cylinder, which is the silhouette of a
motor and a cast basket and all of a driver anybody sees from behind.

### Depth is not a proportion

Every other part of the shape scales with the two face diameters (§22), and
depth cannot: a small full-range driver is relatively deep and a big woofer
relatively shallow, so a single ratio is wrong at one end or the other. It is a
number somebody types, with a fallback for designs saved before the field
existed that is plausible rather than exact and is meant to be corrected.

The scaling test had to learn this. It quadrupled a driver and checked every
part of it quadrupled, which stopped being true the moment three of the numbers
became inputs rather than proportions — so it quadruples those too now, and says
in as many words that a driver four times the size is four times as deep only if
its datasheet says so.

### Three things it can now say no to

None of them shows up in any flat view, which is the point of modelling the
part nobody sees:

- a **magnet wider than its own cutout** cannot be posted through the hole, so
  the driver would have to be fitted from behind;
- a driver **deeper than the cavity** does not go in the box at all, and one
  within 15 mm of the back gets a warning rather than an error, because that is
  a judgement about airflow rather than a fact about fitting;
- a **depth shallower than the driver's own cone** is not a depth. The profile
  clamps so that what is drawn is still a driver, and the message says the
  number is wrong rather than the picture quietly being something else.

## 25. One panel's failure is one panel's failure

Reported as **`working: 7210856 — showing the ring-stack solids`**, with the
observation that removing the fillets made it work again.

Two faults in one line. OCCT refused a shape and threw; the throw came from the
whole job, so six panels were replaced by a sentence because one edge on one of
them could not be cut. And the sentence was a pointer.

### Why the message was a number

Emscripten throws a C++ exception as the bare address of it — `___cxa_throw`
ends in `throw ptr`, and a number has no `message`. The worker did
`String(error?.message ?? error)`, which on a number is the number. This build
has no exception-message helper compiled in and no `Standard_Failure` binding,
so the text OCCT put in the exception cannot be read back out of the pointer at
all. What can be done is to stop pretending: a thrown number is named for what
it is rather than printed.

### Why losing one panel lost the box

`meshPanels` mapped over the panels with nothing between them, so the first
throw ended the job. It catches per panel now. A panel that will not cut comes
back marked instead of meshed, and the views already fall back to the analytic
ring stack for anything without positions (§4) — so what is on screen is the
box, with one panel drawn the approximate way, and the note says which panel and
that it happened. Six panels for one bad edge was the wrong trade.

### What is still open

The shape that provokes it has not been pinned down. Fillets are implicated —
removing them clears it — but a fillet on its own does not do it: sweeping
radius against thickness and against box size on a clean page passes at every
size tried. An earlier sweep that appeared to indict large radii was reusing one
page across cases and could not be reproduced from a clean one, so it is not
evidence. The fallback above makes the fault survivable rather than fatal; it
does not make it go away.

## 26. A bevel bigger than the wall is never asked for

Reported as `working: 7210856 — showing the ring-stack solids`, cleared by
removing the fillets. §25 made that survivable. This is the cause.

### The kernel now says what it refused

Emscripten throws a C++ exception as the bare pointer to it, so the message was
an address. The build carries `-sEXPORT_EXCEPTION_HANDLING_HELPERS` now, which
exports `getExceptionMessage`, and the address turns back into OCCT's own words:
*exception of type StdFail_NotDone*. Sixty-four kilobytes of wasm for a fault
that can be read.

Guarded at every step on the way out. The prebuilt kernel the Node tests run
against is a different build and need not have the helper; a pointer can be
stale; and what comes back is a string read out of wasm memory, so it is checked
for being a plausible sentence before it is shown. None of those is worth a
second failure on the way to reporting the first.

### The limit is the material, and it was measured

A fillet whose radius is the whole wall thickness takes the corner away
entirely and leaves nothing to run the surface over. Swept against the wall,
every fraction up to 0.9 cuts and the thickness exactly does not — on a 12 mm
wall and an 18 mm one, fillet and chamfer alike.

So the rule is that a bevel has to leave material behind it, with half a
millimetre of margin — the smallest step the control offers, so that the largest
radius the box will take is also a number somebody can type.

The app had always called a radius past the wall an error. An error was a
sentence: the impossible bevel went to the kernel regardless. Now it is stopped
twice. The control will not take the number, and `applicableEdges` drops any
that arrives anyway — the same filter that already drops a bevel no single panel
runs the length of, for the same reason: the material will not take it.

### Judged on what was asked, not on what survived

Dropping the bevel before the kernel sees it removes the very thing the message
was about, so `validate` takes both — the treatments that will be cut, and the
ones that were asked for. The bevel messages are judged on the second. A design
that arrives from storage carrying R40 is drawn square, meshes cleanly, and
still says *R40 cuts through the 18 mm wall*, which is the whole point of
saying anything.

## 27. Cone depth, and the air that is left

### The last proportion becomes a number

Cone depth was 0.42 of the cutout radius, which suits a typical full-range
driver and draws a 15 inch pro woofer noticeably too shallow — a real one is
half as deep again. It is a field now, like the depths of §24.

Unlike those, it is **not** in `DEFAULT_DRIVER`. Left unset it follows the
cutout, so a new 15 inch driver starts with a 15 inch driver's cone (73.5 mm)
rather than a 6 inch one's, and typing a number still overrides it for good.
The depths of §24 do carry fixed defaults, which is worth knowing: a new driver
starts 78 mm deep whatever its diameter.

### What the box actually holds

A box sized for twelve litres of air does not hold twelve litres once a
driver's motor is standing in it and a port's tube is running through it. The
readout shows **Net** beside Cavity whenever something is displacing, and stays
quiet when nothing is.

A port takes its whole outside — bore and all, because the bore is open to the
room rather than to the box. A driver's share is integrated over the profile
that is drawn (§24) rather than guessed at, so the picture and the number can
never disagree: each segment of the closed loop below the mounting plane sweeps
a conical frustum, and the signed sum round the loop is what it encloses. The
profile is clipped at the baffle first, because everything in front of that is
outside the box.

The integration is checked against shapes whose volume is known without one — a
cylinder, a cone, a frustum, and a cylinder cut in half by the clip. A cone is
the case worth having: an implementation that averages the end radii instead of
summing `r₁² + r₁r₂ + r₂²` gets a cylinder right and a cone wrong by a third.

### It reads high, and says so

The drawn basket is a closed frustum where a real one is half air between the
spokes, so the figure over-states what a real driver displaces. That is why
there is a **Displaces** field: where a datasheet publishes the driver's
displacement it publishes the better number, and where one is given the
arithmetic steps aside.

Which is the honest position rather than a hedge. Modelling the basket as
spokes would trade a known over-estimate for an unknown one, and the number
that settles it is on the datasheet either way.

### It is not Vd, and the field does not say Vd

Briefly it did, and that was wrong. **Vd** is a Thiele-Small parameter,
Sd × Xmax: the air the *cone* sweeps at full excursion while the driver is
working. What a cabinet's net capacity needs is the volume the driver's *body*
occupies standing still — magnet, basket, cone and all — taking air out of the
box whether it is playing or not. Both are volumes belonging to a driver and
they are otherwise unrelated, so borrowing the shorter name for the other
quantity puts a wrong figure in a right-looking box.

The field is **Displaces**, in litres. Until a figure is given it reads
**Displaces (est.)** and shows what the drawn shape works out to; type the
datasheet's figure over it and the arithmetic steps aside for good.

The distinction is carried through to the readout, because the two are not
equally good and the net volume rests on whichever it got. The error has a known
*direction*: a basket drawn solid over-states what the driver displaces, so the
air left over reads **low**. What is shown is a floor rather than a figure
scattered either side of the truth — so where any driver is still on the
estimate it reads `≥ 11.533 l`, and once every one has a real figure the `≥`
goes and the number stands on its own.

A port needs none of this. It is a tube, its size is its size, and its
displacement is exact.

## §29 The back of the hole

A driver's cutout is a hole through the baffle, and the corner where it comes
out into the box is right where the cone's rear wave leaves. Cut square — and
more so through a doubled baffle, where the hole is twice as long — the driver
breathes out through a short square-edged tube. Rounding or breaking that rear
corner opens the throat into the box, and it is a cut somebody makes with a
router, so it is a shape the kernel makes rather than a note on a drawing.

Each driver carries its own **Inside the cutout**: Square, Chamfer or Fillet,
with the radius beside it. Only the cutout gets it; a flare round a clearance
hole is a way of losing the bolt.

### One cut, on the panel where the hole comes out

The bore goes through every layer on the face — cladding, carcass, doubler —
and the flare is one cut at the back of that stack, wherever the stack ends. So
it is given to the innermost panel of the face and stripped from the rest:
handed to all of them it would appear inside the baffle at a glued joint, which
is not a place a router reaches and not a shape anybody asked for. A doubled
front flares the doubler; an undoubled one flares the carcass.

### The largest flare that will cut, measured twice

Bore a hole in a bare panel and sweep the radius half a millimetre at a time.
OCCT builds every flare up to `thickness - 0.5` and refuses the thickness
itself — the §26 rule arrived at again on a different shape, and for the same
reason: a flare that reaches the front face has eaten the material it was to be
cut into.

The bolt circle is the other limit and it bites first. A flare opens the rim
outward as it goes back, and where that rim lands *among* the bolt holes the
kernel refuses it — an 18 mm baffle took a 13 mm chamfer and not 13.5, which is
the rim reaching 71.5 mm against holes starting at 71. Wider still it builds
again, but a flare that swallows the bolt holes is not a flare, it is a bigger
hole with no bolts left. So `largestFlare` stops short of them, and the control
clamps to it — the §26 position, that an impossible shape is better prevented
than reported.

Both halves are checked against the kernel rather than argued: every radius the
rule allows is built in the test, on a bare panel and a bolted one, fillet and
chamfer alike.

### What it looks like

On the default box, from behind the exploded baffle: square is 1128 triangles
and a hard rim, a 12 mm fillet is 2754 and a lit band curving away into the
hole, a 12 mm chamfer is 1310 and one flat cone. The cut list says which, since
it is a cut somebody has to make: *Driver ⌀116 … , R12 fillet inside*.

## §30 Lagging

A box is lined before it is listened to: felt, wadding, bitumen pads on the
walls. Lagging is that lining, added a face at a time exactly the way a doubler
is, and it is a fourth application of §2's one rule — `shellLayer` again, inside
the doubler, with the cavity being the air inside the lining rather than inside
the boards.

Which means the arithmetic comes out right without being argued into shape.
The volume still closes to the envelope, because the same tiling that made
three layers exact makes four exact. And a box sized to twelve litres and then
lined with ten millimetres of felt **grows** to hold twelve litres, rather than
quietly holding ten and a half: the lining is in the wall, and the wall is what
the envelope is derived from. On the default box, lining every face with 10 mm
takes 218 × 263 × 327 to 238 × 283 × 347, and the cavity stays at 12.022 l.

### Linings are not sheets

`LAGGINGS` is its own list — felt, wadding, bitumen, long-fibre wool — and it is
deliberately not merged into `MATERIALS`. A carcass cannot be cut from felt, and
a Sheet dropdown offering it invites exactly that. So the sheet list stays the
sheet list, the lagging control is given the linings, and `materialById` looks
in both because everything downstream — nesting, thicknesses, colour — treats
them alike. A new lagging panel starts as the first lining at the thickness it
comes in, rather than inheriting the project sheet the way cladding does.

### The wall and the board

Adding lagging to the wall introduced one real hazard, caught before it shipped:
`largestBevel` is capped by the wall, so 10 mm of felt would have offered a
20 mm fillet on an 18 mm carcass. That is not a rounded corner, it is a hole in
the box with something soft showing through.

So the solver returns two figures. `wall` is everything between outside and air,
and it derives the envelope. `board` is cladding + carcass + doubler, and it is
what a bevel may be cut into — every bevel cap and every bevel message reads it.
Lined or bare, the limit on the default box is 17.5 mm and the message still
says *R24 cuts through the 18 mm wall*.

The same distinction runs through the fittings. A hole goes through the lining
like everything else on that face, but the **innermost** panel — the one a port
tube hangs off and the one whose cutout is flared (§29) — is the innermost thing
made of *board*. A tube is glued into the hole in the baffle and passes through
the felt on its way; a flare is routed, and felt is not routed.

### Where it shows

Six more parts in the cut list, labelled Lagging and nested on a roll of their
own material rather than on the birch. Its own hatch in section — widely spaced
and opposed, so a felted wall does not read as another board — and the sheet
note names it. In 3D it explodes the least of any layer, since it is the last
thing in and the first thing you would take out.

## §31 The rest of the driver's dimensions

A box program asks a driver for eight numbers: frame thickness, depth, magnet
depth, magnet diameter, basket diameter, outer diameter, voice coil diameter,
and the volume it displaces. Seven of those the app already had or has since
been given. The three added here — **Frame thick**, **Basket ⌀** and
**Voice coil ⌀** — were the last of the proportions the app was making up.

Each is offered filled in rather than blank, showing exactly the figure the app
would have used, so a datasheet is typed *over* a number rather than into a gap:

| | was, as a proportion | on the default driver |
| --- | --- | --- |
| Frame thick | 0.037 × frame ⌀ | 6.0 mm |
| Basket ⌀ | cutout less 2 × 0.5 mm slop | 115 mm |
| Voice coil ⌀ | 0.3 × cutout | 34.8 mm |

Left alone, every one of them returns the proportion it replaced, so a driver
that has never been told any of them draws exactly as it drew before — same
points, same count, same order, and the frame-to-cone boundary still where
`driverConeFrom` says it is.

### What each one does to the shape

**Frame thick** is the plate that sits on the baffle, and it is what a
datasheet's depth is measured from the front of — so a thicker frame on the same
published depth reaches *less* far into the box. It also sets how far the driver
stands proud in the views, which reads the same number as the profile: two
places, one figure, or a thick-framed driver sinks into the panel in one of them
and not the other.

**Basket ⌀** is the number a cutout is chosen to clear. The app had been
guessing it as the cutout less half a millimetre a side — right in spirit, since
that is how a hole gets sized, and never the driver's own figure. Given both, the
app can check them: a basket within a slop of its cutout is a warning, one wider
than the cutout is an error naming the diameter to cut instead — *a ⌀360 basket
will not pass a ⌀350 cutout — cut it at ⌀361 or more*. The drawn profile clamps
to the hole regardless, because a picture of a basket squeezed through a hole it
would not go through is a picture of something that cannot happen.

**Voice coil ⌀** ends the cone. A cone is a frustum, not a point: it stops at
the former the coil is wound on, and the dust cap covers that junction. So the
coil diameter sets the small end of the cone, and a 100 mm coil in a 15 inch
woofer draws the wide cap such a driver actually has instead of three tenths of
the cutout.

All three feed the displacement of §27 the moment they change the shape — and a
published figure still overrides the lot of it (§28).

## §32 What the drawing shows

Three changes to the A3 sheet: a lining that reads as a lining, and two things
the reader of the drawing gets to switch off.

### Stipple, not another hatch

The lining's first hatch was 45° lines like the boards either side of it, more
widely spaced. That is a difference you measure rather than see: at 1:5 on 10 mm
of felt it is two lines against three. It is a stipple now — a staggered field
of dots, the drawing convention for a loose fill — and beside a clad, doubled
carcass the four read apart at a glance: fine 45°, coarse 45°, opposed 45°,
dots. The key in the sheet note says `STIPPLE = LAGGING`, and says it only where
a lining is actually drawn: naming a hatch that is not on the sheet is worse
than not having a key.

### Two switches

**Acoustic insulation** and **Section A–A**, in the Drawing group beside the
section position, and kept with the design. Both start on.

Hiding the lining builds the views *without* it rather than drawing it and
painting over it — one filtered list of panels feeds the elevations, the plan,
the section and the isometric alike. The box does not change size: hiding felt
is a drawing decision, not a re-solve, so every dimension on the sheet is the
one it was. The kernel path filters the same way before it builds its shape,
which it can do safely because §30 adds the lining last: dropping the tail of
the panel list leaves every other panel at the index its bevels and fittings
were resolved against.

Hiding the section takes the view, the cutting-plane symbol on the plan, and
the hatching key with it — and the internal-height dimension the section
carried, which was always a repeat of the front elevation's, put beside the
view that explained it.

### The isometric gets the room

The section owns a third of the sheet, and giving it up is worth something. The
isometric moves to the right of the page and takes the whole column, both rows,
out to the frame rather than stopping where the section's column stopped:

| | isometric cell | drawn at |
| --- | --- | --- |
| with the section | 153 × 57 | 1:10 |
| without it | 125 × 172 | **1:5** |

That is not just tidier. The isometric of a box is taller than it is wide, and
its old cell was wide and short, so its scale was pinned by the height. A long
low box projects the other way, though, so the bottom row run out to the frame
is offered as well and whichever draws the picture larger is the one used — the
column winning a tie, since the request was for the right of the page. A test
sweeps four shapes and holds the isometric to never being drawn *smaller* than
it was with the section present.

The caption follows the picture rather than sitting at the foot of the cell: in
a cell that tall, a title half a hand below the box belongs to nothing.

## §33 How deep each hole goes

A hole went through every panel on its face, because that is what a hole
usually does. But a driver bolts to the baffle and its cutout carries on
through the doubler behind it — one fitting, two depths — and there was no way
to say so.

Each fitting now carries **Hole through**, and a driver also carries **Bolts
through**. Both are offered as the layers of that face, named by the one the
hole stops in: *Cladding*, *Carcass*, *Doubler*, *Lagging*, or **All layers**.
A face with one panel on it offers nothing, because there is nothing to choose.

### A depth, not a set

A bore enters at the face and stops. It cannot skip the carcass and reappear in
the doubler, so what a hole needs is a depth to stop at rather than a set of
layers to tick — which is also why the control is a list of stopping points and
not a column of checkboxes.

"All layers" is kept as its own answer rather than spelled as the deepest one
that exists today. A hole meant to go all the way should still go all the way
when a doubler is added behind it later.

Bolts are capped by the cutout: a panel with the clearance holes and no cutout
is a panel the cone cannot get through, which is a mistake rather than an
option. `boltDepth` applies the cap, and the Bolts control offers nothing
deeper than the hole it surrounds.

### One place it is applied

`fittingAt(f, depth)` returns the fitting as it applies to the panel that many
layers in — the whole thing, a bare cutout, or nothing at all. Everything
downstream already asked *which fittings are on this panel* and then read the
circles off them, so one function serves the kernel's booleans, the part
templates, the DXF and the cut list at once. Nothing else learned a new idea.

Two things follow it rather than being told separately:

- The cut list says what each panel actually carries. A doubler behind a driver
  whose bolts stop at the baffle reads *Driver ⌀116 in a ⌀162 frame, 78 deep,
  cutout only* — reading "0 × ⌀5 on 147 PCD" off a cut list would be worse than
  reading nothing.
- The clearance check asks each panel for the clearance *that panel* needs. The
  frame is the driver sitting on the outside of the box, so only the panel it
  bolts to is asked to be big enough for it; a panel with no bolt holes is not
  asked to hold a bolt circle; and a panel no hole reaches is not this
  fitting's business at all.

On the default box with a doubled front, sending the bolts to the baffle takes
the kernel's mesh from 2196 triangles to 1336 — five bores fewer in the panel
behind.

## §34 A full fillet

The flare's limit was `thickness - 0.5`, which was §26's rule for an edge bevel
borrowed for a different shape. Swept finely, the borrowed number turns out to
be far too cautious: on 9, 12, 18 and 25 mm panels, fillet and chamfer alike,
`t - 0.01` builds and `t` refuses. The refusal sits exactly on the thickness and
nowhere before it — which stands to reason, since a fillet whose radius is the
whole thickness runs its tangency out at the front face and leaves a knife edge,
and a router with a full-thickness roundover bit would do the same.

So the margin is a hundredth of a millimetre, two orders below anything anybody
cuts to, and the control's limit reads as the sheet thickness: **a full fillet**,
the whole panel rolled away into a quarter-round throat.

### Two limits, and only one of them is the kernel's

The bolt circle is the other, and where the bolts reach the panel being flared
it is the one that bites first: on the default driver, 12.5 mm against an 18 mm
baffle. That margin stays at half a millimetre, because it is a workshop
clearance to a hole rather than a limit the kernel sets.

But it is now asked of the panel *as that panel is actually cut*. §33 lets the
bolts stop at the baffle while the cutout carries on, and a doubler behind a
driver whose bolts stop short of it has no bolt circle for the flare to graze —
so the only limit left there is the thickness, and the full fillet is available
exactly where somebody would want one.

The control says which of the two applies, since it is the difference between a
12 mm flare and rolling the whole panel away, and the way to lift it is three
rows up:

> Up to 12.5 mm: the bolt holes in the doubler are in the way. Send the bolts no
> further than the panel in front and the whole 18 mm is available.

> Up to 18 mm, the full thickness of the doubler it is cut in.

Both halves are checked against the kernel rather than argued: the sweep builds
every radius the rule allows across seven drivers and four thicknesses, and a
test asserts both that `t - 0.01` cuts and that `t` throws.

**§36 lifted the bolt-circle half of this entirely.** It was never a limit on
the shape — only on the order the cuts were made in. See below.
## §35 The lining is not a shade of its face

By-face colour is a hue per axis and a lightness per layer: a clad front and the
carcass behind it are the same blue at two depths, and reading them as one face
is the point of it. §30 gave the lining the same treatment one step further
down — the face colour, ten to twenty per cent darker — and the result was a
felt panel told from the carcass panel it lines only by how much light happened
to be falling on each.

A lining is not that. It is a different material doing a different job, and it
is the one layer somebody wants to pick out of an exploded view. So it leaves
the hue axis altogether: a warm grey, which is what felt and wadding actually
look like and which nothing else on the box is near, since the six face colours
are all green, blue or violet at a fair saturation. The face still shifts its
lightness a little, so a lined left and a lined right are not identical either.

Exploded, a lined box now reads as a grey box inside a coloured one. The
sidebar's face swatches follow, being the same palette, and Material mode was
already showing the lining's own colour.

The test asks for the difference rather than for the value: the lining's hue is
the grey's, its saturation is less than half any board's, and its hue is a
distance from the face it lines — so a change to the face colours cannot quietly
bring the two back together.

## §36 A depth for the bolt holes, and a flare that may run into them

### The bolt circle was never the limit

§29 measured OCCT refusing a flare whose rim landed among the bolt holes, and
capped the radius short of them. That was the right reading of the measurement
and the wrong conclusion from it: the refusal is not about the shape, it is
about the *order*. Filleting an edge whose sweep crosses holes that are already
drilled is what OCCT will not do.

So the cuts are made in the order a workshop makes them. The cutout is bored,
the flare is run while the face around it is still solid, and the bolt holes are
drilled through the flared surface afterwards. Measured across the whole band
the old cap forbade:

| flare R | rim reaches | bolts, then flare | flare, then bolts |
| --- | --- | --- | --- |
| 15 mm | 73 mm | ok | ok |
| 16 mm | 74 mm | **refused** | ok |
| 17 mm | 75 mm | **refused** | ok |
| 17.99 mm | 75.99 mm | **refused** | ok |

(⌀116 cutout, ⌀5 bolts on 147 PCD, so the holes span 71 to 76 mm from centre.)

The thickness is now the only limit, and a flare that opens out into the bolt
holes is **allowed and warned about** rather than prevented:

> the R18 fillet opens the cutout to ⌀152, which breaks into the ⌀5 bolt holes
> at 147 PCD — they will open onto the flare rather than onto a flat face.

A warning and not an error, because it is a real thing to want. What it costs is
that the bolts land on a slope, which is a decision for whoever is holding the
driver. The flare control repeats it in one line, since that is the control that
did it.

### Bolt deep

The mounting holes went right through whatever §33 let them through. **Bolt
deep** is millimetres from the mounting face, so they can be blind: a pilot hole
for a screw, or a hole for a threaded insert.

Offered filled in with the depth of a hole that goes right through — 36 mm on a
doubled 18 mm front — so a datasheet's screw length is typed over a number
rather than into a gap. Typing the through depth back stores *through* rather
than that number, so it stays a through hole if the panel is later made thicker.

The depth is spent through the stack: 25 mm into a doubled front leaves 7 mm for
the doubler, and 12 mm never reaches it at all — that panel then has the cutout
and no bolt holes, which is the §33 case arrived at by a different road. A
fitting handed on with no bolts carries no bolt depth either, since those are
two facts that disagree.

The bore reads the depth as a length and the overshoot at the entry makes a
clean through-hole of anything longer than the panel, so "deeper than the
material" needs no special case. The flat views ignore it: a blind hole is still
a hole to mark out and drill.

## §37 Every interior dimensioned

The drawing measured one inside per axis: the cavity, the innermost box left
after cladding, carcass, doublers and lining had all taken their cut. On a plain
carcass that is the only inside there is and nothing was missing. On a box that
is clad and doubled it is the last of four, and the three between it and the
outside — sizes somebody has to cut boards to and check openings against — were
simply not on the sheet.

So the solver now hands the drawing all four, outermost first:

    interiors: [
      { layer: "cladding", box: L0.inner },   // inside the cladding
      { layer: "shell",    box: L1.inner },   // inside the carcass
      { layer: "doubler",  box: L2.inner },   // inside the doublers
      { layer: "lagging",  box: L3.inner },   // the cavity
    ]

They are the same four boxes the layer solve already built, named and kept
rather than thrown away — the last of them *is* `cavity`, so nothing that reads
the cavity changes.

### One rung each, and no rung drawn twice

Each axis becomes a ladder: the interiors nearest the view, innermost first,
with the overall size outside them all. A rung is dropped when it measures the
same span as one already on the ladder, and when it measures the envelope.

That rule is what keeps a plain box exactly as it was drawn before. With no
cladding, "inside the cladding" *is* the envelope; with no doublers, "inside the
doublers" is the carcass opening again. Three of the four interiors collapse
into one and the box gets the two dimensions it always had — 200 and 236 across
the front, at the same two offsets. Drawing them all would put three dimension
lines on one pair of extension lines, which reads as a mistake because it is
one.

Per-axis, too, not per-box: cladding on the front and top and doublers on the
back and left is four distinct widths, three distinct heights and four distinct
depths, and each axis gets the ladder it has earned rather than the longest one
on the sheet.

### Room for the ladder

Five lines where there were two need somewhere to go, and the margin between the
view and the frame was sized for two. Both halves of that were wrong to leave
alone, so both moved:

- **The layout reserves the headroom.** `layout()` takes the rung count and
  keeps `DIM_NEAR + rungs × DIM_STEP + DIM_TEXT` above the views, which pushes
  the block of views down into the slack the sheet had below it rather than
  running the ladder up off the top.
- **The rungs close up when they must.** The step stays at its 8 mm wherever
  there is room for it, and narrows towards a 5 mm floor when there is not, so a
  ladder is never spaced below what a reader can separate.

The first attempt did only the second of those, and measuring the drawn SVG
against the frame in the browser found the outermost number at y = −3.3: off the
sheet. With the headroom reserved the same measurement reports nothing outside
the frame, on the worst case the app can make — clad, doubled and lined on all
six faces, which reads `(182) (202) (238) 274` across the front, `(291) (311)
(347) 383` up it, and `(227) (247) (265) (301) 337` for depth.

The section keeps its single bracketed internal height. It is a repeat of the
front elevation's innermost rung put beside the view that explains where it
comes from, and a ladder of four there would be four repeats.

## §38 The sheet rearranged, and an isometric that comes apart

Four things, all of them about the drawing.

### The section goes under the end view

It was the third view across the top: front elevation, end view, section. That
is a fine place for it and the wrong one to read it from — the section and the
end view look the same way at the same box, one showing the outside and the
other the wall build-up, and with a whole elevation between them the reader
crosses the sheet to compare them.

So the sheet is two columns of views: the front elevation over the plan, the
end view over the section. Each column is one direction of sight, top to
bottom.

That costs something and it is worth saying plainly. Stacked, the end view and
the section are two full heights of box where the old bottom row was one depth,
so a tall box asks for more sheet than it used to and can drop a scale step for
it: 200 × 250 × 900 goes from 1:5 to 1:10. §32's switch buys it straight back —
with the section off the bottom row is the plan again, and every view on the
sheet grows. Nothing is drawn smaller with the section on than the section
itself needs.

### The views are pushed left

The block was centred, which put half of the sheet's slack on the left of the
front elevation, where nothing uses it, and half on the right, where the
isometric could have. Now it is left-aligned, with exactly the margin the
dimension ladder needs beside it — `DIM_NEAR + rungs × DIM_STEP` and room for
the outermost number, the same quantity §37 reserves above the elevations, so
the height ladder down the left of the front elevation has precisely its own
room and no more.

Everything the views do not use is therefore in one place: the right-hand
column, which is the isometric's, and which now runs the full height of the
drawing area rather than stopping level with the bottom row.

### The isometric is solid, and shows the cutouts

It was a wireframe of the panel cross-sections on the three visible planes — a
true drawing of the joint pattern, and one that could not show a hole, because
a hole is not a panel edge. A driver was on three views out of five and missing
from the one that shows the whole box.

Now each panel is drawn as a box: its three faces that point at the eye, filled
with the paper and outlined, painted back to front. The fill is what does the
work — a panel in front covers what is behind it, so there is no hidden-line
removal to run and nothing to remove.

Order is a topological sort on *is in front of*, not a sort by centre depth. A
panel is in front of another when the two are clear of each other along an axis
and it is on the eye's side of it: further right, further forward, or higher up.
Every pair in a solved box passes that test — prominence is exactly what makes
one panel stop where the next begins — and exploding them only pulls them
further apart. Centres get a long thin panel wrong: the bottom panel's middle
is well behind the front panel's, and all of it is in front of nothing.

The mitres came out right with no code at all. §12 grows the butting panel's
box to the corner before cutting it back, so a mitred front runs the full width
of the box and a butted one stops a thickness short of it — which is exactly
the difference between the two joints as seen from outside.

A hole is drawn on the face the eye can see, with the far rim of the bore as an
open arc where it shows through the near one. Drawing the whole of the far rim
would put a second ellipse outside the first and turn a hole into a bump.
§36's blind holes are honest here: a hole bored 6 mm into an 18 mm baffle is on
the front of it and not the back, so a driver on the back face shows its cutout
through the panel and no bolt holes. §33's depths are honest too — the holes
come from `fittingsOn`, the same function the cut list and the kernel use, so a
cutout that stops at the baffle is in the baffle and not in the doubler behind
it.

### It explodes

A slider in the Drawing group pulls the assembly apart, by the same rule the 3D
view uses — outward along each panel's face normal, scaled by layer, so the
cladding leaves first and furthest and the lining barely moves. That rule now
lives with the model rather than with the 3D code, because two views explode by
it and a box that comes apart one way on screen and another way on the sheet is
a drawing of a different box.

With the kernel on, the isometric is normally OCCT's own hidden-line view of
the cut solid. There is no exploded shape to ask it for — by then the panels
are one solid — so an exploded isometric is drawn from the panel boxes either
way, and the slider works with the kernel on or off.

## §39 A texture for Valchromat

Every sheet in the list rendered as a flat colour, and one of them minds. Birch
ply and MDF are pale and glossless enough that flat colour and a roughness
number get most of the way there. Valchromat is dyed all the way through — wood
fibres coloured before the board is pressed — so what the eye reads is not a
face but the fibres themselves, a few millimetres long, lying every which way.
Without them it comes out as painted plastic, which is the opposite of why
anybody specifies it.

### Generated, not photographed

No image is fetched. There is nothing to license, nothing to ship, nothing to go
missing offline, and the tile is seamless because it is made seamless rather
than retouched into it. A seeded generator rather than `Math.random`, so a
render is the same render twice and the tests have something to hold on to.

One field of values per pixel, mean exactly 1, at three scales:

- **the press mottle**, over tens of millimetres — three wrapping cosines at
  whole numbers of cycles per tile, which cannot help but tile and are already
  unreadable as a pattern
- **the fibres**, half a millimetre to two and a half, dark about twice as often
  as light, tapered at both ends, one per twenty pixels of tile
- **a fine grain** per pixel, because the flat between fibres is not flat

Everything wraps: a fibre that runs off the right comes back on the left.

The tint, the tooth and the sheen all come from that one field, because on a
real board they are one thing — a fibre standing proud is lighter, rougher and
higher at the same time. The tint multiplies the material's colour, the bump
gives the surface its tooth, and the roughness map takes the material's own
roughness down to 0.86 of it in the hollows.

### The mean is one, so the colour is the colour

A tint map is a multiplier, so a map that averages anything less than white
would darken every board by however much the texture happened to average — and
the Valchromat colours are a named range somebody has picked from a fan deck.
So the field is normalised to a mean of exactly 1 and encoded with 1.0 at 236,
leaving the light side of the fleck somewhere to go, and the render divides the
colour back up by exactly that. In the linear working space the `Color` is
already in, which is the only place that arithmetic is the arithmetic it looks
like.

The three maps are read as data rather than as colour: decoding a height or a
roughness through sRGB would bend all three.

### Box mapping, in millimetres

The panels had no UVs — nothing needed them. Rather than unwrap a prism, each
vertex takes the two coordinates that are not its normal's largest, divided by
the tile size in millimetres.

That is a box mapping of the *box*, not of each panel, and the consequence is
the point of it: the fibre is the same size on the baffle as on the back, and
it runs continuously across a joint instead of restarting at every panel — the
way it would if the whole box were cut from one sheet, which it is.

### Where it shows

The rendered view, both ways: the studio rasteriser and the path trace, which
takes the same materials with the same maps. The 3D view stays flat-shaded on
purpose — its colours are there to be read as joinery, and a fibre mat over the
top of that is decoration on a diagram.

Close to, the fibre reads as a fibre. At arm's length the mip chain averages it
into an even matte board, which is exactly what a sheet of Valchromat does from
across a room.

## §40 The isometric draws the edge treatments

§38 rebuilt the isometric from solid panels, and built each panel as a box. A
panel stops being a box the moment an edge is filleted or chamfered, so the
isometric was the last view on the sheet still showing square corners on a box
whose other four views showed round ones.

It is built from the same loft the 3D view and the kernel are: the rings
`panelSolid` stacks, each one the panel's cross-section at a depth from the
outer face inward, narrowing as each bevel eats into it. Every quad between two
rings is turned to face outward against the panel's centre — exact, because a
bevelled box is still convex — and the ones whose normal points at the eye are
the ones drawn.

### Which lines a round has

An edge is drawn when it is the silhouette, or when both faces either side of it
are visible and the edge between them is a real edge. The second half is the
part worth stating, because a fillet is lofted from eight facets and seven of
the boundaries between them are not edges of anything:

- the outer face and the inner face, always
- the depth at which a bevel runs out into the side of the panel
- nothing else

The depths are shared by all four sides of a panel, so most ring boundaries are
boundaries only because some *other* side is rounded at that depth. A line
across the middle of a flat face because the edge beside it was filleted is the
same mistake as a line across the round, and the rule catches both.

What remains is what a filleted edge looks like on a drawing: two lines along
its length with nothing between them, a quarter circle at each end where the
round runs out into the square end of the panel, and — where the round turns
away from the eye part-way along — one silhouette on the round itself. That last
one is a real line and there is at most one per rounded edge; the test pins the
count between "as many as a chamfer" and "one per rounded edge", which is the
band the drawing is allowed to be in and excludes one line per facet.

## §41 Hiding the insulation hides its dimension

§32 gave the drawing a switch for the lining, and it drew the box without it
rather than drawing it and painting over. §37 then put a dimension on the sheet
for every interior — and nothing connected the two. The result was a sheet with
the lining switched off that still carried a bracketed dimension to the face of
a lining that was not drawn: a pair of extension lines reaching to nothing, and
a section whose bracketed internal height was the cavity behind felt the reader
could not see.

`withoutLagging` now drops the inside of the lining along with the lining. The
innermost thing on a drawing without the lining is the board, so `cavity` and
`internal` become the board's, the ladder is one rung shorter, and the section's
repeat of the internal height measures what the section shows.

The layout follows: one interior fewer is one rung fewer to reserve room for, so
the block sits a rung closer to the frame. Every view stays exactly the size it
was — the box has not changed, only what is drawn of it.

## §42 Rebates

A front panel sitting inside a mitred carcass can be let into it: the panel runs
on past where it stopped, and a groove is cut in each panel it runs into to
receive it. One board comes out longer and wider, the others come out with a
groove in them, and the box is the size it always was.

Chosen per panel — which of the four sides that meet it are let in, and how
deep. Four sides is the common case, so "All" is a button rather than four
clicks. (§42 said *per face*, which was only enough while a rebate meant a
carcass panel; §46 makes it any board.)

### No material appears or disappears

That is the whole design, and everything else follows from it. The panel grows
by exactly the slab it now occupies, and every panel that slab lands in loses
exactly its share of the same slab, so §2.4's closure — envelope = panels +
cavity — still comes out at zero to the cubic millimetre. The test asserts both
halves: that closure holds, and that what one panel gained is what the others
lost.

A rebate that cannot be cut is refused rather than fudged, and the check is the
one the closure would have caught later anyway: does the slab land wholly
inside other panels?

- **Nothing there.** A panel that already runs past its neighbours has nothing
  to be let into — the message says to move it down the prominence order,
  because that is the actual fix.
- **Not backed all the way.** Part of the slab lands in the cavity or outside
  the box, so part of the rebate would be cut into thin air.
- **Right through.** A rebate as deep as the board it goes into is a hole.
- **§12 Already mitred.** A mitre and a rebate are two ways to make the same
  joint. The mitre runs the panel out to the corner, which is exactly the
  material the rebate wants to slide into, so a board cannot have both on one
  edge. Only that edge is refused: the other three are cut as asked.

The first three are worded about the panel rather than about one of its sides,
so a rebate on four sides that all fail for the same reason is one warning
rather than four. The mitre is the exception, being a fact about one joint.

### Taking boxes out of a box

A grooved panel is no longer a box, and everything downstream had assumed one.
Rather than teach five subsystems about grooves, one primitive does it:
`subtractBoxes(box, notches)` returns what is left as a handful of boxes.

Every cut plane of every notch divides the box into cells, and a cell survives
if its middle is not inside a notch. Crude, and exactly right — including the
case that matters most, where two grooves overlap in a corner. Subtracting them
one at a time counts that corner twice and loses the closure; a cell is either
in a notch or it is not, and it can only be counted once either way. Survivors
are glued back together along each axis, so a board with one groove in it comes
back as two boxes rather than a wall of them.

Three grooves that meet are merged into one for the same reason: a rebate on
the left, top and bottom of a front panel cuts *one* groove down the panel
beside it, and the cut list should say so once.

That one primitive is then all any of them needs:

- **the cut list** — the blank is unchanged, because a groove is machined out
  of the middle of a board after the board is cut, so a rebate is a note and
  not a size: `Rebate 6 × 18`, or `6 × 18 stopped` where the groove does not
  run out at the ends. The board that was *let in* needs no note; its size says
  it.
- **the elevations and the section** — a grooved panel goes into the hidden
  line removal as the pieces it is left in, all carrying the panel itself. That
  is what makes the groove show as hidden detail and, just as important, what
  stops the joins between the pieces being drawn: a segment with the same panel
  on both sides of it at the same depth is a line through the middle of one
  board, and it is dropped.
- **the 3D view and the isometric** — the loft stops where the grooves start
  and the rest is built from those boxes. A grooved panel is not convex, so
  §4.4's trick of turning every face outward against the panel's own centre
  stops working; each box is turned against *its* centre instead, which is the
  same rule applied to the piece that is actually convex. The test is the
  signed volume of the triangles, which catches a face left the wrong way round
  where a centroid test cannot.
- **the kernel** — the notches are boxes and a boolean cut is what a boolean
  cut is for. Cut before the bevels, since a groove in the inner face and a
  round on an outer edge never meet.

## §43 Rebating into a mitred box

A top panel let into a box whose corners are mitred came out rebated on the
front and back and not on the left and right — which is exactly the case §42
was asked for, and it refused half of it.

Two faults, one of them arithmetic and one of them a rule that was missing.

### The corner is there once, so it can only be counted once

§12 mitres by growing the panel that was butting out to the corner and cutting
both boards at 45°. Between those two steps the two boxes *overlap*: the corner
prism belongs to both of them until the cut takes it off each.

§42's coverage test added up each panel's share of the slab and compared the
total with the slab. Where the slab reached into a mitred corner, two panels
both claimed it, the total came out bigger than the slab, and the test read
that as a slab it could not account for — so it refused a rebate that was
perfectly cuttable. It is the union that matters, not the sum, and
`subtractBoxes` already computes it: what is left of the slab once the panels
around it are taken out of it. Nothing left, nothing to refuse.

The same fact bites on the way out. The notch each panel receives was its whole
intersection with the slab, so at a mitred corner both panels had the corner cut
out of them — twice the material that is there, and the closure said so, by
exactly four corner prisms. Each panel now takes the part of the slab nobody has
taken yet.

### A rebate must not stretch a mitre somewhere else on the panel

Growing a panel along an axis makes every mitre that *runs* along that axis
longer — on that panel and on no other, because the board it is mitred to has
not moved. Half a joint cut longer than the other half is not a joint, and the
closure catches it: two mitres, 162 mm² of prism each, over the 12 mm the panel
grew.

So a rebate is refused on a side whose growth axis is the run axis of a mitre
the panel already carries. Together with §42's rule — no rebate on a mitred
edge — that means a top mitred to the sides cannot be let in at all, while a
front mitred only along its top edge can still be let in at the bottom. The
rule is about which way the panel grows, not about whether it is mitred.

### Saying which sides were refused

What made this hard to find was neither of those. A rebate asked for on four
sides and cut on two said *"let in on front and back"* and nothing whatever
about the other two. The reasons were in the messages, but the control that had
just been used said only what had worked.

Refusals are now grouped by face and reason — one entry naming every side it
applies to — and shown in the control beside what was cut, as well as in the
messages. `Rebate: Top (left, right) — that joint is mitred…` is the sentence
that was missing.

## §44 The mitre and the groove, reckoned together

A review of §43 said the mitre material could be subtracted twice. It could, and
worse: the *drawing* and the *closure* were each wrong, in opposite directions,
and they agreed with each other because they were computed the same way.

The invariant that finds it in one line: **the mesh is the model.** Sum the
signed volume of a panel's triangles and it must equal the volume the model says
that panel has. It did not, by 58 860 mm³ on a 300 mm box — on every panel that
had both a mitre and a groove, and on no other.

### The drawing kept a corner the mitre had taken

§42 stopped the ring loft where the grooves began and built the rest from plain
boxes. The loft is what cuts the mitre — `ringAt` insets the side by `min(d,
leg)` at each depth — so the part built from boxes had no mitre in it at all.
Worse than a rounding error: a mitre eats *more* the deeper it goes, so the part
that was dropped was the widest part of the cut, and the panel came out with a
step in it where the loft gave way to the boxes.

So a box of a mitred panel is now clipped to the cut before it is drawn.
The cut is a plane at 45° through the side axis and the thickness axis and it
does nothing at all to the third, so a clipped box is still a prism — a
cross-section and a length to extrude it along. §12 keeps a panel's mitres on
opposite sides and never adjacent ones, so they all share one side axis and one
2D section holds the lot.

A leg that stops short of the far face bends the boundary — 45° down to the leg,
flat from there on — and the region above a boundary that bends is not convex.
Split at the bend and each half is. §12 always cuts with a leg equal to the
thickness, so in practice there is one piece; the general shape costs four lines
and a mitre with a shorter leg is a thing somebody may want to draw.

### The closure took the same material off twice

The other direction. `panelVolume` took off the whole groove and `mitreLoss`
took off the whole 45° prism, and where a groove runs into a mitred corner the
same material is in both. One term now: the groove cuts the box into cells, each
cell is clipped by the mitres, and the volume is what the cells add up to. For a
panel with no groove it comes to `box − mitreLoss` exactly, as it must.

### And the corner belongs to both boards

§43 had each panel take the part of the slab nobody had taken yet, on the
grounds that the corner is there once. That was the right observation and the
wrong remedy. At a mitred corner the material is there once but it is *shared*:
the 45° cut gives half to each board. Handing the whole corner to the first of
them cuts a groove in a board where the mitre had already taken the material
away, and leaves the other board full where the tongue now is.

So every panel the slab reaches takes its share of it, overlaps and all — and
each loses only the half it actually has, because the volume is reckoned after
the mitre rather than beside it. §43's rule goes; the fault it was working
around was this one all along.

### The refusals were never shown

Separately, and more embarrassingly: §42 emitted them at `level: "warn"` and the
app renders `level: "warning"`. Every rebate refusal since §42 has gone straight
to the floor. The control's own note was the only place they appeared, which is
why §43 added them there — and why the missing warnings went unnoticed for two
sections running.

## §45 Rebates on the flat drawings

A rebate was in the model, in the three-dimensional views and in the section,
and nowhere a person cutting boards would look. The cut list said `Rebate 6 ×
18` in a sentence under the template and the template drew a plain rectangle.

Three places now, and one colour.

### A column

The cut list has a **Rebate** column beside the edge work, because that is what
it is: a second operation on a board whose size has not changed. `6 × 18`, or
`6 × 18 stopped` where the groove does not run out at the ends. It is in the CSV
too — the sheet somebody takes to the saw is the one that matters.

### The templates and the nest

Drawn as the rectangle it is, in its own colour, with the depth written along
the groove. Along it rather than across it, because an 18 mm groove has no room
for the words but a 300 mm one does — the same way it would be written on the
board.

Its own colour and not the cutouts': **a cutout goes through the board and a
rebate does not**, and on a template read across a workshop that is the one
distinction worth being able to make without looking closely. Cyan against the
orange, which no common colour blindness confuses.

The nest draws them too, turned with the part when a part is laid on its side —
through the same `placeOnSheet` the holes go through, so a rotated part cannot
come out with its holes right and its grooves wrong.

### The DXF

A `REBATE` layer, cyan, one closed profile per groove. Its own layer because it
is its own operation: a groove is cut to a depth with the board still whole, and
a machine that runs it at the profile depth has made scrap. The layer is
declared whether or not anything is on it, so a template that switches layers on
and off does not find one appearing from nowhere between one job and the next.

## §46 Rebating anything that is a board

§42 asked for "a panel", and what got built was a rebate on a *carcass* panel:
the design kept them in a map keyed by face, one entry per side of the box,
which is only enough to name a board when there is one board per face. There is
not. A face can carry cladding on the outside, the carcass panel, a doubler
behind it and a lining inside that, and "front" names three of those.

So the key is the panel and not the face: `front` still, for the carcass —
designs saved by §42 are on disk and they mean the carcass panel — and
`doubler|top`, `cladding|front` for the rest. One function writes the key and
one reads it, and the reader takes a bare face to mean the carcass, which is
what makes the old files load.

### Which layers, and why not the fourth

Cladding, carcass, doubler. Not lagging: **a rebate is a joint between two
boards**, and felt is not a board — a groove in a lining is a dent, and a lining
let into a groove is a lining folded over. The same rule applies to what a
rebate is cut *into*, so a lining in the way of a tongue does not count as
backing and the rebate is refused rather than machined into the felt. In a
solved box that never comes up: the layers nest, so what is beside a board at
its own depth is another board. It is the rule written down, not a case anybody
meets.

### Nothing else needed changing, which is the point

The machinery of §42–§44 never knew what a carcass panel was. It grows a box,
it takes the slab out of whatever boxes it lands in, and it refuses what it
cannot cut. Handed a doubler it does the same thing to the doubler, and the
panels the tongue reaches are whatever is beside it — the doublers on the
neighbouring faces, or the carcass itself where those faces have no doubler.
The cut list, the templates, the nest, the DXF, the section, the isometric and
the kernel solids all read `panel.notches` and none of them asked which layer
the panel was in.

Two things did have to change, and both are about what a person reads. The
warnings now name the board — `Rebate: Top doubler — …`, because "Top" names
three panels and a warning that could be about any of them is not a warning.
And the sidebar lists boards rather than faces, in the order they are stacked
from the outside in.

### Outermost first

Where more than one layer on a face is rebated, they are cut from the outside
in: the cladding, then the carcass, then the doubler. Each layer is let into its
neighbours as they stand once the layer outside it has settled, which is the
order the box would be assembled in and the only order in which every rebate is
cut against a panel that has stopped moving.

### A doubler can always be let in

Worth knowing before reaching for the prominence order: a carcass panel can only
be rebated if the panels beside it wrap past it, so a let-in baffle needs the
box wrapped a particular way. A doubler is *inside* the carcass however the box
is wrapped, so there is always board beside it. Every preset, every face, all
four sides — and the closure comes out exact each time, which is the invariant
that says no material appeared or vanished on the way.


## §47 The sidebar is the box, the inspector is the board

§21 built the inspector and left the sidebar as it was, so for two years a
panel could be changed in either — its thickness in a six-cell grid behind a
switch, or in the panel itself; a doubler added from a face dropdown, or from
the face. Two controls for one fact is two places for it to drift, and the one
in the sidebar is always the worse of the two, because it has to name the face
before it can ask anything.

So the split is now a rule, and the rule is: **anything keyed to one board is in
the inspector, and the sidebar is what is true of the box.**

Out of the sidebar went the per-face thickness grid, the per-panel colour grid,
the cladding and doubler and lagging stacks, the rebate list and the list of
every fitting. What stayed is the box: its size, its sheet, its prominence
order, its twelve edges, and what the drawing shows.

### A rebate is four buttons now

It was the control that made the case. In the sidebar a rebate had to be
*added* — pick a panel from a dropdown of every board in the box, get a row,
then choose sides on it — because a list needs a row to hang the sides on.
In the inspector the panel is already the thing on the screen, so a rebate is
four buttons and a number, and it exists because a side is chosen rather than
because it was added. Clear the last side and the panel simply stops being a
rebated panel.

It sits beside the edges, because that is what it is: the other way of joining
this board to the ones around it. A lining gets the rule instead of the
buttons — a groove in felt is a dent.

### What the sidebar says instead

Not nothing: a summary of what the box carries, which is a box-level fact and
was never actually visible before. Six chips for the carcass, then a line each
for cladding, doublers, lagging, rebates and fittings, naming the faces that
have one. Every name opens that board's inspector, so the summary is both the
answer to "what is on this box" and the way to change it — and a panel is
reachable from the sidebar in every mode, not only from the 3D view.

The two overrides say where they are: with the grids gone, what the sidebar can
usefully say about a per-face thickness is *which faces depart from the project
sheet* and how to end the departure. Setting a face's thickness in the inspector
switches the override on, as it always did; "Back to one thickness" is the way
out, and it is the only control of its kind left in the sidebar because it is
the only one that is about all six at once.

### What it caught

Moving the lagging editor into the inspector found a real bug: the inspector's
sheet picker offered every *sheet* for any added panel, so a face lined in felt
was offered birch ply. It had been unreachable in practice because the sidebar's
lagging stack was the one anybody used, and it was passed the linings. The
inspector now picks from the linings for a lagging panel, and a test holds it
there.

## §48 The DXF says what each thing is

The file was a set of paths and six part numbers. Everything that made a path
what it is — how big the hole is, whether it goes through, which edge is
mitred — was in the cut list on another screen, or in a column that names faces
of a box while the shop is holding a rectangle that has been turned to nest.

Three additions, all on one new layer.

### The mitre is marked on the edge it is on

It is still not *cut* here and cannot be: a blank is a rectangle, and the 45° is
a saw set over after the parts come off the sheet. But which edge it goes on is
a fact about the blank, and the file could not say it.

So each treatment gets a line just inside its own edge and a word beside it:
`MITRE 45° THIS EDGE`, `R8 ROUND THIS EDGE`, `6 CHAMFER THIS EDGE`. The mapping
is the one piece of real work: a bevel is named by the face across the corner
from it, and `blankBevels` turns that into a side of the rectangle. `toBlank`
(§10) flips the width axis so a template laid on the board is not mirrored,
which puts the *high* end of that axis at the **top** of the blank — the one
place in the codebase that has to remember it, and the one thing the test
pins down.

The part templates carry the same mark, because the template and the file are
the same drawing.

### Every hole says what it is

Read off the fitting as this panel gets it (§33, §36), so the notes describe
the board in front of you rather than the fitting in the abstract:

- `⌀116 CUTOUT THRU`, `⌀68 BORE THRU`
- `5 x ⌀5 12 DEEP ON ⌀147 PCD`, or `THRU` where it goes through
- `R8 FILLET IN BACK OF CUTOUT`, which is a second setting-up from the other side
- `GROOVE 6 DEEP`, written along the groove
- the blank's own `327 x 218 x 18`, under its number, and `GRAIN ALONG LENGTH`
  where the grain is locked

`THRU` and a depth are the only two things a hole can be. §36 hands a panel the
depth that is *left* for it rather than clamping, so a hole given 30 mm from the
mounting face arrives at an 18 mm board still carrying 30 — and a note reading
"30 DEEP" there is an instruction to drill the bench. Anything at or past the
board reads as `THRU`. The cut list's own note learned the same rule, and now
carries the depth as well.

`%%C` and `%%D` are R12's escapes for the diameter and degree signs. The
literal characters would be a gamble on the code page at the far end.

### Nothing that is cut has words on it

The new layer is `NOTES`, and every word in the file is on it or on `LABEL`.
`OUTLINE`, `HOLES` and `REBATE` stay paths and nothing else, so a CAM seat can
import the cutting layers and machine them without filtering out a wall of text
that a post-processor would otherwise try to cut.

That rule is also what makes the annotation safe to be generous with: it is a
layer somebody switches off.

### Where a note goes

Under the holes it describes, or over them, whichever side of the fitting has
more clear board — and never into the band along an edge that carries a mark,
because two notes written over each other are one note fewer than none. Where
the block will not fit, it closes up and the words get smaller, down to 3 mm and
no further, and it moves off the middle of the board, which is where an edge
mark writes its own words. A note nobody can read is worse than a note that is
slightly in the way.
