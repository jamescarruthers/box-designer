/**
 * §52 The design as a file on disk.
 *
 * Writing one is nearly nothing — it is JSON. What is worth testing is reading
 * one back: a file is the copy that outlives the browser it was written in, so
 * it will be opened by an app that is not the one that wrote it, and what
 * happens then has to be something better than a silent default box.
 */
import { describe, it, expect } from "vitest";
import { DEFAULT_DESIGN, derive, addPanel, setOwnProminence } from "../src/ui/design.js";
import {
  designFileText, designFileName, readDesignFile, openedNote, slug,
  FILE_FORMAT, FILE_VERSION,
} from "../src/ui/file.js";

/** A design with something on every layer, so the round trip has work to do. */
function elaborate() {
  let d = { ...DEFAULT_DESIGN, title: "SUBWOOFER", thickness: 21, kerf: 4.2 };
  d = addPanel(d, "cladding", "front");
  d = addPanel(d, "doubler", "front");
  d = addPanel(d, "doubler", "top");
  d = addPanel(d, "lagging", "back");
  d = setOwnProminence(d, "doubler", true);
  return {
    ...d,
    edge: { ...d.edge, perEdge: true, by: { "front|left": { type: "mitre", radius: 12 } } },
    rebate: { "doubler|front": { sides: ["top", "bottom"], depth: 6 } },
    fittings: [{ id: "d1", type: "driver", face: "front", at: { a: 108, b: 163 },
      cutout: 116, pcd: 147, bolts: 5, boltHole: 5 }],
  };
}

describe("§52 what gets written", () => {
  it("says what it is, and is something a person can read", () => {
    const text = designFileText(DEFAULT_DESIGN);
    const raw = JSON.parse(text);
    expect(raw.format).toBe(FILE_FORMAT);
    expect(raw.version).toBe(FILE_VERSION);
    expect(raw.design.title).toBe(DEFAULT_DESIGN.title);
    // Indented and newline-terminated: the point of JSON is that it opens in
    // anything, and one 4 kB line does not.
    expect(text).toContain("\n  ");
    expect(text.endsWith("\n")).toBe(true);
  });

  it("names the file after the box", () => {
    expect(designFileName("SHEET BOX")).toBe("sheet-box.json");
    expect(designFileName("Mk II — 12 L")).toBe("mk-ii-12-l.json");
    expect(designFileName("")).toBe("box.json");
    expect(slug("///")).toBe("box");
  });
});

describe("§52 a design survives the round trip", () => {
  it("comes back as it went in", () => {
    const design = elaborate();
    expect(readDesignFile(designFileText(design)).design).toEqual(design);
  });

  it("still solves, which is the only thing that matters", () => {
    const design = elaborate();
    const back = readDesignFile(designFileText(design)).design;
    expect(derive(back).sol.closureExact).toBe(true);
    expect(derive(back).rows.length).toBe(derive(design).rows.length);
    expect(derive(back).sol.panels).toEqual(derive(design).sol.panels);
  });

  it("keeps a departure the box does not follow", () => {
    // §53 The doublers' own order is part of the design, so it is part of the
    // file. A round trip that quietly put them back on the box's order would
    // resize six panels.
    const design = { ...elaborate(), prominence: { doubler: { preset: "tb", order:
      ["top", "bottom", "front", "back", "left", "right"] } } };
    const back = readDesignFile(designFileText(design)).design;
    expect(back.prominence.doubler.order[0]).toBe("top");
    expect(derive(back).sol.panels).toEqual(derive(design).sol.panels);
  });
});

describe("§52 a file this app did not write", () => {
  it("opens a bare design, with no wrapper round it", () => {
    // Copied out of localStorage, or written by hand. Refusing it would be
    // refusing a design because of its envelope.
    const read = readDesignFile(JSON.stringify({ ...DEFAULT_DESIGN, title: "BARE" }));
    expect(read.design.title).toBe("BARE");
    expect(read.version).toBeNull();
  });

  it("fills in what an older file never had", () => {
    const old = { title: "OLD", start: DEFAULT_DESIGN.start, thickness: 18, material: "birch" };
    const read = readDesignFile(JSON.stringify({ format: FILE_FORMAT, version: 1, design: old }));
    expect(read.design.title).toBe("OLD");
    expect(read.design.fittings).toEqual([]);
    expect(read.design.prominence).toEqual({ doubler: null });
    expect(() => derive(read.design)).not.toThrow();
  });

  it("says what it dropped out of a newer one", () => {
    const read = readDesignFile(JSON.stringify({
      format: FILE_FORMAT, version: 9,
      design: { ...DEFAULT_DESIGN, chamfers: [1, 2], sorcery: true },
    }));
    expect(read.dropped).toEqual(["chamfers", "sorcery"]);
    expect(read.version).toBe(9);
    const note = openedNote("later.json", read);
    expect(note).toContain("later.json");
    expect(note).toContain("later version");
    expect(note).toContain("chamfers, sorcery");
  });

  it("has nothing to say about a file that opened whole", () => {
    const read = readDesignFile(designFileText(DEFAULT_DESIGN));
    expect(openedNote("box.json", read)).toBe("Opened box.json.");
  });
});

describe("§52 a file that is not a design", () => {
  const refuses = (text, fragment) => {
    expect(() => readDesignFile(text)).toThrow(fragment);
  };

  it("refuses something that is not JSON", () => refuses("<svg/>", "not JSON"));
  it("refuses a list", () => refuses("[1,2,3]", "a list"));
  it("refuses JSON that is not ours", () =>
    refuses(JSON.stringify({ nodes: [], links: [] }), "how to open"));
  it("refuses an empty object", () => refuses("{}", "how to open"));

  it("takes a design that is only half recognisable", () => {
    // One key we know is a design; the rest goes, and is named.
    const read = readDesignFile(JSON.stringify({ title: "HALF", nodes: [], links: [] }));
    expect(read.design.title).toBe("HALF");
    expect(read.kept).toEqual(["title"]);
    expect(read.dropped).toEqual(["nodes", "links"]);
  });
});
