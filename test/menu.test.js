/**
 * §58 What a right-click offers.
 *
 * The whole of the decision is in `menu.js` and none of it in the component
 * that shows it, so this is where the feature is tested: what appears on an
 * edge and on a panel, what is refused and what it says about the refusal, and
 * what each item does to the design. No canvas is involved in any of it.
 */
import { describe, it, expect } from "vitest";
import { contextMenu, menuItems, EDGE_TREATMENTS, ADDABLE, PAGES } from "../src/ui/menu.js";
import {
  DEFAULT_DESIGN, derive, addPanel, setLayerOrder, setOwnProminence, setEdgeTreatment,
  layerOrder, setProjectMaterial,
} from "../src/ui/design.js";
import { PROMINENCE_PRESETS, FACES } from "../src/model/constants.js";

const open = (design, target, page = null) => contextMenu(design, derive(design), target, page);
const panelOn = (design, face, layer = "shell") =>
  derive(design).rows.find((r) => r.face === face && r.layer === layer).panelIndex;
const item = (menu, id) => menuItems(menu).find((i) => i.id === id);

describe("§58 a right-click on a panel", () => {
  const design = DEFAULT_DESIGN;
  const menu = () => open(design, { kind: "panel", index: panelOn(design, "left") });

  it("names the board it was opened on", () => {
    expect(menu().title).toBe("Left carcass");
    expect(menu().face).toBe("left");
  });

  it("offers every layer a face can carry, and not the carcass", () => {
    const ids = menuItems(menu()).map((i) => i.id);
    for (const l of ADDABLE) expect(ids).toContain(`add-${l}`);
    // The carcass is the box, not something added to a face.
    expect(ids.some((i) => i.includes("shell"))).toBe(false);
  });

  it("adds the layer to the face that was clicked", () => {
    const after = item(menu(), "add-doubler").apply(design);
    expect(after.doubler.left).toBeTruthy();
    expect(Object.keys(after.doubler)).toEqual(["left"]);
    expect(derive(after).sol.closureExact).toBe(true);
  });

  it("offers to take a layer away once the face has one", () => {
    const clad = addPanel(design, "cladding", "left");
    const m = open(clad, { kind: "panel", index: panelOn(clad, "left") });
    expect(item(m, "add-cladding")).toBeUndefined();
    expect(item(m, "remove-cladding").label).toBe("Remove the cladding");
    expect(item(m, "remove-cladding").apply(clad).cladding.left).toBeUndefined();
  });

  it("adds to the face, whichever of its layers was clicked", () => {
    // Right-clicking the front cladding and asking for a doubler can only mean
    // a doubler on the front.
    const clad = addPanel(design, "cladding", "front");
    const m = open(clad, { kind: "panel", index: panelOn(clad, "front", "cladding") });
    expect(m.title).toBe("Front cladding");
    expect(item(m, "add-doubler").apply(clad).doubler.front).toBeTruthy();
  });

  it("returns nothing for a panel that is not there", () => {
    expect(open(design, { kind: "panel", index: 99 })).toBeNull();
    expect(contextMenu(design, derive(design), null)).toBeNull();
  });
});

describe("§58 moving a face up and down the order", () => {
  const design = DEFAULT_DESIGN;                      // front, back, left, right, top, bottom
  const menuFor = (face) => open(design, { kind: "panel", index: panelOn(design, face) });

  it("brings a face to the front in one move, keeping the rest in order", () => {
    const after = item(menuFor("bottom"), "front").apply(design);
    expect(after.order).toEqual(["bottom", "front", "back", "left", "right", "top"]);
  });

  it("sends a face to the back the same way", () => {
    const after = item(menuFor("front"), "back").apply(design);
    expect(after.order).toEqual(["back", "left", "right", "top", "bottom", "front"]);
  });

  it("changes no internal dimension, which is what prominence never does", () => {
    const before = derive(design).sol;
    const after = derive(item(menuFor("bottom"), "front").apply(design)).sol;
    expect(after.internal).toEqual(before.internal);
    expect(after.E).toEqual(before.E);
    expect(after.closureExact).toBe(true);
  });

  it("refuses the move that is already made, and says so", () => {
    const front = menuFor("front");                   // rank 0 under the default preset
    expect(item(front, "front").disabled).toBe(true);
    expect(item(front, "front").why).toContain("already runs past all five");
    expect(item(front, "back").disabled).toBe(false);

    const bottom = menuFor("bottom");                 // rank 5
    expect(item(bottom, "back").disabled).toBe(true);
    expect(item(bottom, "back").why).toContain("already inside all five");
  });

  it("moves a doubler in the doublers' own order when they have one", () => {
    // §53 A doubler laid out by its own order is moved in that order, and the
    // box's is left alone — the same rule the inspector's arrows follow.
    let d = design;
    for (const f of FACES) d = addPanel(d, "doubler", f);
    d = setOwnProminence(d, "doubler", true);
    d = setLayerOrder(d, "doubler", PROMINENCE_PRESETS[0].order);

    const m = open(d, { kind: "panel", index: panelOn(d, "bottom", "doubler") });
    expect(item(m, "front").label).toBe("Bring to the front of the doublers");
    const after = item(m, "front").apply(d);
    expect(layerOrder(after, "doubler")[0]).toBe("bottom");
    expect(after.order).toEqual(d.order);
  });
});

