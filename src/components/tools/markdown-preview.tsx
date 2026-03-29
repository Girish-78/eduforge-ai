"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { PdfDocumentFooter } from "@/components/tools/pdf-document-footer";
import { PdfDocumentHeader } from "@/components/tools/pdf-document-header";

interface MarkdownPreviewProps {
  content: string;
  contentId?: string;
  documentTitle?: string;
  schoolName?: string;
  dateLabel?: string;
  logoLabel?: string;
}

export function MarkdownPreview({
  content,
  contentId,
  documentTitle = "Generated Notes",
  schoolName,
  dateLabel,
  logoLabel,
}: MarkdownPreviewProps) {
  const resolvedDateLabel =
    dateLabel ??
    new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date());

  return (
    <div className="max-h-[34rem] overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-4 print:max-h-none print:overflow-visible print:border-0 print:bg-transparent print:p-0">
      <div
        id={contentId}
        className="mx-auto w-full max-w-3xl rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200/80 print:max-w-none print:rounded-none print:bg-white print:p-0 print:shadow-none print:ring-0"
      >
        <PdfDocumentHeader
          schoolName={schoolName}
          documentTitle={documentTitle}
          dateLabel={resolvedDateLabel}
          logoLabel={logoLabel}
        />
        <div data-pdf-body className="mt-6 text-[15px] text-slate-800">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h1: ({ children }) => (
                <h1 className="mt-4 mb-2 text-2xl font-bold text-slate-900">{children}</h1>
              ),
              h2: ({ children }) => (
                <h2 className="pdf-major-section mt-8 mb-2 border-b border-slate-200 pb-2 text-xl font-semibold text-slate-900">
                  {children}
                </h2>
              ),
              h3: ({ children }) => (
                <h3 className="mt-5 mb-2 pt-1 text-lg font-semibold text-slate-900">
                  {children}
                </h3>
              ),
              p: ({ children }) => <p className="mb-3 text-slate-800">{children}</p>,
              ul: ({ children }) => (
                <ul className="mb-3 list-disc space-y-1.5 pl-5">{children}</ul>
              ),
              ol: ({ children }) => (
                <ol className="mb-3 list-decimal space-y-1.5 pl-5">{children}</ol>
              ),
              li: ({ children }) => <li className="leading-7">{children}</li>,
              table: ({ children }) => (
                <div className="pdf-table-wrapper mt-3 overflow-x-auto rounded-lg border border-slate-200">
                  <table className="min-w-full border-collapse text-sm">{children}</table>
                </div>
              ),
              thead: ({ children }) => <thead className="bg-slate-100">{children}</thead>,
              th: ({ children }) => (
                <th className="border border-slate-300 px-2 py-2 text-left font-semibold text-slate-900">
                  {children}
                </th>
              ),
              td: ({ children }) => (
                <td className="border border-slate-300 px-2 py-2 align-top">{children}</td>
              ),
              strong: ({ children }) => (
                <strong className="font-semibold text-slate-900">{children}</strong>
              ),
            }}
          >
            {content}
          </ReactMarkdown>
        </div>
        <PdfDocumentFooter />
      </div>
    </div>
  );
}
