import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FileText, Plus, Target, TrendingUp } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import type { ParsedResume } from "@/lib/resume-types";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard | Resume Analyzer" },
      { name: "description", content: "Your resumes, match scores and analysis history." },
      { property: "og:title", content: "Dashboard | Resume Analyzer" },
      { property: "og:description", content: "Your resumes, match scores and analysis history." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const resumes = useQuery({
    queryKey: ["resumes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resumes")
        .select("id, original_filename, file_type, status, parsed, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const analyses = useQuery({
    queryKey: ["analyses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("analyses")
        .select("id, resume_id, job_title, match_score, created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  const scores = (analyses.data ?? []).filter((a) => a.match_score !== null);
  const avg = scores.length
    ? Math.round(scores.reduce((s, a) => s + (a.match_score ?? 0), 0) / scores.length)
    : null;

  const chartData = [...scores]
    .reverse()
    .slice(-8)
    .map((a) => ({ name: a.job_title?.slice(0, 14) || "Job", score: a.match_score ?? 0 }));

  return (
    <AppShell>
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Your resumes and job match history.</p>
        </div>
        <Button asChild className="ml-auto">
          <Link to="/upload">
            <Plus className="size-4" />
            Upload resume
          </Link>
        </Button>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Stat icon={FileText} label="Resumes" value={resumes.data?.length ?? 0} />
        <Stat icon={Target} label="Analyses" value={analyses.data?.length ?? 0} />
        <Stat icon={TrendingUp} label="Average match" value={avg === null ? "—" : `${avg}%`} />
      </div>

      {chartData.length > 1 && (
        <div className="surface mt-6 p-6">
          <h2 className="text-lg font-semibold">Recent match scores</h2>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} stroke="var(--color-muted-foreground)" />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "0.75rem",
                  }}
                />
                <Bar dataKey="score" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="surface mt-6 p-6">
        <h2 className="text-lg font-semibold">Your resumes</h2>
        {resumes.isLoading ? (
          <div className="mt-4 space-y-3">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : resumes.data?.length ? (
          <ul className="mt-4 divide-y divide-border">
            {resumes.data.map((r) => {
              const parsed = (r.parsed ?? {}) as ParsedResume;
              return (
                <li key={r.id}>
                  <Link
                    to="/resumes/$id"
                    params={{ id: r.id }}
                    className="flex flex-wrap items-center gap-3 py-3 transition-colors hover:text-primary"
                  >
                    <FileText className="size-4 text-muted-foreground" />
                    <span className="font-medium">{parsed.full_name || r.original_filename}</span>
                    <span className="text-sm text-muted-foreground">{r.original_filename}</span>
                    <Badge
                      variant={r.status === "parsed" ? "secondary" : "outline"}
                      className="ml-auto capitalize"
                    >
                      {r.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString()}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            No resumes yet. Upload a PDF or Word file to get started.
          </p>
        )}
      </div>
    </AppShell>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof FileText;
  label: string;
  value: string | number;
}) {
  return (
    <div className="surface p-5">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="size-4 text-primary" />
        {label}
      </div>
      <p className="mt-2 font-display text-3xl font-semibold">{value}</p>
    </div>
  );
}