describe("§58 a right-click on an edge", () => {
  const design = DEFAULT_DESIGN;
  const edge = (key, d = design) => open(d, { kind: "edge", key });

  it("names the two faces that meet there", () => {
    expect(edge("front|left").title).toBe("Front / Left edge");
    expect(edge("nonsense|left")).toBeNull();
  });

  it("offers all four treatments", () => {
    expect(menuItems(edge("front|left")).map((i) => i.id))
      .toEqual(EDGE_TREATMENTS.map((t) => t.id));
  });

  it("marks what the edge already is, and does not offer it again", () => {
    const m = edge("front|left");
    expect(item(m, "none").on).toBe(true);
    expect(item(m, "none").disabled).toBe(true);

    const filleted = setEdgeTreatment(design, "front|left", "fillet", 12);
    const after = edge("front|left", filleted);
    expect(item(after, "fillet").on).toBe(true);
    expect(item(after, "fillet").disabled).toBe(true);
    expect(item(after, "none").disabled).toBe(false);
  });

  it("applies the treatment to that edge and no other", () => {
    const after = item(edge("front|left"), "mitre").apply(design);
    expect(after.edge.by["front|left"].type).toBe("mitre");
    expect(after.edge.perEdge).toBe(true);
    expect(Object.keys(after.edge.by)).toEqual(["front|left"]);
  });

  it("shows the radius a bevel would be cut at", () => {
    expect(item(edge("front|left"), "fillet").label).toBe("Fillet R12");
    expect(item(edge("front|left"), "chamfer").label).toBe("Chamfer R12");
    expect(item(edge("front|left"), "mitre").label).toBe("Mitre");
  });

  it("refuses what the edge cannot take, in the words §15 already had", () => {
    // §3 A bevel needs one panel running the whole edge; under the default
    // order four of the twelve have no such panel.
    const design2 = DEFAULT_DESIGN;
    const der = derive(design2);
    const beveless = Object.keys(der.fullLength).filter((k) => !der.fullLength[k]);
    expect(beveless.length).toBeGreaterThan(0);
    const m = edge(beveless[0], design2);
    expect(item(m, "fillet").disabled).toBe(true);
    expect(item(m, "fillet").why).toContain("no one panel runs the whole of this edge");
    // Square is always available: it is the absence of a treatment.
    expect(item(m, "chamfer").disabled).toBe(true);
  });

  it("refuses a mitre with the reason the mitre check gives", () => {
    const der = derive(design);
    const bad = Object.entries(der.mitrable).find(([, m]) => !m.ok);
    if (!bad) return;                                  // every edge mitrable: nothing to check
    const m = edge(bad[0]);
    expect(item(m, "mitre").disabled).toBe(true);
    expect(item(m, "mitre").why).toBe(bad[1].why);
  });
});

describe("§58 the way in to everything else", () => {
  it("opens the inspector on the panel that was clicked", () => {
    const index = panelOn(DEFAULT_DESIGN, "top");
    const m = open(DEFAULT_DESIGN, { kind: "panel", index });
    expect(item(m, "inspect").inspect).toBe(index);
    expect(item(m, "inspect").apply).toBeUndefined();
  });

  it("gives every item something to do", () => {
    // An item that neither changes the design, opens something, turns a page
    // nor comes back from one is a dead line in a menu.
    const alive = (i) => Boolean(i.apply) || i.inspect != null || Boolean(i.into) || Boolean(i.back);
    const targets = [{ kind: "panel", index: panelOn(DEFAULT_DESIGN, "top") },
      { kind: "edge", key: "front|left" }];
    for (const target of targets) {
      for (const page of [null, ...PAGES]) {
        const menu = open(DEFAULT_DESIGN, target, page);
        if (!menu) continue;
        for (const i of menuItems(menu)) {
          expect(alive(i)).toBe(true);
          expect(i.label.length).toBeGreaterThan(0);
        }
      }
    }
  });
});

/**
 * §59 The board itself, from the menu.
 *
 * A sheet, nine thicknesses and twelve colours is more than a menu can hold
 * flat, so the menu turns a page. Which page shows what, and what each item
 * writes, is the same kind of question §58 answered for the rest of it — and
 * the answer differs by layer, because §47's rules do: the carcass has one
 * sheet for all six faces, and everything else carries its own.
 */
