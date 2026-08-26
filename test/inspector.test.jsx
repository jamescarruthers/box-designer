/**
 * §21 The inspector: everything about the face you have selected.
 *
 * Driven the way somebody uses it — select a panel, change something on it,
 * and check that the box changed in that one place. The interesting cases are
 * all about *blast radius*: the design keeps one thickness and one colour for
 * the whole carcass, so a control on one face has to switch the per-face
 * override on before it writes, or it either does nothing or moves all six.
 */
import React from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";

vi.mock("three", async (importOriginal) => {
  const actual = await importOriginal();
  const { StubRenderer } = await import("./stub-renderer.js");
  return { ...actual, WebGLRenderer: StubRenderer };
});

// §23 The kernel is the default engine now, so mounting the app asks for it.
// Held at "still loading", which is the analytic ring stacks on screen — what
// these tests were looking at before the default changed.
vi.mock("../src/occt/client.js", async () => {
  const { stubKernel } = await import("./stub-kernel.js");
  return stubKernel().module;
});

import App from "../src/ui/App.jsx";
import { setFaceThickness, setFaceColour, moveFace, authoredEdge, derive, DEFAULT_DESIGN } from "../src/ui/design.js";
import { edgesOfFace, otherFace, FACES } from "../src/model/constants.js";

beforeAll(() => {
  global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  Element.prototype.setPointerCapture = () => {};
  global.URL.createObjectURL = () => "blob:stub";
  global.URL.revokeObjectURL = () => {};
});

afterEach(cleanup);
beforeEach(() => localStorage.clear());

/** Open the cut list and select the first part, which is how a test picks a panel. */
function selectFirstPanel(container) {
  fireEvent.click(screen.getByRole("button", { name: "Cut list & sheets" }));
  const row = container.querySelector("table.cuts tbody tr");
  fireEvent.click(row);
  return container.querySelector(".inspector");
}

describe("§21 one face's thickness", () => {
  it("switches the per-face override on rather than moving all six", () => {
    // Straight from a uniform box: the design has one thickness and the
    // override off, so writing to `thicknessBy` alone would be ignored.
    const next = setFaceThickness(DEFAULT_DESIGN, "front", 25);
    expect(next.perFaceThickness).toBe(true);
    expect(next.thicknessBy.front).toBe(25);
    for (const f of FACES.filter((x) => x !== "front")) {
      expect(next.thicknessBy[f]).toBe(DEFAULT_DESIGN.thickness);
    }
  });

  it("seeds the other five from the uniform thickness, not from stale entries", () => {
    // `thicknessBy` is kept in step by the sidebar, but a design edited before
    // the override was ever switched on can carry an old set — and inheriting
    // those would change five faces nobody touched.
    const stale = { ...DEFAULT_DESIGN, thickness: 12, thicknessBy: { ...DEFAULT_DESIGN.thicknessBy, back: 30 } };
    const next = setFaceThickness(stale, "front", 25);
    expect(next.thicknessBy.back).toBe(12);
    expect(next.thicknessBy.front).toBe(25);
  });

  it("leaves an override already on exactly as it was", () => {
    const on = { ...DEFAULT_DESIGN, perFaceThickness: true, thicknessBy: { ...DEFAULT_DESIGN.thicknessBy, back: 30 } };
    expect(setFaceThickness(on, "front", 25).thicknessBy.back).toBe(30);
  });

  it("changes the cut list for that face and no other", () => {
    const before = derive(DEFAULT_DESIGN).rows;
    const after = derive(setFaceThickness(DEFAULT_DESIGN, "front", 25)).rows;
    const front = after.find((r) => r.face === "front" && r.layer === "shell");
    expect(front.thickness).toBe(25);
    // The other five are still the sheet. Their blanks move — a thicker front
    // pushes the box out — but nobody else got thicker.
    for (const r of after.filter((r) => r.face !== "front" && r.layer === "shell")) {
      expect(r.thickness).toBe(DEFAULT_DESIGN.thickness);
    }
    expect(before.length).toBe(after.length);
  });
});

