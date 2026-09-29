import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Target, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { analyzeAgainstJob } from "@/lib/resume.functions";
import type { AnalysisResult, ParsedResume, ResumeEntry } from "@/lib/resume-types";

export const Route = createFileRoute("/_authenticated/resumes/$id")({
  head: () => ({
    meta: [
      { title: "Resume details | Resume Analyzer" },
      { name: "description", content: "Structured resume details and job match analysis." },
      { property: "og:title", content: "Resume details | Resume Analyzer" },
      {
        property: "og:description",
        content: "Structured resume details and job match analysis.",
      },
    ],
  }),
  component: ResumeDetails,
});

function ResumeDetails() {
  const { id } = Route.useParams();
  const queryClient = useQueryClient();
  const runAnalysis = useServerFn(analyzeAgainstJob);
  const [jobTitle, setJobTitle] = useState("");
  const [jobDescription, setJobDescription] = useState("");

  const resume = useQuery({
    queryKey: ["resume", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("resumes").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const analyses = useQuery({
    queryKey: ["analyses", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("analyses")
        .select("*")
        .eq("resume_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const analyze = useMutation({
    mutationFn: async () => runAnalysis({ data: { resumeId: id, jobTitle, jobDescription } }),
    onSuccess: () => {
      toast.success("Analysis ready.");
      setJobDescription("");
      void queryClient.invalidateQueries({ queryKey: ["analyses"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Analysis failed."),
  });

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("resumes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Resume deleted.");
      window.location.href = "/dashboard";
    },
  });

  if (resume.isLoading) {
    return (
      <AppShell>
        <Skeleton className="h-64 w-full" />
      </AppShell>
    );
  }

  const parsed = (resume.data?.parsed ?? {}) as ParsedResume;

  return (
    <AppShell>
      <Button asChild variant="ghost" size="sm">
        <Link to="/dashboard">
          <ArrowLeft className="size-4" />
          Dashboard
        </Link>
      </Button>

      <div className="mt-4 flex flex-wrap items-start gap-3">
        <div>
          <h1 className="text-3xl font-semibold">{parsed.full_name || resume.data?.original_filename}</h1>
          <p className="text-sm text-muted-foreground">
            {[parsed.email, parsed.phone, parsed.location].filter(Boolean).join(" · ") ||
              resume.data?.original_filename}
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-sm">
            {[parsed.linkedin, parsed.github, parsed.portfolio].filter(Boolean).map((link) => (
              <a
                key={link}
                href={link!.startsWith("http") ? link! : `https://${link}`}
                target="_blank"
                rel="noreferrer"
                className="text-primary underline-offset-4 hover:underline"
              >
                {link}
              </a>
            ))}
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto text-destructive"
          onClick={() => remove.mutate()}
        >
          <Trash2 className="size-4" />
          Delete
        </Button>
      </div>

      {resume.data?.status === "failed" && (
        <p className="surface mt-4 border-destructive p-4 text-sm text-destructive">
          {resume.data.error_message}
        </p>
      )}

      <Tabs defaultValue="profile" className="mt-8">
        <TabsList>
          <TabsTrigger value="profile">Extracted resume</TabsTrigger>
          <TabsTrigger value="match">Job match</TabsTrigger>
          <TabsTrigger value="text">Raw text</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-6 space-y-6">
          {parsed.summary && (
            <Section title="Summary">
              <p className="text-sm text-muted-foreground">{parsed.summary}</p>
            </Section>
          )}
          {!!parsed.skills?.length && (
            <Section title="Skills">
              <div className="flex flex-wrap gap-2">
                {parsed.skills.map((s) => (
                  <Badge key={s} variant="secondary">
                    {s}
                  </Badge>
                ))}
              </div>
            </Section>
          )}
          <EntryList title="Experience" entries={parsed.experience} />
          <EntryList title="Internships" entries={parsed.internships} />
          <EntryList title="Projects" entries={parsed.projects} />
          <EntryList title="Education" entries={parsed.education} />
          <BulletList title="Certifications" items={parsed.certifications} />
          <BulletList title="Achievements" items={parsed.achievements} />
          <BulletList title="Languages" items={parsed.languages} />
        </TabsContent>

        <TabsContent value="match" className="mt-6 space-y-6">
          <Section title="Analyze against a job description">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="job-title">Job title</Label>
                <Input
                  id="job-title"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="Backend Engineer"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="jd">Job description</Label>
                <Textarea
                  id="jd"
                  rows={8}
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  placeholder="Paste the full job description here…"
                />
              </div>
              <Button onClick={() => analyze.mutate()} disabled={analyze.isPending}>
                {analyze.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Analyzing…
                  </>
                ) : (
                  <>
                    <Target className="size-4" />
                    Run analysis
                  </>
                )}
              </Button>
            </div>
          </Section>

          {analyses.data?.map((a) => (
            <AnalysisCard
              key={a.id}
              title={a.job_title || "Untitled role"}
              date={a.created_at}
              score={a.match_score}
              result={(a.result ?? {}) as AnalysisResult}
            />
          ))}
        </TabsContent>

        <TabsContent value="text" className="mt-6">
          <Section title="Text we read from the file">
            <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap text-sm text-muted-foreground">
              {resume.data?.raw_text}
            </pre>
          </Section>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="surface p-6">
      <h2 className="mb-4 text-lg font-semibold">{title}</h2>
      {children}
    </div>
  );
}

function EntryList({ title, entries }: { title: string; entries?: ResumeEntry[] | undefined }) {
  if (!entries?.length) return null;
  return (
    <Section title={title}>
      <ul className="space-y-5">
        {entries.map((e, i) => (
          <li key={`${e.title}-${i}`}>
            <div className="flex flex-wrap items-baseline gap-2">
              <p className="font-medium">{e.title}</p>
              {e.organization && <p className="text-sm text-muted-foreground">{e.organization}</p>}
              <p className="ml-auto text-xs text-muted-foreground">
                {[e.start_date, e.end_date].filter(Boolean).join(" – ")}
              </p>
            </div>
            {e.description && <p className="mt-1 text-sm text-muted-foreground">{e.description}</p>}
            {!!e.highlights?.length && (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {e.highlights.map((h, j) => (
                  <li key={j}>{h}</li>
                ))}
              </ul>
            )}
            {!!e.technologies?.length && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {e.technologies.map((t) => (
                  <Badge key={t} variant="outline">
                    {t}
                  </Badge>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
    </Section>
  );
}

function BulletList({ title, items }: { title: string; items?: string[] | undefined }) {
  if (!items?.length) return null;
  return (
    <Section title={title}>
      <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </Section>
  );
}

function AnalysisCard({
  title,
  date,
  score,
  result,
}: {
  title: string;
  date: string;
  score: number | null;
  result: AnalysisResult;
}) {
  return (
    <div className="surface p-6">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-lg font-semibold">{title}</h3>
        <span className="text-xs text-muted-foreground">
          {new Date(date).toLocaleDateString()}
        </span>
        <span className="ml-auto font-display text-3xl font-semibold text-primary">
          {score ?? "—"}
          <span className="text-base">%</span>
        </span>
      </div>
      <Progress value={score ?? 0} className="mt-3" />
      {result.verdict && <p className="mt-3 text-sm text-muted-foreground">{result.verdict}</p>}

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <KeywordBlock title="Matching keywords" items={result.matching_keywords} tone="success" />
        <KeywordBlock title="Missing keywords" items={result.missing_keywords} tone="destructive" />
        <KeywordBlock title="Matching skills" items={result.matching_skills} tone="success" />
        <KeywordBlock title="Missing skills" items={result.missing_skills} tone="destructive" />
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Relevance label="Experience relevance" value={result.experience_relevance} />
        <Relevance label="Project relevance" value={result.project_relevance} />
      </div>

      {!!result.ats_notes?.length && (
        <div className="mt-5">
          <p className="text-sm font-medium">ATS notes</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {result.ats_notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </div>
      )}

      {!!result.suggestions?.length && (
        <div className="mt-5">
          <p className="text-sm font-medium">Suggested improvements</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {result.suggestions.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function KeywordBlock({
  title,
  items,
  tone,
}: {
  title: string;
  items?: string[] | undefined;
  tone: "success" | "destructive";
}) {
  if (!items?.length) return null;
  return (
    <div>
      <p className="text-sm font-medium">{title}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {items.map((k) => (
          <Badge key={k} variant={tone === "success" ? "secondary" : "outline"}>
            {k}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function Relevance({
  label,
  value,
}: {
  label: string;
  value?: { score?: number; comment?: string } | undefined;
}) {
  if (!value) return null;
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-sm text-muted-foreground">{value.score ?? "—"}%</p>
      </div>
      <Progress value={value.score ?? 0} className="mt-2" />
      {value.comment && <p className="mt-2 text-sm text-muted-foreground">{value.comment}</p>}
    </div>
  );
}
