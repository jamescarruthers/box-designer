// §10 One fitting's controls, and the list of them.
//
// Shared between the sidebar, which lists every fitting on the box, and the
// inspector (§21), which lists the ones on the face you have selected. The same
// fitting has to read the same way in both — a driver whose PCD field is in a
// different place depending on which panel you opened it from is two controls
// wearing one name.

import React from "react";
import { FACES, FACE_LABEL, LAYER_LABEL } from "../model/constants.js";
import { newFitting, describeFitting, faceAxes, hasTube, convertAt,
  driverOuter, driverDepth, driverMagnet, driverMagnetDepth, driverCone,
  driverThick, driverBasket, driverVoiceCoil,
  driverDisplacement, hasDisplacement, innermostOn, largestFlare,
  fittingStack, boltDepth, fittingAt, flareHitsBolts, reaches } from "../model/fittings.js";
import { panelThickness } from "../model/solver.js";
import { Num, Segmented, round } from "./fields.jsx";

/** A new fitting, centred on the face it is being put on. */
export function centredFitting(derived, type, face) {
  const panel = derived.fittingPanels?.[face]
    ?? derived.sol.panels.find((p) => p.face === face)
    ?? derived.sol.panels[0];
  const [p, q] = faceAxes(panel.face);
  return newFitting(type, panel.face, {
    a: (panel.box[p][0] + panel.box[p][1]) / 2,
    b: (panel.box[q][0] + panel.box[q][1]) / 2,
  });
}

/**
 * §34 What the flare's limit is, and which of the two set it.
 *
 * The thickness where nothing else is in the way — the whole panel rolled
 * away, if that is what somebody wants — and the bolt circle where the bolts
 * reach that far, since a flare cannot open out through the holes that hold
 * the driver on.
 */
export function flareNote(f, panel, most) {
  const layer = (LAYER_LABEL[panel.layer] ?? panel.layer).toLowerCase();
  const limit = `Up to ${round(most)} mm, the full thickness of the ${layer} it is cut in.`;
  // §36 The bolt circle is no longer a limit — the flare is cut before the
  // bolts are drilled, so it builds — but a flare that opens out past them is
  // worth saying out loud at the control that did it.
  return flareHitsBolts(f) ? `${limit} This one opens out into the bolt holes.` : limit;
}

/**
 * §33 How far a hole goes into the stack, as a list of the layers it could
 * stop at.
 *
 * Named by the layer the hole ends in — "Carcass" means through the cladding
 * and the carcass and no further — because that is how somebody at a bench
 * thinks about it. "All layers" is kept as its own answer rather than being
 * spelled as the deepest one: a hole meant to go all the way should still go
 * all the way when a doubler is added behind it.
 */
function Depth({ label, aria, stack, value, onChange, cap = null, disabled = false }) {
  const options = stack.map((p, i) => [String(i + 1), LAYER_LABEL[p.layer] ?? p.layer]);
  const capped = cap == null ? options : options.slice(0, cap);
  return (
    <label className="field">
      <span>{label}</span>
      <select aria-label={aria} disabled={disabled}
        value={value == null ? "all" : String(Math.min(value, capped.length))}
        onChange={(e) => onChange(e.target.value === "all" ? null : Number(e.target.value))}>
        {capped.map(([v, name]) => <option key={v} value={v}>{name}</option>)}
        <option value="all">All layers</option>
      </select>
    </label>
  );
}

/**
 * One fitting.
 *
 * `index` is its place in the design's own list, which is what the labels are
 * numbered by — so a fitting keeps the name it has in the sidebar when it is
 * looked at from the inspector, and a test that finds "Fitting 2 pcd" finds the
 * same field in both.
 *
 * `onFace` drops the face picker: inside the inspector the face is the thing
 * you selected, and a control that could move the fitting off the panel you are
 * looking at would empty the panel you are looking at.
 */
