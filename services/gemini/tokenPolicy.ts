/** This app is local-only. Same-origin checks are not a replacement for login on a public deployment. */
export function isLocalTokenRequest(request: Request): boolean {
  const url = new URL(request.url);
  const allowed = new Set(["localhost", "127.0.0.1", "[::1]"]);
  if (!allowed.has(url.hostname)) return false;
  const origin = request.headers.get("origin");
  return origin === url.origin && request.headers.get("sec-fetch-site") !== "cross-site";
}
export class TokenRateLimit {
  private attempts = new Map<string, number[]>();
  allow(key: string, now = Date.now()): boolean {
    for (const [entry, timestamps] of this.attempts) if ((timestamps.at(-1) ?? 0) < now - 60_000) this.attempts.delete(entry);
    const timestamps = (this.attempts.get(key) ?? []).filter((time) => now - time < 60_000);
    if (timestamps.length >= 6) return false;
    timestamps.push(now); this.attempts.set(key, timestamps); return true;
  }
}
