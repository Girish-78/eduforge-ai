"use client";

import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { formatScientificContent } from "@/lib/scientific-format";

interface MarkdownPreviewProps {
  content: string;
  contentId?: string;
  header?: ReactNode;
}

export function MarkdownPreview({ content, contentId, header }: MarkdownPreviewProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
      <div
        id={contentId}
        className="document-surface mx-auto w-full max-w-[794px] space-y-5 rounded-[22px] bg-white px-7 py-8 text-[16px] text-slate-800 shadow-[0_18px_45px_rgba(15,23,42,0.08)] sm:px-10 sm:py-10"
      >
        {header}
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: ({ children }) => (
              <h1 className="mb-4 text-[2rem] leading-tight font-bold text-[#0f172a]">
                {formatScientificContent(children)}
              </h1>
            ),
            h2: ({ children }) => (
              <h2 className="mt-8 mb-3 border-b border-slate-200 pb-2 text-[1.45rem] leading-tight font-semibold text-[#1e3a8a]">
                {formatScientificContent(children)}
              </h2>
            ),
            h3: ({ children }) => (
              <h3 className="mt-6 mb-2 text-[1.15rem] leading-snug font-semibold text-[#1e3a8a]">
                {formatScientificContent(children)}
              </h3>
            ),
            p: ({ children }) => (
              <p className="mb-3 text-slate-800 leading-[1.68]">{formatScientificContent(children)}</p>
            ),
            ul: ({ children }) => <ul className="mb-4 list-disc space-y-2 pl-6">{children}</ul>,
            ol: ({ children }) => <ol className="mb-4 list-decimal space-y-2 pl-6">{children}</ol>,
            li: ({ children }) => <li className="leading-[1.65]">{formatScientificContent(children)}</li>,
            pre: ({ children }) => (
              <pre className="pdf-formula-block my-4 overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[0.96rem] leading-[1.6] text-slate-800">
                {children}
              </pre>
            ),
            table: ({ children }) => (
              <div className="pdf-table-wrapper my-4 overflow-x-auto rounded-xl border border-slate-300 bg-white">
                <table className="w-full table-fixed border-collapse text-[0.96rem] leading-[1.6]">{children}</table>
              </div>
            ),
            thead: ({ children }) => <thead className="bg-slate-100">{children}</thead>,
            th: ({ children }) => (
              <th className="border border-slate-300 bg-slate-100 px-3.5 py-2.5 text-left font-bold break-words text-slate-900 [overflow-wrap:anywhere]">
                {formatScientificContent(children)}
              </th>
            ),
            td: ({ children }) => (
              <td className="border border-slate-300 px-3.5 py-2.5 align-top break-words text-slate-800 [overflow-wrap:anywhere]">
                {formatScientificContent(children)}
              </td>
            ),
            strong: ({ children }) => (
              <strong className="font-semibold text-slate-900">
                {formatScientificContent(children)}
              </strong>
            ),
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}
