import { interpretFallback, InterpretedRequest } from "@/lib/request";

export async function interpretRequest(prompt: string): Promise<{ data: InterpretedRequest; source: "openai" | "fallback" }> {
  const apiKey = process.env.OPENAI_API_KEY;
  const fallback = interpretFallback(prompt);
  if (!apiKey) return { data: fallback, source: "fallback" };

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-5-mini",
      input: [{ role: "system", content: "Extract a hotel purchase request. Never increase or invent the user's budget. Return only schema-valid data." }, { role: "user", content: prompt }],
      text: {
        format: {
          type: "json_schema",
          name: "hotel_purchase_request",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["destination", "timing", "guests", "rooms", "maxTotalMinor", "required", "preferred"],
            properties: {
              destination: { type: "string" }, timing: { type: "string" }, guests: { type: "integer", minimum: 1 }, rooms: { type: "integer", minimum: 1 },
              maxTotalMinor: { type: "integer", minimum: 1 }, required: { type: "array", items: { type: "string" } }, preferred: { type: "array", items: { type: "string" } },
            },
          },
        },
      },
    }),
  });
  if (!response.ok) return { data: fallback, source: "fallback" };
  const body = (await response.json()) as { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> };
  const outputText = body.output_text || body.output?.flatMap((item) => item.content || []).map((item) => item.text || "").join("");
  if (!outputText) return { data: fallback, source: "fallback" };
  try { return { data: JSON.parse(outputText) as InterpretedRequest, source: "openai" }; }
  catch { return { data: fallback, source: "fallback" }; }
}
