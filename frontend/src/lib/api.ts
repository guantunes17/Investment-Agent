const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";

export async function apiFetch<T>(
  path: string,
  options?: RequestInit & { timeout?: number }
): Promise<T> {
  const { timeout = 8000, ...fetchOptions } = options ?? {};

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { "Content-Type": "application/json", ...fetchOptions?.headers },
      signal: controller.signal,
      ...fetchOptions,
    });
    if (!res.ok) {
      const errText = await res.text();
      let detail = `${res.status} ${res.statusText}`;
      if (errText.trim()) {
        detail = errText;
      }
      throw new Error(`API error: ${detail}`);
    }
    // DELETE often returns 204 No Content — no JSON body
    if (res.status === 204) {
      return undefined as T;
    }
    const text = await res.text();
    if (!text.trim()) {
      return undefined as T;
    }
    return JSON.parse(text) as T;
  } finally {
    clearTimeout(timer);
  }
}
