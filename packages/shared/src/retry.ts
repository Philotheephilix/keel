/**
 * Standalone retrying fetch — ZERO imports so it is safe to use from browser client
 * components without pulling in config/db/Sui. Retries 429/503 + transient network
 * errors with exponential backoff + jitter (the public testnet fullnode throttles hard).
 */
export function retryingFetch(maxRetries = 5): typeof fetch {
  return async (input: any, init?: any) => {
    let lastErr: unknown;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const res = await fetch(input, init);
        if ((res.status === 429 || res.status === 503) && attempt < maxRetries) {
          const retryAfter = Number(res.headers.get("retry-after"));
          const wait = retryAfter > 0 ? retryAfter * 1000 : Math.min(8000, 300 * 2 ** attempt) + Math.random() * 250;
          await new Promise((r) => setTimeout(r, wait));
          continue;
        }
        return res;
      } catch (e) {
        lastErr = e;
        if (attempt >= maxRetries) throw e;
        await new Promise((r) => setTimeout(r, Math.min(8000, 300 * 2 ** attempt) + Math.random() * 250));
      }
    }
    throw lastErr;
  };
}