describe("§21 one face's colour", () => {
  it("switches per-panel colour on and paints only that face", () => {
    const next = setFaceColour(DEFAULT_DESIGN, "top", "#548772");
    expect(next.perPanelColour).toBe(true);
    expect(next.colourBy.top).toBe("#548772");
    expect(Object.keys(next.colourBy)).toEqual(["top"]);
  });

  it("puts a face back to following the project without dropping the others", () => {
    // Null is a real answer — "as the project" follows the sheet when the sheet
    // changes, where painting it the project's current colour does not.
    const painted = setFaceColour(setFaceColour(DEFAULT_DESIGN, "top", "#548772"), "left", "#da646c");
    const cleared = setFaceColour(painted, "top", null);
    expect(cleared.colourBy.top).toBe(null);
    expect(cleared.colourBy.left).toBe("#da646c");
    expect(cleared.perPanelColour).toBe(true);
  });
});

describe("§21 the face's own edges", () => {
  it("is the four edges that face is one side of", () => {
    for (const face of FACES) {
      const edges = edgesOfFace(face);
      expect(edges).toHaveLength(4);
      for (const k of edges) expect(k.split("|")).toContain(face);
      // Named by the face across the corner, which is how you would point at it.
      expect(edges.map((k) => otherFace(k, face)).every(Boolean)).toBe(true);
      expect(new Set(edges.map((k) => otherFace(k, face))).size).toBe(4);
    }
    // Never its own opposite: the front and the back share no edge.
    expect(edgesOfFace("front").map((k) => otherFace(k, "front"))).not.toContain("back");
  });

  it("reads back what the design asks for, mitres included", () => {
    // `edgeMap` drops a mitre to square, because a mitre is a joint rather than
    // a decoration. A control on one edge has to show the mitre it was given.
    const mitred = { ...DEFAULT_DESIGN, edge: { ...DEFAULT_DESIGN.edge, perEdge: true, by: { "front|left": { type: "mitre" } } } };
    expect(authoredEdge(mitred, "front|left").type).toBe("mitre");
    // And a radius to offer even where nothing has been asked for, or switching
    // an edge from square to fillet offers a fillet of nothing.
    expect(authoredEdge(DEFAULT_DESIGN, "front|left")).toEqual({ type: "none", radius: DEFAULT_DESIGN.edge.radius });
  });

  it("shows the uniform treatment on every edge before anything is per-edge", () => {
    const filleted = { ...DEFAULT_DESIGN, edge: { ...DEFAULT_DESIGN.edge, type: "fillet", radius: 8 } };
    expect(authoredEdge(filleted, "front|left")).toEqual({ type: "fillet", radius: 8 });
  });
});

describe("§21 prominence, from the face rather than from the list", () => {
  it("moves the face one place and leaves the rest in order", () => {
    const next = moveFace(DEFAULT_DESIGN, "left", -1);
    expect(next.order.indexOf("left")).toBe(DEFAULT_DESIGN.order.indexOf("left") - 1);
    expect([...next.order].sort()).toEqual([...DEFAULT_DESIGN.order].sort());
  });

  it("will not push the most prominent face off the top", () => {
    const top = DEFAULT_DESIGN.order[0];
    expect(moveFace(DEFAULT_DESIGN, top, -1)).toBe(DEFAULT_DESIGN);
    expect(moveFace(DEFAULT_DESIGN, DEFAULT_DESIGN.order[5], 1)).toBe(DEFAULT_DESIGN);
  });

  it("names the order custom once it is no longer a preset", () => {
    expect(moveFace(DEFAULT_DESIGN, "left", -1).preset).toBe("custom");
    // And back again: a hand-made order that lands on a preset is that preset.
    expect(moveFace(moveFace(DEFAULT_DESIGN, "left", -1), "left", 1).preset).toBe(DEFAULT_DESIGN.preset);
  });
});

