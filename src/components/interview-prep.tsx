import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { generateInterviewPrep, type InterviewQA, type JobMatch } from "@/lib/resume.functions";

export function InterviewPrep({ resumeId, jobs }: { resumeId: string; jobs: JobMatch[] }) {
  const run = useServerFn(generateInterviewPrep);
  const [title, setTitle] = useState(jobs[0]?.title ?? "");
  const [listing, setListing] = useState("");
  const [qs, setQs] = useState<InterviewQA[]>([]);

  const gen = useMutation({
    mutationFn: () => run({ data: { resumeId, jobTitle: title, jobListing: listing } }),
    onSuccess: (r) => { setQs(r.questions); if (!r.questions.length) toast.error("No questions returned."); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not generate questions."),
  });

  return (
    <div className="space-y-6">
      <div className="surface space-y-4 rounded-xl p-5">
        {jobs.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {jobs.map((j) => (
              <Button key={j.title} size="sm" variant={title === j.title ? "default" : "outline"} onClick={() => setTitle(j.title)}>
                {j.title}
              </Button>
            ))}
          </div>
        )}
        <div className="space-y-1.5">
          <Label>Job title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Backend Engineer" />
        </div>
        <div className="space-y-1.5">
          <Label>Job listing (optional — paste for sharper questions)</Label>
          <Textarea value={listing} onChange={(e) => setListing(e.target.value)} className="h-32" placeholder="Paste the job description from LinkedIn, Naukri, etc." />
        </div>
        <Button onClick={() => gen.mutate()} disabled={gen.isPending || !title.trim()}>
          {gen.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
          {gen.isPending ? "Preparing questions…" : "Generate interview questions"}
        </Button>
      </div>

      {qs.length > 0 && (
        <Accordion type="multiple" className="surface rounded-xl px-5">
          {qs.map((q, i) => (
            <AccordionItem key={i} value={String(i)}>
              <AccordionTrigger className="text-left">
                <span className="flex items-start gap-3">
                  <Badge variant="outline" className="shrink-0">{q.category}</Badge>
                  <span>{q.question}</span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="space-y-3">
                <p className="whitespace-pre-line text-sm leading-relaxed">{q.answer}</p>
                {q.tip && <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">Tip: {q.tip}</p>}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
}
