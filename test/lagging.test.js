/**
 * §30 Lagging: the lining inside the box.
 *
 * It is added a face at a time the way a doubler is, and it is a layer in the
 * wall the way a doubler is — so a box sized to a volume grows to keep that
 * volume once it is lined. What it is *not* is board: it cannot hold up a
 * bevel, a port tube does not hang off it, and a router does not flare it.
 */
import { describe, it, expect } from "vitest";
import { FACES, LAYERS, LAGGINGS, MATERIALS, materialById, isLagging } from "../src/model/constants.js";
import { solve, boxVolume, wallOf, boardOf, fillFaces } from "../src/model/solver.js";
import { largestBevel, uniformEdges } from "../src/model/bevel.js";
import { innermostOn, cutoutFlare } from "../src/model/fittings.js";
import { DEFAULT_DESIGN, derive, addPanel, removePanel, editPanel, freeFaces, inheritedPanel } from "../src/ui/design.js";

const lined = (thickness = 10, faces = FACES) =>
  faces.reduce((d, f) => editPanel(addPanel(d, "lagging", f), "lagging", f, { thickness }), DEFAULT_DESIGN);

describe("§30 the lining materials", () => {
  it("is its own list, kept out of the sheets", () => {
    expect(LAGGINGS.length).toBeGreaterThan(0);
    for (const m of LAGGINGS) {
      expect(isLagging(m.id)).toBe(true);
      expect(MATERIALS.some((s) => s.id === m.id)).toBe(false);
      // Everything a sheet has, so the same controls and the same nesting work.
      expect(m.thicknesses).toContain(m.thickness);
      expect(m.stock.length).toBeGreaterThan(0);
    }
  });

  it("is found by id like any other material", () => {
    expect(materialById("felt").name).toBe("Acoustic felt");
    expect(isLagging("birch")).toBe(false);
  });

  it("is the last layer, inside the doubler", () => {
    expect(LAYERS).toEqual(["cladding", "shell", "doubler", "lagging"]);
  });
});

describe("§30 lining a box", () => {
  it("starts with none, and takes a face at a time", () => {
    expect(DEFAULT_DESIGN.lagging).toEqual({});
    expect(freeFaces(DEFAULT_DESIGN, "lagging")).toEqual(FACES);
    const one = addPanel(DEFAULT_DESIGN, "lagging", "back");
    expect(Object.keys(one.lagging)).toEqual(["back"]);
    expect(freeFaces(one, "lagging")).not.toContain("back");
    expect(removePanel(one, "lagging", "back").lagging).toEqual({});
  });

  it("starts as a lining rather than as the project sheet", () => {
    // The one place it must not follow the project: a carcass of birch ply does
    // not imply a lining of birch ply.
    expect(inheritedPanel(DEFAULT_DESIGN, "lagging")).toEqual({
      material: LAGGINGS[0].id, thickness: LAGGINGS[0].thickness,
    });
    expect(inheritedPanel(DEFAULT_DESIGN, "doubler").material).toBe(DEFAULT_DESIGN.material);
  });

  it("grows the box to keep the cavity it was asked for", () => {
    const bare = derive(DEFAULT_DESIGN), felt = derive(lined(10));
    expect(felt.sol.E.x).toBe(bare.sol.E.x + 20);
    expect(felt.sol.E.z).toBe(bare.sol.E.z + 20);
    // Which is the whole point: the air inside is still what was asked for.
    expect(felt.sol.cavityVolume).toBeCloseTo(bare.sol.cavityVolume, 6);
  });

  it("eats the cavity instead when the size is given rather than the volume", () => {
    const fixed = { ...DEFAULT_DESIGN, start: { ...DEFAULT_DESIGN.start, mode: "dimensions" } };
    const bare = derive(fixed);
    const felt = FACES.reduce((d, f) => editPanel(addPanel(d, "lagging", f), "lagging", f, { thickness: 10 }), fixed);
    // Given external sizes there is nowhere for it to go but inward.
    const ext = { ...felt, start: { ...felt.start, basis: "external" } };
    const extBare = derive({ ...fixed, start: { ...fixed.start, basis: "external" } });
    expect(derive(ext).sol.E).toEqual(extBare.sol.E);
    expect(derive(ext).sol.cavityVolume).toBeLessThan(extBare.sol.cavityVolume);
  });

  it("keeps the volume closing, which is the whole invariant", () => {
    const d = derive(lined(12));
    expect(d.sol.closureExact).toBe(true);
    const parts = d.sol.panels.reduce((a, p) => a + boxVolume(p.box), 0);
    expect(parts + boxVolume(d.sol.cavity)).toBeCloseTo(d.sol.envVolume, 6);
    expect(d.sol.panels.filter((p) => p.layer === "lagging")).toHaveLength(6);
  });

  it("puts the lining in the cut list, on its own roll", () => {
    const d = derive(lined(10));
    const rows = d.rows.filter((r) => r.layer === "lagging");
    expect(rows).toHaveLength(6);
    expect(rows.every((r) => r.material === "Acoustic felt")).toBe(true);
    expect(rows.every((r) => r.thickness === 10)).toBe(true);
    expect(rows.every((r) => r.layerLabel === "Lagging")).toBe(true);
    // Nested on felt, not on the birch the carcass came off.
    expect(d.sheets.some((s) => s.materialId === "felt")).toBe(true);
    expect(d.sheets.some((s) => s.materialId === "birch")).toBe(true);
  });
});