describe("§53 prominence from a doubler", () => {
  /** Open a face's carcass, add a doubler, and inspect the doubler. */
  const doubleFace = (face) => {
    fireEvent.click(screen.getByLabelText(`Open the ${face} carcass`));
    fireEvent.click(screen.getByRole("button", { name: "Add doubler" }));
  };

  it("shows the rank the panel is actually laid out by", () => {
    render(<App />);
    for (const f of ["Front", "Top"]) doubleFace(f);
    fireEvent.click(screen.getByLabelText("Close the panel inspector"));

    // Doublers of their own, ordered top first. The top doubler is rank 0 in
    // that order and rank 4 in the box's — and it is the doubler on screen.
    fireEvent.click(screen.getByRole("button", { name: "Their own order" }));
    fireEvent.change(screen.getByLabelText("Doubler preset"), { target: { value: "tb" } });

    fireEvent.click(screen.getByLabelText("Open the Top doubler"));
    const inspector = document.querySelector(".inspector");
    expect(within(inspector).getByText("Runs past all five")).toBeTruthy();

    // The carcass on the same face is still where the box's order puts it.
    fireEvent.click(screen.getByLabelText("Inspect the Top carcass"));
    expect(within(document.querySelector(".inspector")).getByText("Runs past 1, inside 4")).toBeTruthy();
  });

  it("moves the doubler in its own order, not the box's", () => {
    const { container } = render(<App />);
    for (const f of ["Front", "Top"]) doubleFace(f);
    fireEvent.click(screen.getByLabelText("Close the panel inspector"));
    fireEvent.click(screen.getByRole("button", { name: "Their own order" }));

    fireEvent.click(screen.getByLabelText("Open the Top doubler"));
    fireEvent.click(screen.getByLabelText("Raise Top"));

    // The box's order has not moved.
    expect([...container.querySelectorAll(".rank-summary.for-shell li")].map((li) => li.textContent))
      .toEqual(["Front", "Back", "Left", "Right", "Top", "Bottom"]);
    expect([...container.querySelectorAll(".rank-summary.for-doubler li")].map((li) => li.textContent))
      .toEqual(["Front", "Back", "Left", "Top", "Right", "Bottom"]);
  });

  it("moves the box's order while the doublers follow it", () => {
    // Moving a doubler that is laid out by the box's order *is* moving the
    // box's order — that is what following it means, and the alternative is a
    // button on the panel that does nothing to the panel.
    const { container } = render(<App />);
    doubleFace("Top");
    fireEvent.click(screen.getByLabelText("Close the panel inspector"));
    fireEvent.click(screen.getByLabelText("Open the Top doubler"));
    fireEvent.click(screen.getByLabelText("Raise Top"));

    expect([...container.querySelectorAll(".rank-summary.for-shell li")].map((li) => li.textContent))
      .toEqual(["Front", "Back", "Left", "Top", "Right", "Bottom"]);
    expect(container.querySelector(".rank-summary.for-doubler")).toBeNull();
  });
});

