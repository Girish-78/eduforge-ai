"use client";

import { saveAs } from "file-saver";
import htmlDocx from "html-docx-js-typescript";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { MarkdownPreview } from "@/components/tools/markdown-preview";
import { LoadingDots } from "@/components/ui/loading-dots";
import type { GenerateType } from "@/lib/prompt-templates";

const A4_WIDTH_PX = 794;
const A4_HEIGHT_PX = 1123;
const PDF_EXPORT_SCALE = 2;
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

  #pdf-content [data-pdf-header],
  #pdf-content [data-pdf-footer] {
    width: 100%;
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

function createHiddenRenderRoot() {
  const renderRoot = document.createElement("div");
  Object.assign(renderRoot.style, {
    position: "fixed",
    top: "0",
    left: "-10000px",
    width: `${A4_WIDTH_PX}px`,
    pointerEvents: "none",
    opacity: "0",
    zIndex: "-1",
    background: "#ffffff",
  });

  document.body.appendChild(renderRoot);
  return renderRoot;
}

function createPdfPage(
  renderRoot: HTMLDivElement,
  headerTemplate: HTMLElement,
  footerTemplate: HTMLElement,
) {
  const page = document.createElement("div");
  Object.assign(page.style, {
    width: `${A4_WIDTH_PX}px`,
    height: `${A4_HEIGHT_PX}px`,
    boxSizing: "border-box",
    padding: "46px 50px 38px",
    background: "#ffffff",
    color: "#0f172a",
    fontFamily: "Arial, sans-serif",
    lineHeight: "1.6",
    display: "flex",
    flexDirection: "column",
    gap: "20px",
    overflow: "hidden",
  });

  const header = headerTemplate.cloneNode(true) as HTMLElement;
  const body = document.createElement("div");
  Object.assign(body.style, {
    flex: "1",
    minHeight: "0",
    display: "flex",
    flexDirection: "column",
  });

  const footer = footerTemplate.cloneNode(true) as HTMLElement;
  footer.style.marginTop = "auto";

  page.append(header, body, footer);
  renderRoot.appendChild(page);

  return { page, body };
}

function updatePageNumbers(pages: HTMLDivElement[]) {
  pages.forEach((page, index) => {
    const label = page.querySelector("[data-pdf-page-number-label]");
    if (label) {
      label.textContent = `Page ${index + 1} of ${pages.length}`;
    }
  });
}

function shouldStartNewPageBeforeBlock(block: HTMLElement, currentPageBody: HTMLElement) {
  return block.tagName === "H2" && currentPageBody.childElementCount > 0;
}

function buildPdfPages(source: HTMLElement) {
  const headerTemplate = source.querySelector("[data-pdf-header]");
  const bodyTemplate = source.querySelector("[data-pdf-body]");
  const footerTemplate = source.querySelector("[data-pdf-footer]");

  if (!(headerTemplate instanceof HTMLElement)) {
    throw new Error("Printable header is missing.");
  }

  if (!(bodyTemplate instanceof HTMLElement)) {
    throw new Error("Printable body is missing.");
  }

  if (!(footerTemplate instanceof HTMLElement)) {
    throw new Error("Printable footer is missing.");
  }

  const renderRoot = createHiddenRenderRoot();
  const pages: HTMLDivElement[] = [];
  let currentPage = createPdfPage(renderRoot, headerTemplate, footerTemplate);
  pages.push(currentPage.page);

  const blocks = Array.from(bodyTemplate.children) as HTMLElement[];

  for (const block of blocks) {
    if (shouldStartNewPageBeforeBlock(block, currentPage.body)) {
      currentPage = createPdfPage(renderRoot, headerTemplate, footerTemplate);
      pages.push(currentPage.page);
    }

    const clonedBlock = block.cloneNode(true) as HTMLElement;
    currentPage.body.appendChild(clonedBlock);

    if (
      currentPage.body.scrollHeight > currentPage.body.clientHeight + 1 &&
      currentPage.body.childElementCount > 1
    ) {
      currentPage.body.removeChild(clonedBlock);
      currentPage = createPdfPage(renderRoot, headerTemplate, footerTemplate);
      pages.push(currentPage.page);
      currentPage.body.appendChild(block.cloneNode(true) as HTMLElement);
    }
  }

  updatePageNumbers(pages);

  return { pages, renderRoot };
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
  const dateLabel = new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date());

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

  async function downloadPDF() {
    if (!output.trim()) {
      setError("Generate content first to export.");
      return;
    }

    const source = getPrintableSource();
    if (!source) {
      setError("Unable to find printable content.");
      return;
    }

    let renderRoot: HTMLDivElement | null = null;

    try {
      const builtPages = buildPdfPages(source);
      renderRoot = builtPages.renderRoot;

      await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => resolve());
      });

      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      for (const [index, page] of builtPages.pages.entries()) {
        const canvas = await html2canvas(page, {
          scale: PDF_EXPORT_SCALE,
          useCORS: true,
          backgroundColor: "#ffffff",
          width: A4_WIDTH_PX,
          height: A4_HEIGHT_PX,
          windowWidth: A4_WIDTH_PX,
          windowHeight: A4_HEIGHT_PX,
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
      console.error(downloadError);
      setError("Unable to export PDF.");
      toast.error("Unable to export PDF.");
    } finally {
      renderRoot?.remove();
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

  function printPDF() {
    if (!output.trim()) {
      setError("Generate content first to print.");
      return;
    }

    window.print();
  }

  return (
    <section className="mx-auto w-full max-w-4xl space-y-5">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm print:hidden">
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        <p className="mt-1 text-sm text-slate-600">{description}</p>
      </header>

      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm print:hidden">
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

      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm print:border-0 print:bg-transparent print:p-0 print:shadow-none">
        <h2 className="mb-2 text-lg font-semibold text-slate-900 print:hidden">Output</h2>
        {error ? (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 print:hidden">
            {error}
          </p>
        ) : null}
        {usageWarning ? (
          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 print:hidden">
            {usageWarning}
          </p>
        ) : null}
        {output ? (
          <div className="space-y-3">
            <MarkdownPreview
              content={output}
              contentId="pdf-content"
              documentTitle={documentTitle}
              schoolName="Your School"
              dateLabel={dateLabel}
            />
            <div className="flex flex-wrap gap-2 print:hidden">
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
          <p className="text-sm text-slate-600 print:hidden">
            Generated content will appear here.
          </p>
        )}
      </article>
    </section>
  );
}
