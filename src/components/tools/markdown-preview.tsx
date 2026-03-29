"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownPreviewProps {
  content: string;
}

export function MarkdownPreview({ content }: MarkdownPreviewProps) {
  return (
    <div className="max-h-[34rem] overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-5">
      <div className="mx-auto w-full max-w-3xl space-y-4 text-[15px] leading-7 text-slate-800">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h2: ({ children }) => (
              <h2 className="border-b border-slate-200 pb-2 text-xl font-semibold text-slate-900">
                {children}
              </h2>
            ),
            h3: ({ children }) => (
              <h3 className="pt-1 text-lg font-semibold text-slate-900">{children}</h3>
            ),
            p: ({ children }) => <p className="text-slate-800">{children}</p>,
            ul: ({ children }) => <ul className="list-disc space-y-1 pl-6">{children}</ul>,
            ol: ({ children }) => <ol className="list-decimal space-y-1 pl-6">{children}</ol>,
            li: ({ children }) => <li className="leading-7">{children}</li>,
            table: ({ children }) => (
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="min-w-full border-collapse text-sm">{children}</table>
              </div>
            ),
            thead: ({ children }) => <thead className="bg-slate-100">{children}</thead>,
            th: ({ children }) => (
              <th className="border border-slate-200 px-3 py-2 text-left font-semibold text-slate-900">
                {children}
              </th>
            ),
            td: ({ children }) => (
              <td className="border border-slate-200 px-3 py-2 align-top">{children}</td>
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
