/**
 * §53 A prominence of the doublers' own.
 *
 * Prominence has always been one rank over the six faces, applied to every
 * layer alike. It is a joinery choice, and the joinery inside a carcass is not
 * the joinery of the carcass — a doubler ring stiffening a baffle is laid out
 * against the other doublers, not against the boards outside it.
 *
 * The load-bearing claim is that this stays *contained*: a layer ordered its
 * own way resizes its own panels, changes no other layer, changes no internal
 * dimension, and closes on volume exactly as §2.4 requires.
 */
import { describe, it, expect } from "vitest";
import { solve, boxVolume } from "../src/model/solver.js";
import { FACES, LAYERS, PROMINENCE_PRESETS, rankFromOrder } from "../src/model/constants.js";
import {
  DEFAULT_DESIGN, derive, addPanel, moveFace,
  layerOrder, layerPreset, ownOrder, layerRanks, setLayerOrder, setOwnProminence,
} from "../src/ui/design.js";
import { mergeDesign } from "../src/ui/storage.js";

/** A box wearing every layer, so every order has something to reorder. */
function loaded() {
  let d = DEFAULT_DESIGN;
  for (const f of FACES) d = addPanel(d, "cladding", f);
  for (const f of FACES) d = addPanel(d, "doubler", f);
  for (const f of FACES) d = addPanel(d, "lagging", f);
  return d;
}

const sizes = (d, layer) => derive(d).rows.filter((r) => r.layer === layer)
  .map((r) => `${r.face} ${r.length}×${r.width}`).sort();

const OTHER = PROMINENCE_PRESETS[2].order;   // top & bottom wrap

describe("§53 a layer may be ordered differently from the box", () => {
  it("says so in the solver, one layer at a time", () => {
    const th = Object.fromEntries(FACES.map((f) => [f, 18]));
    const rank = rankFromOrder(PROMINENCE_PRESETS[0].order);
    const ranks = { doubler: rankFromOrder(OTHER) };
    const args = { start: DEFAULT_DESIGN.start, thickness: th, doubler: th, rank, round: 1 };
    const same = solve(args);
    const apart = solve({ ...args, ranks });

    // Same box, same carcass, same cavity.
    expect(apart.E).toEqual(same.E);
    expect(apart.panels.filter((p) => p.layer === "shell"))
      .toEqual(same.panels.filter((p) => p.layer === "shell"));
    expect(apart.internal).toEqual(same.internal);
    // Different doublers.
    expect(apart.panels.filter((p) => p.layer === "doubler"))
      .not.toEqual(same.panels.filter((p) => p.layer === "doubler"));
    // And the rank it actually used, per layer, for anything that asks.
    expect(apart.ranks.doubler.top).toBe(0);
    expect(apart.ranks.shell).toBe(apart.rank);
  });

  it("closes on volume for every pair of orders, on every layer", () => {
    const th = Object.fromEntries(FACES.map((f) => [f, 12]));
    let cases = 0, worst = 0;
    for (const box of PROMINENCE_PRESETS) {
      for (const other of PROMINENCE_PRESETS) {
        for (const layer of LAYERS) {
          const sol = solve({
            start: DEFAULT_DESIGN.start, thickness: th, cladding: th, doubler: th, lagging: th,
            rank: rankFromOrder(box.order), ranks: { [layer]: rankFromOrder(other.order) }, round: 1,
          });
          cases++;
          worst = Math.max(worst, Math.abs(sol.closure) / sol.envVolume);
          expect(sol.closureExact).toBe(true);
          // §2.4 invariant 1: no two panels share any volume.
          const total = sol.panels.reduce((a, p) => a + boxVolume(p.box), 0);
          expect(total + boxVolume(sol.cavity)).toBeCloseTo(sol.envVolume, 6);
        }
      }
    }
    expect(cases).toBe(100);
    expect(worst).toBe(0);
  });

  it("leaves every internal dimension alone, which is what prominence never touches", () => {
    const follow = loaded();
    const own = setLayerOrder(setOwnProminence(follow, "doubler", true), "doubler", OTHER);
    const a = derive(follow).sol, b = derive(own).sol;
    expect(b.internal).toEqual(a.internal);
    expect(b.E).toEqual(a.E);
    for (const [i, box] of b.interiors.entries()) {
      expect(box.box).toEqual(a.interiors[i].box);
    }
  });

  it("resizes the doublers and nothing else", () => {
    const follow = loaded();
    const own = setLayerOrder(setOwnProminence(follow, "doubler", true), "doubler", OTHER);
    expect(sizes(own, "doubler")).not.toEqual(sizes(follow, "doubler"));
    for (const layer of ["cladding", "shell", "lagging"]) {
      expect(sizes(own, layer)).toEqual(sizes(follow, layer));
    }
  });
});

