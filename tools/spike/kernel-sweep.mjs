// Which geometry makes the kernel throw? Sweep edge treatments, radii, mitres,
// reinforcement and fittings in combination, and report every one that fails.
//
// Reported as "working: 7210856 — showing the ring-stack solids": an OCCT
// exception surfacing as the bare pointer Emscripten throws. The message says
// nothing, so the shape has to be found by trying shapes.
import { chromium } from "playwright-core";

const app = process.env.APP ?? "http://localhost:5013/";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
page.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));

const settle = async (ms = 60000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const n = (await page.locator(".solid-state").innerText().catch(() => "")) || "";
    if (/B-Rep/.test(n)) return { ok: true, note: n.split("\n")[0] };
    if (/ring-stack|unavailable|Try again/.test(n)) return { ok: false, note: n.split("\n")[0] };
    await page.waitForTimeout(200);
  }
  return { ok: false, note: "STUCK" };
};

await page.goto(app, { waitUntil: "domcontentloaded" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
console.log("baseline".padEnd(30), (await settle()).note);
const key = await page.evaluate(() => Object.keys(localStorage).find((k) => /box|design/i.test(k)) ?? "(none)");
console.log("storage key:", key);

async function withDesign(patch) {
  await page.evaluate(({ p, k }) => {
    const base = JSON.parse(localStorage.getItem(k) ?? "{}");
    localStorage.setItem(k, JSON.stringify({ ...base, ...p }));
  }, { p: patch, k: key });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(700);
  return settle();
}

const driver = (over = {}) => ({
  id: "d1", type: "driver", face: "front", at: { a: 50, b: 50 }, units: "ratio",
  cutout: 116, outer: 162, pcd: 147, bolts: 5, boltHole: 5,
  depth: 78, magnet: 90, magnetDepth: 32, ...over,
});
const uniform = (type, radius) => ({ edge: { type, radius, perEdge: false, by: {} } });

const CASES = [
  ["fillet 12", uniform("fillet", 12)],
  ["fillet 30", uniform("fillet", 30)],
  ["fillet 60", uniform("fillet", 60)],
  ["fillet 100", uniform("fillet", 100)],
  ["chamfer 30", uniform("chamfer", 30)],
  ["chamfer 80", uniform("chamfer", 80)],
  ["fillet 12 + driver", { ...uniform("fillet", 12), fittings: [driver()] }],
  ["fillet 40 + driver", { ...uniform("fillet", 40), fittings: [driver()] }],
  ["mitre ring + driver", {
    edge: {
      type: "none", radius: 12, perEdge: true,
      by: {
        "front|left": { type: "mitre" }, "front|right": { type: "mitre" },
        "back|left": { type: "mitre" }, "back|right": { type: "mitre" },
      },
    },
    fittings: [driver()],
  }],
  ["cladding + doubler + driver", {
    cladding: { front: { material: "birch", thickness: 6 } },
    doubler: { front: { material: "birch", thickness: 12 } },
    fittings: [driver()],
  }],
  ["driver on every face", {
    fittings: ["front", "back", "left", "right", "top", "bottom"]
      .map((f, i) => driver({ id: `d${i}`, face: f })),
  }],
  ["port, long tube", {
    fittings: [{
      id: "p1", type: "port", face: "front", at: { a: 50, b: 20 }, units: "ratio",
      diameter: 68, length: 400, wall: 3, tube: true,
    }],
  }],
  ["driver + port + tube", {
    fittings: [driver(), {
      id: "p1", type: "port", face: "front", at: { a: 50, b: 15 }, units: "ratio",
      diameter: 68, length: 250, wall: 3, tube: true,
    }],
  }],
  ["fillet 40 + mitres + driver + tube", {
    edge: {
      type: "fillet", radius: 40, perEdge: true,
      by: { "front|left": { type: "mitre" }, "front|right": { type: "mitre" }, "top|left": { type: "fillet", radius: 40 } },
    },
    fittings: [driver(), {
      id: "p1", type: "port", face: "back", at: { a: 50, b: 20 }, units: "ratio",
      diameter: 68, length: 200, wall: 3, tube: true,
    }],
  }],
];

for (const [name, patch] of CASES) {
  const r = await withDesign(patch);
  console.log(name.padEnd(30), r.ok ? "ok  " : "FAIL", r.note);
}
await browser.close();
