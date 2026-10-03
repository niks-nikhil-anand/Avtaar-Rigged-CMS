import { GoogleGenAI } from "@google/genai";
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
try {
  const models = await ai.models.list({ config: { pageSize: 100 } });
  for await (const model of models) {
    if (/live|native.audio/.test(model.name ?? "")) console.log(model.name, model.supportedActions);
  }
} catch (error) {
  console.log("Model availability check failed:", error.status ?? "network", String(error.message).replaceAll(process.env.GEMINI_API_KEY, "[redacted]"));
  process.exitCode = 1;
}
