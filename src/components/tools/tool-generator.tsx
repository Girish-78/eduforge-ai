"use client";

import { saveAs } from "file-saver";
import htmlDocx from "html-docx-js-typescript";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { MarkdownPreview } from "@/components/tools/markdown-preview";
import { LoadingDots } from "@/components/ui/loading-dots";
import {
  buildPdfExportPages,
  createPrintDocumentMarkup,
  pdfExportPageSize,
  PDF_EXPORT_SCALE,
  resolveLogoDataUrl,
} from "@/lib/pdf-export";
import type { GenerateType } from "@/lib/prompt-templates";

const EXPORT_DOCX_STYLES = `
  body {
    margin: 0;
    background: #ffffff;
    color: #0f172a;
    font-family: Arial, sans-serif;
  }

  #pdf-content {
    font-family: Arial, sans-serif;
    line-height: 1.6;
    padding: 20px;
    color: #0f172a;
  }

  #pdf-content h1,
  #pdf-content h2,
  #pdf-content h3 {
    margin-top: 16px;
    margin-bottom: 8px;
  }

  #pdf-content p {
    margin-bottom: 10px;
  }

  #pdf-content ul,
  #pdf-content ol {
    padding-left: 20px;
    margin-bottom: 10px;
  }

  #pdf-content table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 10px;
  }

  #pdf-content th,
  #pdf-content td {
    border: 1px solid #ccc;
    padding: 8px;
    text-align: left;
    vertical-align: top;
  }

  #pdf-content .pdf-table-wrapper {
    overflow: hidden;
  }
`;

interface ToolGeneratorProps {
  title: string;
  description: string;
  type: GenerateType;
  placeholder: string;
}

interface SessionUser {
  email?: string;
  name?: string;
}

interface ProfilePayload {
  user?: {
    logoUrl?: string | null;
  };
}

function sanitizeFileName(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "document";
}

function getPrintableSource() {
  return document.getElementById("pdf-content");
}

async function getUserLogoUrl(userId: string) {
  if (!userId) {
    return null;
  }

  try {
    const response = await fetch(`/api/profile?userId=${encodeURIComponent(userId)}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as ProfilePayload;
    return payload.user?.logoUrl ?? null;
  } catch (error) {
    console.error("getUserLogoUrl error", error);
    return null;
  }
}

export function ToolGenerator({
  title,
  description,
  type,
  placeholder,
}: ToolGeneratorProps) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [output, setOutput] = useState("");
  const [usageWarning, setUsageWarning] = useState("");

  const session = useMemo(() => {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem("saas-user");
    if (!raw) return null;

    try {
      return JSON.parse(raw) as SessionUser;
    } catch {
      return null;
    }
  }, []);

  const userId = session?.email ?? "";
  const documentTitle = input.trim() || title;

  async function onGenerate() {
    setError("");
    setOutput("");
    setUsageWarning("");

    if (!input.trim()) {
      setError("Please enter some input before generating.");
      return;
    }

    if (!userId) {
      setError("Please login first to generate and save documents.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          input,
          userId,
        }),
      });

      const payload = (await res.json()) as {
        output?: string;
        result?: string;
        error?: string;
        usage?: { plan?: "free" | "pro"; remaining?: number; limit?: number };
      };

      if (!res.ok) {
        setError(payload.error ?? "Generation failed.");
        toast.error(payload.error ?? "Generation failed.");
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
    } catch {
      setError("Unable to reach generation service.");
      toast.error("Unable to reach generation service.");
    } finally {
      setLoading(false);
    }
  }

  async function createExportPages() {
    const source = getPrintableSource();
    if (!source) {
      throw new Error("Printable content not found.");
    }

    const logoUrl = await getUserLogoUrl(userId);
    const logoDataUrl = await resolveLogoDataUrl(logoUrl);

    return buildPdfExportPages({
      source,
      logoDataUrl,
    });
  }

  async function downloadPDF() {
    if (!output.trim()) {
      setError("Generate content first to export.");
      return;
    }

    const source = getPrintableSource();
    if (!source) {
      setError("Unable to export PDF. Printable content is missing.");
      toast.error("Unable to export PDF. Printable content is missing.");
      return;
    }

    let cleanup: (() => void) | null = null;

    try {
      const exportPages = await createExportPages();
      cleanup = exportPages.cleanup;

      await new Promise((resolve) => window.setTimeout(resolve, 50));

      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      for (const [index, page] of exportPages.pages.entries()) {
        if (!page) {
          throw new Error(`Missing export page at index ${index}.`);
        }

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

    const source = getPrintableSource();
    if (!source) {
      setError("Unable to find printable content.");
      return;
    }

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8" /><style>${EXPORT_DOCX_STYLES}</style></head><body>${source.outerHTML}</body></html>`;
    const docxBlob = await htmlDocx.asBlob(html);
    const finalBlob =
      docxBlob instanceof Blob
        ? docxBlob
        : new Blob([docxBlob as unknown as BlobPart], {
            type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          });
    saveAs(finalBlob, `${sanitizeFileName(documentTitle)}.docx`);
    toast.success("DOCX downloaded");
  }

  async function printPDF() {
    if (!output.trim()) {
      setError("Generate content first to print.");
      return;
    }

    const source = getPrintableSource();
    if (!source) {
      setError("Unable to print. Printable content is missing.");
      toast.error("Unable to print. Printable content is missing.");
      return;
    }

    let cleanup: (() => void) | null = null;

    try {
      const exportPages = await createExportPages();
      cleanup = exportPages.cleanup;

      const printWindow = window.open("", "_blank", "noopener,noreferrer");
      if (!printWindow) {
        throw new Error("Print window was blocked by the browser.");
      }

      const markup = exportPages.pages.map((page) => page.outerHTML).join("");
      printWindow.document.open();
      printWindow.document.write(createPrintDocumentMarkup(markup));
      printWindow.document.close();
      printWindow.focus();

      window.setTimeout(() => {
        printWindow.print();
      }, 250);
    } catch (printError) {
      console.error("printPDF error", printError);
      setError("Unable to print PDF. Please try again.");
      toast.error("Unable to print PDF. Please try again.");
    } finally {
      cleanup?.();
    }
  }

  return (
    <section className="mx-auto w-full max-w-4xl space-y-5">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        <p className="mt-1 text-sm text-slate-600">{description}</p>
      </header>

      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <label className="mb-2 block text-sm font-medium text-slate-700">Input</label>
        <textarea
          rows={7}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none ring-slate-200 focus:ring-2"
        />
        <button
          type="button"
          onClick={onGenerate}
          disabled={loading}
          className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Generating..." : "Generate"}
        </button>
        {loading ? (
          <div className="mt-3">
            <LoadingDots label="AI is drafting content" />
          </div>
        ) : null}
      </article>

      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-2 text-lg font-semibold text-slate-900">Output</h2>
        {error ? (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        ) : null}
        {usageWarning ? (
          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
            {usageWarning}
          </p>
        ) : null}
        {output ? (
          <div className="space-y-3">
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
                onClick={printPDF}
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
          <p className="text-sm text-slate-600">Generated content will appear here.</p>
        )}
      </article>
    </section>
  );
}