describe("§59 the sheet, the thickness and the colour", () => {
  const design = DEFAULT_DESIGN;
  const page = (d, face, layer, p) =>
    contextMenu(d, derive(d), { kind: "panel", index: panelOn(d, face, layer) }, p);
  const labels = (menu) => menuItems(menu).filter((i) => !i.back).map((i) => i.label);

  it("offers the three of them as pages, with what they are now", () => {
    const m = page(design, "front", "shell", null);
    const board = item(m, "board"), thick = item(m, "thickness"), colour = item(m, "colour");
    expect(board.into).toBe("board");
    expect(board.note).toBe("Birch ply");
    expect(thick.into).toBe("thickness");
    expect(thick.note).toBe("18 mm");
    expect(colour.swatch).toBeTruthy();
  });

  it("comes back from a page", () => {
    for (const p of PAGES) {
      const m = page(design, "front", "shell", p);
      expect(menuItems(m)[0].back).toBe(true);
      expect(m.back).toBe(true);
    }
  });

  it("changes the carcass sheet for the whole carcass, and says so", () => {
    // §47 There is one carcass sheet, not one per face. A menu that pretended
    // otherwise would change five other boards without mentioning them.
    const m = page(design, "front", "shell", "board");
    expect(m.groups.some((g) => g.name === "The whole carcass")).toBe(true);
    expect(labels(m)).toEqual(["MDF", "Birch ply", "Oak-faced ply", "Pine", "Valchromat"]);
    expect(item(m, "birch").disabled).toBe(true);          // already that
    const after = item(m, "mdf").apply(design);
    expect(after.material).toBe("mdf");
    expect(derive(after).sol.closureExact).toBe(true);
  });

  it("changes one face's thickness and leaves the other five", () => {
    const m = page(design, "top", "shell", "thickness");
    expect(labels(m)).toEqual(["4 mm", "6 mm", "9 mm", "12 mm", "15 mm", "18 mm", "24 mm", "30 mm"]);
    expect(item(m, "t18").on).toBe(true);
    const after = item(m, "t24").apply(design);
    expect(after.perFaceThickness).toBe(true);
    expect(after.thicknessBy.top).toBe(24);
    expect(after.thicknessBy.front).toBe(18);
  });

  it("paints one face from the range the sheet is sold in", () => {
    const val = setProjectMaterial(design, "valchromat");
    const m = page(val, "front", "shell", "colour");
    expect(labels(m)[0]).toBe("As the project");
    expect(labels(m)).toContain("Green Mint");
    const after = item(m, "green-mint").apply(val);
    expect(after.perPanelColour).toBe(true);
    expect(after.colourBy.front).toBe("#548772");
    // And back to the project's, which is what "As the project" means.
    const back = item(page(after, "front", "shell", "colour"), "inherit").apply(after);
    expect(back.colourBy.front ?? null).toBeNull();
  });

  it("refuses the colour page on a sheet that comes as it comes", () => {
    // Birch ply has no range. The inspector can still paint it any hex, and
    // the item says where to go rather than opening a page with one line.
    const m = page(design, "front", "shell", null);
    expect(item(m, "colour").disabled).toBe(true);
    expect(item(m, "colour").why).toContain("inspector");
  });

  it("gives a cladding its own sheet, thickness and colour", () => {
    const clad = addPanel(design, "cladding", "front");
    const m = page(clad, "front", "cladding", "board");
    expect(m.groups.some((g) => g.name === "The whole carcass")).toBe(false);
    const after = item(m, "valchromat").apply(clad);
    expect(after.cladding.front.material).toBe("valchromat");
    expect(after.material).toBe(design.material);          // the carcass is untouched

    const t = page(after, "front", "cladding", "thickness");
    const thicker = item(t, "t19").apply(after);
    expect(thicker.cladding.front.thickness).toBe(19);
    expect(thicker.thickness).toBe(design.thickness);
  });

  it("offers a lining the linings, not the boards", () => {
    // §30 A lining comes off a roll: no birch ply among them.
    const lined = addPanel(design, "lagging", "back");
    const m = page(lined, "back", "lagging", "board");
    expect(labels(m)).not.toContain("Birch ply");
    expect(labels(m).length).toBeGreaterThan(0);
    const after = item(m, "wool").apply(lined);
    expect(after.lagging.back.material).toBe("wool");
  });

  it("has nothing to say about an edge", () => {
    for (const p of PAGES) {
      expect(contextMenu(design, derive(design), { kind: "edge", key: "front|left" }, p).kind)
        .toBe("edge");
    }
  });
});
