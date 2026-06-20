/**
 * Minimal .env loader for scripts and the keeper (Next.js loads env itself).
 * Side-effect import: `import "@keel/shared/loadenv"` BEFORE importing config.
 * Reads <cwd>/.env without adding a dotenv dependency.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

function load(path: string): void {
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return; // no .env (e.g. prod uses real env) — fine
  }
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

/** Walk up from cwd to find the nearest .env (monorepo root). */
function findEnv(start: string): string | null {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    const candidate = resolve(dir, ".env");
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

const envPath = findEnv(process.cwd());
if (envPath) load(envPath);