export function FittingEditor({ fitting: f, index, edit, remove, derived, onFace = false }) {
  const [p, q] = faceAxes(f.face);
  const ratio = f.units === "ratio";
  const panel = derived.fittingPanels?.[f.face];
  const n = index + 1;
  // §29 The flare is cut where the hole comes out into the box, so what limits
  // it is the innermost panel on that face — the doubler if there is one, the
  // carcass if there is not.
  const inner = derived.sol?.panels ? innermostOn(derived.sol.panels, f.face) : null;
  // §33 The layers this face actually has. One of them and there is nothing to
  // choose: a hole through the only panel there is goes through all of them.
  const stack = derived.sol?.panels ? fittingStack(derived.sol.panels, f.face) : [];
  const flare = f.flare?.type && f.flare.type !== "none" ? f.flare : { type: "none", radius: 0 };
  // §34 The limit belongs to the panel the flare is cut in, as that panel is
  // actually cut. Where the bolts stop short of it (§33) there is no bolt
  // circle for the flare to graze, and the only limit left is the thickness —
  // so a full fillet, the whole panel rolled away, becomes available exactly
  // where somebody would want one.
  const flaredAs = inner ? fittingAt(f, Math.max(0, stack.indexOf(inner))) : null;
  // §36 How deep a bolt hole runs when it runs right through: the panels the
  // bolts are allowed through (§33), added up.
  const boltThrough = stack.reduce((a, p, i) =>
    a + (reaches(i, boltDepth(f)) ? panelThickness(p) : 0), 0);
  const mostFlare = flaredAs ? largestFlare(flaredAs, panelThickness(inner)) : 0;
  // §20 Switching units moves the number, not the fitting.
  const setUnits = (units) => edit({ units, at: convertAt(f, panel, units) });
  return (
    <div className="fitting">
      <div className="fitting-head">
        {onFace ? (
          <span className="on-face">{FACE_LABEL[f.face]}</span>
        ) : (
          <select value={f.face} aria-label={`Fitting ${n} face`}
            onChange={(e) => edit({ face: e.target.value })}>
            {FACES.map((x) => <option key={x} value={x}>{FACE_LABEL[x]}</option>)}
          </select>
        )}
        <span className="kind">{f.type === "port" ? "Port" : "Driver"}</span>
        <button type="button" className="drop" aria-label={`Remove fitting ${n}`}
          onClick={remove}>×</button>
      </div>
      <div className="fitting-units">
        <Segmented ariaLabel={`Fitting ${n} units`} value={ratio ? "ratio" : "mm"}
          onChange={setUnits}
          options={[{ id: "mm", name: "mm" }, { id: "ratio", name: "% of panel" }]} />
      </div>
      <div className="fitting-grid">
        <Num label={`At ${p}`} aria={`Fitting ${n} at ${p}`} suffix={ratio ? "%" : "mm"}
          value={round(f.at.a)} onChange={(v) => edit({ at: { ...f.at, a: v } })} />
        <Num label={`At ${q}`} aria={`Fitting ${n} at ${q}`} suffix={ratio ? "%" : "mm"}
          value={round(f.at.b)} onChange={(v) => edit({ at: { ...f.at, b: v } })} />
        {f.type === "driver" ? (
          <>
            <Num label="Cutout ⌀" aria={`Fitting ${n} cutout`} suffix="mm" step={0.5} value={f.cutout} onChange={(v) => edit({ cutout: v })} />
            {/* §22 The frame, which is what has to fit on the panel and what
                gets drawn. Shown with the fallback filled in rather than blank,
                so a driver saved before the field existed reads as a number
                somebody can correct instead of a gap they have to guess at. */}
            <Num label="Frame ⌀" aria={`Fitting ${n} outer`} suffix="mm" step={0.5}
              value={round(driverOuter(f))} onChange={(v) => edit({ outer: v })} />
            <Num label="PCD" aria={`Fitting ${n} pcd`} suffix="mm" step={0.5} value={f.pcd} onChange={(v) => edit({ pcd: v })} />
            <Num label="Bolts" aria={`Fitting ${n} bolts`} value={f.bolts} min={2} onChange={(v) => edit({ bolts: Math.max(2, Math.round(v)) })} />
            <Num label="Bolt ⌀" aria={`Fitting ${n} boltHole`} suffix="mm" step={0.5} value={f.boltHole} onChange={(v) => edit({ boltHole: v })} />
            {/* §28 The volume this driver takes out of the box by standing
                in it — the number that makes the net volume real. Deliberately
                not labelled Vd: that is Sd × Xmax, the air the cone sweeps
                while it works, which is a different quantity altogether. Until
                a figure is given, what is shown is worked out from the shape
                that is drawn: a basket drawn solid where a real one is half
                air, so it reads high. */}
            <Num label={hasDisplacement(f) ? "Displaces" : "Displaces (est.)"} aria={`Fitting ${n} displaces`}
              suffix="l" step={0.01}
              value={Math.round(driverDisplacement(f) / 1e4) / 100}
              onChange={(v) => edit({ displaces: v * 1e6 })} />
          </>
        ) : (
          <>
            {/* The bore is the tube's inside diameter, continuous from the
                outer face of the panel to the end of the tube. */}
            <Num label="Inside ⌀" aria={`Fitting ${n} diameter`} suffix="mm" step={0.5} value={f.diameter} onChange={(v) => edit({ diameter: v })} />
            <Num label="Length" aria={`Fitting ${n} length`} suffix="mm" value={f.length}
              disabled={!hasTube(f)} onChange={(v) => edit({ length: v })} />
            <Num label="Wall" aria={`Fitting ${n} wall`} suffix="mm" step={0.5} value={f.wall}
              disabled={!hasTube(f)} onChange={(v) => edit({ wall: v })} />
          </>
        )}
      </div>
      {stack.length > 1 ? (
        <div className="fitting-grid fitting-depth">
          {/* §33 A hole enters at the face and stops; it cannot skip a layer
              and reappear behind it. So this is a depth rather than a set. */}
          <Depth label="Hole through" aria={`Fitting ${n} through`} stack={stack}
            value={f.through ?? null} onChange={(v) => edit({ through: v })} />
          {f.type === "driver" ? (
            /* The one that wanted its own answer: bolts into the baffle, the
               cutout on through the doubler behind it. Never deeper than the
               cutout, since bolt holes in a panel the cone cannot pass is a
               mistake rather than a choice. */
            <Depth label="Bolts through" aria={`Fitting ${n} boltsThrough`} stack={stack}
              cap={f.through ?? stack.length}
              value={boltDepth(f)} onChange={(v) => edit({ boltsThrough: v })} />
          ) : null}
        </div>
      ) : null}
      {/* §60 The rest of a driver's numbers: what is behind the baffle and how
          it is held on. Most drivers are placed with the six above; these are
          folded until they are wanted, and stay in the document either way. */}
      {f.type === "driver" ? (
        <details className="fitting-more">
          <summary>Mounting and behind the baffle</summary>
          <div className="fitting-grid">
            {/* §31 The frame's own plate, which a datasheet's depth is measured
                from the front of. */}
            <Num label="Frame thick" aria={`Fitting ${n} thick`} suffix="mm" step={0.5}
              value={round(driverThick(f))} onChange={(v) => edit({ thick: v })} />
            {/* §36 How deep the mounting holes are drilled, from the mounting
                face. Offered filled in with the depth of a hole that goes
                right through what §33 lets it through, so a datasheet's screw
                length is typed over a number; anything shorter is a blind hole
                for a screw or an insert, and typing the through depth back
                stores "through" rather than that number, so it stays a through
                hole if the panel is made thicker. */}
            <Num label="Bolt deep" aria={`Fitting ${n} boltDeep`} suffix="mm" step={0.5}
              value={round(boltThrough > 0 ? Math.min(f.boltDeep ?? boltThrough, boltThrough) : (f.boltDeep ?? 0))}
              max={boltThrough || undefined}
              onChange={(v) => edit({ boltDeep: v >= boltThrough - 1e-9 ? null : v })} />
            {/* §24 Behind the baffle. Depth is overall and measured from the
                mounting face, which is how a datasheet gives it. */}
            <Num label="Depth" aria={`Fitting ${n} depth`} suffix="mm" step={0.5}
              value={round(driverDepth(f))} onChange={(v) => edit({ depth: v })} />
            <Num label="Magnet ⌀" aria={`Fitting ${n} magnet`} suffix="mm" step={0.5}
              value={round(driverMagnet(f))} onChange={(v) => edit({ magnet: v })} />
            <Num label="Magnet deep" aria={`Fitting ${n} magnetDepth`} suffix="mm" step={0.5}
              value={round(driverMagnetDepth(f))} onChange={(v) => edit({ magnetDepth: v })} />
            {/* §31 What the hole is cut to clear. Bigger than the cutout is a
                driver that does not go in, and the messages say so rather than
                the drawing quietly squeezing it through. */}
            <Num label="Basket ⌀" aria={`Fitting ${n} basket`} suffix="mm" step={0.5}
              value={round(driverBasket(f))} onChange={(v) => edit({ basket: v })} />
            {/* §27 Surround to dust cap. Deep on a pro woofer, shallow on a
                shielded full-range — a proportion of the cutout is a fair
                guess and never the number. */}
            <Num label="Cone deep" aria={`Fitting ${n} coneDepth`} suffix="mm" step={0.5}
              value={round(driverCone(f))} onChange={(v) => edit({ coneDepth: v })} />
            {/* §31 Where the cone ends: it stops at the coil former, and the
                dust cap covers the junction. */}
            <Num label="Voice coil ⌀" aria={`Fitting ${n} vc`} suffix="mm" step={0.5}
              value={round(driverVoiceCoil(f))} onChange={(v) => edit({ vc: v })} />
          </div>
        </details>
      ) : null}
      {f.type === "driver" ? (
        <div className="fitting-flare">
          <span className="flare-label">Inside the cutout</span>
          <Segmented ariaLabel={`Fitting ${n} flare type`} value={flare.type}
            onChange={(type) => edit({ flare: {
              type,
              // A flare turned on for the first time starts at something usable
              // rather than at zero, which would look like nothing happening.
              radius: flare.radius > 0 ? Math.min(flare.radius, mostFlare) : Math.min(6, mostFlare),
            } })}
            options={[{ id: "none", name: "Square" }, { id: "chamfer", name: "Chamfer" }, { id: "fillet", name: "Fillet" }]} />
          {/* §29 The back of the hole, where the cone's rear wave leaves.
              Square-edged it is a short tube of baffle in the way of it; the
              radius is capped at what that panel can take, so what the
              control offers is always a shape the kernel will cut. */}
          <Num label="Flare R" aria={`Fitting ${n} flare`} suffix="mm" step={0.5}
            value={round(flare.radius)} max={mostFlare}
            disabled={flare.type === "none"}
            onChange={(v) => edit({ flare: { ...flare, radius: v } })} />
        </div>
      ) : null}
      {/* §34 Which of the two limits applies is worth saying, because it is
          the difference between a 12 mm flare and rolling the whole panel
          away — and the way to lift it is a control three rows up. */}
      {f.type === "driver" && flare.type !== "none" && inner ? (
        <p className="flare-note">{flareNote(flaredAs, inner, mostFlare)}</p>
      ) : null}
      {f.type === "port" ? (
        <label className="check">
          <input type="checkbox" checked={hasTube(f)} aria-label={`Fitting ${n} tube`}
            onChange={(e) => edit({ tube: e.target.checked })} />
          <span>Fit a tube behind the hole</span>
        </label>
      ) : null}
      <p className="note">{describeFitting(f)}</p>
    </div>
  );
}

