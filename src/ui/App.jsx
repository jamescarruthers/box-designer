import React, { useMemo, useState, useRef, useCallback, useEffect, Suspense, lazy } from "react";
import Controls from "./Controls.jsx";
import Viewport, { VIEW_PRESETS } from "./Viewport.jsx";
import ViewMenu from "./ViewMenu.jsx";
import CutListView from "./CutListView.jsx";
import Inspector from "./Inspector.jsx";
import DrawingView from "./DrawingView.jsx";
import Help from "./Help.jsx";
// §19 Loaded when the mode is opened. Physical materials and the environment
// prefilter pull in a good deal of three that the other modes never touch, and
// the app has to open on a slow connection.
const RenderView = lazy(() => import("./RenderView.jsx"));
import { DEFAULT_DESIGN, derive } from "./design.js";
import ContextMenu from "./ContextMenu.jsx";
import { contextMenu } from "./menu.js";
import { loadDesign, saveDesign, forgetDesign } from "./storage.js";
import { designFileText, designFileName, readDesignFile, openedNote, readFile, download,
  FILE_ACCEPT, FILE_TYPE } from "./file.js";
import { useKernelSolids } from "./useKernelSolids.js";
import { useHistory } from "./history.js";
import { isDebug } from "./debug.js";
import { kernelProgress } from "../occt/kernel.js";
import { fmt } from "../cutlist/cutlist.js";
import { FACE_LABEL } from "../model/constants.js";

const MODES = [
  { id: "view", name: "3D view" },
  { id: "render", name: "Render" },
  { id: "cuts", name: "Cut list & sheets" },
  { id: "drawing", name: "Drawing" },
];

/** Whether a key press landed in something that edits text of its own. */
const inField = (el) => el instanceof HTMLElement
  && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);

