/**
 * §58 What a right-click offers.
 *
 * The whole of the decision is in `menu.js` and none of it in the component
 * that shows it, so this is where the feature is tested: what appears on an
 * edge and on a panel, what is refused and what it says about the refusal, and
 * what each item does to the design. No canvas is involved in any of it.
 */
import { describe, it, expect } from "vitest";
import { contextMenu, menuItems, EDGE_TREATMENTS, ADDABLE } from "../src/ui/menu.js";
import {
  DEFAULT_DESIGN, derive, addPanel, setLayerOrder, setOwnProminence, setEdgeTreatment,
  layerOrder,
} from "../src/ui/design.js";
import { PROMINENCE_PRESETS, FACES } from "../src/model/constants.js";

const open = (design, target) => contextMenu(design, derive(design), target);
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
    // An item that neither changes the design nor opens anything is a dead
    // line in a menu.
    for (const target of [{ kind: "panel", index: panelOn(DEFAULT_DESIGN, "top") },
      { kind: "edge", key: "front|left" }]) {
      for (const i of menuItems(open(DEFAULT_DESIGN, target))) {
        expect(Boolean(i.apply) || i.inspect != null).toBe(true);
        expect(i.label.length).toBeGreaterThan(0);
      }
    }
  });
});
