// Drive the full Buy Cover flow through the UI: select -> configure -> quote -> buy (real testnet mint).
import { chromium } from "playwright";
const BASE = "http://localhost:3000";
const OUT = "/tmp/keel-shots";

const browser = await chromium.launch();
const page = await browser.newContext({ viewport: { width: 1100, height: 1000 } }).then((c) => c.newPage());
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const log = (...a) => console.log(...a);

await page.goto(`${BASE}/buy-cover`, { waitUntil: "networkidle", timeout: 45000 });
await page.waitForTimeout(1500);

// Step 1: pick the LONGEST-dated market (last row) — widest mintable band for a 2% trigger.
const selects = page.getByText("Select", { exact: false });
const count = await selects.count();
log("markets:", count);
await selects.nth(count - 1).click();
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/buy-step2-configure.png`, fullPage: true });

// Step 2: set coverage amount. Fill the first numeric input; trigger defaults to ~spot*0.98.
const numbers = page.locator('input[type="number"]');
const nInputs = await numbers.count();
log("number inputs:", nInputs);
await numbers.nth(0).fill("5"); // coverage $5; keep default trigger (~2% below spot)
await numbers.nth(0).blur().catch(() => {});
// wait for quote to compute
await page.waitForTimeout(5000);
await page.screenshot({ path: `${OUT}/buy-step2-quote.png`, fullPage: true });
log("page after quote (excerpt):", (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, " ").slice(0, 500));

// Continue to review (wait until enabled)
const cont = page.getByRole("button", { name: /^continue$/i }).first();
await cont.waitFor({ state: "visible", timeout: 20000 });
for (let i = 0; i < 30 && (await cont.isDisabled()); i++) await page.waitForTimeout(1000);
log("continue enabled:", !(await cont.isDisabled()));
await cont.click();
await page.waitForTimeout(2000);
await page.screenshot({ path: `${OUT}/buy-step3-review.png`, fullPage: true });

// Buy -> signs via test wallet, mints on testnet
const buy = page.getByRole("button", { name: /buy cover/i }).first();
await buy.waitFor({ state: "visible", timeout: 20000 });
log("buy button:", await buy.textContent());
await buy.click();
log("clicked buy; waiting for mint + navigation...");
// wait for navigation to policy detail or a success state (mint takes ~5-15s)
await page.waitForURL(/\/policy\//, { timeout: 60000 }).catch(() => log("no /policy navigation yet"));
await page.waitForTimeout(3000);
log("final url:", page.url());
await page.screenshot({ path: `${OUT}/buy-policy.png`, fullPage: true });
log("policy page (excerpt):", (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, " ").slice(0, 500));

log("pageerrors:", errors.slice(0, 3));
await browser.close();
