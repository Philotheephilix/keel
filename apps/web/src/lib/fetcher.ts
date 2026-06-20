/** Client-side fetch helper for the keel.* API with typed error surfacing. */
export type ApiError = { code: string; message: string };

export class KeelApiError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/keel${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = (json as { error?: ApiError }).error;
    throw new KeelApiError(err?.code ?? "INTERNAL", err?.message ?? `Request failed (${res.status})`);
  }
  return json as T;
}

export const api = {
  get: <T>(path: string) => call<T>(path),
  post: <T>(path: string, body: unknown) => call<T>(path, { method: "POST", body: JSON.stringify(body) }),
};
