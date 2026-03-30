"use client";

import { saveAs } from "file-saver";
import htmlDocx from "html-docx-js-typescript";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MarkdownPreview } from "@/components/tools/markdown-preview";
import { ToolInputForm } from "@/components/tools/tool-input-form";
import { LoadingDots } from "@/components/ui/loading-dots";
import { createDocxHtml } from "@/lib/docx-export";
import {
  buildPdfExportPages,
  pdfExportPageSize,
  PDF_EXPORT_SCALE,
  resolveLogoDataUrl,
  waitForImages,
} from "@/lib/pdf-export";
import type { SessionUser } from "@/lib/session";
import {
  buildToolPromptInput,
  getToolDocumentTitle,
  TOOL_FILE_MAX_SIZE,
  type ToolDefinition,
} from "@/lib/tools";

const EXPORT_DOCX_STYLES = `
  body {
    margin: 0;
    padding: 24px;
    background: #ffffff;
    color: #0f172a;
    font-family: Arial, sans-serif;
  }

  #pdf-content {
    font-family: Arial, sans-serif;
    line-height: 1.6;
    color: #0f172a;
  }

  h1, h2, h3 {
    margin: 16px 0 8px;
    color: #0f172a;
  }

  h1 {
    font-size: 24px;
  }

  h2 {
    font-size: 20px;
  }

  h3 {
    font-size: 17px;
  }

  p {
    margin: 0 0 10px;
  }

  ul, ol {
    margin: 0 0 10px;
    padding-left: 20px;
  }

  li {
    margin-bottom: 6px;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    margin: 14px 0;
  }

  th, td {
    border: 1px solid #cbd5e1;
    padding: 8px;
    text-align: left;
    vertical-align: top;
  }

  thead {
    background: #f8fafc;
  }
`;

interface ToolGeneratorProps {
  tool: ToolDefinition;
  sessionUser: SessionUser;
}

interface ProfilePayload {
  user?: {
    logoUrl?: string | null;
  };
  error?: string;
}

function sanitizeFileName(value: string) {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "document"
  );
}

function getPrintableSource() {
  return document.getElementById("pdf-content");
}

function wait(delay: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, delay);
  });
}

function summarizeFiles(files: File[]) {
  return files.map((file) => ({
    name: file.name,
    size: file.size,
    type: file.type,
  }));
}