describe("§30 what a lining is not", () => {
  it("is in the wall but not in the board", () => {
    const cladding = fillFaces(0), thickness = fillFaces(18), doubler = fillFaces(0), lagging = fillFaces(10);
    expect(wallOf(cladding, thickness, doubler, lagging).front).toBe(28);
    expect(boardOf(cladding, thickness, doubler).front).toBe(18);
    const sol = solve({ envelope: { x: 300, y: 300, z: 300 }, thickness: 18, lagging: 10 });
    expect(sol.wall.front).toBe(28);
    expect(sol.board.front).toBe(18);
  });

  it("does not let a bevel be cut bigger than the board behind it", () => {
    // The fault this exists for: with the lining counted, a 20 mm fillet would
    // be offered on an 18 mm carcass because there was felt glued behind it.
    const bare = derive(DEFAULT_DESIGN), felt = derive(lined(10));
    expect(largestBevel(felt.sol.board)).toBe(largestBevel(bare.sol.board));
    expect(largestBevel(felt.sol.board)).toBe(17.5);
    const asked = uniformEdges("fillet", 24);
    const d = derive({ ...lined(10), edge: { type: "fillet", radius: 24, perEdge: false, by: {} } });
    // Dropped rather than sent to the kernel, and explained against the board:
    // "the 18 mm wall", not the 28 mm the felt would have made of it.
    expect(Object.values(d.edges).every((t) => t.type === "none")).toBe(true);
    const said = d.messages.filter((m) => /cuts through/.test(m.text));
    expect(said.length).toBeGreaterThan(0);
    expect(said.every((m) => /18 mm wall/.test(m.text))).toBe(true);
    expect(said.some((m) => /28 mm/.test(m.text))).toBe(false);
    expect(asked["front|top"].radius).toBe(24);
  });

  it("hangs a port's tube off the board, not off the felt", () => {
    const d = derive({
      ...lined(10, ["back"]),
      fittings: [{ id: "p1", type: "port", face: "back", at: { a: 109, b: 80 },
        diameter: 68, length: 150, wall: 3, tube: true }],
    });
    const withTube = d.sol.panels.filter((p) => d.tubesOn(p).length);
    expect(withTube).toHaveLength(1);
    expect(withTube[0].layer).toBe("shell");
    expect(innermostOn(d.sol.panels, "back").layer).toBe("shell");
    // Bored through the lining all the same: the hole has to be there too.
    expect(d.sol.panels.filter((p) => p.face === "back" && d.fittingsOn(p).length)).toHaveLength(2);
  });

  it("flares the board behind the lining rather than the lining", () => {
    const d = derive({
      ...lined(10, ["front"]),
      fittings: [{ id: "d1", type: "driver", face: "front", at: { a: 109, b: 163 },
        cutout: 116, outer: 162, pcd: 147, bolts: 5, boltHole: 5, depth: 78,
        flare: { type: "fillet", radius: 8 } }],
    });
    const flared = d.sol.panels.filter((p) => d.fittingsOn(p).some((f) => cutoutFlare(f)));
    expect(flared).toHaveLength(1);
    expect(flared[0].layer).toBe("shell");
  });
});
