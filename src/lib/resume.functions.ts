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

export type JobMatch = {
  title: string;
  seniority?: string;
  match_score: number;
  why?: string;
  matching_skills?: string[];
  missing_skills?: string[];
  search_keywords?: string;
  tailored_text?: string;
};

const clamp = (n: unknown) =>
  typeof n === "number" ? Math.max(0, Math.min(100, Math.round(n))) : 0;

export const suggestJobs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { resumeId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: resume } = await supabase
      .from("resumes").select("id, raw_text").eq("id", data.resumeId).eq("user_id", userId).single();
    if (!resume?.raw_text) throw new Error("Resume not found.");
    const { geminiJson, jobSuggestPrompt } = await import("./gemini.server");
    const out = (await geminiJson(jobSuggestPrompt(resume.raw_text))) as { jobs?: JobMatch[] };
    const jobs = (out.jobs ?? [])
      .filter((j) => j?.title)
      .map((j) => ({ ...j, match_score: clamp(j.match_score) }))
      .sort((a, b) => b.match_score - a.match_score);
    await supabase.from("resumes").update({ job_matches: jobs as never }).eq("id", resume.id).eq("user_id", userId);
    return { jobs };
  });

export const tailorResume = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { resumeId: string; jobTitle: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: resume } = await supabase
      .from("resumes").select("raw_text").eq("id", data.resumeId).eq("user_id", userId).single();
    if (!resume?.raw_text) throw new Error("Resume not found.");
    const { geminiJson, tailorPrompt } = await import("./gemini.server");
    const out = (await geminiJson(tailorPrompt(resume.raw_text, data.jobTitle))) as {
      tailored_text?: string; changes?: string[]; current_score?: number; projected_score?: number;
    };
    return {
      tailored_text: out.tailored_text ?? resume.raw_text,
      changes: out.changes ?? [],
      current_score: clamp(out.current_score),
      projected_score: clamp(out.projected_score),
    };
  });

export const saveEditedResume = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { resumeId: string; text: string; jobTitle: string }) => {
    if (!input.text || input.text.trim().length < 50) throw new Error("Resume text is too short.");
    return { ...input, text: input.text.slice(0, 60000) };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { geminiJson, extractionPrompt, scoreTitlePrompt } = await import("./gemini.server");
    const [parsed, score] = (await Promise.all([
      geminiJson(extractionPrompt(data.text)),
      geminiJson(scoreTitlePrompt(data.text, data.jobTitle)),
    ])) as [{ confidence?: number }, Partial<JobMatch>];

    const { data: row } = await supabase
      .from("resumes").select("job_matches").eq("id", data.resumeId).eq("user_id", userId).single();
    const jobs = ((row?.job_matches as JobMatch[] | null) ?? []).map((j) =>
      j.title === data.jobTitle
        ? { ...j, tailored_text: data.text, match_score: clamp(score.match_score), why: score.why ?? j.why,
            matching_skills: score.matching_skills ?? j.matching_skills,
            missing_skills: score.missing_skills ?? j.missing_skills }
        : j,
    );
    const { error } = await supabase.from("resumes").update({
      raw_text: data.text,
      parsed: parsed as never,
      status: "parsed",
      overall_confidence: typeof parsed.confidence === "number" ? parsed.confidence : null,
      job_matches: jobs as never,
    }).eq("id", data.resumeId).eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { score: clamp(score.match_score) };
  });

export type InterviewQA = { category: string; question: string; answer: string; tip: string };

export const generateInterviewPrep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { resumeId: string; jobTitle: string; jobListing: string }) => {
    if (!input.jobTitle?.trim()) throw new Error("Job title is required.");
    return { ...input, jobListing: (input.jobListing ?? "").slice(0, 15000) };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: resume } = await supabase
      .from("resumes").select("raw_text").eq("id", data.resumeId).eq("user_id", userId).single();
    if (!resume?.raw_text) throw new Error("Resume not found.");
    const { gatewayJson, interviewPrompt } = await import("./ai-gateway.server");
    const out = (await gatewayJson(
      interviewPrompt(resume.raw_text, data.jobTitle, data.jobListing || `A typical ${data.jobTitle} role.`),
    )) as { questions?: InterviewQA[] };
    return { questions: (out.questions ?? []).filter((q) => q?.question) };
  });
