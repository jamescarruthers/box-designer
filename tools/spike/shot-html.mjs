import { chromium } from "playwright-core";
const [inFile, outFile] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const p = await b.newPage({ viewport: { width: 1760, height: 700 }, deviceScaleFactor: 2 });
await p.goto("file://" + inFile);
await p.screenshot({ path: outFile, fullPage: true });
await b.close();