describe("§21 the inspector in the app", () => {
  it("opens on the selected panel and closes again", () => {
    const { container } = render(<App />);
    expect(container.querySelector(".inspector")).toBe(null);
    const inspector = selectFirstPanel(container);
    expect(inspector).toBeTruthy();
    expect(container.querySelector(".app").className).toContain("inspecting");

    fireEvent.click(screen.getByRole("button", { name: "Close the panel inspector" }));
    expect(container.querySelector(".inspector")).toBe(null);
    expect(container.querySelector(".app").className).not.toContain("inspecting");
  });

  it("adds a doubler to the face being looked at, and takes it away again", () => {
    const { container } = render(<App />);
    const inspector = selectFirstPanel(container);
    const face = inspector.getAttribute("aria-label").split(" ")[0];
    const parts = () => container.querySelectorAll("table.cuts tbody tr").length;
    const before = parts();

    fireEvent.click(within(inspector).getByRole("button", { name: /^Add doubler$/ }));
    expect(parts()).toBe(before + 1);
    // On that face, not on the box's default one.
    const added = [...container.querySelectorAll("table.cuts tbody tr")]
      .map((r) => r.textContent).filter((t) => t.includes("Doubler"));
    expect(added).toHaveLength(1);
    expect(added[0].toLowerCase()).toContain(face.toLowerCase());

    fireEvent.click(screen.getByRole("button", { name: new RegExp(`Remove the ${face} doubler`, "i") }));
    expect(parts()).toBe(before);
  });

  it("offers cladding as well, on the same face", () => {
    const { container } = render(<App />);
    const inspector = selectFirstPanel(container);
    fireEvent.click(within(inspector).getByRole("button", { name: /^Add cladding$/ }));
    const clad = [...container.querySelectorAll("table.cuts tbody tr")]
      .map((r) => r.textContent).filter((t) => t.includes("Cladding"));
    expect(clad).toHaveLength(1);
  });

  it("never offers to remove the carcass panel, which is the box", () => {
    const { container } = render(<App />);
    const inspector = selectFirstPanel(container);
    const face = inspector.getAttribute("aria-label").split(" ")[0];
    expect(screen.queryByRole("button", { name: new RegExp(`Remove the ${face} carcass`, "i") })).toBe(null);
  });

  it("changes that face's thickness from the panel itself", () => {
    const { container } = render(<App />);
    const inspector = selectFirstPanel(container);
    const face = inspector.getAttribute("aria-label").split(" ")[0];
    const field = within(inspector).getByLabelText(`${face} thickness`);
    fireEvent.change(field, { target: { value: "25" } });

    // Column 5 is thickness — read the cell, not the row: a row's text also
    // holds lengths and widths, and "25" turns up inside 425 without meaning it.
    const thicknessOf = (tr) => tr.querySelectorAll("td")[5].textContent;
    expect(thicknessOf(container.querySelector("table.cuts tbody tr.sel"))).toBe("25");
    // And the other carcass panels are still the project sheet.
    const others = [...container.querySelectorAll("table.cuts tbody tr")]
      .filter((r) => r.textContent.includes("Carcass") && !r.className.includes("sel"));
    expect(others).not.toHaveLength(0);
    for (const r of others) expect(thicknessOf(r)).not.toBe("25");
  });

  it("adds a fitting to the face being looked at", () => {
    const { container } = render(<App />);
    const inspector = selectFirstPanel(container);
    const face = inspector.getAttribute("aria-label").split(" ")[0].toLowerCase();
    const add = within(inspector).getByLabelText(new RegExp(`Add a fitting to the ${face}`, "i"));
    fireEvent.change(add, { target: { value: "driver" } });
    // It lands on this face, so it shows in this panel rather than only in the
    // sidebar's list of every fitting on the box.
    const shown = container.querySelectorAll(".inspector .fitting");
    expect(shown).toHaveLength(1);
    expect(shown[0].querySelector(".kind").textContent).toBe("Driver");
    // Set out on the face it was added to, not on the default one.
    expect(shown[0].querySelector(".on-face").textContent).toBe(
      face.charAt(0).toUpperCase() + face.slice(1));
  });

  it("steps to another layer on the same face without going back to the box", () => {
    const { container } = render(<App />);
    const inspector = selectFirstPanel(container);
    const face = inspector.getAttribute("aria-label").split(" ")[0];
    fireEvent.click(within(inspector).getByRole("button", { name: /^Add doubler$/ }));
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`Inspect the ${face} doubler`, "i") }));
    expect(container.querySelector(".inspector").getAttribute("aria-label"))
      .toBe(`${face} doubler panel`);
  });
});

/**
 * §47 The split: the sidebar is about the box, the inspector is about one
 * board, and nothing is in both.
 *
 * These are mostly negatives, which is unusual for a UI test and is the point:
 * what went wrong before was not that a control was missing but that the same
 * face could be changed in two places, and only one of them was in front of the
 * panel it changed.
 */
