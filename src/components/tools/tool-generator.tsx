"use client";

import { saveAs } from "file-saver";
import htmlDocx from "html-docx-js-typescript";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import type { GenerateType } from "@/lib/prompt-templates";
import { MarkdownPreview } from "@/components/tools/markdown-preview";
import { LoadingDots } from "@/components/ui/loading-dots";

interface ToolGeneratorProps {
  title: string;
  description: string;
  type: GenerateType;
  placeholder: string;
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

  const userId = useMemo(() => {
    if (typeof window === "undefined") return "";
    const raw = localStorage.getItem("saas-user");
    if (!raw) return "";
    try {
      const parsed = JSON.parse(raw) as { email?: string };
      return parsed.email ?? "";
    } catch {
      return "";
    }
  }, []);

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

  async function onDownloadPdf() {
    if (!output.trim()) {
      setError("Generate content first to export.");
      return;
    }

    const source = document.getElementById("pdf-content");
    if (!source) {
      setError("Unable to find printable content.");
      return;
    }

    const scale = 3;
    const canvas = await html2canvas(source, {
      scale,
      useCORS: true,
      backgroundColor: "#ffffff",
      windowWidth: source.scrollWidth,
      width: source.scrollWidth,
    });

    const pdf = new jsPDF("p", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 10;
    const printableWidth = pageWidth - margin * 2;
    const printableHeight = pageHeight - margin * 2;
    const pxPerMm = canvas.width / printableWidth;
    const pageHeightPx = Math.floor(printableHeight * pxPerMm);

    const sourceRect = source.getBoundingClientRect();
    const tableRanges = Array.from(source.querySelectorAll("table")).map((table) => {
      const rect = table.getBoundingClientRect();
      const top = Math.max(0, Math.floor((rect.top - sourceRect.top) * scale));
      const bottom = Math.min(canvas.height, Math.ceil((rect.bottom - sourceRect.top) * scale));
      return { top, bottom };
    });

    function adjustPageEnd(start: number, proposedEnd: number) {
      let adjustedEnd = proposedEnd;
      for (const range of tableRanges) {
        const intersects = range.top < proposedEnd && range.bottom > proposedEnd;
        const canMoveBeforeTable = range.top - start > 80;
        if (intersects && canMoveBeforeTable) {
          adjustedEnd = Math.min(adjustedEnd, range.top);
        }
      }
      if (adjustedEnd <= start + 40) {
        return proposedEnd;
      }
      return adjustedEnd;
    }

    let offsetY = 0;
    let pageIndex = 0;

    while (offsetY < canvas.height) {
      const maxEnd = Math.min(offsetY + pageHeightPx, canvas.height);
      const sliceEnd = adjustPageEnd(offsetY, maxEnd);
      const sliceHeight = Math.max(1, sliceEnd - offsetY);

      const pageCanvas = document.createElement("canvas");
      pageCanvas.width = canvas.width;
      pageCanvas.height = sliceHeight;

      const ctx = pageCanvas.getContext("2d");
      if (!ctx) {
        setError("Unable to prepare PDF canvas.");
        return;
      }

      ctx.drawImage(
        canvas,
        0,
        offsetY,
        canvas.width,
        sliceHeight,
        0,
        0,
        canvas.width,
        sliceHeight,
      );

      const imageData = pageCanvas.toDataURL("image/png");
      const imageHeightMm = sliceHeight / pxPerMm;

      if (pageIndex > 0) {
        pdf.addPage();
      }

      pdf.addImage(imageData, "PNG", margin, margin, printableWidth, imageHeightMm);

      offsetY += sliceHeight;
      pageIndex += 1;
    }

    pdf.save(`${title.toLowerCase().replace(/\s+/g, "-")}.pdf`);
    toast.success("PDF downloaded");
  }

  async function onDownloadDocx() {
    if (!output.trim()) {
      setError("Generate content first to export.");
      return;
    }

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8" /></head><body>${output}</body></html>`;
    const docxBlob = await htmlDocx.asBlob(html);
    const finalBlob =
      docxBlob instanceof Blob
        ? docxBlob
        : new Blob([docxBlob as unknown as BlobPart], {
            type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          });
    saveAs(finalBlob, `${title.toLowerCase().replace(/\s+/g, "-")}.docx`);
    toast.success("DOCX downloaded");
  }

  return (
    <section className="mx-auto w-full max-w-4xl space-y-5">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        <p className="mt-1 text-sm text-slate-600">{description}</p>
      </header>

      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <label className="mb-2 block text-sm font-medium text-slate-700">
          Input
        </label>
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
                onClick={onDownloadPdf}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                Download PDF
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
          <p className="text-sm text-slate-600">
            Generated content will appear here.
          </p>
        )}
      </article>
    </section>
  );
}

