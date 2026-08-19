// Every base class of every symbol we bind must itself be bound, or embind
// fails at the first call. Walk the `extends` chains transitively.
import fs from "fs";
const dts = fs.readFileSync("node_modules/opencascade.js/dist/opencascade.full.d.ts", "utf8");

const base = new Map();
for (const m of dts.matchAll(/export declare class (\w+)(?: extends (\w+))?/g)) {
  const name = m[1].replace(/_\d+$/, "");
  const parent = m[2] ? m[2].replace(/_\d+$/, "") : null;
  if (!base.has(name) || (parent && !base.get(name))) base.set(name, parent);
}
const known = new Set(base.keys());

const wanted = fs.readFileSync("occt/box-designer.yml", "utf8")
  .split("\n").filter((l) => l.includes("- symbol:")).map((l) => l.split("symbol:")[1].trim());

const closure = new Set();
for (const w of wanted) {
  let cur = w;
  while (cur && !closure.has(cur)) {
    closure.add(cur);
    cur = base.get(cur) ?? null;
  }
}
const extra = [...closure].filter((c) => !wanted.includes(c) && known.has(c)).sort();
console.log("declared:", wanted.length, " closure:", closure.size, " missing base classes:", extra.length);
console.log(extra.join("\n"));

// Handle types are separate classes in the full build.
const handles = wanted.filter((w) => known.has(`Handle_${w}`)).map((w) => `Handle_${w}`);
console.log("\nhandle types available for declared symbols:", handles.join(", ") || "(none)");