describe("§53 following the box, or not", () => {
  it("follows it until it is told not to", () => {
    const d = loaded();
    expect(ownOrder(d, "doubler")).toBe(false);
    expect(layerOrder(d, "doubler")).toBe(d.order);
    expect(layerPreset(d, "doubler")).toBe(d.preset);
    expect(layerRanks(d)).toEqual({});
  });

  it("starts its own order as a copy, so switching it on moves nothing", () => {
    const d = setOwnProminence(loaded(), "doubler", true);
    expect(ownOrder(d, "doubler")).toBe(true);
    expect(layerOrder(d, "doubler")).toEqual(loaded().order);
    expect(derive(d).sol.panels).toEqual(derive(loaded()).sol.panels);
  });

  it("goes back to following, and forgets what it was", () => {
    let d = setLayerOrder(setOwnProminence(loaded(), "doubler", true), "doubler", OTHER);
    d = setOwnProminence(d, "doubler", false);
    expect(ownOrder(d, "doubler")).toBe(false);
    expect(derive(d).sol.panels).toEqual(derive(loaded()).sol.panels);
  });

  it("writes an order back where it came from", () => {
    // Following: reordering from the doubler control reorders the box, because
    // that is the order the doublers are laid out by.
    const following = setLayerOrder(loaded(), "doubler", OTHER);
    expect(following.order).toEqual(OTHER);
    expect(following.preset).toBe("tb");
    expect(following.prominence.doubler).toBeNull();

    // Its own: the box keeps the order it had.
    const apart = setLayerOrder(setOwnProminence(loaded(), "doubler", true), "doubler", OTHER);
    expect(apart.order).toEqual(DEFAULT_DESIGN.order);
    expect(apart.prominence.doubler).toEqual({ preset: "tb", order: OTHER });
  });

  it("names a hand-made layer order Custom, the same as the box's", () => {
    let d = setOwnProminence(loaded(), "doubler", true);
    d = moveFace(d, "left", -1, "doubler");
    expect(d.prominence.doubler.preset).toBe("custom");
    expect(d.prominence.doubler.order).toEqual(["front", "left", "back", "right", "top", "bottom"]);
    expect(d.preset).toBe(DEFAULT_DESIGN.preset);
    expect(d.order).toEqual(DEFAULT_DESIGN.order);
  });

  it("moves a face in the order that lays out the layer it was moved from", () => {
    const own = setOwnProminence(loaded(), "doubler", true);
    // From a doubler while the doublers follow the box: the box moves.
    const shellMove = moveFace(loaded(), "left", -1, "shell");
    expect(shellMove.order[1]).toBe("left");
    // From a doubler with its own order: only the doublers move.
    const doublerMove = moveFace(own, "left", -1, "doubler");
    expect(sizes(doublerMove, "shell")).toEqual(sizes(own, "shell"));
    expect(sizes(doublerMove, "doubler")).not.toEqual(sizes(own, "doubler"));
  });

  it("refuses to move a face off either end", () => {
    const own = setOwnProminence(loaded(), "doubler", true);
    expect(moveFace(own, "front", -1, "doubler")).toBe(own);
    expect(moveFace(own, "bottom", 1, "doubler")).toBe(own);
  });
});

describe("§53 a design written before any of this", () => {
  it("opens saying what it always said", () => {
    const old = { title: "OLD", start: DEFAULT_DESIGN.start, thickness: 18, material: "birch",
      order: OTHER, preset: "tb", doubler: { front: { material: "birch", thickness: 18 } } };
    const back = mergeDesign(DEFAULT_DESIGN, old);
    expect(back.prominence).toEqual({ doubler: null });
    expect(layerOrder(back, "doubler")).toEqual(OTHER);
    expect(derive(back).sol.closureExact).toBe(true);
  });

  it("keeps a layer order through storage", () => {
    const own = setLayerOrder(setOwnProminence(loaded(), "doubler", true), "doubler", OTHER);
    const back = mergeDesign(DEFAULT_DESIGN, JSON.parse(JSON.stringify(own)));
    expect(back.prominence.doubler).toEqual({ preset: "tb", order: OTHER });
    expect(derive(back).sol.panels).toEqual(derive(own).sol.panels);
  });
});
