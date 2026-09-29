import { Link, useNavigate } from "@tanstack/react-router";
import { FileText, LayoutDashboard, LogOut, Upload } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Link to="/dashboard" className="flex items-center gap-2 font-display text-lg font-semibold">
            <FileText className="size-5 text-primary" />
            Resume Analyzer
          </Link>
          <nav className="ml-auto flex items-center gap-1">
            <Button asChild variant="ghost" size="sm">
              <Link to="/dashboard">
                <LayoutDashboard className="size-4" />
                Dashboard
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/upload">
                <Upload className="size-4" />
                Upload
              </Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={signOut} aria-label="Sign out">
              <LogOut className="size-4" />
            </Button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
