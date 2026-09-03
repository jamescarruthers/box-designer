/**
 * §60 The interface, cut back.
 *
 * The review in docs/ux-review.md found one decision reachable from five
 * places, two hundred and sixty words of permanent help text, a chip bar of
 * nineteen buttons, telemetry on screen, mode-specific settings in the
 * sidebar, and no undo. These are the tests for what replaced them.
 */
import React from "react";
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";

vi.mock("three", async (importOriginal) => {
  const actual = await importOriginal();
  const { StubRenderer } = await import("./stub-renderer.js");
  return { ...actual, WebGLRenderer: StubRenderer };
});
vi.mock("../src/occt/client.js", async () => {
  const { stubKernel } = await import("./stub-kernel.js");
  return stubKernel().module;
});

import App, { solidNote } from "../src/ui/App.jsx";
import { initialHistory, push, undo, redo, HISTORY_LIMIT } from "../src/ui/history.js";
import { isDebug } from "../src/ui/debug.js";
import { engineNote } from "../src/ui/DrawingView.jsx";
import { DEFAULT_DESIGN, derive, rebateOffer, setLayerOrder, setEdgeTreatment, setRebateSides } from "../src/ui/design.js";
import { PROMINENCE_PRESETS } from "../src/model/constants.js";

beforeAll(() => {
  global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  Element.prototype.setPointerCapture = () => {};
});
beforeEach(() => { localStorage.clear(); });
afterEach(() => { cleanup(); window.history.replaceState({}, "", "/"); });

const open = (name) => fireEvent.click(screen.getByLabelText(`Open the ${name}`));
const openView = () => fireEvent.click(screen.getByRole("button", { name: "View ▾" }));
const undoKey = () => fireEvent.keyDown(window, { key: "z", ctrlKey: true });
const redoKey = () => fireEvent.keyDown(window, { key: "z", ctrlKey: true, shiftKey: true });

describe("§60 a history of the design", () => {
  const a = { t: "a" }, b = { t: "b" }, c = { t: "c" }, d = { t: "d" };

  it("pushes, undoes and redoes", () => {
    let h = initialHistory(a);
    h = push(h, b, 1000);
    h = push(h, c, 2000);
    expect(h.present).toBe(c);
    h = undo(h);
    expect(h.present).toBe(b);
    expect(h.future).toEqual([c]);
    h = undo(h);
    expect(h.present).toBe(a);
    expect(undo(h)).toBe(h);                 // nothing further back
    h = redo(h);
    expect(h.present).toBe(b);
    h = push(h, d, 3000);                    // a new branch drops the old future
    expect(h.future).toEqual([]);
    expect(redo(h)).toBe(h);
  });

  it("coalesces a burst of typing into one step", () => {
    let h = initialHistory({ thickness: 0 });
    h = push(h, { thickness: 1 }, 1000);
    h = push(h, { thickness: 16 }, 1100);
    h = push(h, { thickness: 163 }, 1200);
    expect(h.past).toEqual([{ thickness: 0 }]);          // one step, not three
    h = push(h, { thickness: 9 }, 5000);                 // a while later: its own step
    expect(h.past).toEqual([{ thickness: 0 }, { thickness: 163 }]);
    expect(undo(h).present).toEqual({ thickness: 163 });
  });

  it("keeps a click on something else apart, however quick", () => {
    let h = initialHistory({ thickness: 18, order: "a" });
    h = push(h, { thickness: 25, order: "a" }, 1000);
    h = push(h, { thickness: 25, order: "b" }, 1050);    // 50 ms later, a different field
    expect(h.past).toHaveLength(2);
    expect(undo(h).present).toEqual({ thickness: 25, order: "a" });
  });

  it("is the same history when nothing changed", () => {
    const h = push(initialHistory(a), b, 1000);
    expect(push(h, b, 9000)).toBe(h);
  });

  it("is bounded", () => {
    let h = initialHistory({ n: 0 });
    for (let i = 1; i <= HISTORY_LIMIT + 50; i++) h = push(h, { n: i }, i * 1000);
    expect(h.past).toHaveLength(HISTORY_LIMIT);
  });
});

