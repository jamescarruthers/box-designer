import { chromium } from "playwright-core";
import fs from "fs";
const [svgPath, out, scale = "3"] = process.argv.slice(2);
const svg = fs.readFileSync(svgPath, "utf8");
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 420 * +scale, height: 297 * +scale } });
await page.setContent(`<body style="margin:0">${svg.replace('width="100%"', `width="${420 * +scale}" height="${297 * +scale}"`)}</body>`);
await page.screenshot({ path: out });
await browser.close();
