// Renders plain resume text into a clean, ATS-friendly PDF (client-side).
export async function downloadResumePdf(text: string, jobTitle: string, name?: string) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 54;
  let y = M;
  const ensure = (h: number) => { if (y + h > H - M) { doc.addPage(); y = M; } };

  const lines = text.replace(/\r/g, "").split("\n");
  let first = true;
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) { y += 6; continue; }
    const t = line.trim();
    if (first) {
      doc.setFont("helvetica", "bold"); doc.setFontSize(20); doc.setTextColor(20, 28, 60);
      ensure(26); doc.text(t, M, y + 14); y += 26; first = false;
      doc.setDrawColor(20, 28, 60); doc.setLineWidth(1.2); doc.line(M, y, W - M, y); y += 12;
      continue;
    }
    const isHeading = t.length < 40 && (t === t.toUpperCase() && /[A-Z]/.test(t) || /^#+\s/.test(t) || /:$/.test(t) && !t.includes(" - "));
    const isBullet = /^[-•*▪·]\s*/.test(t);
    if (isHeading) {
      y += 6; ensure(22);
      doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(20, 28, 60);
      doc.text(t.replace(/^#+\s/, "").replace(/:$/, "").toUpperCase(), M, y + 10); y += 14;
      doc.setDrawColor(210, 214, 225); doc.setLineWidth(0.6); doc.line(M, y, W - M, y); y += 8;
      continue;
    }
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(40, 40, 48);
    const indent = isBullet ? 12 : 0;
    const body = isBullet ? t.replace(/^[-•*▪·]\s*/, "") : t;
    const wrapped = doc.splitTextToSize(body, W - M * 2 - indent) as string[];
    for (let i = 0; i < wrapped.length; i++) {
      ensure(14);
      if (isBullet && i === 0) doc.text("•", M + 2, y + 10);
      doc.text(wrapped[i]!, M + indent, y + 10); y += 14;
    }
  }
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p); doc.setFontSize(8); doc.setTextColor(150, 150, 160);
    doc.text(`Tailored for ${jobTitle}`, M, H - 24);
    doc.text(`${p} / ${pages}`, W - M, H - 24, { align: "right" });
  }
  const safe = (s: string) => s.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "");
  doc.save(`${safe(name || "Resume")}_${safe(jobTitle)}.pdf`);
}
