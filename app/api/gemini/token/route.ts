import { GoogleGenAI } from "@google/genai";
import { DEFAULT_LIVE_MODEL, liveConfig } from "@/services/gemini/config";
import { isLocalTokenRequest, TokenRateLimit } from "@/services/gemini/tokenPolicy";

export const runtime = "nodejs";
const limiter = new TokenRateLimit();
const headers = { "Cache-Control": "no-store", "Pragma": "no-cache" };
export async function POST(request: Request) {
  if (!isLocalTokenRequest(request)) return Response.json({ error: "Live sessions are available only from this app on localhost." }, { status: 403, headers });
  if (!limiter.allow(new URL(request.url).host)) return Response.json({ error: "Too many connection attempts. Wait one minute and try again." }, { status: 429, headers: { ...headers, "Retry-After": "60" } });
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return Response.json({ error: "Set GEMINI_API_KEY in .env.local and restart the server." }, { status: 503, headers });
  const model = process.env.GEMINI_LIVE_MODEL || DEFAULT_LIVE_MODEL;
  try {
    const ai = new GoogleGenAI({ apiKey, httpOptions: { apiVersion: "v1beta", timeout: 15_000 } });
    const expiresAt = new Date(Date.now() + 30 * 60_000).toISOString();
    const token = await ai.authTokens.create({ config: {
      uses: 1, expireTime: expiresAt, newSessionExpireTime: new Date(Date.now() + 60_000).toISOString(),
      liveConnectConstraints: { model, config: liveConfig() },
    } });
    if (!token.name) throw new Error("Token provisioning returned no token.");
    return Response.json({ token: token.name, model, expiresAt }, { headers });
  } catch (error) {
    const status = typeof error === "object" && error !== null && "status" in error ? Number(error.status) : 0;
    // Never return upstream error bodies: these can include credential-bearing URLs.
    const message = status === 429 ? "Gemini quota was exceeded. Check your account quota and try again later."
      : status === 400 || status === 401 || status === 403 ? "Gemini rejected the server credential or Live configuration. Check the key, model access, and billing."
      : "Could not obtain a Gemini Live token. Check your network and model access, then retry.";
    return Response.json({ error: message }, { status: status === 429 ? 429 : 502, headers });
  }
}
