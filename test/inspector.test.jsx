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
