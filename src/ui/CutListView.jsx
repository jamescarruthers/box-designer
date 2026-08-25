// §7 Cut list & sheets: three columns read against each other, never behind tabs.

import React from "react";
import { fmt, cutListCsv } from "../cutlist/cutlist.js";
import { panelColour, ACCENT } from "../three/palette.js";
import { blankCircles, blankBoltCircles } from "../model/fittings.js";
import { panelBlank } from "../model/solver.js";
import { sheetYield } from "../cutlist/nest.js";
import { sheetsDxf } from "../cutlist/dxf.js";

const Swatch = ({ row, on }) => on
  ? <i className="swatch" style={{ background: panelColour(row.panel) }} /> : null;

export default function CutListView({ derived, title, colourByFace, selected, hovered, onSelect, onHover }) {
  const { rows, sheets, totals } = derived;
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
          <button type="button" onClick={() => download(cutListCsv(rows), "cut-list.csv")}>Export CSV</button>
        </header>
        <div className="scroll">
          <table className="cuts">
            <thead>
              <tr><th>Part</th><th>Face</th><th>Layer</th><th>Length</th><th>Width</th><th>Th.</th><th>Material</th><th>Grain</th><th>Edge</th></tr>
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
                  <td>{r.grainLocked ? "Locked" : "Free"}</td>
                  <td className="edgework">{r.edgeWork}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totals.byMaterial.length > 1 ? (
          <table className="by-material">
            <tbody>
              {totals.byMaterial.map((m) => (
                <tr key={`${m.materialId}${m.thickness}`}>
                  <th scope="row">{m.material} {fmt(m.thickness)} mm</th>
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
          <div><dt>Closure</dt><dd className={totals.closure === "exact" ? "ok" : "bad"}>{totals.closure}</dd></div>
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
                    <text x={p.x + p.w / 2} y={p.y + p.h / 2} textAnchor="middle" dominantBaseline="middle"
                      fontSize={Math.min(p.w, p.h) * 0.22} fill="#e8eef4">{p.row.id}</text>
                  </g>
                ))}
              </svg>
              <figcaption>
                Sheet {sh.index} · {sh.material} {fmt(sh.thickness)} mm · {sh.stock[0]} × {sh.stock[1]} ·
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
 * §10: "without cutouts the part templates are rectangles and not worth
 * printing at 1:1." The bolt circle is drawn as a chain line, because it is a
 * setting-out circle rather than anything the router follows.
 */
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

/** A filename that will not need renaming before it can be emailed. */
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "box";

function download(text, name, type = "text/csv;charset=utf-8") {
  const blob = new Blob([text], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