describe("§47 panel controls live in the inspector", () => {
  const sidebar = (container) => container.querySelector(".controls");

  it("keeps no panel-by-panel control in the sidebar", () => {
    const { container } = render(<App />);
    const side = sidebar(container);
    // The layer stacks, the rebate list and the fitting editors are gone from
    // it; each of them named a face before it could ask anything.
    expect(side.querySelector(".stack-list")).toBe(null);
    expect(side.querySelector(".fitting")).toBe(null);
    expect(side.querySelector(".rebate")).toBe(null);
    for (const label of ["Add cladding", "Add doublers", "Add lagging", "Add a rebate", "Add a fitting"]) {
      expect(screen.queryByLabelText(label), label).toBe(null);
    }
    // And no six-cell grid of thicknesses or colours.
    expect(side.querySelector(".face-grid")).toBe(null);
    expect(side.querySelector(".colour-grid")).toBe(null);
  });

  it("opens a board from the sidebar's summary of the box", () => {
    const { container } = render(<App />);
    expect(container.querySelector(".inspector")).toBe(null);
    fireEvent.click(screen.getByLabelText("Open the Left carcass"));
    expect(container.querySelector(".inspector").getAttribute("aria-label")).toBe("Left carcass panel");

    // A layer added from the inspector turns up in the summary, and the
    // summary opens it: the sidebar says what the box carries and the
    // inspector says what each board is.
    fireEvent.click(screen.getByRole("button", { name: /^Add doubler$/ }));
    expect(container.querySelector(".panel-summary").textContent).toMatch(/DoublerLeft/);
    fireEvent.click(screen.getByLabelText("Open the Left doubler"));
    expect(container.querySelector(".inspector").getAttribute("aria-label")).toBe("Left doubler panel");
  });

  it("says in the sidebar which face departs from the project sheet, and how to end it", () => {
    const { container } = render(<App />);
    const side = () => sidebar(container).textContent;
    expect(side()).not.toMatch(/Its own thickness/);

    fireEvent.click(screen.getByLabelText("Open the Top carcass"));
    fireEvent.change(screen.getByLabelText("Top thickness"), { target: { value: "25" } });
    expect(side()).toMatch(/Its own thickness: Top 25 mm/);

    // And the way back to a box cut from one sheet, which is the only thing
    // the sidebar can say about it that the panel cannot.
    fireEvent.click(screen.getByRole("button", { name: "Back to one thickness" }));
    expect(side()).not.toMatch(/Its own thickness/);
    fireEvent.click(screen.getByRole("button", { name: "Cut list & sheets" }));
    const thicknessOf = (tr) => tr.querySelectorAll("td")[5].textContent;
    for (const r of container.querySelectorAll("table.cuts tbody tr")) expect(thicknessOf(r)).toBe("18");
  });

  it("rebates the board being looked at, a side at a time", () => {
    const { container } = render(<App />);
    // Sides wrap, so the front can be let into them.
    const preset = [...container.querySelectorAll("label.field")]
      .find((l) => l.textContent.startsWith("Preset")).querySelector("select");
    fireEvent.change(preset, { target: { value: "sides" } });
    fireEvent.click(screen.getByLabelText("Open the Front carcass"));

    // No rebate to add first: the sides are the control, and choosing one is
    // what makes the panel a rebated panel.
    expect(screen.getByLabelText("Front rebate depth").disabled).toBe(true);
    fireEvent.click(screen.getByLabelText("Front rebate top"));
    expect(screen.getByLabelText("Front rebate depth").disabled).toBe(false);
    expect(container.querySelector(".rebate .note").textContent).toMatch(/Let in 6 mm on top/);

    // Depth is kept when another side is added, and the last side off takes
    // the rebate with it.
    fireEvent.change(screen.getByLabelText("Front rebate depth"), { target: { value: "8" } });
    fireEvent.click(screen.getByLabelText("Front rebate bottom"));
    expect(container.querySelector(".rebate .note").textContent).toMatch(/Let in 8 mm on top, bottom/);
    // "All" fills the sides in while any is missing, and clears them once
    // they are all on — so two clicks from here empties it.
    fireEvent.click(screen.getByLabelText("Front rebate all sides"));
    expect(container.querySelector(".rebate .note").textContent)
      .toMatch(/Let in 8 mm on left, right, top, bottom/);
    fireEvent.click(screen.getByLabelText("Front rebate all sides"));
    expect(container.querySelector(".rebate .note").textContent).toMatch(/No sides chosen/);
    expect(container.querySelector(".panel-summary").textContent).toMatch(/RebatedNone/);
  });

  it("offers no rebate on a lining, and says why", () => {
    const { container } = render(<App />);
    fireEvent.click(screen.getByLabelText("Open the Back carcass"));
    fireEvent.click(screen.getByRole("button", { name: /^Add lagging$/ }));
    fireEvent.click(screen.getByLabelText("Open the Back lagging"));
    const inspector = container.querySelector(".inspector");
    expect(inspector.textContent).toMatch(/A lining is not a board/);
    expect(within(inspector).queryByLabelText(/rebate all sides/)).toBe(null);
  });

  it("offers a lining the linings to be cut from, not the sheets", () => {
    // §30 The lagging stack chose off the roll goods; the inspector's sheet
    // picker offered birch ply to a face lined in felt until this moved here.
    const { container } = render(<App />);
    fireEvent.click(screen.getByLabelText("Open the Back carcass"));
    fireEvent.click(screen.getByRole("button", { name: /^Add lagging$/ }));
    fireEvent.click(screen.getByLabelText("Open the Back lagging"));
    const options = [...within(container.querySelector(".inspector"))
      .getByLabelText("Lagging Back material").options].map((o) => o.value);
    expect(options).toContain("wadding");
    expect(options).not.toContain("birch");
  });
});

