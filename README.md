# Sheet Box Designer

A web app for designing boxes made from sheet material (plywood, MDF). It solves
panel sizes from a few parameters, shows the result in 3D, and produces a cut
list, sheet layouts and a technical drawing to British standards.

The model, the algorithms and the drawing conventions are specified in
[`claude.md`](claude.md). This repository implements that specification.

```
npm install
npm run dev        # http://localhost:5173
npm test           # 123 tests, including the verified fixtures
npm run build
```

## What it does

**Panel solver.** Three nested layers — cladding, shell, doubler — each tiling
the walls of the previous layer's cavity with one function. Which panel runs
full size and which stops short is decided by a strict *prominence* rank over
all six faces, so `front & back wrap` and `baffle wraps sides` are the same code
path with a different order. Reordering prominence changes every panel size and
no internal dimension.

Start from internal or external dimensions, or from a target volume and a
proportion (default 1 : 1.25 : 1.6).

**Edge treatments.** Chamfers and fillets, global or per edge, cut from the
outer face inward. They attach to whichever panel is the outermost material at
that edge, so cladding a face moves the bevel to the cladding. Blank sizes never
change — a bevel is an operation after assembly and the cut list carries it as a
note.

**3D view.** Panel solids built as a ring stack from the outer surface inward,
with every triangle oriented outward against the panel centroid. Four Fusion-360
render styles, colour by material or by face, explode, click to select, and a
hand-rolled orbit camera that survives a switch to another mode.

**Materials.** The carcass sets the project sheet. Cladding and doublers are
added a side at a time from a dropdown, each inheriting that sheet and then
editable — a birch carcass can carry a 19 mm Valchromat baffle and a 25 mm MDF
doubler. Every material has a standard thickness a new panel starts at
(Valchromat 19 mm, the rest 18 mm) and a list of the thicknesses it is sold in.

**Cut list and sheets.** Sorted by layer then area, numbered after sorting.
Part templates share one scale keyed to the longest part. Shelf packing, first
fit decreasing, kerf-aware, grouped by material and thickness, rotating parts
unless the grain is locked — and grain locking binds only sheets that have one.
Totals break down by material. CSV export.

**Technical drawing.** A3 landscape, first angle, at a real ISO 5455 preferred
scale rather than "to fit". Front elevation, end view from the left, section
A–A, plan from above and a true isometric projection. Hidden line removal is
exact — every panel projects to a rectangle, so visibility is a containment test
with no tolerance anywhere. SVG export.

## Layout

```
src/model/      constants, the solver, edge treatments, validation
src/three/      panel solids, the face palette
src/cutlist/    cut list, CSV, shelf nesting
src/drawing/    projections, hidden line removal, section, isometric, the sheet
src/ui/         the three modes and the controls
test/           the suite from §9 of the specification
tools/          render an SVG to PNG, and drive the built app in Chromium
```

## The tests that matter

- **Closure and overlap** — 30,000 random envelopes, thicknesses, cladding,
  doublers and prominence orders, in integer millimetres so the arithmetic is
  exact. Panel volumes plus the cavity equal the envelope, exactly; no pair of
  panels overlaps; internal dimensions never depend on prominence.
- **Pluvia 7P Mica fixture** — the published panel sizes for a real standmount,
  to the millimetre.
- **Triangle orientation** — every triangle of a filleted side panel points away
  from the panel centroid, and the bevel is at the outer face, not in the cavity.
- **Hidden line removal** — the verified end-view table, and a sides-wrap case
  where an outline assembled from four panels merges into four segments.
- **Bevel line counts** — no bevel 74 lines and 0 arcs; fillet 74 and 12;
  chamfer 98 and 0. A fillet must add arcs without adding lines.
- **Valid SVG** — every preset against every fixture, parsed as XML.
- **Driving the app** — mounted in jsdom with a stubbed `WebGLRenderer`.

To look at the drawing rather than assert about it:

```
npx vite build && npx vite preview --port 5011 &
node tools/shoot-app.mjs http://localhost:5011 ./out   # the three modes
node tools/shoot-scenario.mjs ./out                   # fillets, cladding, doublers, explode
node tools/shoot-responsive.mjs ./out                 # the 1320 px and 1000 px breakpoints
```

## Deployment

`.github/workflows/pages.yml` runs the tests and the build on every push and
pull request, and publishes `dist/` to GitHub Pages from `main`. The Vite base
is `./`, so it works under a project-site path without further configuration.

Enable it once in the repository: **Settings → Pages → Source: GitHub Actions**.

## Known gaps

No cutouts, no rebates or dados, the isometric ignores edge treatments, bevels
do not shift interior hidden lines, one sheet size (A3), and dimension
placements are hand-tuned. §10 of the specification has the detail.
