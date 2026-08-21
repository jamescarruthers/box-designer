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

    // §29 The cap is the panel and the bolt circle, and it is enforced rather
    // than merely declared: a radius typed past it comes back at it.
    fireEvent.change(screen.getByLabelText("Fitting 1 flare"), { target: { value: "40" } });
    expect(Number(screen.getByLabelText("Fitting 1 flare").value)).toBe(12.5);

    fireEvent.click(within(container.querySelector(".fitting-flare")).getByRole("button", { name: "Square" }));
    expect(container.querySelector(".fitting .note").textContent).not.toContain("inside");
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