export default function App() {
  // §13 Opened from storage, saved on every change. §60 Kept as a history, so
  // a change is a step that can be taken back. Read once, lazily, so the parse
  // happens before the first render rather than as a second one.
  const [design, setDesign, history] = useHistory(loadDesign);
  const [mode, setMode] = useState("view");
  const [style, setStyle] = useState("shaded-edges");
  // §60 The box is drawn in what it is made of. Face colours tell the panels
  // apart, which is a thing to switch on when it is wanted.
  const [colourByFace, setColourByFace] = useState(false);
  const [explode, setExplode] = useState(0);
  // §51 One box, one way of looking at it: the 3D view and the rendered view
  // share how far it is pulled apart and whether it is drawn in perspective.
  // They keep their own camera angles — those are set up per view — but a box
  // that is exploded is exploded, and there is nothing to gain from being
  // shown it two ways at once.
  const [parallel, setParallel] = useState(false);
  // §22 Whether the drivers are drawn on the box. A way of looking at it rather
  // than something about it, so it lives here beside the render style and not
  // in the design. On by default: a box with the drivers in it is the picture
  // somebody is trying to see, and the holes are still there underneath.
  const [showDrivers, setShowDrivers] = useState(true);
  const [selected, setSelected] = useState(null);
  const [hovered, setHovered] = useState(null);
  const [camera, setCamera] = useState({ preset: "iso", nonce: 0 });
  // §19 The rendered view's own camera, kept here because the mode is
  // unmounted when it is not on screen. Two views of one box, each remembering
  // where it was left.
  const [renderCamera, setRenderCamera] = useState(null);
  // §23 OpenCASCADE from the start. The analytic ring stacks are an
  // approximation that was never asked to carry fittings — they cannot cut a
  // hole — so a box with a driver in it is drawn wrong by the engine that used
  // to be the default. The kernel is not a second opinion any more; it is the
  // one that models what is being made, and the ring stacks are what is on
  // screen while it loads and what is left if it cannot.
  //
  // §60 The switch is a developer's, and is shown only with `?debug`.
  const [solidEngine, setSolidEngine] = useState("kernel");
  // A stall terminates the worker, so trying again is a real thing to do rather
  // than a hopeful one — and switching the engine off and on again to get it is
  // a trick you have to know.
  const [attempt, setAttempt] = useState(0);
  // §52 What happened to the last file — opened, and what was dropped out of
  // it, or why it would not open. Kept until the next one, because a file that
  // half-opened is something to read at your own pace, not a flash.
  const [fileNote, setFileNote] = useState(null);
  // §58 The right-click menu: what was under the pointer and where the pointer
  // was. Not part of the design and not part of the view — it is a question
  // somebody is in the middle of asking.
  const [menu, setMenu] = useState(null);
  // §59 What the pointer is over in the 3D view: a panel, an edge, or nothing.
  // The panel half feeds the `hovered` the cut list already shares, so hovering
  // a board in the box lights its row in the list and the other way about.
  const [hoverTarget, setHoverTarget] = useState(null);
  // §60 Reset asks before it wipes the box, and help is a page rather than a
  // paragraph under every field.
  const [confirmReset, setConfirmReset] = useState(false);
  const [help, setHelp] = useState(false);
  const fileInput = useRef(null);
  const debug = isDebug();

  const derived = useMemo(() => {
    try { return { ok: true, ...derive(design) }; }
    catch (e) { return { ok: false, error: e }; }
  }, [design]);

  // Saved after the render that used it, so a design that cannot be solved is
  // still kept — you can reload and carry on fixing it rather than losing it.
  useEffect(() => { saveDesign(design); }, [design]);

  // §60 Undo and redo from the keyboard. Not while a field has the focus: the
  // field's own undo is the one wanted there, and it already writes back into
  // the design as it goes.
  useEffect(() => {
    const key = (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      if (inField(e.target)) return;
      const k = e.key.toLowerCase();
      if (k === "z" && e.shiftKey) { e.preventDefault(); history.redo(); }
      else if (k === "z") { e.preventDefault(); history.undo(); }
      else if (k === "y") { e.preventDefault(); history.redo(); }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [history]);

  // §52 Out to a file, and back in from one. The design in the file is the
  // design in storage: opening one is the same act as reloading the tab, so it
  // replaces the box outright rather than merging into it, and the panel that
  // was selected is let go of because it was an index into a different box.
  const saveToDisk = useCallback(() => {
    download(designFileText(design), designFileName(design.title), FILE_TYPE);
    setFileNote({ ok: true, text: `Saved ${designFileName(design.title)}.` });
  }, [design]);

  const openFromDisk = useCallback(async (file) => {
    if (!file) return;
    try {
      const read = readDesignFile(await readFile(file));
      setDesign(read.design, { step: true });
      setSelected(null);
      setFileNote({ ok: true, text: openedNote(file.name, read) });
    } catch (e) {
      setFileNote({ ok: false, text: e?.message ?? String(e) });
    }
  }, [setDesign]);

  // Forgets as well as resets: a design kept between visits that you cannot
  // get rid of is a trap, not a convenience. §60 Asked first, and undoable
  // after — the history still holds the box that was there.
  const reset = useCallback(() => {
    forgetDesign(); setDesign(DEFAULT_DESIGN, { step: true });
    setSelected(null); setFileNote(null); setConfirmReset(false);
  }, [setDesign]);

  // §58 A right-click on the box. A miss closes whatever was open rather than
  // leaving a menu hanging over nothing.
  const onContext = useCallback((target, at) => {
    setMenu(target ? { target, at } : null);
  }, []);

  const onMenuPick = useCallback((item) => {
    // §59 A page turns in place: the menu stays where it is and shows the next
    // list, so the pointer does not have to chase a flyout.
    if (item.into) { setMenu((m) => (m ? { ...m, page: item.into } : m)); return; }
    if (item.back) { setMenu((m) => (m ? { ...m, page: null } : m)); return; }
    setMenu(null);
    if (item.inspect != null) { setSelected(item.inspect); return; }
    if (item.apply) setDesign((d) => item.apply(d));
  }, [setDesign]);

  const onHover = useCallback((t) => {
    setHoverTarget(t);
    setHovered(t?.kind === "panel" ? t.index : null);
  }, []);

  const onSelect = useCallback((i) => setSelected((cur) => (cur === i ? null : i)), []);
  const kernelSolids = useKernelSolids(derived.ok ? derived : null,
    derived.ok && solidEngine === "kernel", attempt);

  if (!derived.ok) {
    return <div className="app fatal"><p>The box cannot be solved: {String(derived.error?.message ?? derived.error)}</p></div>;
  }

  const errors = derived.messages.filter((m) => m.level === "error");
  const warnings = derived.messages.filter((m) => m.level === "warning");
  const selectedRow = derived.rows.find((r) => r.panelIndex === selected);
  const solidState = solidEngine === "kernel" ? solidNote(kernelSolids, debug) : null;

  return (
    // §21 Three columns while a panel is selected: the project on the left, the
    // box in the middle, that panel on the right. The class is on the app
    // rather than on the inspector because the middle column has to give up the
    // width, and the cut list has to give up a column of its own.
    <div className={selectedRow ? "app inspecting" : "app"}>
      <aside className="side">
        <header className="brand">
          <div className="brand-row">
            <h1>Sheet Box Designer</h1>
            <button type="button" className="help-button" aria-label="Help" title="How the box is made"
              onClick={() => setHelp(true)}>?</button>
          </div>
          <input className="title-input" value={design.title} aria-label="Drawing title"
            onChange={(e) => setDesign({ ...design, title: e.target.value.toUpperCase() })} />
        </header>
        {/* §47 The sidebar can open a panel too: what it shows of a board is a
            summary, and every line of it is a way into the inspector that owns
            the board. Not `onSelect`, which toggles — a name in a list that
            closes the panel it names is a name that does not work twice. */}
        <Controls design={design} set={setDesign} derived={derived} colourByFace={colourByFace}
          onInspect={setSelected} />
        <footer className="side-foot">
          <div className="side-foot-row">
            <button type="button" onClick={history.undo} disabled={!history.canUndo}
              title="Ctrl+Z">Undo</button>
            <button type="button" onClick={history.redo} disabled={!history.canRedo}
              title="Ctrl+Shift+Z">Redo</button>
            <span className="spacer" />
            {/* §52 The design as a file: the way to keep two boxes, to send one
                to somebody, or to put one in a repository beside its drawings.
                The input is hidden and driven by the button, because a bare
                file input is the one control in a browser nobody can style and
                everybody recognises as an afterthought. §60 Named as files,
                because the box is also saved as you go. */}
            <button type="button" onClick={() => fileInput.current?.click()}>Open file…</button>
            <button type="button" onClick={saveToDisk}>Save file</button>
          </div>
          <div className="side-foot-row">
            {confirmReset ? (
              <span className="reset-confirm" role="alert">
                Start again from the default box?
                <button type="button" onClick={reset}>Reset</button>
                <button type="button" onClick={() => setConfirmReset(false)}>Keep</button>
              </span>
            ) : (
              <>
                <button type="button" onClick={() => setConfirmReset(true)}>Reset…</button>
                <span className="autosave">Saved in this browser as you go</span>
              </>
            )}
          </div>
          <input ref={fileInput} type="file" accept={FILE_ACCEPT} className="hidden-file"
            aria-label="Open a design file"
            onChange={(e) => { openFromDisk(e.target.files?.[0]); e.target.value = ""; }} />
        </footer>
        {fileNote ? (
          <p className={fileNote.ok ? "note file-note" : "note file-note bad"} role="status">
            {fileNote.text}
            <button type="button" className="linkish" onClick={() => setFileNote(null)}>dismiss</button>
          </p>
        ) : null}
      </aside>

      <main className="main">
        <nav className="modes">
          {MODES.map((m) => (
            <button key={m.id} type="button" className={mode === m.id ? "on" : ""}
              onClick={() => setMode(m.id)}>{m.name}</button>
          ))}
          <span className="spacer" />
          <span className="stat">{fmt(derived.sol.E.x)} × {fmt(derived.sol.E.y)} × {fmt(derived.sol.E.z)} mm</span>
          <span className="stat">{derived.totals.parts} parts · {derived.totals.sheets} sheet{derived.totals.sheets === 1 ? "" : "s"}</span>
        </nav>

        <div className="stage">
          {/* The viewport stays mounted and is hidden with CSS, so the camera survives. */}
          <div className={`pane pane-view ${mode === "view" ? "" : "hidden"}`}>
            <Viewport derived={derived} style={style} colourByFace={colourByFace} explode={explode}
              parallel={parallel}
              selected={selected} hovered={hovered} onSelect={onSelect} hidden={mode !== "view"} camera={camera}
              solids={solidEngine === "kernel" ? kernelSolids.solids : null}
              onContext={onContext}
              onHover={onHover} drivers={showDrivers} />
            {/* §60 Three things: how to look, where from, and how far apart. */}
            <div className="chips">
              <ViewMenu style={style} onStyle={setStyle}
                colourByFace={colourByFace} onColourByFace={setColourByFace}
                parallel={parallel} onParallel={setParallel}
                drivers={showDrivers} onDrivers={setShowDrivers} />
              <div className="chip-group">
                {Object.keys(VIEW_PRESETS).map((p) => (
                  <button key={p} type="button" onClick={() => setCamera({ preset: p, nonce: Date.now() })}>{p}</button>
                ))}
              </div>
              <div className="chip-group explode">
                <label htmlFor="explode">Explode</label>
                <input id="explode" type="range" min="0" max="120" value={explode}
                  onChange={(e) => setExplode(Number(e.target.value))} />
                <output>{explode}</output>
              </div>
              {debug ? (
                <div className="chip-group">
                  <button type="button" className={solidEngine === "analytic" ? "on" : ""}
                    onClick={() => setSolidEngine("analytic")}>Analytic</button>
                  <button type="button" className={solidEngine === "kernel" ? "on" : ""}
                    onClick={() => setSolidEngine("kernel")}>OpenCASCADE</button>
                </div>
              ) : null}
            </div>
            {solidState ? (
              <div className="solid-state">
                {solidState}
                {kernelSolids.status === "failed" ? (
                  <button type="button" className="linkish"
                    onClick={() => setAttempt((n) => n + 1)}>Try again</button>
                ) : null}
              </div>
            ) : null}
            {selectedRow ? (
              <div className="selection">
                <strong>{selectedRow.id}</strong> {selectedRow.faceLabel} {selectedRow.layerLabel} ·{" "}
                {fmt(selectedRow.length)} × {fmt(selectedRow.width)} × {fmt(selectedRow.thickness)} mm
                {selectedRow.edgeWork !== "—" ? ` · ${selectedRow.edgeWork}` : ""}
              </div>
            ) : hoverNote(hoverTarget, derived) ? (
              // §59 What the pointer is on, and that a right-click will act on
              // it. The line is only ever there while the pointer is on the box.
              <div className="selection hovering">{hoverNote(hoverTarget, derived)}</div>
            ) : null}
          </div>

          {mode === "cuts" ? (
            <div className="pane pane-cuts">
              <CutListView derived={derived} design={design} set={setDesign} colourByFace={colourByFace}
                selected={selected} hovered={hovered} onSelect={onSelect} onHover={setHovered}
                debug={debug} />
            </div>
          ) : null}

          {mode === "render" ? (
            <div className="pane pane-render">
              <Suspense fallback={<div className="render-state">preparing the studio…</div>}>
                <RenderView derived={derived} design={design}
                  solids={solidEngine === "kernel" ? kernelSolids.solids : null} hidden={false}
                  camera={renderCamera} onCamera={setRenderCamera}
                  drivers={showDrivers} onDrivers={setShowDrivers}
                  explode={explode} onExplode={setExplode}
                  parallel={parallel} onParallel={setParallel} />
              </Suspense>
            </div>
          ) : null}

          {mode === "drawing" ? (
            <div className="pane pane-drawing">
              <DrawingView derived={derived} design={design} set={setDesign} debug={debug} />
            </div>
          ) : null}
        </div>

        {errors.length || warnings.length ? (
          <div className="messages">
            {errors.map((m, i) => <p key={`e${i}`} className="error">{m.text}</p>)}
            {warnings.map((m, i) => <p key={`w${i}`} className="warning">{m.text}</p>)}
          </div>
        ) : null}
      </main>

      {/* §21 Selecting a panel is asking a question about it, so the answers are
          put where the question was asked rather than back in the project
          controls. Shown in every mode: the cut list and the drawing select
          panels too, and the same face is the same face from all three. */}
      {selectedRow ? (
        <Inspector design={design} set={setDesign} derived={derived} row={selectedRow}
          colourByFace={colourByFace} onSelect={setSelected} onClose={() => setSelected(null)} />
      ) : null}

      {help ? <Help onClose={() => setHelp(false)} /> : null}

      {/* §58 Last in the tree, so it is over everything without a z-index race. */}
      {menu ? (
        <ContextMenu menu={contextMenu(design, derived, menu.target, menu.page)} at={menu.at}
          onPick={onMenuPick} onClose={() => setMenu(null)} />
      ) : null}
    </div>
  );
}

/**
 * §59 What the pointer is over, in words, and the reminder that it can be acted
 * on. Named the way §58's menu names it, so the line and the menu agree.
 */
export function hoverNote(target, derived) {
  if (target?.kind === "edge") {
    const [a, b] = String(target.key).split("|");
    if (!FACE_LABEL[a] || !FACE_LABEL[b]) return null;
    return `${FACE_LABEL[a]} / ${FACE_LABEL[b]} edge — right-click to treat it`;
  }
  if (target?.kind === "panel") {
    const row = derived.rows?.find((r) => r.panelIndex === target.index);
    if (!row) return null;
    return `${row.id} ${row.faceLabel} ${row.layerLabel} · ${fmt(row.length)} × ${fmt(row.width)}`
      + ` — click to inspect, right-click for more`;
  }
  return null;
}

/**
 * What to say about the kernel, if anything.
 *
 * §60 Three states are the user's: it is still building, it failed, or a panel
 * would not cut and is drawn from the ring stack instead. Ready is nothing to
 * say. With `?debug` the old line is back — which engine, how many triangles,
 * how long, and whether it ran threaded, which is the answer to why a Pages
 * deployment is slower than a local one: GitHub Pages cannot send COOP and
 * COEP, so the service worker is the only thing supplying them and it can
 * quietly fail.
 */
export function solidNote(k, debug = false) {
  if (k.status === "loading") return `${kernelProgress(k.progress)}…`;
  if (k.status === "refreshing") return debug ? "remeshing…" : null;
  if (k.status === "failed") {
    return debug
      ? `${k.error?.message ?? "kernel unavailable"} — showing the ring-stack solids`
      : `${k.error?.message ?? "The precise model would not build"} — showing an approximation`;
  }
  if (k.status === "ready") {
    const how = k.threaded ? "threaded" : k.isolated ? "one thread" : "one thread, not isolated";
    const note = debug ? `B-Rep, ${k.triangles} triangles, ${k.ms} ms, ${how}` : null;
    // §25 A panel the kernel would not build is drawn from the ring stack
    // instead. Said plainly, and only when it happened: the box is on screen
    // either way, and which panel it was is what somebody needs to know.
    const refused = k.refused ?? [];
    if (!refused.length) return note;
    const which = refused.map((r) => FACE_LABEL[r.face] ?? r.face).join(", ");
    // §26 And why, in the kernel's own words where it gave any.
    const why = refused.find((r) => typeof r.failed === "string" && r.failed)?.failed;
    return `${note ? `${note} · ` : ""}${refused.length} panel${refused.length === 1 ? "" : "s"} `
      + `(${which}) would not cut — drawn approximately`
      + (why ? `: ${why}` : "");
  }
  return null;
}
