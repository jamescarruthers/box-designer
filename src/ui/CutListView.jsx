// §7 Cut list & sheets: three columns read against each other, never behind tabs.

import React from "react";
import { fmt, cutListCsv } from "../cutlist/cutlist.js";
import { panelColour, ACCENT } from "../three/palette.js";
import { sheetYield } from "../cutlist/nest.js";

const Swatch = ({ row, on }) => on
  ? <i className="swatch" style={{ background: panelColour(row.panel) }} /> : null;

export default function CutListView({ derived, colourByFace, selected, hovered, onSelect, onHover }) {
  const { rows, sheets, totals, material } = derived;
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
              <tr><th>Part</th><th>Face</th><th>Layer</th><th>Length</th><th>Width</th><th>Th.</th><th>Grain</th><th>Edge work</th></tr>
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
                  <td>{r.grain === "Free" ? "Free" : "Locked"}</td>
                  <td className="edgework">{r.edgeWork}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
                  fill={colourByFace ? panelColour(r.panel) : material.colour}
                  fillOpacity="0.24"
                  stroke={selected === r.panelIndex || hovered === r.panelIndex ? ACCENT : "currentColor"}
                  strokeWidth={longest * 0.006} />
                <text x={r.length / 2} y={r.width / 2} textAnchor="middle" dominantBaseline="middle"
                  fontSize={longest * 0.05}>{r.id}</text>
                <text x={r.length / 2} y={-longest * 0.018} textAnchor="middle" fontSize={longest * 0.035}>{fmt(r.length)}</text>
                <text x={-longest * 0.018} y={r.width / 2} textAnchor="middle" fontSize={longest * 0.035}
                  transform={`rotate(-90 ${-longest * 0.018} ${r.width / 2})`}>{fmt(r.width)}</text>
              </svg>
              <figcaption>{r.id} · {r.faceLabel} · {fmt(r.thickness)} mm</figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="col col-sheets">
        <header><h2>Sheet layouts</h2><span className="hint">{material.name}, grouped by thickness</span></header>
        <div className="scroll">
          {sheets.map((sh) => (
            <figure key={sh.index} className="sheet">
              <svg viewBox={`-20 -20 ${sh.stock[0] + 40} ${sh.stock[1] + 40}`}>
                <rect x="0" y="0" width={sh.stock[0]} height={sh.stock[1]} fill="#0f1318" stroke="#5a6b7c" strokeWidth="6" />
                {sh.parts.map((p, i) => (
                  <g key={i} onMouseEnter={() => onHover(p.row.panelIndex)} onMouseLeave={() => onHover(null)}
                    onClick={() => onSelect(selected === p.row.panelIndex ? null : p.row.panelIndex)}>
                    <rect x={p.x} y={p.y} width={p.w} height={p.h}
                      fill={colourByFace ? panelColour(p.row.panel) : material.colour}
                      fillOpacity={selected === p.row.panelIndex || hovered === p.row.panelIndex ? 0.62 : 0.3}
                      stroke={selected === p.row.panelIndex || hovered === p.row.panelIndex ? ACCENT : "#8ea1b4"}
                      strokeWidth="5" />
                    <text x={p.x + p.w / 2} y={p.y + p.h / 2} textAnchor="middle" dominantBaseline="middle"
                      fontSize={Math.min(p.w, p.h) * 0.22} fill="#e8eef4">{p.row.id}</text>
                  </g>
                ))}
              </svg>
              <figcaption>
                Sheet {sh.index} · {sh.stock[0]} × {sh.stock[1]} · {fmt(sh.thickness)} mm ·
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

function download(text, name) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
