import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Download, ExternalLink, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  saveEditedResume, suggestJobs, tailorResume, type JobMatch,
} from "@/lib/resume.functions";
import { downloadResumePdf } from "@/lib/resume-pdf";

function platformLinks(q: string) {
  const e = encodeURIComponent(q);
  const slug = q.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-");
  return [
    { name: "LinkedIn", url: `https://www.linkedin.com/jobs/search/?keywords=${e}` },
    { name: "Indeed", url: `https://www.indeed.com/jobs?q=${e}` },
    { name: "Naukri", url: `https://www.naukri.com/${slug}-jobs` },
    { name: "Glassdoor", url: `https://www.glassdoor.com/Job/jobs.htm?sc.keyword=${e}` },
    { name: "Wellfound", url: `https://wellfound.com/jobs?q=${e}` },
    { name: "Google Jobs", url: `https://www.google.com/search?q=${e}+jobs&ibp=htl;jobs` },
  ];
}

export function JobMatches({
  resumeId, rawText, jobs,
}: { resumeId: string; rawText: string; jobs: JobMatch[] | null }) {
  const qc = useQueryClient();
  const suggest = useServerFn(suggestJobs);
  const tailor = useServerFn(tailorResume);
  const save = useServerFn(saveEditedResume);
  const [editing, setEditing] = useState<JobMatch | null>(null);
  const [text, setText] = useState("");
  const [changes, setChanges] = useState<string[]>([]);
  const [projected, setProjected] = useState<number | null>(null);
  const started = useRef(false);

  const find = useMutation({
    mutationFn: () => suggest({ data: { resumeId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["resume", resumeId] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not find jobs."),
  });

  useEffect(() => {
    if (!jobs && !started.current) { started.current = true; find.mutate(); }
  }, [jobs, find]);

  const aiTailor = useMutation({
    mutationFn: (title: string) => tailor({ data: { resumeId, jobTitle: title } }),
    onSuccess: (r) => { setText(r.tailored_text); setChanges(r.changes); setProjected(r.projected_score); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not tailor resume."),
  });

  const saveRun = useMutation({
    mutationFn: () => save({ data: { resumeId, text, jobTitle: editing!.title } }),
    onSuccess: (r) => {
      const before = editing?.match_score ?? 0;
      toast.success(`New score for ${editing?.title}: ${r.score}% (${r.score - before >= 0 ? "+" : ""}${r.score - before})`);
      setEditing(null);
      void qc.invalidateQueries({ queryKey: ["resume", resumeId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save."),
  });

  const open = (j: JobMatch) => {
    setEditing(j); setText(j.tailored_text ?? rawText); setChanges([]); setProjected(null);
  };

  if (!jobs) {
    return (
      <div className="surface flex items-center gap-3 rounded-xl p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Finding job titles that fit this resume…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Roles you match best, with live searches on popular job sites.</p>
        <Button variant="outline" size="sm" onClick={() => find.mutate()} disabled={find.isPending}>
          {find.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Refresh
        </Button>
      </div>
      {jobs.map((j) => (
        <div key={j.title} className="surface rounded-xl p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-display text-lg font-semibold">{j.title}</h3>
              {j.seniority && <p className="text-xs text-muted-foreground">{j.seniority}</p>}
              {j.why && <p className="mt-1 text-sm text-muted-foreground">{j.why}</p>}
            </div>
            <div className="text-right">
              <div className="font-display text-3xl font-bold text-primary">{j.match_score}%</div>
              <Progress value={j.match_score} className="mt-1 h-1.5 w-28" />
            </div>
          </div>
          {!!j.missing_skills?.length && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              <span className="text-xs text-muted-foreground">Missing:</span>
              {j.missing_skills.slice(0, 8).map((s) => <Badge key={s} variant="outline">{s}</Badge>)}
            </div>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {platformLinks(j.search_keywords || j.title).map((p) => (
              <a key={p.name} href={p.url} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs hover:bg-muted">
                {p.name} <ExternalLink className="h-3 w-3" />
              </a>
            ))}
            {j.tailored_text && (
              <Button size="sm" variant="outline" className="ml-auto"
                onClick={() => void downloadResumePdf(j.tailored_text!, j.title)}>
                <Download className="h-4 w-4" /> PDF
              </Button>
            )}
            <Button size="sm" className={j.tailored_text ? "" : "ml-auto"} onClick={() => open(j)}>
              <Sparkles className="h-4 w-4" /> Improve for this job
            </Button>
          </div>
        </div>
      ))}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Edit resume for {editing?.title}</DialogTitle>
            <DialogDescription>
              Current score {editing?.match_score}%. Edit freely or let AI rewrite it, then save to re-score.
            </DialogDescription>
          </DialogHeader>
          <Button variant="outline" size="sm" className="w-fit"
            onClick={() => editing && aiTailor.mutate(editing.title)} disabled={aiTailor.isPending}>
            {aiTailor.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Rewrite with AI
          </Button>
          {projected !== null && (
            <div className="rounded-md bg-muted p-3 text-sm">
              <p className="font-medium">Estimated score after changes: {projected}%</p>
              <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                {changes.slice(0, 6).map((c) => <li key={c}>{c}</li>)}
              </ul>
            </div>
          )}
          <Textarea value={text} onChange={(e) => setText(e.target.value)} className="h-80 font-mono text-xs" />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button variant="outline" onClick={() => editing && void downloadResumePdf(text, editing.title)}>
              <Download className="h-4 w-4" /> Download PDF
            </Button>
            <Button onClick={() => saveRun.mutate()} disabled={saveRun.isPending}>
              {saveRun.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save & re-score
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
