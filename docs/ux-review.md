# UX review — Sheet Box Designer

> **Status.** The plan in section 4 has been carried out; §60 of `claude.md`
> records what changed and why. The findings below describe the app as it was
> at 52ca1ed and are kept as the reasoning behind the changes.

Reviewed on 2026-09-03 against `main` at 52ca1ed. I read every file in
`src/ui/` and `src/styles.css`, then drove the built app in Chromium at
1600, 1280, 1000 and 820 px wide, through all four modes, with the inspector
open, a driver fitted, per-edge treatment on, a tool armed, and the right-click
menu open.

## Summary

The app does a lot and does it correctly. The interface is hard to use because
it has grown by addition. Every new idea got its own surface and the old
surfaces stayed. The result is:

- **Five places to set an edge treatment.** Sidebar (uniform), sidebar
  (per-edge list), chip bar (arm a tool, click an edge), right-click menu, and
  the inspector. Three places to set prominence. Three to set a panel's
  thickness or colour. Two to add a layer.
- **Two hundred and sixty words of grey help text** always on screen in the
  sidebar and inspector, at 10.5 px, in a colour that fails the WCAG AA
  contrast ratio for text.
- **A chip bar of 19 buttons and a slider in eight groups** over the 3D view,
  mixing how you look at the box, how you edit it, and which geometry engine
  is running.
- **Engineering telemetry shown to the user** at all times: "B-Rep, 72
  triangles, 1187 ms, one thread", "Closure: exact", an Analytic/OpenCASCADE
  switch in two modes.
- **Sidebar controls that belong to one mode** shown in every mode: the whole
  Drawing group, plus kerf, stock size and grain lock, which only affect the
  cut list.
- **No undo, and a Reset button that wipes the saved design with no
  confirmation**, in an app where a single click on the box changes the
  design.

The fix is mostly removal and relocation, not new design. Section 4 gives a
plan. The counts behind every claim are in section 5.

## 1. What works

Keep these. They are the right shape.

- **Click a panel, get an inspector about that panel.** One thing on the right,
  about the thing you pointed at.
- **The right-click menu** with its "why not" text on disabled items. This is
  the best editing surface in the app and should become the main one.