/**
 * §21 The stylesheet, on the two points that made a field unreadable.
 *
 * Reported as "the fittings panel is a bit tight — the numbers are not
 * visible", and it was worse than tight: every number input in the inspector
 * showed nothing at all. Two causes, and neither is reachable from jsdom, which
 * does no layout — so this reads the stylesheet and checks the two rules that
 * have to hold. Brittle in the way a CSS test is, and worth it for a fault that
 * empties a control without emptying its value.
 */
describe("§21 the fitting fields have room for their numbers", () => {
  // From the project root: under jsdom `import.meta.url` is not a file URL.
  const css = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");
  const at = (selector) => css.indexOf(selector);

  it("gives the inspector's fitting grid one column, not two", () => {
    // 300 px, less a group's padding, is 127 px a column — and a number input
    // spends 33 px of its own width on padding before a digit is drawn.
    expect(css).toMatch(/\.inspector \.fitting-grid \{[^}]*grid-template-columns:\s*1fr\s*[;}]/);
  });

  it("puts the fitting label back to its narrow width, after the wider rule", () => {
    // The whole bug: `.inspector .field` and `.fitting-grid .field` have the
    // same specificity, so the later one wins. The inspector's wider label was
    // later, and it took 22 px off every fitting input in the panel.
    const wide = at(".inspector .field {");
    const narrow = at(".inspector .fitting-grid .field {");
    expect(wide).toBeGreaterThan(-1);
    expect(narrow).toBeGreaterThan(wide);
  });

  it("hides the number spinner, which is where the suffix is drawn", () => {
    // About 7 px inside the content box, on a control that overlays its own
    // "mm" there. It is what turned 163.5 into "163." in the sidebar.
    expect(css).toMatch(/input\[type="number"\]::-webkit-inner-spin-button/);
    expect(css).toMatch(/appearance:\s*textfield/);
  });
});