describe("§60 undo in the app", () => {
  it("takes a change back from the keyboard and puts it back again", () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText("Thickness"), { target: { value: "25" } });
    expect(screen.getByLabelText("Thickness").value).toBe("25");
    undoKey();
    expect(screen.getByLabelText("Thickness").value).toBe("18");
    redoKey();
    expect(screen.getByLabelText("Thickness").value).toBe("25");
  });

  it("has buttons for it, which know when there is nothing to do", () => {
    render(<App />);
    const undoButton = () => screen.getByRole("button", { name: "Undo" });
    const redoButton = () => screen.getByRole("button", { name: "Redo" });
    expect(undoButton().disabled).toBe(true);
    expect(redoButton().disabled).toBe(true);
    open("Front carcass");
    fireEvent.click(screen.getByRole("button", { name: "Add doubler" }));
    expect(screen.getByLabelText("Open the Front doubler")).toBeTruthy();
    expect(undoButton().disabled).toBe(false);
    fireEvent.click(undoButton());
    expect(screen.queryByLabelText("Open the Front doubler")).toBeNull();
    expect(redoButton().disabled).toBe(false);
    fireEvent.click(redoButton());
    expect(screen.getByLabelText("Open the Front doubler")).toBeTruthy();
  });

  it("leaves a field's own undo to the field", () => {
    render(<App />);
    const field = screen.getByLabelText("Thickness");
    fireEvent.change(field, { target: { value: "25" } });
    fireEvent.keyDown(field, { key: "z", ctrlKey: true });
    expect(field.value).toBe("25");
  });

  it("makes a reset something that can be taken back", () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText("Thickness"), { target: { value: "25" } });
    fireEvent.click(screen.getByRole("button", { name: "Reset…" }));
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByLabelText("Thickness").value).toBe("18");
    undoKey();
    expect(screen.getByLabelText("Thickness").value).toBe("25");
  });
});

