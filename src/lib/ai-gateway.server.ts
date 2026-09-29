// Lovable AI Gateway (Responses API) — streams, accumulates text server-side, returns parsed JSON.
export class GatewayError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export async function gatewayJson(prompt: string, model = "openai/gpt-6-astra"): Promise<unknown> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new GatewayError("AI is not configured.", 401);
  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "fetch" },
    body: JSON.stringify({
      model, input: prompt, stream: true, store: false,
      reasoning: { effort: "low", summary: "auto" },
      include: ["reasoning.encrypted_content"],
    }),
  });
  if (!res.ok || !res.body) {
    let msg = "The AI service failed.";
    try { const j = (await res.json()) as { message?: string; error?: { message?: string } }; msg = j.message ?? j.error?.message ?? msg; } catch { /* ignore */ }
    if (res.status === 402) msg = "AI credits are used up. Add credits in Settings → Plans & credits.";
    if (res.status === 429) msg = "The AI is busy right now. Please try again in a minute.";
    throw new GatewayError(msg, res.status);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "", text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const d = line.slice(5).trim();
      if (!d || d === "[DONE]") continue;
      try {
        const ev = JSON.parse(d) as { type?: string; delta?: string };
        if (ev.type === "response.output_text.delta" && ev.delta) text += ev.delta;
        if (ev.type === "response.failed" || ev.type === "error") throw new GatewayError("The AI could not complete this request.", 500);
      } catch (e) { if (e instanceof GatewayError) throw e; }
    }
  }
  if (!text.trim()) throw new GatewayError("The AI returned no answer for this request.", 500);
  const t = text.trim().replace(/^```json/i, "").replace(/^```/, "").replace(/```$/, "");
  try { return JSON.parse(t); } catch {
    const s = t.indexOf("{"), e = t.lastIndexOf("}");
    if (s >= 0 && e > s) return JSON.parse(t.slice(s, e + 1));
    throw new GatewayError("The AI answer could not be read.", 500);
  }
}

export function interviewPrompt(resumeText: string, jobTitle: string, jobListing: string) {
  return `You are a senior hiring manager preparing a candidate for an interview.
Job title: ${jobTitle}
Job listing:
"""
${jobListing.slice(0, 15000)}
"""
Candidate resume:
"""
${resumeText.slice(0, 25000)}
"""
Write 10 interview questions tailored to this role and this candidate (mix of technical, behavioral, and questions probing resume gaps). For each, give a strong practice answer in first person grounded ONLY in the candidate's real experience (use STAR for behavioral), plus a short tip. Return ONLY JSON:
{"questions":[{"category":"Technical"|"Behavioral"|"Role fit"|"Gap","question":string,"answer":string,"tip":string}]}`;
}
