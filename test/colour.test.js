/**
 * §18 A colour on the sheet, and a colour on a panel.
 *
 * Valchromat is dyed through rather than faced, so its colour is a property of
 * the board and not of a finish applied later — which is why it belongs to the
 * panel in the model and follows it into the cut list and the sheet layouts.
 */
import { describe, it, expect } from "vitest";
import { MATERIALS, materialById, paletteFor, colourName, PALETTES, stockColour } from "../src/model/constants.js";
import {
  DEFAULT_DESIGN, derive, panelSpec, shellColour, inheritedPanel,
  setProjectMaterial, editPanel, addPanel, setFaceColour,
} from "../src/ui/design.js";
import { colourNote, cutListCsv, stockKey } from "../src/cutlist/cutlist.js";

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

/**
 * §50 The colour in the cut list.
 *
 * A cut list without it cannot be taken to a merchant who sells the sheet in
 * twelve colours — and, worse, a nest without it lays six parts out on one
 * board when two of them are a different board altogether.
 */
describe("§50 the colour a part is cut from", () => {
  const twoTone = () => {
    let d = { ...setProjectMaterial(DEFAULT_DESIGN, "valchromat"), colour: "#548772" };
    return derive(setFaceColour(d, "front", "#da646c"));
  };

  it("names a colour the sheet is sold in, and gives the hex for one it is not", () => {
    expect(colourNote("valchromat", "#548772")).toBe("Green Mint");
    expect(colourNote("valchromat", "#DA646C")).toBe("Red");
    // A Valchromat panel painted something off the range: there is no name for
    // it, so the number is the only honest answer.
    expect(colourNote("valchromat", "#123456")).toBe("#123456");
  });

  it("says nothing about a sheet that comes as it comes", () => {
    // "Birch" in the colour column of a list whose material column already
    // says Birch ply is a column doing no work.
    expect(colourNote("birch", materialById("birch").colour)).toBe("");
    expect(colourNote("birch", null)).toBe("");
    // Painted, though, is worth saying — it is a finish somebody has chosen.
    expect(colourNote("birch", "#da646c")).toBe("#da646c");
  });

  it("carries it into the row and the file", () => {
    const d = twoTone();
    const front = d.rows.find((r) => r.face === "front" && r.layer === "shell");
    expect(front.colourNote).toBe("Red");
    expect(d.rows.filter((r) => r.colourNote === "Green Mint")).toHaveLength(5);

    const csv = cutListCsv(d.rows).split("\n");
    const at = csv[0].split(",").indexOf("Colour");
    expect(at).toBeGreaterThan(-1);
    const cells = csv.slice(1).map((line) => line.split(",")[at]);
    expect(cells.filter((c) => c === "Red")).toHaveLength(1);
    expect(cells.filter((c) => c === "Green Mint")).toHaveLength(5);
  });

  it("nests two colours of one sheet as two sheets", () => {
    // The part of this that is not cosmetic: a green board and a red board are
    // two boards, and a layout that puts parts of both on one of them is a
    // layout nobody can cut to.
    const d = twoTone();
    expect(d.sheets).toHaveLength(2);
    for (const sheet of d.sheets) {
      const colours = new Set(sheet.parts.map((p) => p.row.colourNote));
      expect(colours.size).toBe(1);
    }
    expect(d.sheets.map((s) => s.colourNote).sort()).toEqual(["Green Mint", "Red"]);
    // And the tally counts them as two orders.
    expect(d.totals.byMaterial).toHaveLength(2);
    expect(d.totals.byMaterial.map((m) => m.parts).sort()).toEqual([1, 5]);
  });

  it("does not split a sheet that is only painted", () => {
    // Birch ply painted red is one sheet and a tin of paint. Splitting the nest
    // for it would waste board for nothing.
    const d = derive(setFaceColour(DEFAULT_DESIGN, "front", "#da646c"));
    expect(d.sheets).toHaveLength(1);
    expect(d.sheets[0].parts).toHaveLength(6);
    expect(stockColour("birch", "#da646c")).toBe("");
    expect(stockColour("valchromat", "#DA646C")).toBe("#da646c");
  });

  it("keys a part and the sheet it lands on the same way", () => {
    const d = twoTone();
    for (const sheet of d.sheets) {
      for (const part of sheet.parts) expect(stockKey(part.row)).toBe(stockKey(sheet));
    }
  });
});