describe("§60 the chip bar", () => {
  it("is a view menu, the camera presets and the explode", () => {
    const { container } = render(<App />);
    const chips = container.querySelector(".pane-view .chips");
    const names = [...chips.querySelectorAll("button")].map((b) => b.textContent);
    expect(names).toEqual(["View ▾", "iso", "front", "top", "right"]);
    expect(chips.querySelector("#explode")).toBeTruthy();
    // No edge tools, no engine switch.
    expect(screen.queryByRole("button", { name: "Fillet an edge" })).toBeNull();
    expect(screen.queryByRole("button", { name: "OpenCASCADE" })).toBeNull();
  });

  it("opens the view menu with the style, colouring, projection and drivers in it", () => {
    render(<App />);
    expect(screen.queryByRole("group", { name: "View" })).toBeNull();
    openView();
    const menu = screen.getByRole("group", { name: "View" });
    for (const name of ["Shaded", "Wireframe", "By face", "By material", "Perspective", "Parallel", "Shown", "Hidden"]) {
      expect(within(menu).getByRole("button", { name })).toBeTruthy();
    }
    expect(within(menu).getByRole("button", { name: "By material" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("group", { name: "View" })).toBeNull();
  });

  it("shows the engine switch and the closure only with ?debug", () => {
    window.history.replaceState({}, "", "/?debug");
    const { container } = render(<App />);
    expect(screen.getByRole("button", { name: "OpenCASCADE" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cut list & sheets" }));
    expect(within(container.querySelector(".totals")).getByText("exact")).toBeTruthy();
  });

  it("says nothing about the kernel once it is ready, unless asked", () => {
    const ready = { status: "ready", triangles: 72, ms: 1187, threaded: false, isolated: true };
    expect(solidNote(ready)).toBeNull();
    expect(solidNote(ready, true)).toMatch(/B-Rep, 72 triangles, 1187 ms, one thread/);
    // But a panel it would not cut is still said, in plain words.
    const refused = { ...ready, refused: [{ face: "front", failed: "no" }] };
    expect(solidNote(refused)).toMatch(/1 panel \(Front\) would not cut/);
    // And a failure is said, with a way back.
    expect(solidNote({ status: "failed", error: new Error("stalled") })).toMatch(/stalled — showing an approximation/);
    expect(solidNote({ status: "loading", progress: { phase: "fetching", loaded: 4_000_000 } })).toMatch(/fetching the kernel, 4.0 MB…$/);

    expect(engineNote("kernel", "kernel", { status: "ready", ms: 500 })).toBeNull();
    expect(engineNote("kernel", "kernel", { status: "ready", ms: 500 }, true)).toBe("B-Rep, 500 ms");
    expect(engineNote("kernel", "analytic", { status: "failed", error: new Error("no") })).toMatch(/no — showing the analytic sheet/);
  });

  it("reads ?debug off the query", () => {
    expect(isDebug("")).toBe(false);
    expect(isDebug("?debug")).toBe(true);
    expect(isDebug("?debug=1")).toBe(true);
    expect(isDebug("?x=1&debug")).toBe(true);
    expect(isDebug("?debugger")).toBe(false);
  });
});

describe("§60 settings live in the mode they change", () => {
  it("keeps the drawing's controls on the drawing", () => {
    const { container } = render(<App />);
    expect(screen.queryByLabelText("Section A–A")).toBeNull();
    expect(screen.queryByLabelText("Explode isometric")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Drawing" }));
    expect(screen.getByLabelText("Section A–A")).toBeTruthy();
    expect(screen.getByLabelText("Acoustic insulation")).toBeTruthy();
    expect(screen.getByLabelText("Explode isometric")).toBeTruthy();
    expect(container.querySelector(".sheet-controls")).toBeTruthy();
  });

  it("keeps the kerf, the stock and the grain on the cut list", () => {
    const { container } = render(<App />);
    expect(screen.queryByLabelText("Kerf")).toBeNull();
    expect(screen.queryByLabelText("Stock")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Cut list & sheets" }));
    expect(screen.getByLabelText("Kerf").value).toBe("3.2");
    expect(screen.getByLabelText("Stock")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Kerf"), { target: { value: "4" } });
    expect(container.querySelector(".cut-settings")).toBeTruthy();
    expect(JSON.parse(localStorage.getItem("sheet-box-designer/design/1")).kerf).toBe(4);
  });

  it("has five groups in the sidebar, none of them about one mode", () => {
    const { container } = render(<App />);
    const titles = [...container.querySelectorAll(".controls .group h2")].map((h) => h.textContent);
    expect(titles).toEqual(["Size", "Material", "Prominence", "Panels", "Edges"]);
  });

  it("labels the starting point", () => {
    const { container } = render(<App />);
    const text = container.querySelector(".controls .group").textContent;
    expect(text).toMatch(/Sizes are/);
    expect(text).toMatch(/Given as/);
    // §60 Dimensions by default, and the same box as before.
    expect(screen.getByLabelText("Width").value).toBe("182");
    expect(DEFAULT_DESIGN.start.mode).toBe("dimensions");
  });
});

describe("§60 the sidebar's edges group", () => {
  it("sets all twelve at once, and ends any per-edge work when it does", () => {
    render(<App />);
    open("Front carcass");
    fireEvent.change(screen.getByLabelText("Front left edge treatment"), { target: { value: "fillet" } });
    expect(screen.getByRole("button", { name: "Back to one treatment" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Chamfer" }));
    expect(screen.queryByRole("button", { name: "Back to one treatment" })).toBeNull();
    expect(screen.getByLabelText("Front left edge treatment").value).toBe("chamfer");
    expect(screen.getByLabelText("Front right edge treatment").value).toBe("chamfer");
  });

  it("changes the radius of every bevel, the per-edge ones too", () => {
    render(<App />);
    open("Front carcass");
    fireEvent.change(screen.getByLabelText("Front left edge treatment"), { target: { value: "fillet" } });
    fireEvent.change(screen.getByLabelText("Radius"), { target: { value: "8" } });
    expect(screen.getByLabelText("Front left edge radius").value).toBe("8");
  });
});

describe("§60 help, folds and the fitting editor", () => {
  it("opens the help page and closes it", () => {
    render(<App />);
    expect(screen.queryByRole("dialog", { name: "Help" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Help" }));
    const help = screen.getByRole("dialog", { name: "Help" });
    expect(help.textContent).toMatch(/Prominence/);
    expect(help.textContent).toMatch(/Ctrl\+Z/);
    fireEvent.click(screen.getByRole("button", { name: "Close help" }));
    expect(screen.queryByRole("dialog", { name: "Help" })).toBeNull();
  });

  it("folds an inspector group and remembers it", () => {
    const { container } = render(<App />);
    open("Front carcass");
    const fold = () => within(container.querySelector(".inspector")).getByRole("button", { name: "Rebate" });
    expect(fold().getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByLabelText("Front rebate depth")).toBeTruthy();
    fireEvent.click(fold());
    expect(fold().getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByLabelText("Front rebate depth")).toBeNull();
    // Remembered across a reopen.
    fireEvent.click(screen.getByLabelText("Close the panel inspector"));
    open("Front carcass");
    expect(fold().getAttribute("aria-expanded")).toBe("false");
  });

  it("keeps the common driver fields in view and folds the rest", () => {
    const { container } = render(<App />);
    open("Front carcass");
    fireEvent.change(screen.getByLabelText("Add a fitting to the front"), { target: { value: "driver" } });
    const fitting = container.querySelector(".fitting");
    const more = fitting.querySelector("details.fitting-more");
    expect(more).toBeTruthy();
    expect(more.open).toBe(false);
    // In the document either way, so a datasheet can be typed in.
    expect(more.contains(screen.getByLabelText("Fitting 1 magnet"))).toBe(true);
    expect(more.contains(screen.getByLabelText("Fitting 1 pcd"))).toBe(false);
  });

  it("keeps every note under the fields to a line", () => {
    const { container } = render(<App />);
    open("Front carcass");
    const words = (el) => el.textContent.trim().split(/\s+/).length;
    for (const note of container.querySelectorAll(".group > .note")) {
      expect(words(note), note.textContent).toBeLessThanOrEqual(24);
    }
  });
});

describe("§62 a control does not offer what the model would refuse", () => {
  const sidesWrap = PROMINENCE_PRESETS.find((p) => p.id === "sides").order;
  const wrapped = setLayerOrder(DEFAULT_DESIGN, "shell", sidesWrap);

  it("offers no side of a panel that runs past its neighbours", () => {
    const offer = rebateOffer(DEFAULT_DESIGN, derive(DEFAULT_DESIGN), "shell", "front");
    for (const side of ["left", "right", "top", "bottom"]) {
      expect(offer.sides[side].ok).toBe(false);
      expect(offer.sides[side].why).toMatch(/runs past/);
    }
    expect(offer.maxDepth).toBeNull();
  });

  it("offers every side of a panel let in by the ones around it, to a depth shy of them", () => {
    const offer = rebateOffer(wrapped, derive(wrapped), "shell", "front");
    for (const side of ["left", "right", "top", "bottom"]) expect(offer.sides[side].ok).toBe(true);
    // The carcass is 18 mm, so the deepest groove is 17.5.
    expect(offer.maxDepth).toBe(17.5);
  });

  it("closes a side whose joint is mitred, and says so", () => {
    // Plinth & lid: the front sits inside all four of its neighbours, and its
    // joint with the left runs the same length on both, so it can be mitred.
    const plinth = setLayerOrder(DEFAULT_DESIGN, "shell", PROMINENCE_PRESETS.find((p) => p.id === "plinth").order);
    const mitred = setEdgeTreatment(plinth, "front|left", "mitre");
    expect(derive(mitred).requestedMitres["front|left"]).toBeTruthy();
    const offer = rebateOffer(mitred, derive(mitred), "shell", "front");
    expect(offer.sides.left.ok).toBe(false);
    expect(offer.sides.left.why).toMatch(/mitred/);
    expect(offer.sides.right.ok).toBe(true);
  });

  it("keeps a chosen side on when the box changes under it, with the reason", () => {
    const chosen = setRebateSides(wrapped, "front", { left: true });
    const back = setLayerOrder(chosen, "shell", PROMINENCE_PRESETS[0].order);
    const offer = rebateOffer(back, derive(back), "shell", "front");
    expect(offer.sides.left.on).toBe(true);
    expect(offer.sides.left.ok).toBe(false);
    expect(offer.sides.left.why).toMatch(/runs past/);
  });

  it("disables the buttons in the inspector, and All chooses only what is open", () => {
    render(<App />);
    const preset = [...document.querySelectorAll("label.field")]
      .find((l) => l.textContent.startsWith("Preset")).querySelector("select");
    fireEvent.change(preset, { target: { value: "plinth" } });
    open("Front carcass");
    // Mitre the left joint from the inspector: that side closes.
    fireEvent.change(screen.getByLabelText("Front left edge treatment"), { target: { value: "mitre" } });
    expect(screen.getByLabelText("Front rebate left").disabled).toBe(true);
    expect(screen.getByLabelText("Front rebate right").disabled).toBe(false);
    // §43 And the top and bottom, since growing the front that way would
    // stretch the mitre. The reasons are on the sheet, one line each.
    expect(screen.getByLabelText("Front rebate top").disabled).toBe(true);
    expect(screen.getByLabelText("Front rebate top").title).toMatch(/mitre longer/);
    fireEvent.click(screen.getByLabelText("Front rebate all sides"));
    expect(document.querySelector(".rebate .note").textContent).toMatch(/Let in 6 mm on right\./);
    // No warning: nothing was asked for that could not be done.
    expect(document.querySelector(".messages .warning")).toBeNull();
    // And the depth cannot be typed through the board beside it.
    fireEvent.change(screen.getByLabelText("Front rebate depth"), { target: { value: "40" } });
    expect(screen.getByLabelText("Front rebate depth").value).toBe("17.5");
  });

  it("bounds the section plane to the box", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Drawing" }));
    fireEvent.change(screen.getByLabelText("Section at x"), { target: { value: "900" } });
    expect(screen.getByLabelText("Section at x").value).toBe("218");
  });

  it("bounds a fitting's position to its panel", () => {
    render(<App />);
    open("Front carcass");
    fireEvent.change(screen.getByLabelText("Add a fitting to the front"), { target: { value: "driver" } });
    fireEvent.change(screen.getByLabelText("Fitting 1 at x"), { target: { value: "900" } });
    expect(screen.getByLabelText("Fitting 1 at x").value).toBe("218");
    expect(screen.getByLabelText("Fitting 1 at x").getAttribute("min")).toBe("0");
  });
});
