// §7 Cut list & sheets: three columns read against each other, never behind tabs.
//
// §60 How the sheets are cut — the stock size, the kerf, whether the grain is
// locked — is set here, over the layouts it changes, rather than in the sidebar
// in every mode.

import React from "react";
import { fmt, cutListCsv } from "../cutlist/cutlist.js";
import { panelColour, ACCENT, REBATE } from "../three/palette.js";
import { blankCircles, blankBoltCircles } from "../model/fittings.js";
import { blankNotches } from "../model/rebate.js";
import { blankBevels } from "../model/bevel.js";
import { panelBlank } from "../model/solver.js";
import { sheetYield } from "../cutlist/nest.js";
import { sheetsDxf } from "../cutlist/dxf.js";
import { download, slug } from "./file.js";
import { Num } from "./fields.jsx";

const Swatch = ({ row, on }) => on
  ? <i className="swatch" style={{ background: panelColour(row.panel) }} /> : null;

export default function CutListView({ derived, design, set, colourByFace, selected, hovered, onSelect, onHover, debug = false }) {
  const { rows, sheets, totals } = derived;
  const title = design?.title ?? "box";
  const longest = Math.max(...rows.map((r) => r.length), 1);

  const rowProps = (r) => ({
    className: [selected === r.panelIndex ? "sel" : "", hovered === r.panelIndex ? "hov" : ""].join(" ").trim(),
    onMouseEnter: () => onHover(r.panelIndex),
    onMouseLeave: () => onHover(null),
    onClick: () => onSelect(selected === r.panelIndex ? null : r.panelIndex),
  });

  return (
    <div className="cutlist-mode">
      <section className="col col-list">
        <header>
          <h2>Cut list</h2>
          <button type="button" onClick={() => download(cutListCsv(rows), "cut-list.csv", "text/csv;charset=utf-8")}>Export CSV</button>
        </header>
        <div className="scroll">
          <table className="cuts">
            <thead>
              <tr><th>Part</th><th>Face</th><th>Layer</th><th>Length</th><th>Width</th><th>Th.</th><th>Material</th><th>Colour</th><th>Grain</th><th>Edge</th><th>Rebate</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} {...rowProps(r)}>
                  <td className="id"><Swatch row={r} on={colourByFace} />{r.id}</td>
                  <td>{r.faceLabel}</td>
                  <td>{r.layerLabel}</td>
                  <td className="num">{fmt(r.length)}</td>
                  <td className="num">{fmt(r.width)}</td>
                  <td className="num">{fmt(r.thickness)}</td>
                  <td>{r.material}</td>
                  {/* §50 The colour it is cut from, in the colour it is: a chip
                      of the board beside the name a merchant would answer to. */}
                  <td className="colour-cell">
                    <i className="chip" style={{ background: r.colour }} />
                    {r.colourNote}
                  </td>
                  <td>{r.grainLocked ? "Locked" : "Free"}</td>
                  <td className="edgework">{r.edgeWork}</td>
                  <td className="rebate-cell">{r.rebate ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totals.byMaterial.length > 1 ? (
          <table className="by-material">
            <tbody>
              {totals.byMaterial.map((m) => (
                <tr key={`${m.materialId}${m.thickness}${m.colourNote}`}>
                  <th scope="row">
                    {m.colourNote ? <i className="chip" style={{ background: m.colour }} /> : null}
                    {m.material} {fmt(m.thickness)} mm{m.colourNote ? ` · ${m.colourNote}` : ""}
                  </th>
                  <td className="num">{m.parts} part{m.parts === 1 ? "" : "s"}</td>
                  <td className="num">{m.area.toFixed(3)} m²</td>
                  <td className="num">{m.sheets} sheet{m.sheets === 1 ? "" : "s"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
        <dl className="totals">
          <div><dt>Parts</dt><dd>{totals.parts}</dd></div>
          <div><dt>Area</dt><dd>{totals.area.toFixed(3)} m²</dd></div>
          <div><dt>Sheets</dt><dd>{totals.sheets}</dd></div>
          {/* §60 A test invariant, kept on screen for whoever is testing. */}
          {debug ? <div><dt>Closure</dt><dd className={totals.closure === "exact" ? "ok" : "bad"}>{totals.closure}</dd></div> : null}
        </dl>
      </section>

      <section className="col col-parts">
        <header><h2>Part templates</h2><span className="hint">one scale, keyed to {fmt(longest)} mm</span></header>
        <div className="scroll parts">
          {rows.map((r) => (
            <figure key={r.id} {...rowProps(r)}>
              {/* Every part shares one viewBox width, keyed to the longest part,
                  so a 344 mm baffle and a 130 mm cleat do not draw the same size. */}
              <svg viewBox={`${-longest * 0.06} ${-longest * 0.06} ${longest * 1.12} ${r.width + longest * 0.12}`}>
                <rect x="0" y="0" width={r.length} height={r.width}
                  fill={colourByFace ? panelColour(r.panel) : r.colour}
                  fillOpacity="0.24"
                  stroke={selected === r.panelIndex || hovered === r.panelIndex ? ACCENT : "currentColor"}
                  strokeWidth={longest * 0.006} />
                <Rebates row={r} longest={longest} />
                <EdgeMarks row={r} longest={longest} />
                <Fittings row={r} longest={longest} />
                <text x={r.length / 2} y={r.width / 2} textAnchor="middle" dominantBaseline="middle"
                  fontSize={longest * 0.05}>{r.id}</text>
                <text x={r.length / 2} y={-longest * 0.018} textAnchor="middle" fontSize={longest * 0.035}>{fmt(r.length)}</text>
                <text x={-longest * 0.018} y={r.width / 2} textAnchor="middle" fontSize={longest * 0.035}
                  transform={`rotate(-90 ${-longest * 0.018} ${r.width / 2})`}>{fmt(r.width)}</text>
              </svg>
              <figcaption>
                {r.id} · {r.faceLabel} · {fmt(r.thickness)} mm {r.material}
                {r.fittingNote ? <em className="fitting-note">{r.fittingNote}</em> : null}
                {r.rebateNote ? <em className="fitting-note">{r.rebateNote}</em> : null}
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="col col-sheets">
        <header>
          <h2>Sheet layouts</h2>
          <button type="button" title="1:1 in millimetres, part outlines and cutouts on separate layers"
            onClick={() => download(sheetsDxf(sheets), `${slug(title)}-sheets.dxf`,
              "application/dxf")}>Export DXF</button>
        </header>
        {set ? (
          <div className="cut-settings">
            <label className="field">
              <span>Stock</span>
              <select value={design.stockIndex} aria-label="Stock"
                onChange={(e) => set({ ...design, stockIndex: Number(e.target.value) })}>
                {derived.material.stock.map((st, i) => <option key={i} value={i}>{st[0]} × {st[1]}</option>)}
              </select>
            </label>
            <Num label="Kerf" suffix="mm" step={0.1} value={design.kerf} onChange={(v) => set({ ...design, kerf: v })} />
            <label className="check">
              <input type="checkbox" checked={design.grainLocked}
                onChange={(e) => set({ ...design, grainLocked: e.target.checked })} />
              <span>Lock grain along length</span>
            </label>
          </div>
        ) : null}
        <div className="scroll">
          {sheets.map((sh) => (
            <figure key={sh.index} className="sheet">
              <svg viewBox={`-20 -20 ${sh.stock[0] + 40} ${sh.stock[1] + 40}`}>
                <rect x="0" y="0" width={sh.stock[0]} height={sh.stock[1]} fill="#0f1318" stroke="#5a6b7c" strokeWidth="6" />
                {sh.parts.map((p, i) => (
                  <g key={i} onMouseEnter={() => onHover(p.row.panelIndex)} onMouseLeave={() => onHover(null)}
                    onClick={() => onSelect(selected === p.row.panelIndex ? null : p.row.panelIndex)}>
                    <rect x={p.x} y={p.y} width={p.w} height={p.h}
                      fill={colourByFace ? panelColour(p.row.panel) : p.row.colour}
                      fillOpacity={selected === p.row.panelIndex || hovered === p.row.panelIndex ? 0.62 : 0.3}
                      stroke={selected === p.row.panelIndex || hovered === p.row.panelIndex ? ACCENT : "#8ea1b4"}
                      strokeWidth="5" />
                    {placedNotches(p).map((r, k) => (
                      <rect key={k} x={r.x} y={r.y} width={r.w} height={r.h}
                        fill={REBATE} fillOpacity="0.4" stroke={REBATE} strokeWidth="4" />
                    ))}
                    <text x={p.x + p.w / 2} y={p.y + p.h / 2} textAnchor="middle" dominantBaseline="middle"
                      fontSize={Math.min(p.w, p.h) * 0.22} fill="#e8eef4">{p.row.id}</text>
                  </g>
                ))}
              </svg>
              <figcaption>
                Sheet {sh.index} · {sh.material} {fmt(sh.thickness)} mm{sh.colourNote ? ` ${sh.colourNote}` : ""} · {sh.stock[0]} × {sh.stock[1]} ·
                yield {(sheetYield(sh) * 100).toFixed(0)}%
                {sh.overflow ? " · a part is larger than the sheet" : ""}
              </figcaption>
            </figure>
          ))}
        </div>
      </section>
    </div>
  );
}

/**
 * §45 The grooves, on the face the cutter goes at.
 *
 * Drawn under the fittings, because a hole through a rebate is still a hole
 * and the reader wants to see it whole. Its own colour rather than the
 * cutouts': a cutout goes through the board and a rebate does not, and that is
 * the distinction a template exists to make. The depth is written in it where
 * there is room, since a rebate that does not say how deep it is is only a
 * rectangle drawn on a board.
 */
function Rebates({ row, longest }) {
  const cut = row.panel?.notches?.length ? blankNotches(row.panel, panelBlank(row.panel)) : [];
  if (!cut.length) return null;
  const w = longest * 0.005;
  return (
    <g className="rebates">
      {cut.map((r, i) => {
        // The depth runs along the groove, the way it would be written on the
        // board — so a groove 18 mm across does not have to hold the words.
        const down = r.h > r.w;
        const [along, across] = down ? [r.h, r.w] : [r.w, r.h];
        const size = Math.min(longest * 0.03, across * 0.62);
        const label = `${fmt(r.depth)} deep`;
        const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
        return (
          <g key={i}>
            <rect x={r.x} y={r.y} width={r.w} height={r.h}
              fill={REBATE} fillOpacity="0.28" stroke={REBATE} strokeWidth={w} />
            {along > size * label.length * 0.62 && across > longest * 0.028 ? (
              <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle"
                fontSize={size} fill={REBATE}
                transform={down ? `rotate(-90 ${cx} ${cy})` : undefined}>{label}</text>
            ) : null}
          </g>
        );
      })}
    </g>
  );
}

/**
 * §48 Which edge the saw is set over for, marked on the edge.
 *
 * The same mark the DXF carries, for the same reason: "45° front, back" in the
 * cut list names faces of the box, and what is in front of somebody is a
 * rectangle that has been turned to nest. A line inside the edge and a word
 * beside it answers the question the words cannot.
 *
 * Drawn in the annotation idiom the bolt circle and the hole centres use —
 * `currentColor`, thin, and dashed — because none of it is cut on the sheet.
 */
function EdgeMarks({ row, longest }) {
  if (!row.bevels || !Object.keys(row.bevels).length) return null;
  const blank = panelBlank(row.panel);
  const marks = blankBevels(row.panel, row.bevels, blank);
  if (!marks.length) return null;
  const inset = Math.max(2, Math.min(10, Math.min(blank.length, blank.width) * 0.08));
  const size = Math.min(longest * 0.026, Math.min(blank.length, blank.width) * 0.1);
  const inward = { top: [0, 1], bottom: [0, -1], left: [1, 0], right: [-1, 0] };
  return (
    <g className="edge-marks" stroke="currentColor" opacity="0.75">
      {marks.map((m) => {
        const [[x1, y1], [x2, y2]] = m.seg;
        const [ix, iy] = inward[m.side];
        const [ax, ay] = [x1 + ix * inset + Math.sign(x2 - x1) * inset, y1 + iy * inset + Math.sign(y2 - y1) * inset];
        const [bx, by] = [x2 + ix * inset + Math.sign(x1 - x2) * inset, y2 + iy * inset + Math.sign(y1 - y2) * inset];
        const [tx, ty] = [(x1 + x2) / 2 + ix * (inset + size), (y1 + y2) / 2 + iy * (inset + size)];
        const down = m.side === "left" || m.side === "right";
        return (
          <g key={m.side}>
            <line x1={ax} y1={ay} x2={bx} y2={by} strokeWidth={longest * 0.004}
              strokeDasharray={`${longest * 0.014} ${longest * 0.007}`} />
            <text x={tx} y={ty} textAnchor="middle" dominantBaseline="middle" stroke="none"
              fill="currentColor" fontSize={size}
              transform={down ? `rotate(-90 ${tx} ${ty})` : undefined}>{bevelLabel(m)}</text>
          </g>
        );
      })}
    </g>
  );
}

/** The same three treatments, in the app's shorter voice. */
const bevelLabel = (b) => (b.type === "mitre" ? "45° mitre"
  : b.type === "fillet" ? `R${fmt(b.radius)} round` : `${fmt(b.radius)} chamfer`);

/**
 * §10: "without cutouts the part templates are rectangles and not worth
 * printing at 1:1." The bolt circle is drawn as a chain line, because it is a
 * setting-out circle rather than anything the router follows.
 */
/**
 * §45 A part's grooves where the nest actually put it — turned with the part
 * when the nest laid it on its side, which is the whole reason this is not
 * just the blank rectangle offset by x and y.
 */
function placedNotches(part) {
  const row = part.row;
  if (!row.panel?.notches?.length) return [];
  return blankNotches(row.panel, panelBlank(row.panel)).map((r) => (part.rotated
    ? { x: part.x + part.w - (r.y + r.h), y: part.y + r.x, w: r.h, h: r.w }
    : { x: part.x + r.x, y: part.y + r.y, w: r.w, h: r.h }));
}

function Fittings({ row, longest }) {
  if (!row.fittings?.length) return null;
  const blank = panelBlank(row.panel);
  const cut = blankCircles(row.fittings, row.panel, blank);
  const pcd = blankBoltCircles(row.fittings, row.panel, blank);
  const w = longest * 0.005;
  return (
    <g className="fittings">
      {pcd.map((c, i) => (
        <circle key={`p${i}`} cx={c.x} cy={c.y} r={c.d / 2} fill="none"
          stroke="currentColor" strokeWidth={w * 0.6} strokeDasharray={`${longest * 0.02} ${longest * 0.008} ${longest * 0.004} ${longest * 0.008}`} />
      ))}
      {cut.map((c, i) => (
        <circle key={`c${i}`} cx={c.x} cy={c.y} r={c.d / 2}
          fill="var(--bg)" stroke={ACCENT} strokeWidth={w} />
      ))}
      {cut.filter((c) => c.role !== "bolt").map((c, i) => (
        <g key={`x${i}`} stroke="currentColor" strokeWidth={w * 0.5} opacity="0.7">
          <line x1={c.x - c.d / 2 - longest * 0.012} y1={c.y} x2={c.x + c.d / 2 + longest * 0.012} y2={c.y} />
          <line x1={c.x} y1={c.y - c.d / 2 - longest * 0.012} x2={c.x} y2={c.y + c.d / 2 + longest * 0.012} />
        </g>
      ))}
    </g>
  );
}