- **The hover line** ("P04 Front carcass · 327 × 218 — click to inspect,
  right-click for more"). It teaches the two gestures without a tutorial.
- **Cut list, part templates and sheet layouts as three columns** that light up
  together on hover. Good.
- **The drawing sheet.** Clean, and the toolbar above it is the least cluttered
  in the app.
- **The prominence summary line** ("Front › Back › Left › …") with the order
  picker folded away, and "Runs past all five" in the inspector instead of a
  rank number.
- The dark, monospace, single-accent look. It suits a workshop tool.

## 2. Findings

Ordered by how much each one costs the user. "Where" gives the file so the
finding can be checked.

### 2.1 The same decision can be made in up to five places

| Decision | Surfaces |
|---|---|
| Edge treatment | Sidebar uniform segmented; sidebar per-edge list with "Add an edge…" select; chip bar Square/Chamfer/Fillet/Mitre arm-then-click; right-click on an edge; inspector "Edges of this face" |
| Prominence | Sidebar preset and order picker; inspector rank row with ▲▼; right-click "Bring to the front / Send to the back" |
| Panel thickness and colour | Sidebar (project); inspector Sheet group; right-click "Thickness" and "Colour" pages |
| Add cladding / doubler / lagging | Inspector layer list; right-click "On this face" |
| Explode | 3D chip bar slider; Render chip bar slider (shared state); sidebar "Explode isometric" (separate state) |
| Drivers on/off, Perspective/Parallel | 3D chip bar; Render chip bar |

Where: `src/ui/Controls.jsx` (Edge treatment group, lines 139–218),
`src/ui/App.jsx` (chip bar, lines 221–275), `src/ui/menu.js`,
`src/ui/Inspector.jsx`.

The code comments record the intent as "one place to change a board" (§47) and
then the menu (§58, §59) added another. Each surface is reasoned; together they
mean a user never knows which one is "the" way, and a new user sees three
controls for a thing they have not yet understood once.

The chip-bar edge tools are the worst of these. Arming a tool and then hunting
for a 1 px edge is a mode, and modes need a visible state. The armed-state
banner is drawn at the same corner as the selection readout and is hidden by
it whenever a panel is selected (see 2.6). So the only sign a tool is armed is
one orange chip among nineteen.

### 2.2 Help text has replaced structure

The sidebar carries nine static notes (165 words). The inspector carries four
group notes (93 words) plus a note per fitting. All at 10.5 px, in `--ink-3`,
always visible.

Examples:

- The **Panels** note is 55 words that say "the controls are not here, they are
  in the inspector". A group whose text explains where its controls went is a
  group that should not exist in that form.
- The **per-edge** note is 60 words on mitre rules, followed by a select whose
  disabled options already encode the same rules.
- "**Up to 17.5 mm: a bevel has to leave material behind it, and this applies
  to every edge, so the thinnest wall sets the limit.**" The input already
  clamps. One line: "Max 17.5 mm (thinnest wall)".
- "**8 of 12 edges run the full length of one panel. The rest stay square: a
  bevel would stop against the side of the next panel.**" True, useful once,
  and never again.

Where: `src/ui/Controls.jsx` `note=` props and `<p className="note">`;
`src/ui/Inspector.jsx` `note=` props.

Every note is correct. The problem is that they are permanent. Rules belong in
the controls (disabled state, clamp, a "why" on hover, as the context menu
already does) and in one help page, not in paragraphs between every field.

### 2.3 The chip bar mixes looking, editing and engineering

Eight groups, 19 buttons and a slider, in two rows at 1600 px and three at
820 px:

| Group | What it is |
|---|---|
| Shaded / Shaded + hidden edges / Wireframe / Wireframe, hidden removed | View |
| By face / Material | View |
| Drivers | View |
| iso / front / top / right | View |
| Perspective / Parallel | View |
| Analytic / OpenCASCADE | Engine switch |
| Square / Chamfer / Fillet / Mitre | Edit tool |
| Explode | View |

Only the camera presets and explode are used often. Render style and
projection are set once. The engine switch is a developer control (see 2.4).
The edit tools duplicate the right-click menu (see 2.1).

Where: `src/ui/App.jsx` lines 221–275; `src/ui/RenderView.jsx` lines 488–536.

### 2.4 Engineering telemetry is always on screen

- Bottom right of the 3D view, permanently: "B-Rep, 72 triangles, 1187 ms, one
  thread". After a change: "remeshing…".
- Drawing toolbar: "B-Rep, 544 ms", and an Analytic / OpenCASCADE toggle.
- Cut list totals: "Closure: exact".
- Validation error text: "Volume closure error 1.2e-9 mm³ — this is a bug, not
  user input."

Nobody designing a box knows what B-Rep or OpenCASCADE is, or should have to.
"Closure" is a test invariant. The user needs three states only: building the
precise model, precise model ready (say nothing), precise model failed (say so,
offer retry, show the approximation). The comment in `solidNote` says the
thread count is there to explain why GitHub Pages is slower than local; that is
a note for the README, not the screen.

Where: `src/ui/App.jsx` `solidNote`; `src/ui/DrawingView.jsx` `engineNote`;
`src/ui/CutListView.jsx` totals; `src/model/validate.js` line 44.

### 2.5 Mode-specific settings live in the global sidebar

The sidebar is visible in every mode and scrolls to 1582 px at a 874 px
viewport, so the bottom half is below the fold at all times.

- The **Drawing** group (Section A–A, Acoustic insulation, Explode isometric,
  Section at x, Centre the section plane) only affects Drawing mode.
- **Kerf**, **Stock** size and **Lock grain** only affect the cut list nest.
- **Round to** affects everything, but is a setting, not a design decision.

Move each into the toolbar of the mode it affects and the sidebar drops to four
groups: Size, Material, Prominence, Panels.

Where: `src/ui/Controls.jsx` Material and Drawing groups.

### 2.6 Bugs and rough edges

- **Overlay collision.** `.edge-arm` (left 14, bottom 14) and `.selection`
  (left 10, bottom 10) occupy the same corner. With a panel selected and a tool
  armed, the selection box covers the "Fillet — click an edge · done" banner.
  Seen in the screenshots; `src/styles.css` lines 234 and 413.
- **Reset is destructive with no confirmation.** It calls `forgetDesign()` and
  replaces the design in one click. `src/ui/App.jsx` line 180.
- **No undo.** Every change writes to storage at once. "Send to the back",
  "Remove the doubler", "Mitre a ring of 4" and a mis-click on a face chip are
  all one click and all irreversible except by hand. Direct manipulation on the
  box is only safe with undo behind it.
- **"Save" and "Open…" are ambiguous** because the app also autosaves. Users
  will wonder whether they must click Save. "Download file" / "Open file", or
  an "Autosaved" hint beside them, would settle it.
- **Two segmented controls with no label** open the sidebar: Internal /
  External, then Dimensions / Volume. A first-time user does not know what
  "Internal" is internal to. "Size given as: Internal / External" and "As:
  Dimensions / Volume" cost one word each.
- **Default mode is Volume with a proportion** and the note "keeps the axial
  modes apart". That is a loudspeaker design fact in an app titled Sheet Box
  Designer. If the audience is speaker builders, say so in the title. If it is
  not, default to Dimensions.
- **Default colour mode is By face**, so the first screen shows a purple, green
  and blue box, not a plywood one. The face colours are for telling panels
  apart; Material is what the user is making. Consider Material as the
  default with face colour as an overlay for the cut list.
- **The Panels group is five rows of "None"** under a 55-word note, on a fresh
  design. Show only rows with something in them.
- **Touch has no right-click.** The menu is the only route to some actions
  (thickness pages). Long-press, or a "…" button in the selection readout,
  would cover it.
- **The fitting editor is 20 numeric fields in one column** in the inspector,
  from "At x" down to "Flare R", each with a 62 px label, several of which wrap
  ("Frame thick", "Magnet deep", "Displaces (est.)"). Most users set position,
  cutout, PCD and bolt count. Fold the rest under "Behind the baffle" and
  "Mounting" so the common case is six fields.

### 2.7 Type and contrast

| Text | Size | Colour | Contrast on `--bg-2` |
|---|---|---|---|
| Body | 12 px | `--ink` | fine |
| Labels | 11 px | `--ink-2` | 6.4 : 1 |
| Notes, hints, engine state | 10.5 px | `--ink-3` | **3.4 : 1** |
| Fitting notes, "why" text | 9.5 px | `--ink-3` | **3.4 : 1** |
| Edge axis ("runs z") | 9 px | `--ink-3` | **3.4 : 1** |

WCAG AA asks 4.5 : 1 for text under 18 px. Everything in `--ink-3` fails, and
that is exactly the text that explains the rules. Either lift `--ink-3` to
about `#7f8d9a` or stop putting information in it. Nothing should be under
10 px.

## 3. What to remove, move and keep

### Remove

- The chip-bar edge tools (Square / Chamfer / Fillet / Mitre) and the armed
  state, banner and `edgeTool` plumbing. Right-click on an edge and the
  inspector already cover it.
- The sidebar per-edge list and "Add an edge…" select. Keep the "Per edge"
  fact visible as one line ("4 edges treated · show") that opens the inspector
  or a flat list, and keep "Mitre a ring of 4" as a single action.
- The Analytic / OpenCASCADE toggles in both modes. Load the kernel, fall back
  when it fails, say so once. Keep the switch behind a query string or a
  keyboard chord for debugging.
- "B-Rep … triangles … ms … thread", "Closure", and the drawing engine note
  when the state is "ready".
- Every note that restates a rule the control enforces.
- The Render mode's duplicate Drivers / Projection / Explode chips, unless
  Render is merged into the 3D view as a fifth style ("Photo"). The code
  comment argues for a separate scene; a separate scene does not need a
  separate toolbar.

### Move

- Drawing group → Drawing mode toolbar.
- Kerf, Stock, Lock grain → Cut list header.
- Round to → beside the size readout, or a Settings popover.
- Render style, By face / Material, Perspective / Parallel, Drivers → one
  "View" popover on the 3D chip bar, leaving camera presets and Explode as
  the only chips always visible.

### Add

- Undo / redo (Ctrl+Z / Ctrl+Shift+Z) over the design state. The design is
  already an immutable object passed through `set`; a history stack is a
  small change in `App.jsx`.
- A confirmation on Reset, or make Reset undoable.
- Labels on the two starting-point segmented controls.
- A single help page (or a "?" per group) holding the prose that is now in
  notes.
- Collapsible groups in the inspector, remembering which are open.

### Keep

Everything in section 1.

## 4. A plan, in order

Each step stands alone and can ship on its own.

1. **Fix the two bugs.** Overlay collision; Reset confirmation. An hour.
2. **Add undo.** This makes every later removal safe, because the remaining
   editing surfaces (click, right-click, inspector) all act at once.
3. **Remove the duplicate edge surfaces** (chip tools, sidebar per-edge list).
   Tests in `test/kernel-ui.test.jsx` and `test/edgepick.test.js` will need
   the same edits.
4. **Move mode-specific controls into their modes** (Drawing group; kerf,
   stock, grain). The sidebar halves in length.
5. **Fold the chip bar** into camera presets, explode and a View popover. Hide
   the engine switches and telemetry.
6. **Cut the notes** to one line each and move the rules into a help page.
   Raise `--ink-3` contrast. Nothing under 10 px.
7. **Tidy the inspector**: collapsible groups, tiered fitting editor, hide
   empty summary rows in the sidebar.
8. **Revisit defaults**: Dimensions over Volume unless the audience is
   speaker builders; Material colouring over By face; labels on the
   starting-point controls.

After steps 3 to 5 the app has one sidebar of four groups, one chip row of
about seven controls, an inspector, and a menu. That is the app the code
comments describe.

## 5. Counts

Measured in the built app at 1600 × 1000, default design, before any change.

| Thing | Count |
|---|---|
| Sidebar: buttons / inputs / selects | 19 / 16 / 4 |
| Sidebar scroll height vs viewport | 1582 px in 874 px |
| Sidebar static notes | 9, 165 words |
| Inspector group notes | 4, 93 words |
| Inspector scroll height vs viewport (no fitting) | 1230 px in 964 px |
| Inspector: buttons / inputs / selects (no fitting) | 12 / 7 / 5 |
| Fitting editor numeric fields (driver) | 20 |
| 3D chip bar: groups / buttons | 8 / 19, plus a slider |
| Render chip bar: groups / buttons | 6 / 7, plus a slider and a number |
| Surfaces that set an edge treatment | 5 |
| Surfaces that set prominence | 3 |
| Explode controls | 3 (two states) |
| `--ink-3` on `--bg-2` contrast | 3.36 : 1 |
| Console errors during the run | 0 |
