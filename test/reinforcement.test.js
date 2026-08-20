/** Cladding and doublers are added a side at a time and carry their own sheet. */
import { describe, it, expect } from "vitest";
import { MATERIALS, materialById, FACES } from "../src/model/constants.js";
import {
  DEFAULT_DESIGN, addPanel, removePanel, editPanel, freeFaces, inheritedPanel,
  layerThickness, panelSpec, setProjectMaterial, setProjectThickness, stockFor, derive,
} from "../src/ui/design.js";

const front = (d) => d.cladding.front;

describe("standard thicknesses", () => {
  it("gives every material one, and Valchromat 19 mm", () => {
    for (const m of MATERIALS) {
      expect(m.thickness).toBeGreaterThan(0);
      expect(m.thicknesses).toContain(m.thickness);
    }
    expect(materialById("valchromat").thickness).toBe(19);
    expect(materialById("mdf").thickness).toBe(18);
  });

  it("starts a project at its sheet's standard", () => {
    expect(DEFAULT_DESIGN.thickness).toBe(materialById(DEFAULT_DESIGN.material).thickness);
  });
});

describe("adding a side", () => {
  it("starts with no cladding and no doublers", () => {
    expect(DEFAULT_DESIGN.cladding).toEqual({});
    expect(DEFAULT_DESIGN.doubler).toEqual({});
    expect(freeFaces(DEFAULT_DESIGN, "cladding")).toEqual(FACES);
  });

  it("inherits the project sheet", () => {
    const d = addPanel(DEFAULT_DESIGN, "cladding", "front");
    expect(front(d)).toEqual({ material: DEFAULT_DESIGN.material, thickness: DEFAULT_DESIGN.thickness });
    expect(inheritedPanel(DEFAULT_DESIGN)).toEqual(front(d));
  });

  it("inherits whatever the project sheet currently is", () => {
    const val = setProjectMaterial(DEFAULT_DESIGN, "valchromat");
    expect(addPanel(val, "doubler", "back").doubler.back).toEqual({ material: "valchromat", thickness: 19 });
  });

  it("offers only the sides a layer has not used", () => {
    const d = addPanel(addPanel(DEFAULT_DESIGN, "cladding", "front"), "cladding", "top");
    expect(freeFaces(d, "cladding")).toEqual(["back", "left", "right", "bottom"]);
    expect(freeFaces(d, "doubler")).toEqual(FACES);           // the layers are independent
  });

  it("removes a side without touching the others", () => {
    const d = addPanel(addPanel(DEFAULT_DESIGN, "cladding", "front"), "cladding", "top");
    expect(Object.keys(removePanel(d, "cladding", "front").cladding)).toEqual(["top"]);
  });

  it("keeps the order sides were added in", () => {
    let d = DEFAULT_DESIGN;
    for (const f of ["top", "front", "left"]) d = addPanel(d, "cladding", f);
    expect(Object.keys(d.cladding)).toEqual(["top", "front", "left"]);
  });
});

describe("editing a panel", () => {
  const clad = addPanel(DEFAULT_DESIGN, "cladding", "front");

  it("takes a new material's standard thickness when it was still on the old one's", () => {
    expect(front(editPanel(clad, "cladding", "front", { material: "valchromat" })))
      .toEqual({ material: "valchromat", thickness: 19 });
  });

  it("keeps a deliberate thickness when the material changes", () => {
    const thick = editPanel(clad, "cladding", "front", { thickness: 25 });
    expect(front(editPanel(thick, "cladding", "front", { material: "mdf" })))
      .toEqual({ material: "mdf", thickness: 25 });
  });

  it("sets both at once when both are given", () => {
    expect(front(editPanel(clad, "cladding", "front", { material: "mdf", thickness: 6 })))
      .toEqual({ material: "mdf", thickness: 6 });
  });

  it("ignores an edit to a side that is not there", () => {
    expect(editPanel(clad, "cladding", "back", { thickness: 9 })).toBe(clad);
  });

  it("feeds the solver plain thicknesses", () => {
    const d = editPanel(addPanel(clad, "cladding", "top"), "cladding", "top", { thickness: 6 });
    expect(layerThickness(d.cladding)).toEqual({
      front: 18, top: 6, back: 0, left: 0, right: 0, bottom: 0,
    });
    expect(layerThickness(undefined)).toEqual(Object.fromEntries(FACES.map((f) => [f, 0])));
  });
});

