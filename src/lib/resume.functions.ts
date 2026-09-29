import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const parseResume = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { resumeId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: resume, error } = await supabase
      .from("resumes")
      .select("id, raw_text")
      .eq("id", data.resumeId)
      .eq("user_id", userId)
      .single();
    if (error || !resume) throw new Error("Resume not found.");
    if (!resume.raw_text || resume.raw_text.length < 30) {
      throw new Error("No readable text was found in this file.");
    }

    const { geminiJson, extractionPrompt } = await import("./gemini.server");
    try {
      const parsed = (await geminiJson(extractionPrompt(resume.raw_text))) as {
        confidence?: number;
      };
      const { error: updateError } = await supabase
        .from("resumes")
        .update({
          parsed: parsed as never,
          status: "parsed",
          overall_confidence: typeof parsed.confidence === "number" ? parsed.confidence : null,
          error_message: null,
        })
        .eq("id", resume.id)
        .eq("user_id", userId);
      if (updateError) throw new Error(updateError.message);
      return { ok: true as const };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Analysis failed.";
      await supabase
        .from("resumes")
        .update({ status: "failed", error_message: message })
        .eq("id", resume.id)
        .eq("user_id", userId);
      throw new Error(message);
    }
  });

export const analyzeAgainstJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { resumeId: string; jobTitle: string; jobDescription: string }) => {
    if (!input.jobDescription || input.jobDescription.trim().length < 40) {
      throw new Error("Please paste a job description of at least 40 characters.");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: resume, error } = await supabase
      .from("resumes")
      .select("id, raw_text")
      .eq("id", data.resumeId)
      .eq("user_id", userId)
      .single();
    if (error || !resume?.raw_text) throw new Error("Resume not found.");

    const { geminiJson, analysisPrompt } = await import("./gemini.server");
    const result = (await geminiJson(
      analysisPrompt(resume.raw_text, data.jobTitle, data.jobDescription),
    )) as { match_score?: number };

    const score =
      typeof result.match_score === "number"
        ? Math.max(0, Math.min(100, Math.round(result.match_score)))
        : null;

    const { data: inserted, error: insertError } = await supabase
      .from("analyses")
      .insert({
        user_id: userId,
        resume_id: resume.id,
        job_title: data.jobTitle || null,
        job_description: data.jobDescription,
        match_score: score,
        result: result as never,
      })
      .select("id")
      .single();
    if (insertError) throw new Error(insertError.message);

    return { id: inserted.id };
  });
