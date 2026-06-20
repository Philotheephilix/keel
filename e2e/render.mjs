// Render-pass: load every page with the test wallet, capture console/page errors + screenshots.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:3000";
const OUT = "/tmp/keel-shots";
mkdirSync(OUT, { recursive: true });

const routes = [
  ["landing", "/"],
  ["connect", "/connect"],
  ["dashboard", "/dashboard"],
  ["buy-cover", "/buy-cover"],
  ["underwriter", "/underwriter"],
  ["activity", "/activity"],
  ["settings", "/settings"],
];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
let anyError = false;

for (const [name, path] of routes) {
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));
  try {
    await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 45000 });
    await page.waitForTimeout(2500); // let queries resolve
    // detect a REAL Next error overlay (not the always-present dev portal)
    const bodyText = await page.evaluate(() => document.body.innerText).catch(() => "");
    const hasErrorOverlay = /Unhandled Runtime Error|Build Error|Cannot read properties|TypeError:|ReferenceError:/i.test(bodyText);
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
    const realErrors = errors.filter((e) => !/favicon|Download the React DevTools|hydrat/i.test(e));
    const status = hasErrorOverlay || realErrors.length > 0 ? "❌" : "✅";
    if (status === "❌") anyError = true;
    console.log(`${status} ${path}  (errorOverlay=${hasErrorOverlay}, consoleErrors=${realErrors.length})`);
    realErrors.slice(0, 3).forEach((e) => console.log("    · " + e.slice(0, 160)));
  } catch (e) {
    anyError = true;
    console.log(`❌ ${path}  EXCEPTION ${e.message.slice(0, 120)}`);
  }
  await page.close();
}

await browser.close();
console.log(anyError ? "\nRESULT: errors found" : "\nRESULT: all pages clean");
process.exit(anyError ? 1 : 0);