/**
 * The fittings of a design, or the subset of them on one face.
 *
 * `face` narrows the list and fixes what a new one is put on. The indices
 * handed to the editor are into the *design's* list either way, so removing the
 * second fitting on the front removes that one and not the second on the box.
 */
export function FittingList({ design, set, derived, face = null }) {
  const list = design.fittings ?? [];
  const put = (next) => set({ ...design, fittings: next });
  const shown = list.map((f, i) => [f, i]).filter(([f]) => !face || f.face === face);
  const add = (type) => put([...list, centredFitting(derived, type, face ?? "front")]);

  return (
    <div className="stack">
      <div className="stack-head">
        <h3>{shown.length ? `${shown.length} fitted` : "None"}</h3>
        <select className="add" value="" aria-label={face ? `Add a fitting to the ${FACE_LABEL[face].toLowerCase()}` : "Add a fitting"}
          onChange={(e) => { if (e.target.value) add(e.target.value); }}>
          <option value="">Add…</option>
          <option value="driver">Driver</option>
          <option value="port">Port</option>
        </select>
      </div>

      {shown.map(([f, i]) => (
        <FittingEditor key={f.id} fitting={f} index={i} derived={derived} onFace={Boolean(face)}
          edit={(patch) => put(list.map((x, j) => (j === i ? { ...x, ...patch } : x)))}
          remove={() => put(list.filter((_, j) => j !== i))} />
      ))}
    </div>
  );
}
