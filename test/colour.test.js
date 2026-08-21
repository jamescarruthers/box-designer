/**
 * §18 A colour on the sheet, and a colour on a panel.
 *
 * Valchromat is dyed through rather than faced, so its colour is a property of
 * the board and not of a finish applied later — which is why it belongs to the
 * panel in the model and follows it into the cut list and the sheet layouts.
 */
import { describe, it, expect } from "vitest";
import { MATERIALS, materialById, paletteFor, colourName, PALETTES } from "../src/model/constants.js";
import {
  DEFAULT_DESIGN, derive, panelSpec, shellColour, inheritedPanel,
  setProjectMaterial, editPanel, addPanel,
} from "../src/ui/design.js";

const valchromat = (extra = {}) => ({ ...setProjectMaterial(DEFAULT_DESIGN, "valchromat"), ...extra });

describe("§18 the ranges a sheet is sold in", () => {
  it("gives Valchromat its twelve colours and everything else none", () => {
    expect(paletteFor("valchromat")).toHaveLength(12);
    for (const m of MATERIALS.filter((x) => x.id !== "valchromat")) {
      expect(paletteFor(m.id)).toBe(null);
    }
  });

  it("names a colour that is in the range, and admits when one is not", () => {
    expect(colourName("valchromat", "#548772")).toBe("Green Mint");
    expect(colourName("valchromat", "#548772".toUpperCase())).toBe("Green Mint");
    expect(colourName("valchromat", "#123456")).toBe(null);
    expect(colourName("birch", "#548772")).toBe(null);
  });

  it("keeps every swatch a distinct, well-formed colour", () => {
    const hexes = PALETTES.valchromat.map((c) => c.hex);
    expect(new Set(hexes).size).toBe(hexes.length);
    for (const c of PALETTES.valchromat) {
      expect(c.hex).toMatch(/^#[0-9a-f]{6}$/);
      expect(c.name).toBeTruthy();
    }
  });

  it("starts the sheet on a colour it actually comes in", () => {
    expect(colourName("valchromat", materialById("valchromat").colour)).toBe("Grey");
  });
});

describe("§18 a colour falls back rather than being copied", () => {
  it("uses the sheet's own colour until the design says otherwise", () => {
    expect(shellColour(DEFAULT_DESIGN, "front")).toBe(materialById("birch").colour);
    expect(DEFAULT_DESIGN.colour).toBe(null);
  });

  it("takes the project colour on every panel", () => {
    const d = valchromat({ colour: "#da646c" });
    for (const f of ["front", "back", "left", "right", "top", "bottom"]) {
      expect(shellColour(d, f)).toBe("#da646c");
    }
  });

  it("lets one panel differ without disturbing the rest", () => {
    const d = valchromat({ colour: "#548772", perPanelColour: true, colourBy: { front: "#da646c" } });
    expect(shellColour(d, "front")).toBe("#da646c");
    expect(shellColour(d, "back")).toBe("#548772");
  });

  it("ignores the per-panel colours while the switch is off", () => {
    const d = valchromat({ colour: "#548772", perPanelColour: false, colourBy: { front: "#da646c" } });
    expect(shellColour(d, "front")).toBe("#548772");
  });

  it("carries the colour into the cut list, where the panel is ordered from", () => {
    const rows = derive(valchromat({ colour: "#597ba2", perPanelColour: true, colourBy: { top: "#e3b869" } })).rows;
    const by = Object.fromEntries(rows.map((r) => [r.faceLabel, r.colour]));
    expect(by.Top).toBe("#e3b869");
    expect(by.Front).toBe("#597ba2");
  });
});

describe("§18 a colour belongs to a range", () => {
  it("drops the colours when the sheet changes, rather than carrying a stale number", () => {
    const d = valchromat({ colour: "#548772", perPanelColour: true, colourBy: { front: "#da646c" } });
    const moved = setProjectMaterial(d, "birch");
    expect(moved.colour).toBe(null);
    expect(moved.colourBy).toEqual({});
    expect(shellColour(moved, "front")).toBe(materialById("birch").colour);
  });

  it("keeps them when the sheet does not change", () => {
    const d = valchromat({ colour: "#548772" });
    expect(setProjectMaterial(d, "valchromat").colour).toBe("#548772");
  });

  it("does the same for an added panel's own sheet", () => {
    const d = editPanel(addPanel(valchromat({ colour: "#da646c" }), "cladding", "front"),
      "cladding", "front", { colour: "#e3b869" });
    expect(d.cladding.front.colour).toBe("#e3b869");

    const moved = editPanel(d, "cladding", "front", { material: "mdf" });
    expect(moved.cladding.front.colour).toBeUndefined();
    expect(panelSpec(moved, { layer: "cladding", face: "front" }).colour).toBe(materialById("mdf").colour);
  });

  it("still takes a colour and a material set together", () => {
    const d = addPanel(valchromat(), "doubler", "back");
    const both = editPanel(d, "doubler", "back", { material: "mdf", colour: "#101010" });
    expect(both.doubler.back).toMatchObject({ material: "mdf", colour: "#101010" });
  });

  it("hands a new panel the project's colour, so a clad box is one colour by default", () => {
    expect(inheritedPanel(valchromat({ colour: "#597ba2" })).colour).toBe("#597ba2");
    // And nothing at all when the project is following its sheet, so the panel
    // follows its own sheet in turn.
    expect(inheritedPanel(DEFAULT_DESIGN).colour).toBeUndefined();
  });
});
