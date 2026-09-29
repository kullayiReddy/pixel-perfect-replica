const MODELS = ["gemini-3.8-flash", "gemini-3.5-flash", "gemini-3.1-flash-lite"];

export async function geminiJson(prompt: string): Promise<unknown> {
  const apiKey = process.env["GEMINI_API_KEY"];
  if (!apiKey) throw new Error("Gemini API key is not configured.");

  let lastError = "";
  for (const model of MODELS) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
        }),
      },
    );

    if (res.status === 404 || res.status === 429 || res.status >= 500) {
      lastError =
        res.status === 404
          ? `Model ${model} is not available for this API key.`
          : `The AI service is busy right now. Please try again in a moment.`;
      continue;
    }
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Gemini request failed (${res.status}): ${body.slice(0, 300)}`);
    }

    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    const jsonText = text.trim().replace(/^```json/i, "").replace(/^```/, "").replace(/```$/, "");
    try {
      return JSON.parse(jsonText);
    } catch {
      const start = jsonText.indexOf("{");
      const end = jsonText.lastIndexOf("}");
      if (start >= 0 && end > start) return JSON.parse(jsonText.slice(start, end + 1));
      throw new Error("Gemini returned a response that could not be read as structured data.");
    }
  }
  throw new Error(lastError || "No Gemini model available for this API key.");
}

export function extractionPrompt(resumeText: string) {
  return `You are a resume parsing engine. Read the resume text and return ONLY JSON matching this shape:
{
  "full_name": string, "email": string, "phone": string, "location": string,
  "linkedin": string, "github": string, "portfolio": string, "summary": string,
  "education": [{"title": string, "organization": string, "location": string, "start_date": string, "end_date": string, "description": string}],
  "experience": [{"title": string, "organization": string, "location": string, "start_date": string, "end_date": string, "highlights": [string], "technologies": [string]}],
  "internships": [same shape as experience],
  "projects": [{"title": string, "description": string, "highlights": [string], "technologies": [string]}],
  "skills": [string], "certifications": [string], "achievements": [string], "languages": [string],
  "confidence": number between 0 and 1
}
Use empty strings or empty arrays for anything not present. Never invent facts.

RESUME TEXT:
"""
${resumeText.slice(0, 60000)}
"""`;
}

export function analysisPrompt(resumeText: string, jobTitle: string, jobDescription: string) {
  return `You are an ATS (applicant tracking system) analyst. Compare the resume to the job description and return ONLY JSON:
{
  "match_score": integer 0-100,
  "verdict": one short sentence,
  "matching_keywords": [string], "missing_keywords": [string],
  "matching_skills": [string], "missing_skills": [string],
  "experience_relevance": {"score": integer 0-100, "comment": string},
  "project_relevance": {"score": integer 0-100, "comment": string},
  "ats_notes": [string],
  "suggestions": [string]
}
Keep each list to at most 15 items and each suggestion under 200 characters. Be specific and honest.

JOB TITLE: ${jobTitle || "(not given)"}

JOB DESCRIPTION:
"""
${jobDescription.slice(0, 20000)}
"""

RESUME TEXT:
"""
${resumeText.slice(0, 40000)}
"""`;
}
