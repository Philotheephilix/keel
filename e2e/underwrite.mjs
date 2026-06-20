// Drive the Underwriter supply flow through the UI (real testnet supply).
import { chromium } from "playwright";
const BASE = "http://localhost:3000";
const OUT = "/tmp/keel-shots";
const browser = await chromium.launch();
const page = await browser.newContext({ viewport: { width: 1100, height: 1000 } }).then((c) => c.newPage());
const errs = [];
page.on("pageerror", (e) => errs.push(e.message));
const log = (...a) => console.log(...a);

await page.goto(`${BASE}/underwriter`, { waitUntil: "networkidle", timeout: 45000 });
await page.waitForTimeout(3000);
await page.screenshot({ path: `${OUT}/underwriter-before.png`, fullPage: true });
const before = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, " ");
log("before:", before.slice(0, 300));

// Supply $2
const supplyInput = page.locator('input[type="number"]').first();
await supplyInput.fill("2");
const supplyBtn = page.getByRole("button", { name: /^supply$/i }).first();
await supplyBtn.click();
log("clicked Supply $2; waiting for tx...");
// wait for the success notice or position refresh
await page.waitForTimeout(15000);
await page.screenshot({ path: `${OUT}/underwriter-after.png`, fullPage: true });
const after = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, " ");
log("after:", after.slice(0, 400));
log("supply notice present:", /Supplied/i.test(after));
log("pageerrors:", errs.slice(0, 3));
await browser.close();
