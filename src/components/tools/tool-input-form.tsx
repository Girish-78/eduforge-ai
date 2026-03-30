"use client";

import type { ChangeEvent } from "react";
import {
  TOOL_FILE_ACCEPT,
  TOOL_FILE_MAX_SIZE,
  type ToolDefinition,
} from "@/lib/tools";

interface ToolInputFormProps {
  tool: ToolDefinition;
  values: Record<string, string>;
  onFieldChange: (name: string, value: string) => void;
  files: File[];
  onFileChange: (files: File[]) => void;
  logoUrl: string;
  generating: boolean;
}

const fileTypes = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
]);

export function ToolInputForm({
  tool,
  values,
  onFieldChange,
  files,
  onFileChange,
  logoUrl,
  generating,
}: ToolInputFormProps) {
  function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const nextFiles = Array.from(event.target.files ?? []).filter((file) => {
      return fileTypes.has(file.type) && file.size <= TOOL_FILE_MAX_SIZE;
    });

    onFileChange(nextFiles.slice(0, 3));
  }

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-100 pb-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{tool.title}</h1>
          <p className="mt-1 text-sm text-slate-600">{tool.description}</p>
        </div>
        <div className="min-w-[220px] rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Header Logo
          </p>
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt="Saved school logo"
              className="mt-3 h-14 w-auto object-contain"
            />
          ) : (
            <p className="mt-3 text-sm text-slate-500">
              No logo in settings. The PDF header will stay empty.
            </p>
          )}
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {tool.fields.map((field) => {
          const isTextarea = field.type === "textarea";

          return (
            <div
              key={field.name}
              className={isTextarea ? "md:col-span-2" : undefined}
            >
              <label className="mb-2 block text-sm font-medium text-slate-700">
                {field.label}
                {field.required ? <span className="text-rose-600"> *</span> : null}
              </label>
              {isTextarea ? (
                <textarea
                  rows={field.rows ?? 4}
                  value={values[field.name] ?? ""}
                  onChange={(event) => onFieldChange(field.name, event.target.value)}
                  placeholder={field.placeholder}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none ring-slate-200 focus:ring-2"
                />
              ) : (
                <input
                  type={field.type === "number" ? "number" : "text"}
                  min={field.min}
                  max={field.max}
                  value={values[field.name] ?? ""}
                  onChange={(event) => onFieldChange(field.name, event.target.value)}
                  placeholder={field.placeholder}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none ring-slate-200 focus:ring-2"
                />
              )}
              {field.helperText ? (
                <p className="mt-1 text-xs text-slate-500">{field.helperText}</p>
              ) : null}
            </div>
          );
        })}

        <div className="md:col-span-2">
          <label className="mb-2 block text-sm font-medium text-slate-700">
            File Upload
          </label>
          <input
            type="file"
            accept={TOOL_FILE_ACCEPT}
            multiple
            onChange={handleFiles}
            className="block w-full text-sm text-slate-700 file:mr-4 file:rounded-lg file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-slate-700"
          />
          <p className="mt-1 text-xs text-slate-500">
            Accepted: PDF, DOCX, JPG, PNG. Up to 3 files, 10MB each.
          </p>
          {files.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {files.map((file) => (
                <span
                  key={`${file.name}-${file.size}`}
                  className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
                >
                  {file.name}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <button
        type="submit"
        disabled={generating}
        className="mt-5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {generating ? "Generating..." : "Generate"}
      </button>
    </article>
  );
}
