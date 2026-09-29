import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, FileText, ListChecks, Sparkles, Target } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Resume Analyzer — structured resumes and ATS job matching" },
      {
        name: "description",
        content:
          "Upload a PDF or Word resume, get every detail extracted automatically, and score it against any job description.",
      },
      { property: "og:title", content: "Resume Analyzer — structured resumes and ATS job matching" },
      {
        property: "og:description",
        content:
          "Upload a PDF or Word resume, get every detail extracted automatically, and score it against any job description.",
      },
    ],
  }),
  component: Landing,
});

const features = [
  {
    icon: FileText,
    title: "Every detail, structured",
    body: "Contact info, education, experience, internships, projects, skills, certifications, achievements and languages — pulled out automatically.",
  },
  {
    icon: Target,
    title: "Job match scoring",
    body: "Paste a job description and get a match score with matching and missing keywords and skills.",
  },
  {
    icon: ListChecks,
    title: "Concrete suggestions",
    body: "Specific rewrites and additions that make the resume land better with recruiters and screening tools.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen">
      <section className="hero-gradient border-b border-border">
        <div className="mx-auto max-w-6xl px-4 py-24">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <Sparkles className="size-3.5 text-primary" />
            Powered by Gemini
          </div>
          <h1 className="mt-6 max-w-3xl text-5xl font-bold leading-[1.05] sm:text-6xl">
            Read a resume the way a recruiter's software does.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted-foreground">
            Upload a PDF or Word resume. Get it turned into clean, structured information — then
            measure it against any job description.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/auth">
                Get started
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/auth">Sign in</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20">
        <div className="grid gap-6 md:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="surface p-6">
              <f.icon className="size-6 text-primary" />
              <h2 className="mt-4 text-lg font-semibold">{f.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
