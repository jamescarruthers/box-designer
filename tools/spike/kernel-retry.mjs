// §11 What a person sees when the kernel cannot be had, and how they get back.
//
// The wasm is blocked outright, so the job fails the way a dead connection
// fails it; then it is unblocked and the offered way back is taken.
import { chromium } from "playwright-core";

const url = process.argv[2] ?? "http://localhost:5011";
const out = process.argv[3] ?? ".";
const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1200, height: 850 }, deviceScaleFactor: 1.5 });

let blocking = true;
await page.route("**/*.wasm", (route) => (blocking ? route.abort("failed") : route.continue()));
await page.goto(url, { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });

await page.getByRole("button", { name: "OpenCASCADE" }).click();
await page.locator(".solid-state button").waitFor({ timeout: 120_000 });
console.log("failed with:", (await page.locator(".solid-state").innerText()).replace(/\s+/g, " "));
const around = async (name) => {
  const b = await page.locator(".solid-state").boundingBox();
  await page.screenshot({ path: `${out}/${name}.png`,
    clip: { x: b.x - 24, y: b.y - 18, width: b.width + 48, height: b.height + 36 } });
};
await around("kernel-failed");

blocking = false;
await page.getByRole("button", { name: "Try again" }).click();
for (let i = 0; i < 120; i++) {
  const s = (await page.locator(".solid-state").innerText()).replace(/\s+/g, " ");
  if (/B-Rep/.test(s)) { console.log("after Try again:", s); break; }
  await page.waitForTimeout(500);
}
await around("kernel-recovered");
await browser.close();
