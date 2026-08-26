/** §9.7 Drive the app: mount it in jsdom, stub WebGLRenderer, click through the
 *  modes and change inputs, and assert nothing falls over. */
import React from "react";
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
import { ACCENT, REBATE } from "../src/three/palette.js";

beforeAll(() => {
  global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  Element.prototype.setPointerCapture = () => {};
  global.URL.createObjectURL = () => "blob:stub";
  global.URL.revokeObjectURL = () => {};
});

afterEach(cleanup);

// §13 The design lives in storage now, so every test starts from a fresh
// browser rather than from whatever the last one left behind.
beforeEach(() => localStorage.clear());

const errors = [];
const originalError = console.error;
console.error = (...a) => { errors.push(a.join(" ")); originalError(...a); };

describe("the app", () => {
  it("mounts, shows the three modes and fires no React errors", () => {
    errors.length = 0;
    render(<App />);
    for (const name of ["3D view", "Cut list & sheets", "Drawing"])
      expect(screen.getByRole("button", { name })).toBeTruthy();
    expect(errors).toEqual([]);
  });

  it("moves between modes and keeps the viewport mounted", () => {
    const { container } = render(<App />);
    const viewport = container.querySelector(".viewport");
    expect(viewport).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Cut list & sheets" }));
    expect(container.querySelector(".pane-cuts")).toBeTruthy();
    // The camera survives: the viewport is hidden, not unmounted.
    expect(container.querySelector(".viewport")).toBe(viewport);
    expect(container.querySelector(".pane-view").className).toContain("hidden");

    fireEvent.click(screen.getByRole("button", { name: "Drawing" }));
    expect(container.querySelector(".pane-drawing svg")).toBeTruthy();
    expect(container.querySelector(".viewport")).toBe(viewport);
  });

  it("updates the cut list and the drawing when an input changes", () => {
    const { container } = render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Cut list & sheets" }));
    const before = [...container.querySelectorAll("table.cuts tbody tr")].map((r) => r.textContent);

    fireEvent.change(screen.getByLabelText("Volume"), { target: { value: "40" } });
    const after = [...container.querySelectorAll("table.cuts tbody tr")].map((r) => r.textContent);
    expect(after).not.toEqual(before);
    expect(after).toHaveLength(before.length);

    fireEvent.click(screen.getByRole("button", { name: "Drawing" }));
    const svg = container.querySelector(".sheet-holder").innerHTML;
    expect(svg).toContain("FRONT ELEVATION");
    expect(svg).toContain("SECTION A–A");
  });

  it("keeps the six-face order folded away behind the preset", () => {
    const { container } = render(<App />);
    expect(container.querySelector(".prominence")).toBeNull();
    // The summary still says what the order is.
    expect([...container.querySelectorAll(".rank-summary li")].map((li) => li.textContent))
      .toEqual(["Front", "Back", "Left", "Right", "Top", "Bottom"]);

    fireEvent.click(screen.getByRole("button", { name: "Override the order…" }));
    expect(container.querySelectorAll(".prominence li")).toHaveLength(6);
    expect(container.querySelector(".rank-summary")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Hide the order" }));
    expect(container.querySelector(".prominence")).toBeNull();
  });

  it("follows the preset in the summary", () => {
    const { container } = render(<App />);
    fireEvent.change(screen.getByLabelText("Preset"), { target: { value: "baffle" } });
    expect([...container.querySelectorAll(".rank-summary li")].map((li) => li.textContent))
      .toEqual(["Front", "Left", "Right", "Bottom", "Back", "Top"]);
  });

  it("marks a hand-made order Custom and keeps it visible when folded", () => {
    const { container } = render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Override the order…" }));
    fireEvent.click(screen.getByLabelText("Raise Left"));
    expect(screen.getByLabelText("Preset").value).toBe("custom");

    fireEvent.click(screen.getByRole("button", { name: "Hide the order" }));
    expect([...container.querySelectorAll(".rank-summary li")].map((li) => li.textContent))
      .toEqual(["Front", "Left", "Back", "Right", "Top", "Bottom"]);
  });

  it("changes every panel size and no internal dimension when prominence is reordered", () => {
    const { container } = render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Cut list & sheets" }));
    const sizes = () => [...container.querySelectorAll("table.cuts tbody tr")]
      .map((r) => [...r.querySelectorAll(".num")].slice(0, 2).map((c) => c.textContent).join("×")).sort();
    const before = sizes();
    const internalBefore = readout(container, "Internal");

    fireEvent.change(screen.getByLabelText("Preset"), { target: { value: "sides" } });
    expect(sizes()).not.toEqual(before);
    expect(readout(container, "Internal")).toBe(internalBefore);
  });

  it("§16 rounds the sizes to whole millimetres, and back again on request", () => {
    const { container } = render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Cut list & sheets" }));
    const sizes = () => [...container.querySelectorAll("table.cuts tbody tr")]
      .flatMap((r) => [...r.querySelectorAll(".num")].slice(0, 2).map((c) => c.textContent));

    // The default: nothing a person has to read a decimal point off.
    expect(sizes().every((v) => /^\d+$/.test(v))).toBe(true);

    fireEvent.change(screen.getByLabelText("Round sizes to"), { target: { value: "0.1" } });
    expect(sizes().some((v) => v.includes("."))).toBe(true);

    // And it is the envelope that moved, not the panels against each other.
    expect(within(container.querySelector(".totals")).getByText("exact")).toBeTruthy();
  });

  it("§16 pays for a round size in capacity, by a little", () => {
    const { container } = render(<App />);
    const litres = () => Number(readout(container, "Cavity").replace(" l", ""));
    fireEvent.change(screen.getByLabelText("Round sizes to"), { target: { value: "0.1" } });
    const exact = litres();

    fireEvent.change(screen.getByLabelText("Round sizes to"), { target: { value: "10" } });
    expect(Math.abs(litres() - exact)).toBeGreaterThan(0);
    expect(Math.abs(litres() - exact)).toBeLessThan(0.5);
    expect(readout(container, "Envelope").split(" × ").every((v) => Number(v) % 10 === 0)).toBe(true);
  });

  it("§18 colours the sheet from its own range, and one panel apart from it", () => {
    const { container } = render(<App />);
    fireEvent.change(screen.getByLabelText("Stock").closest(".group").querySelector("select"),
      { target: { value: "valchromat" } });

    // Valchromat is the one sheet with names for its colours.
    const named = screen.getByLabelText("Sheet colour name");
    expect([...named.options].map((o) => o.text)).toContain("Green Mint");
    fireEvent.change(named, { target: { value: "#548772" } });

    fireEvent.click(screen.getByLabelText("Colour per panel"));
    fireEvent.change(screen.getByLabelText("Front colour name"), { target: { value: "#da646c" } });

    // The part templates are drawn in whichever colouring is on, so with
    // material colouring they are drawn in the colours the panels are made of.
    fireEvent.click(screen.getByRole("button", { name: "Material" }));
    fireEvent.click(screen.getByRole("button", { name: "Cut list & sheets" }));
    const fills = [...container.querySelectorAll(".parts figure svg > rect")]
      .map((e) => e.getAttribute("fill"));
    expect(fills).toContain("#548772");              // Green Mint, five panels
    expect(fills).toContain("#da646c");              // Red, the front
    expect(fills.filter((f) => f === "#548772")).toHaveLength(5);
  });

  it("§18 drops the colours when the sheet changes, rather than keeping a stale one", () => {
    const { container } = render(<App />);
    const sheetSelect = screen.getByLabelText("Stock").closest(".group").querySelector("select");
    fireEvent.change(sheetSelect, { target: { value: "valchromat" } });
    fireEvent.change(screen.getByLabelText("Sheet colour name"), { target: { value: "#da646c" } });
    expect(screen.getByLabelText("Sheet colour").value).toBe("#da646c");

    fireEvent.change(sheetSelect, { target: { value: "birch" } });
    // Birch ply does not come in red, and the picker says so by showing birch.
    expect(screen.getByLabelText("Sheet colour").value).toBe("#e0c48c");
    expect(container.querySelector("[aria-label='Sheet colour name']")).toBe(null);
  });

  it("reports an error when the walls meet", () => {
    const { container } = render(<App />);
    // On an internal basis the envelope grows to keep the cavity, so the walls
    // can only meet when the outside is what is fixed.
    fireEvent.click(screen.getByRole("button", { name: "External" }));
    fireEvent.click(screen.getByRole("button", { name: "Dimensions" }));
    fireEvent.change(screen.getByLabelText("Thickness"), { target: { value: "200" } });
    expect(container.querySelector(".messages .error").textContent).toMatch(/Internal (width|depth|height)/);
  });

  it("§26 will not take a radius bigger than the wall it would be cut from", () => {
    // It used to take it, call it an error, and send it to the kernel anyway —
    // where OCCT refused the shape and threw, and the whole box was lost for
    // one edge. Now the number cannot be entered: 40 on an 18 mm wall becomes
    // 17.5, the largest that still leaves material behind the fillet (§26).
    const { container } = render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Fillet" }));
    const radius = screen.getByLabelText("Radius");
    fireEvent.change(radius, { target: { value: "40" } });
    expect(Number(radius.value)).toBe(17.5);
    // And nothing is wrong, because nothing impossible was asked for.
    expect(container.querySelector(".messages .error")).toBe(null);
  });

  it("§26 still says so if a design arrives carrying one", () => {
    // The cap is on the control; a design saved before it existed, or edited
    // by hand, can still hold a radius the wall will not take. That one is
    // dropped before the kernel sees it and the message says why — judged on
    // what was asked for rather than on what survived.
    localStorage.setItem("sheet-box-designer/design/1", JSON.stringify({
      edge: { type: "fillet", radius: 40, perEdge: false, by: {} },
    }));
    const { container } = render(<App />);
    expect(container.querySelector(".messages .error").textContent).toContain("cuts through");
  });

  it("carries the face swatch into the cut list, and drops it when face colouring is off", () => {
    const { container } = render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Cut list & sheets" }));
    expect(container.querySelectorAll("table.cuts .swatch").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "3D view" }));
    fireEvent.click(screen.getByRole("button", { name: "Material" }));
    fireEvent.click(screen.getByRole("button", { name: "Cut list & sheets" }));
    expect(container.querySelectorAll("table.cuts .swatch")).toHaveLength(0);
    expect(container.querySelectorAll(".prominence .swatch")).toHaveLength(0);
  });

  it("selects a part from the cut list and shows it in the 3D view", () => {
    const { container } = render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Cut list & sheets" }));
    const first = container.querySelector("table.cuts tbody tr");
    fireEvent.click(first);
    expect(first.className).toContain("sel");
    fireEvent.click(screen.getByRole("button", { name: "3D view" }));
    expect(container.querySelector(".selection").textContent).toContain("P01");
  });

  it("cycles the render styles and the view presets without error", () => {
    errors.length = 0;
    const { container } = render(<App />);
    for (const s of ["Shaded", "Wireframe", "Wireframe, hidden removed", "Shaded + hidden edges"])
      fireEvent.click(screen.getByRole("button", { name: s }));
    for (const p of ["iso", "front", "top", "right"])
      fireEvent.click(screen.getByRole("button", { name: p }));
    fireEvent.change(container.querySelector("#explode"), { target: { value: "60" } });
    expect(errors).toEqual([]);
  });

  it("switches the starting point between dimensions and volume", () => {
    const { container } = render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Dimensions" }));
    fireEvent.change(screen.getByLabelText("Width"), { target: { value: "500" } });
    expect(readout(container, "Envelope")).toContain("536");   // 500 internal + 2 × 18
    fireEvent.click(screen.getByRole("button", { name: "External" }));
    expect(readout(container, "Envelope")).toContain("500");
  });

  it("adds a cladding side from the dropdown, inheriting the project sheet", () => {
    const { container } = render(<App />);
    expect(container.querySelectorAll(".stack-list li")).toHaveLength(0);

    fireEvent.change(screen.getByLabelText("Add cladding"), { target: { value: "front" } });
    const row = container.querySelector(".stack-list li");
    expect(row.textContent).toContain("Front");
    expect(screen.getByLabelText("Cladding Front thickness").value).toBe("18");
    expect(screen.getByLabelText("Cladding Front material").value).toBe("birch");

    // ...and the box grows by the cladding, since the basis is internal.
    fireEvent.click(screen.getByRole("button", { name: "Cut list & sheets" }));
    expect([...container.querySelectorAll("table.cuts tbody tr")]
      .some((r) => r.textContent.includes("Cladding"))).toBe(true);
  });

  it("changes an added panel to another sheet and separates it in the layouts", () => {
    const { container } = render(<App />);
    fireEvent.change(screen.getByLabelText("Add cladding"), { target: { value: "front" } });
    fireEvent.change(screen.getByLabelText("Cladding Front material"), { target: { value: "valchromat" } });
    // Valchromat is 19 mm as standard.
    expect(screen.getByLabelText("Cladding Front thickness").value).toBe("19");

    fireEvent.change(screen.getByLabelText("Cladding Front thickness"), { target: { value: "25" } });
    fireEvent.click(screen.getByRole("button", { name: "Cut list & sheets" }));
    const cells = [...container.querySelectorAll("table.cuts tbody tr")].map((r) => r.textContent);
    expect(cells.some((t) => t.includes("Valchromat") && t.includes("25"))).toBe(true);
    expect(container.querySelectorAll(".sheet")).toHaveLength(2);
    expect(container.querySelector(".by-material")).toBeTruthy();
  });

  it("removes an added side", () => {
    const { container } = render(<App />);
    fireEvent.change(screen.getByLabelText("Add doublers"), { target: { value: "back" } });
    expect(container.querySelectorAll(".stack-list li")).toHaveLength(1);
    fireEvent.click(screen.getByLabelText("Remove Doublers Back"));
    expect(container.querySelectorAll(".stack-list li")).toHaveLength(0);
  });

  it("moves the carcass to a new sheet's standard thickness", () => {
    render(<App />);
    expect(screen.getByLabelText("Thickness").value).toBe("18");
    fireEvent.change(screen.getByLabelText("Sheet"), { target: { value: "valchromat" } });
    expect(screen.getByLabelText("Thickness").value).toBe("19");
  });

  it("§12 mitres one edge from the per-edge control, and says so in the cut list", () => {
    const { container } = render(<App />);
    fireEvent.click(screen.getByLabelText("Per edge"));
    // §15 The list holds what has been done to the box, so an edge is added to
    // it before it can be given anything — from here, or by clicking it in 3D.
    fireEvent.change(screen.getByLabelText("Add an edge treatment"), { target: { value: "front|left" } });
    const select = screen.getByLabelText("front|left treatment");
    expect([...select.options].find((o) => o.value === "mitre").disabled).toBe(false);
    fireEvent.change(select, { target: { value: "mitre" } });

    fireEvent.click(screen.getByRole("button", { name: "Cut list & sheets" }));
    expect(container.textContent).toContain("45°");
    expect(within(container.querySelector(".totals")).getByText("exact")).toBeTruthy();
  });

  it("§12 will not offer a mitre on an edge the panels cannot both run", () => {
    render(<App />);
    fireEvent.click(screen.getByLabelText("Per edge"));
    const blocked = ["front|top", "front|bottom", "back|top", "back|bottom"]
      .map((k) => {
        fireEvent.change(screen.getByLabelText("Add an edge treatment"), { target: { value: k } });
        return screen.getByLabelText(`${k} treatment`);
      })
      .filter((s) => [...s.options].find((o) => o.value === "mitre").disabled);
    expect(blocked.length).toBeGreaterThan(0);
  });

  it("§15 arms an edge tool from the viewport, and lists only what has been done", () => {
    const { container } = render(<App />);
    fireEvent.click(screen.getByLabelText("Per edge"));
    // Twelve rows of "Square" was a list of everything that could happen, which
    // is a list of nothing.
    expect(container.querySelectorAll(".edge-row")).toHaveLength(0);
    expect(container.querySelector(".edge-grid")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Fillet an edge" }));
    expect(container.querySelector(".edge-arm").textContent).toContain("click an edge");
    // Armed is a state of the pointer, not of the box: nothing is cut yet.
    expect(container.querySelectorAll(".edge-row")).toHaveLength(0);

    fireEvent.change(screen.getByLabelText("Add an edge treatment"), { target: { value: "front|left" } });
    expect(container.querySelectorAll(".edge-row")).toHaveLength(1);
    expect(screen.getByLabelText("front|left treatment").value).toBe("fillet");

    fireEvent.click(screen.getByLabelText("Square front|left"));
    expect(container.querySelectorAll(".edge-row")).toHaveLength(0);
  });

  it("§10 turns a port's tube off from the control", () => {
    const { container } = render(<App />);
    fireEvent.change(screen.getByLabelText("Add a fitting"), { target: { value: "port" } });
    expect(container.textContent).toContain("× 150");

    fireEvent.click(screen.getByLabelText("Fitting 1 tube"));
    expect(container.textContent).toContain("no tube");
    // Its length is not a number that means anything any more.
    expect(screen.getByLabelText("Fitting 1 length").disabled).toBe(true);
  });

  it("§28 names the driver's displacement for what it is, not Vd", () => {
    // Vd is Sd × Xmax — the air the cone sweeps while it works. What comes out
    // of the box's capacity is the driver's body standing still in it. The
    // field carried the wrong name briefly; this is here so it cannot again.
    const { container } = render(<App />);
    fireEvent.change(screen.getByLabelText("Add a fitting"), { target: { value: "driver" } });

    const field = screen.getByLabelText("Fitting 1 displaces").closest(".field");
    expect(field.textContent).toContain("Displaces");
    expect(field.textContent).not.toMatch(/\bVd\b/);
    // Estimated until a figure is given, and said so.
    expect(field.textContent).toContain("est.");

    fireEvent.change(screen.getByLabelText("Fitting 1 displaces"), { target: { value: "0.18" } });
    expect(field.textContent).not.toContain("est.");
    expect(readout(container, "Net")).not.toContain("≥");
  });

  it("§29 flares the back of a cutout from the fitting's own controls", () => {
    const { container } = render(<App />);
    fireEvent.change(screen.getByLabelText("Add a fitting"), { target: { value: "driver" } });

    // Square to begin with, and the radius has nothing to act on.
    const radius = screen.getByLabelText("Fitting 1 flare");
    expect(radius.disabled).toBe(true);
    expect(container.querySelector(".fitting .note").textContent).not.toContain("inside");

    fireEvent.click(within(container.querySelector(".fitting-flare")).getByRole("button", { name: "Fillet" }));
    expect(screen.getByLabelText("Fitting 1 flare").disabled).toBe(false);
    expect(container.querySelector(".fitting .note").textContent).toContain("fillet inside");

    // §36 The cap is the panel's thickness, and it is enforced rather than
    // merely declared: a radius typed past it comes back at it.
    fireEvent.change(screen.getByLabelText("Fitting 1 flare"), { target: { value: "40" } });
    expect(Number(screen.getByLabelText("Fitting 1 flare").value)).toBe(18);

    fireEvent.click(within(container.querySelector(".fitting-flare")).getByRole("button", { name: "Square" }));
    expect(container.querySelector(".fitting .note").textContent).not.toContain("inside");
  });

  it("§30 lines a face with lagging from the sidebar, chosen off the linings", () => {
    const { container } = render(<App />);
    const before = container.querySelector(".modes .stat").textContent;

    fireEvent.change(screen.getByLabelText("Add lagging"), { target: { value: "back" } });
    expect(screen.getByLabelText("Lagging Back thickness").value).toBe("10");
    expect(screen.getByLabelText("Lagging Back material").value).toBe("felt");
    // The lining list, not the sheet list: no birch ply in it.
    const options = [...screen.getByLabelText("Lagging Back material").options].map((o) => o.value);
    expect(options).toContain("wadding");
    expect(options).not.toContain("birch");

    // Sized to a volume, so lining it grows the box by the lining.
    expect(container.querySelector(".modes .stat").textContent).not.toBe(before);
    fireEvent.click(screen.getByRole("button", { name: "Cut list & sheets" }));
    expect([...container.querySelectorAll("table.cuts tbody tr")]
      .some((r) => r.textContent.includes("Lagging"))).toBe(true);
  });

  it("§31 offers the whole set of driver dimensions, filled in rather than blank", () => {
    const { container } = render(<App />);
    fireEvent.change(screen.getByLabelText("Add a fitting"), { target: { value: "driver" } });

    // Every one shows the figure the app would use, so a datasheet is typed
    // over a number rather than into a gap.
    for (const [label, value] of [
      ["Fitting 1 thick", 6], ["Fitting 1 basket", 115], ["Fitting 1 vc", 34.8],
    ]) {
      expect(Number(screen.getByLabelText(label).value)).toBeCloseTo(value, 1);
    }

    // A basket that will not pass its cutout is said, not silently drawn.
    fireEvent.change(screen.getByLabelText("Fitting 1 basket"), { target: { value: "130" } });
    expect(container.textContent).toMatch(/will not pass a ⌀116 cutout/);
    fireEvent.change(screen.getByLabelText("Fitting 1 basket"), { target: { value: "110" } });
    expect(container.textContent).not.toMatch(/will not pass/);
  });

  it("§32 turns the section and the insulation off from the sidebar", () => {
    const { container } = render(<App />);
    fireEvent.change(screen.getByLabelText("Add lagging"), { target: { value: "back" } });
    fireEvent.click(screen.getByRole("button", { name: "Drawing" }));

    const sheet = () => container.querySelector(".sheet-holder").innerHTML;
    expect(sheet()).toMatch(/SECTION A–A/);
    expect(sheet()).toMatch(/url\(#hatch-lagging\)/);

    fireEvent.click(screen.getByLabelText("Acoustic insulation"));
    expect(sheet()).not.toMatch(/url\(#hatch-lagging\)/);
    expect(sheet()).toMatch(/SECTION A–A/);

    fireEvent.click(screen.getByLabelText("Section A–A"));
    expect(sheet()).not.toMatch(/SECTION A–A/);
    // The section's own controls have nothing to act on with it off.
    expect(screen.getByLabelText("Section at x").disabled).toBe(true);
  });

  it("§33 puts the bolt holes in the baffle and the cutout through the doubler", () => {
    const { container } = render(<App />);
    fireEvent.change(screen.getByLabelText("Add doublers"), { target: { value: "front" } });
    fireEvent.change(screen.getByLabelText("Add a fitting"), { target: { value: "driver" } });

    // Two layers on the face, so there is a depth to choose. Both start at all.
    expect(screen.getByLabelText("Fitting 1 through").value).toBe("all");
    expect(screen.getByLabelText("Fitting 1 boltsThrough").value).toBe("all");

    fireEvent.change(screen.getByLabelText("Fitting 1 boltsThrough"), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "Cut list & sheets" }));
    // The part templates carry each panel's own note. The carcass baffle keeps
    // its ring of holes; the doubler behind it is bored and bare.
    const notes = [...container.querySelectorAll("figcaption")]
      .map((el) => el.textContent).filter((t) => /Driver/.test(t));
    expect(notes).toHaveLength(2);
    expect(notes.filter((t) => /5 × ⌀5 on 147 PCD/.test(t))).toHaveLength(1);
    expect(notes.filter((t) => /cutout only/.test(t))).toHaveLength(1);
  });

  it("§33 offers no depth to choose when the face is one panel thick", () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText("Add a fitting"), { target: { value: "driver" } });
    expect(screen.queryByLabelText("Fitting 1 through")).toBe(null);
    expect(screen.queryByLabelText("Fitting 1 boltsThrough")).toBe(null);
  });

  it("§36 gives the whole panel to a flare, and says when it opens into the bolts", () => {
    const { container } = render(<App />);
    fireEvent.change(screen.getByLabelText("Add doublers"), { target: { value: "front" } });
    fireEvent.change(screen.getByLabelText("Add a fitting"), { target: { value: "driver" } });
    fireEvent.click(within(container.querySelector(".fitting-flare")).getByRole("button", { name: "Fillet" }));

    // The thickness is the only limit now, bolt holes or no bolt holes.
    const note = () => container.querySelector(".flare-note").textContent;
    fireEvent.change(screen.getByLabelText("Fitting 1 flare"), { target: { value: "18" } });
    expect(Number(screen.getByLabelText("Fitting 1 flare").value)).toBe(18);
    expect(note()).toMatch(/full thickness of the doubler/);
    expect(container.querySelector(".fitting .note").textContent).toMatch(/R18 fillet inside/);

    // It opens well past the bolt circle at that size, and both the control
    // and the messages say so rather than the app quietly preventing it.
    expect(note()).toMatch(/opens out into the bolt holes/);
    expect(container.textContent).toMatch(/breaks into the ⌀5 bolt holes at 147 PCD/);

    // Back inside the bolt circle and neither says anything.
    fireEvent.change(screen.getByLabelText("Fitting 1 flare"), { target: { value: "10" } });
    expect(note()).not.toMatch(/opens out/);
    expect(container.textContent).not.toMatch(/breaks into/);
  });

  it("§36 drills the bolt holes to a depth, and stops them where it runs out", () => {
    const { container } = render(<App />);
    fireEvent.change(screen.getByLabelText("Add doublers"), { target: { value: "front" } });
    fireEvent.change(screen.getByLabelText("Add a fitting"), { target: { value: "driver" } });

    // Offered filled in with a hole that goes right through both panels.
    expect(Number(screen.getByLabelText("Fitting 1 boltDeep").value)).toBe(36);

    // Shallower than the baffle: the doubler behind it gets no bolt holes.
    fireEvent.change(screen.getByLabelText("Fitting 1 boltDeep"), { target: { value: "12" } });
    fireEvent.click(screen.getByRole("button", { name: "Cut list & sheets" }));
    const notes = [...container.querySelectorAll("figcaption")]
      .map((el) => el.textContent).filter((t) => /Driver/.test(t));
    expect(notes.filter((t) => /5 × ⌀5 on 147 PCD/.test(t))).toHaveLength(1);
    expect(notes.filter((t) => /cutout only/.test(t))).toHaveLength(1);
  });

  it("§13 keeps the design across a reload, and lets you get rid of it", () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText("Thickness"), { target: { value: "21" } });
    cleanup();

    // A fresh App is a reload: same storage, same design.
    render(<App />);
    expect(screen.getByLabelText("Thickness").value).toBe("21");

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByLabelText("Thickness").value).toBe("18");
    cleanup();
    render(<App />);
    expect(screen.getByLabelText("Thickness").value).toBe("18");
  });

  it("§37 dimensions every interior on the drawing, not just the innermost", () => {
    const { container } = render(<App />);
    const sheet = () => {
      fireEvent.click(screen.getByRole("button", { name: "Drawing" }));
      return container.querySelector(".sheet-holder").innerHTML;
    };
    const brackets = (svg) => [...svg.matchAll(/>\((\d+(?:\.\d+)?)\)</g)].map((m) => Number(m[1]));

    // A plain carcass: one interior, so one bracketed size per axis, plus the
    // section's repeat of the internal height.
    const plain = brackets(sheet());
    expect(new Set(plain).size).toBe(3);

    for (const f of ["front", "back"]) {
      fireEvent.change(screen.getByLabelText("Add cladding"), { target: { value: f } });
      fireEvent.change(screen.getByLabelText("Add doublers"), { target: { value: f } });
      fireEvent.change(screen.getByLabelText("Add lagging"), { target: { value: f } });
    }

    // Those three layers all take from the depth, so the end view now carries
    // four nested reference dimensions where it carried one.
    const lined = brackets(sheet());
    expect(lined.length).toBeGreaterThan(plain.length);
    const depths = [...new Set(lined)].filter((v) => !plain.includes(v));
    expect(depths.length).toBeGreaterThanOrEqual(3);
    // Each is smaller than the overall depth the box reports.
    const overall = Number(readout(container, "Envelope").split("×")[1]);
    for (const d of depths) expect(d).toBeLessThan(overall);
  });

  it("§38 explodes the drawing's isometric from a slider", () => {
    const { container } = render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Drawing" }));
    const sheet = () => container.querySelector(".sheet-holder").innerHTML;
    const iso = () => {
      const svg = sheet();
      const at = svg.indexOf('<g data-view="iso">');
      return svg.slice(at, svg.indexOf("</g>", at));
    };
    const before = iso();
    const slider = screen.getByLabelText("Explode isometric");
    expect(slider.value).toBe("0");

    fireEvent.change(slider, { target: { value: "60" } });
    expect(screen.getByLabelText("Explode isometric").value).toBe("60");
    expect(iso()).not.toBe(before);
    // Same panels, further apart: one filled face per visible side of each.
    const fills = (svg) => svg.match(/fill="var\(--paper\)"/g)?.length ?? 0;
    expect(fills(iso())).toBe(fills(before));

    fireEvent.change(slider, { target: { value: "0" } });
    expect(iso()).toBe(before);
  });

  it("§42 rebates a panel into the ones around it, from the sidebar", () => {
    const { container } = render(<App />);
    // A let-in baffle needs the sides to wrap, or there is nothing to let it
    // into — and the control says exactly that when there is not.
    fireEvent.change(screen.getByLabelText("Add a rebate"), { target: { value: "front" } });
    expect(container.querySelector(".rebate .note").textContent).toMatch(/No sides chosen/);

    fireEvent.click(screen.getByLabelText("Front rebate all sides"));
    expect(container.querySelector(".rebate .note").textContent).toMatch(/prominence order/);

    const preset = [...container.querySelectorAll("label.field")]
      .find((l) => l.textContent.startsWith("Preset")).querySelector("select");
    fireEvent.change(preset, { target: { value: "sides" } });
    expect(container.querySelector(".rebate .note").textContent)
      .toMatch(/Let in 6 mm on left, right, top, bottom/);

    // The board that is let in is bigger; the ones it goes into carry a note
    // and keep their size, and the box still closes.
    fireEvent.click(screen.getByRole("button", { name: "Cut list & sheets" }));
    const notes = [...container.querySelectorAll("figcaption")]
      .map((el) => el.textContent).filter((t) => /Rebate/.test(t));
    expect(notes).toHaveLength(4);
    expect(notes[0]).toMatch(/Rebate 6 × 18/);
    expect(within(container.querySelector(".totals")).getByText("exact")).toBeTruthy();
  });

  it("§42 changes the depth, and takes the rebate away again", () => {
    const { container } = render(<App />);
    const preset = [...container.querySelectorAll("label.field")]
      .find((l) => l.textContent.startsWith("Preset")).querySelector("select");
    fireEvent.change(preset, { target: { value: "sides" } });
    fireEvent.change(screen.getByLabelText("Add a rebate"), { target: { value: "front" } });
    fireEvent.click(screen.getByLabelText("Front rebate left"));
    fireEvent.change(screen.getByLabelText("Front rebate depth"), { target: { value: "9" } });
    expect(container.querySelector(".rebate .note").textContent).toMatch(/Let in 9 mm on left/);

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(container.querySelector(".rebate")).toBe(null);
    expect(screen.getByLabelText("Add a rebate").value).toBe("");
  });

  it("§45 shows the rebate in the cut list and on the flat drawings", () => {
    const { container } = render(<App />);
    const preset = [...container.querySelectorAll("label.field")]
      .find((l) => l.textContent.startsWith("Preset")).querySelector("select");
    fireEvent.change(preset, { target: { value: "sides" } });
    fireEvent.change(screen.getByLabelText("Add a rebate"), { target: { value: "front" } });
    fireEvent.click(screen.getByLabelText("Front rebate all sides"));
    fireEvent.click(screen.getByRole("button", { name: "Cut list & sheets" }));

    // A column of its own, filled in for the four boards that carry a groove
    // and blank for the two that do not.
    const head = [...container.querySelectorAll("table.cuts thead th")].map((t) => t.textContent);
    expect(head).toContain("Rebate");
    const at = head.indexOf("Rebate");
    const cells = [...container.querySelectorAll("table.cuts tbody tr")]
      .map((r) => r.children[at].textContent);
    expect(cells.filter(Boolean)).toHaveLength(4);
    expect(cells.filter(Boolean)[0]).toMatch(/^6 × 18/);

    // And drawn on the templates and on the nest, in the rebate colour.
    expect(container.querySelectorAll(".parts g.rebates rect")).toHaveLength(4);
    const onSheets = [...container.querySelectorAll(".col-sheets rect")]
      .filter((r) => r.getAttribute("stroke") === REBATE);
    expect(onSheets).toHaveLength(4);
    // Never the colour a cutout is drawn in.
    for (const r of container.querySelectorAll(".parts g.rebates rect"))
      expect(r.getAttribute("stroke")).not.toBe(ACCENT);
  });

  it("§45 draws no rebate on a board that has none", () => {
    const { container } = render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Cut list & sheets" }));
    expect(container.querySelectorAll(".parts g.rebates")).toHaveLength(0);
    const head = [...container.querySelectorAll("table.cuts thead th")].map((t) => t.textContent);
    const at = head.indexOf("Rebate");
    for (const row of container.querySelectorAll("table.cuts tbody tr"))
      expect(row.children[at].textContent).toBe("");
  });

  it("§46 rebates a doubler, and says which board it means", () => {
    const { container } = render(<App />);
    // Nothing but carcass panels to rebate until there is another board.
    const add = () => screen.getByLabelText("Add a rebate");
    const options = () => [...add().options].map((o) => o.textContent);
    expect(options()).not.toContain("Top doubler");

    fireEvent.change(screen.getByLabelText("Add doublers"), { target: { value: "top" } });
    expect(options()).toContain("Top doubler");

    fireEvent.change(add(), { target: { value: "doubler|top" } });
    fireEvent.click(screen.getByLabelText("Top doubler rebate all sides"));
    expect(container.querySelector(".rebate h3").textContent).toBe("Top doubler");
    expect(container.querySelector(".rebate .note").textContent)
      .toMatch(/Let in 6 mm on front, back, left, right/);
    // The doubler is inside the carcass whichever way the box is wrapped, so
    // this one needs no help from the prominence order.
    fireEvent.change(screen.getByLabelText("Top doubler rebate depth"), { target: { value: "9" } });
    expect(container.querySelector(".rebate .note").textContent).toMatch(/Let in 9 mm/);

    // The carcass panels beside it carry the groove, and the box still closes.
    fireEvent.click(screen.getByRole("button", { name: "Cut list & sheets" }));
    const head = [...container.querySelectorAll("table.cuts thead th")].map((t) => t.textContent);
    const at = head.indexOf("Rebate");
    const cells = [...container.querySelectorAll("table.cuts tbody tr")]
      .map((r) => r.children[at].textContent);
    expect(cells.filter(Boolean)).toHaveLength(4);
    expect(within(container.querySelector(".totals")).getByText("exact")).toBeTruthy();
  });

  it("§14 offers a DXF of the sheet layouts", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Cut list & sheets" }));
    expect(screen.getByRole("button", { name: "Export DXF" })).toBeTruthy();
    // The download path is stubbed in this environment; that it builds without
    // throwing on a real derived design is the part worth asserting here.
    fireEvent.click(screen.getByRole("button", { name: "Export DXF" }));
  });

  it("reports the volume closure as exact", () => {
    const { container } = render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Cut list & sheets" }));
    const totals = container.querySelector(".totals");
    expect(within(totals).getByText("exact")).toBeTruthy();
  });
});

function readout(container, label) {
  for (const d of container.querySelectorAll(".readout div"))
    if (d.querySelector("dt").textContent === label) return d.querySelector("dd").textContent;
  return null;
}