export function ToolGenerator({ tool }: ToolGeneratorProps) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(tool.fields.map((field) => [field.name, ""])),
  );
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [error, setError] = useState("");
  const [output, setOutput] = useState("");
  const [usageWarning, setUsageWarning] = useState("");
  const [logoUrl, setLogoUrl] = useState("");

  const documentTitle = useMemo(() => {
    return getToolDocumentTitle(tool, values) || tool.navLabel;
  }, [tool, values]);

  useEffect(() => {
    async function loadProfile() {
      setProfileLoading(true);
      try {
        const response = await fetch("/api/profile", { cache: "no-store" });
        const payload = (await response.json()) as ProfilePayload;

        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to load profile.");
        }

        setLogoUrl(payload.user?.logoUrl ?? "");
      } catch (profileError) {
        console.error("ToolGenerator profile load error", profileError);
      } finally {
        setProfileLoading(false);
      }
    }

    void loadProfile();
  }, []);

  function onFieldChange(name: string, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  function onFileChange(nextFiles: File[]) {
    const oversizedFile = nextFiles.find((file) => file.size > TOOL_FILE_MAX_SIZE);
    if (oversizedFile) {
      setError(`${oversizedFile.name} is larger than 10MB.`);
      toast.error(`${oversizedFile.name} is larger than 10MB.`);
      return;
    }

    setFiles(nextFiles);
  }

  function validateForm() {
    for (const field of tool.fields) {
      if (field.required && !values[field.name]?.trim()) {
        return `${field.label} is required.`;
      }
    }

    return "";
  }

  async function onGenerate() {
    setError("");
    setOutput("");
    setUsageWarning("");

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      toast.error(validationError);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: tool.type,
          title: documentTitle,
          input: buildToolPromptInput(tool, values, summarizeFiles(files)),
        }),
      });

      const payload = (await res.json()) as {
        output?: string;
        result?: string;
        error?: string;
        usage?: { plan?: "free" | "pro"; remaining?: number; limit?: number };
      };

      if (!res.ok) {
        const message = payload.error ?? "Generation failed.";
        setError(message);
        toast.error(message);

        if (res.status === 401) {
          router.replace("/login");
        }

        if (res.status === 403) {
          router.replace("/dashboard/tools");
        }

        if (payload.usage?.plan === "free" && payload.usage.remaining === 0) {
          setUsageWarning("Daily free limit reached. Upgrade to paid plans soon.");
        }
        return;
      }

      setOutput(payload.output ?? payload.result ?? "");
      toast.success("Content generated");

      if (payload.usage?.plan === "free" && typeof payload.usage.remaining === "number") {
        setUsageWarning(
          `Free plan usage: ${payload.usage.remaining} of ${payload.usage.limit} generations remaining today.`,
        );
      }
    } catch (generateError) {
      console.error("ToolGenerator onGenerate error", generateError);
      setError("Unable to reach generation service.");
      toast.error("Unable to reach generation service.");
    } finally {
      setLoading(false);
    }
  }

  async function ensurePrintableContent() {
    const source = getPrintableSource();
    if (!source) {
      throw new Error("Printable content not found.");
    }

    await waitForImages(source);
    await wait(400);
    return source;
  }

  async function createExportPages() {
    const source = await ensurePrintableContent();
    const logoDataUrl = await resolveLogoDataUrl(logoUrl);
    const exportPages = await buildPdfExportPages({
      source,
      logoDataUrl,
      headerData: {
        schoolName: values.schoolName,
        subject: values.subject,
        className: values.className,
      },
    });

    await waitForImages(exportPages.root);
    await wait(400);
    return exportPages;
  }

  async function downloadPDF() {
    if (!output.trim()) {
      setError("Generate content first to export.");
      return;
    }

    let cleanup: (() => void) | null = null;

    try {
      const exportPages = await createExportPages();
      cleanup = exportPages.cleanup;

      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      for (const [index, page] of exportPages.pages.entries()) {
        const canvas = await html2canvas(page, {
          scale: PDF_EXPORT_SCALE,
          useCORS: true,
          backgroundColor: "#ffffff",
          width: pdfExportPageSize.width,
          height: pdfExportPageSize.height,
          windowWidth: pdfExportPageSize.width,
          windowHeight: pdfExportPageSize.height,
        });

        if (index > 0) {
          pdf.addPage();
        }

        pdf.addImage(
          canvas.toDataURL("image/png"),
          "PNG",
          0,
          0,
          pageWidth,
          pageHeight,
          undefined,
          "FAST",
        );
      }

      pdf.save(`${sanitizeFileName(documentTitle)}.pdf`);
      toast.success("PDF downloaded");
    } catch (downloadError) {
      console.error("downloadPDF error", downloadError);
      setError("Unable to export PDF. Please try again.");
      toast.error("Unable to export PDF. Please try again.");
    } finally {
      cleanup?.();
    }
  }

  async function onDownloadDocx() {
    if (!output.trim()) {
      setError("Generate content first to export.");
      return;
    }

    try {
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8" /><style>${EXPORT_DOCX_STYLES}</style></head><body><div id="pdf-content">${createDocxHtml(output)}</div></body></html>`;
      const docxBlob = await htmlDocx.asBlob(html);
      const finalBlob =
        docxBlob instanceof Blob
          ? docxBlob
          : new Blob([docxBlob as unknown as BlobPart], {
              type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            });

      saveAs(finalBlob, `${sanitizeFileName(documentTitle)}.docx`);
      toast.success("DOCX downloaded");
    } catch (docxError) {
      console.error("onDownloadDocx error", docxError);
      setError("Unable to export DOCX. Please try again.");
      toast.error("Unable to export DOCX. Please try again.");
    }
  }

  async function handlePrint() {
    if (!output.trim()) {
      setError("Generate content first to print.");
      return;
    }

    let cleanup: (() => void) | null = null;
    let finalized = false;

    const finalizePrint = () => {
      if (finalized) {
        return;
      }

      finalized = true;
      document.body.classList.remove("pdf-print-mode");
      cleanup?.();
    };

    try {
      const exportPages = await createExportPages();
      cleanup = exportPages.cleanup;

      const onAfterPrint = () => {
        window.removeEventListener("afterprint", onAfterPrint);
        finalizePrint();
      };

      window.addEventListener("afterprint", onAfterPrint);
      document.body.classList.add("pdf-print-mode");
      await wait(150);
      window.print();
      window.setTimeout(finalizePrint, 1500);
    } catch (printError) {
      console.error("handlePrint error", printError);
      finalizePrint();
      setError("Unable to print PDF. Please try again.");
      toast.error("Unable to print PDF. Please try again.");
    }
  }

  return (
    <section className="mx-auto w-full max-w-5xl space-y-5">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void onGenerate();
        }}
      >
        <ToolInputForm
          tool={tool}
          values={values}
          onFieldChange={onFieldChange}
          files={files}
          onFileChange={onFileChange}
          logoUrl={logoUrl}
          generating={loading}
        />
      </form>

      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Output</h2>
            <p className="mt-1 text-sm text-slate-600">
              Clean preview, export, and print layout for {tool.navLabel}.
            </p>
          </div>
          {profileLoading ? (
            <span className="text-xs text-slate-500">Loading header settings...</span>
          ) : null}
        </div>

        {error ? (
          <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        ) : null}

        {usageWarning ? (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
            {usageWarning}
          </p>
        ) : null}

        {loading ? (
          <div className="mt-4">
            <LoadingDots label="AI is drafting content" />
          </div>
        ) : output ? (
          <div className="mt-4 space-y-4">
            <MarkdownPreview content={output} contentId="pdf-content" />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={downloadPDF}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                Download PDF
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                Print PDF
              </button>
              <button
                type="button"
                onClick={onDownloadDocx}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                Download DOCX
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-600">
            Fill the form above to generate your document.
          </p>
        )}
      </article>
    </section>
  );
}