describe("the project sheet", () => {
  it("moves the carcass to a new material's standard", () => {
    const d = setProjectMaterial(DEFAULT_DESIGN, "valchromat");
    expect(d.thickness).toBe(19);
    expect(Object.values(d.thicknessBy)).toEqual(Array(6).fill(19));
  });

  it("keeps a deliberate carcass thickness", () => {
    const d = setProjectMaterial(setProjectThickness(DEFAULT_DESIGN, 12), "valchromat");
    expect(d.thickness).toBe(12);
  });

  it("does not retro-fit already-added panels", () => {
    const clad = addPanel(DEFAULT_DESIGN, "cladding", "front");
    expect(front(setProjectMaterial(clad, "valchromat"))).toEqual({ material: "birch", thickness: 18 });
  });

  it("uses the chosen stock for the project sheet and the first for the rest", () => {
    const d = { ...DEFAULT_DESIGN, material: "birch", stockIndex: 1 };
    expect(stockFor(d, "birch")).toEqual([1525, 1525]);
    expect(stockFor(d, "mdf")).toEqual([2440, 1220]);
  });
});

describe("downstream of a mixed-material box", () => {
  let d = DEFAULT_DESIGN;                                   // birch 18 carcass
  d = editPanel(addPanel(d, "cladding", "front"), "cladding", "front", { material: "valchromat" });
  d = editPanel(addPanel(d, "doubler", "back"), "doubler", "back", { material: "mdf", thickness: 25 });
  const r = derive(d);

  it("attributes each panel to its own sheet", () => {
    const by = Object.fromEntries(r.rows.map((x) => [`${x.layer}:${x.face}`, `${x.material} ${x.thickness}`]));
    expect(by["cladding:front"]).toBe("Valchromat 19");
    expect(by["doubler:back"]).toBe("MDF 25");
    expect(by["shell:left"]).toBe("Birch ply 18");
  });

  it("reports the shell's own material through panelSpec", () => {
    // §18 A colour comes with it, since every panel has one — the sheet's own
    // where nothing has said otherwise.
    expect(panelSpec(d, { layer: "shell", face: "left" }))
      .toEqual({ material: "birch", thickness: 18, colour: materialById("birch").colour });
    expect(panelSpec(d, { layer: "cladding", face: "front" }))
      .toEqual({ material: "valchromat", thickness: 19, colour: materialById("valchromat").colour });
  });

  it("never mixes materials on one sheet", () => {
    for (const s of r.sheets) {
      expect(new Set(s.parts.map((p) => p.row.materialId)).size).toBe(1);
      expect(new Set(s.parts.map((p) => p.row.thickness)).size).toBe(1);
    }
    expect(r.sheets).toHaveLength(3);
  });

  it("breaks the totals down by material and thickness", () => {
    expect(r.totals.byMaterial.map((m) => `${m.material} ${m.thickness}`).sort())
      .toEqual(["Birch ply 18", "MDF 25", "Valchromat 19"]);
    expect(r.totals.byMaterial.reduce((a, m) => a + m.parts, 0)).toBe(r.totals.parts);
    expect(r.totals.byMaterial.reduce((a, m) => a + m.sheets, 0)).toBe(r.totals.sheets);
    expect(r.totals.byMaterial.reduce((a, m) => a + m.area, 0)).toBeCloseTo(r.totals.area, 9);
  });

  it("keeps two 18 mm sheets of different materials apart", () => {
    let m = DEFAULT_DESIGN;                                  // birch 18
    m = editPanel(addPanel(m, "cladding", "front"), "cladding", "front", { material: "mdf", thickness: 18 });
    const sheets = derive(m).sheets;
    expect(new Set(sheets.map((s) => s.materialId))).toEqual(new Set(["birch", "mdf"]));
    for (const s of sheets) expect(new Set(s.parts.map((p) => p.row.materialId)).size).toBe(1);
  });

  it("locks the grain only where the sheet has one", () => {
    const locked = derive({ ...d, grainLocked: true });
    const val = locked.rows.find((x) => x.materialId === "valchromat");
    const ply = locked.rows.find((x) => x.materialId === "birch");
    expect(val.grainLocked).toBe(false);                     // Valchromat has no grain
    expect(ply.grainLocked).toBe(true);
    for (const s of locked.sheets)
      for (const p of s.parts) if (p.row.grainLocked) expect(p.rotated).toBe(false);
  });

  it("names the carcass in the title block and flags the extra sheets", () => {
    expect(r.sheet.svg).toContain("BIRCH PLY 18 +2");
  });

  it("still closes on volume", () => {
    expect(r.totals.closure).toBe("exact");
    expect(r.messages.filter((m) => m.level === "error")).toEqual([]);
  });
});
