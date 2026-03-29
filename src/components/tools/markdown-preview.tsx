"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownPreviewProps {
  content: string;
  contentId?: string;
}

export function MarkdownPreview({ content, contentId }: MarkdownPreviewProps) {
  return (
    <div className="max-h-[34rem] overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-5">
      <div
        id={contentId}
        className="mx-auto w-full max-w-3xl space-y-4 text-[15px] text-slate-800"
        style={{ fontFamily: "Arial, sans-serif", lineHeight: 1.6, padding: "20px" }}
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: ({ children }) => (
              <h1 className="mt-4 mb-2 text-2xl font-bold text-slate-900">{children}</h1>
            ),
            h2: ({ children }) => (
              <h2 className="mt-4 mb-2 border-b border-slate-200 pb-2 text-xl font-semibold text-slate-900">
                {children}
              </h2>
            ),
            h3: ({ children }) => (
              <h3 className="mt-4 mb-2 pt-1 text-lg font-semibold text-slate-900">{children}</h3>
            ),
            p: ({ children }) => <p className="mb-2.5 text-slate-800">{children}</p>,
            ul: ({ children }) => <ul className="mb-2.5 list-disc space-y-1 pl-5">{children}</ul>,
            ol: ({ children }) => <ol className="mb-2.5 list-decimal space-y-1 pl-5">{children}</ol>,
            li: ({ children }) => <li className="leading-7">{children}</li>,
            table: ({ children }) => (
              <div className="mt-2.5 overflow-x-auto rounded-lg border border-slate-200">
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
            strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}
