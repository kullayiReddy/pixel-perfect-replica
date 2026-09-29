import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Briefcase, ExternalLink, Loader2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { fetchOpenings, type Opening } from "@/lib/resume.functions";

const COUNTRIES = [
  ["in", "India"], ["us", "USA"], ["gb", "UK"], ["ca", "Canada"], ["au", "Australia"],
  ["de", "Germany"], ["sg", "Singapore"], ["nl", "Netherlands"], ["fr", "France"],
  ["nz", "New Zealand"], ["za", "South Africa"],
] as const;

export function JobOpenings({
  resumeId, jobTitle, initial,
}: { resumeId: string; jobTitle: string; initial?: Opening[] | undefined }) {
  const qc = useQueryClient();
  const run = useServerFn(fetchOpenings);
  const [country, setCountry] = useState("in");
  const [where, setWhere] = useState("");
  const [open, setOpen] = useState(!!initial?.length);

  const load = useMutation({
    mutationFn: () => run({ data: { resumeId, jobTitle, country, where } }),
    onSuccess: (r) => {
      setOpen(true);
      if (!r.openings.length) toast.info("No live openings found for this search.");
      void qc.invalidateQueries({ queryKey: ["resume", resumeId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not load openings."),
  });

  const list = load.data?.openings ?? initial ?? [];

  return (
    <div className="mt-4 border-t pt-4">
      <div className="flex flex-wrap items-center gap-2">
        <select value={country} onChange={(e) => setCountry(e.target.value)}
          className="h-8 rounded-md border bg-background px-2 text-xs" aria-label="Country">
          {COUNTRIES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
        </select>
        <Input value={where} onChange={(e) => setWhere(e.target.value)} placeholder="City (optional)" className="h-8 w-40 text-xs" />
        <Button size="sm" variant="secondary" onClick={() => load.mutate()} disabled={load.isPending}>
          {load.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Briefcase className="h-4 w-4" />}
          {list.length ? "Refresh live openings" : "Find live openings"}
        </Button>
        {list.length > 0 && (
          <Button size="sm" variant="ghost" onClick={() => setOpen(!open)}>
            {open ? "Hide" : `Show ${list.length}`}
          </Button>
        )}
      </div>
      {open && list.length > 0 && (
        <ul className="mt-3 space-y-2">
          {list.map((o) => (
            <li key={o.id} className="flex items-start justify-between gap-3 rounded-lg border p-3">
              <div className="min-w-0">
                <a href={o.url} target="_blank" rel="noreferrer" className="font-medium hover:underline">
                  {o.title} <ExternalLink className="inline h-3 w-3" />
                </a>
                <p className="text-xs text-muted-foreground">
                  {o.company}
                  {o.location && <> · <MapPin className="inline h-3 w-3" /> {o.location}</>}
                  {o.salary && <> · {o.salary}</>}
                </p>
                {o.why && <p className="mt-1 text-xs text-muted-foreground">{o.why}</p>}
                {!!o.missing_skills?.length && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {o.missing_skills.slice(0, 5).map((s) => <Badge key={s} variant="outline" className="text-[10px]">{s}</Badge>)}
                  </div>
                )}
              </div>
              <div className="shrink-0 text-right">
                <div className="font-display text-xl font-bold text-primary">{o.match_score}%</div>
                <a href={o.url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">Apply</a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
