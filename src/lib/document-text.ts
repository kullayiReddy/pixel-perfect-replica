// Browser-side text extraction for PDF and DOCX resumes.

export type ExtractedDoc = {
  text: string;
  fileType: "pdf" | "docx";
};

function clean(text: string) {
  return text
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function extractPdf(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  const workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

  const buffer = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buffer }).promise;
  let out = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items.map((item) =>
      typeof item === "object" && item !== null && "str" in item ? String(item.str) : "",
    );
    out += strings.join(" ") + "\n\n";
  }
  return out;
}

async function extractDocx(file: File): Promise<string> {
  const mammoth = await import("mammoth/mammoth.browser.js");
  const buffer = await file.arrayBuffer();
  const result = await (mammoth as unknown as {
    extractRawText: (input: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>;
  }).extractRawText({ arrayBuffer: buffer });
  return result.value;
}

export async function extractResumeText(file: File): Promise<ExtractedDoc> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) {
    return { text: clean(await extractPdf(file)), fileType: "pdf" };
  }
  if (name.endsWith(".docx")) {
    return { text: clean(await extractDocx(file)), fileType: "docx" };
  }
  throw new Error("Only PDF and DOCX files are supported.");
}
