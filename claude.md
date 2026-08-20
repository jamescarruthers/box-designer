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
presets and an explode slider.

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
2. **Both panels run the edge's full length.** Otherwise a third panel is in the
   way partway along and the cut cannot run through. This is the §3 rule, but
   applied to both panels rather than just whichever owns the outer corner.
3. **Both are the same thickness.** Then the cut is 45° and the two halves meet.
   Unequal thicknesses have a mitre at some other angle, but it stops being a
   saw set to 45 and starts being a calculation per joint.

Under the presets that leaves 1, 2 or 4 mitrable edges: front and back wrapping
gives the four vertical corners, sides wrapping gives four horizontal ones.
Every edge is judged against the box as it arrived, before any of them move —
mitring one edge grows a panel and could make a second one eligible, and then
the answer would depend on which edge was asked for first.

A mitre and a decorative bevel are **mutually exclusive on one edge**. The mitre
already cuts that corner at 45°; a fillet on top of it would have to be split
across two panels that each own half the corner. Choosing Mitre in the per-edge
control replaces the treatment rather than adding to it.

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
