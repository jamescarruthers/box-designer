/** §9.7 Drive the app: mount it in jsdom, stub WebGLRenderer, click through the
 *  modes and change inputs, and assert nothing falls over. */
import React from "react";
import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";

vi.mock("three", async (importOriginal) => {
  const actual = await importOriginal();
  class StubRenderer {
    constructor() { this.domElement = document.createElement("canvas"); }
    setPixelRatio() {}
    setClearColor() {}
    setSize(w, h) { this.domElement.width = w; this.domElement.height = h; }
    render() { StubRenderer.renders++; }
    dispose() {}
  }
  StubRenderer.renders = 0;
  return { ...actual, WebGLRenderer: StubRenderer };
});

import App from "../src/ui/App.jsx";

beforeAll(() => {
  global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  Element.prototype.setPointerCapture = () => {};
  global.URL.createObjectURL = () => "blob:stub";
  global.URL.revokeObjectURL = () => {};
});

afterEach(cleanup);

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

  it("reports an error when the walls meet", () => {
    const { container } = render(<App />);
    // On an internal basis the envelope grows to keep the cavity, so the walls
    // can only meet when the outside is what is fixed.
    fireEvent.click(screen.getByRole("button", { name: "External" }));
    fireEvent.click(screen.getByRole("button", { name: "Dimensions" }));
    fireEvent.change(screen.getByLabelText("Thickness"), { target: { value: "200" } });
    expect(container.querySelector(".messages .error").textContent).toMatch(/Internal (width|depth|height)/);
  });

  it("warns when a bevel cuts past the outer skin, and errors when it cuts through the wall", () => {
    const { container } = render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Fillet" }));
    fireEvent.change(screen.getByLabelText("Radius"), { target: { value: "40" } });
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
