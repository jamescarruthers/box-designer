// §7 The small controls both panels are built from.
//
// These lived inside Controls until there were two places putting the same
// question to somebody — the sidebar, which asks it about the project, and the
// inspector (§21), which asks it about one face. Two copies of a number field
// is two places for a step, a suffix or an aria-label to drift, and the
// difference shows up as "the colour picker behaves differently over here",
// which is a bug nobody can name.

import React from "react";
import { paletteFor, colourName, materialById, MATERIALS, LAGGINGS } from "../model/constants.js";
import { panelColour } from "../three/palette.js";

export function Group({ title, note, children }) {
  return (
    <section className="group">
      <h2>{title}</h2>
      {note ? <p className="note">{note}</p> : null}
      <div className="group-body">{children}</div>
    </section>
  );
}

export function Num({ label, value, onChange, step = 1, min = 0, max, suffix, list, aria, disabled = false }) {
  // §26 `max` is enforced, not merely declared. The attribute alone stops the
  // spinner going past it and does nothing whatever about a number typed in,
  // which is how a radius bigger than the wall got as far as the kernel.
  const clamp = (v) => (Number.isFinite(max) ? Math.min(v, max) : v);
  return (
    <label className={disabled ? "field disabled" : "field"}>
      <span>{label}</span>
      <span className="input-wrap">
        <input type="number" aria-label={aria ?? label} value={value} step={step} min={min} max={max} list={list}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value === "" ? 0 : clamp(Number(e.target.value)))} />
        {suffix ? <em>{suffix}</em> : null}
      </span>
    </label>
  );
}

/**
 * §18 A colour, chosen by name where the sheet has names for its colours and by
 * eye where it does not.
 *
 * Valchromat comes in twelve; birch ply comes in birch. So the list appears
 * only when there is a list, and the picker is always there beside it — a
 * design is allowed to say "this one, painted" without the app arguing.
 *
 * `value` of null means "as the sheet comes", which is not the same as a hex
 * that happens to match: one follows the sheet when the sheet changes and the
 * other does not.
 */
export function Colour({ label, aria, material, value, onChange, inherit, inheritLabel = "As the sheet comes" }) {
  const palette = paletteFor(material);
  // What the swatch shows when nothing has been chosen is what the panel will
  // actually be, not what the sheet comes in: a face following a green project
  // is green, and a grey square there would be a plain lie.
  const shown = value ?? inherit ?? materialById(material).colour;
  const named = value ? colourName(material, value) : null;
  return (
    <label className="field colour-field">
      <span>{label}</span>
      <span className="colour-wrap">
        {palette ? (
          <select value={named ? value : (value ? "custom" : "")} aria-label={`${aria} colour name`}
            onChange={(e) => onChange(e.target.value === "custom" ? shown : (e.target.value || null))}>
            <option value="">{inheritLabel}</option>
            {palette.map((c) => <option key={c.id} value={c.hex}>{c.name}</option>)}
            <option value="custom">Something else…</option>
          </select>
        ) : (
          <button type="button" className="linkish" onClick={() => onChange(null)}
            disabled={!value}>{value ? "Clear" : inheritLabel}</button>
        )}
        <input type="color" value={shown} aria-label={`${aria} colour`}
          onChange={(e) => onChange(e.target.value)} />
      </span>
    </label>
  );
}

/** The face swatch, shown only while face colouring is on. */
export const FaceSwatch = ({ face, layer, on }) => on
  ? <i className="swatch" style={{ background: panelColour({ face, layer }) }} /> : null;

export function Segmented({ value, options, onChange, ariaLabel }) {
  return (
    <div className="segmented" role="group" aria-label={ariaLabel}>
      {options.map((o) => (
        <button key={o.id} type="button" className={o.id === value ? "on" : ""}
          onClick={() => onChange(o.id)}>{o.name}</button>
      ))}
    </div>
  );
}

/** The thicknesses each material is sold in, offered on every thickness input. */
export function StockThicknesses() {
  // §30 Linings as well as sheets: the thickness box on a lagging panel offers
  // the thicknesses felt is sold in, not the ones birch ply is.
  return [...MATERIALS, ...LAGGINGS].map((m) => (
    <datalist id={`th-${m.id}`} key={m.id}>
      {m.thicknesses.map((t) => <option key={t} value={t} />)}
    </datalist>
  ));
}

/** One decimal place, which is as fine as any of these numbers is read. */
export const round = (v) => Math.round(v * 10) / 10;
