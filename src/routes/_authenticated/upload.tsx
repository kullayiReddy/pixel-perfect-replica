import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { FileUp, Loader2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { extractResumeText } from "@/lib/document-text";
import { parseResume } from "@/lib/resume.functions";

export const Route = createFileRoute("/_authenticated/upload")({
  head: () => ({
    meta: [
      { title: "Upload a resume | Resume Analyzer" },
      { name: "description", content: "Upload a PDF or Word resume to extract its details." },
      { property: "og:title", content: "Upload a resume | Resume Analyzer" },
      {
        property: "og:description",
        content: "Upload a PDF or Word resume to extract its details.",
      },
    ],
  }),
  component: UploadPage;
});

function UploadPage() {
  const navigate = useNavigate();
  const runParse = useServerFn(parseResume);
  const [step, setStep] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  async function handleFile(file: File) {
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Please use a file under 10 MB.");
      return;
    }
    try {
      setStep("Reading the file…");
      const { text, fileType } = await extractResumeText(file);
      if (text.length < 30) throw new Error("No readable text found in this file.");

      setStep("Saving…");
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Please sign in again.");

      const { data: inserted, error } = await supabase
        .from("resumes")
        .insert({
          user_id: user.user.id,
          original_filename: file.name,
          file_type: fileType,
          file_size: file.size,
          raw_text: text,
          status: "processing",
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);

      setStep("Extracting details with AI…");
      await runParse({ data: { resumeId: inserted.id } });

      toast.success("Resume analyzed.");
      navigate({ to: "/resumes/$id", params: { id: inserted.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setStep(null);
    }
  }

  return (
    <AppShell>
      <h1 className="text-3xl font-semibold">Upload a resume</h1>
      <p className="mt-1 text-sm text-muted-foreground">PDF or Word (.docx), up to 10 MB.</p>

      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) void handleFile(file);
        }}
        className={`surface mt-8 flex cursor-pointer flex-col items-center justify-center gap-3 border-dashed p-16 text-center transition-colors ${
          dragging ? "border-primary bg-secondary" : ""
        }`}
      >
        {step ? (
          <>
            <Loader2 className="size-8 animate-spin text-primary" />
            <p className="font-medium">{step}</p>
          </>
        ) : (
          <>
            <FileUp className="size-8 text-primary" />
            <p className="font-medium">Drop your resume here, or click to choose a file</p>
            <p className="text-sm text-muted-foreground">We read the text and structure it for you.</p>
          </>
        )}
        <input
          type="file"
          accept=".pdf,.docx"
          className="hidden"
          disabled={!!step}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
            e.target.value = "";
          }}
        />
      </label>

      <Button variant="ghost" className="mt-6" onClick={() => navigate({ to: "/dashboard" })}>
        Back to dashboard
      </Button>
    </AppShell>
  );
}
