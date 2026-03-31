"use client";

import type { ChangeEvent } from "react";
import {
  disabledButtonStateClassName,
  primaryButtonClassName,
} from "@/lib/button-styles";
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
            id={`tool-file-upload-${tool.slug}`}
            type="file"
            accept={TOOL_FILE_ACCEPT}
            multiple
            onChange={handleFiles}
            className="hidden"
          />
          <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0 flex-1 space-y-3">
              <label
                htmlFor={`tool-file-upload-${tool.slug}`}
                className={`${primaryButtonClassName} w-fit cursor-pointer`}
              >
                Choose Files
              </label>
              <div className="flex min-h-16 flex-wrap items-start gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3">
                {files.length > 0 ? (
                  files.map((file) => (
                    <span
                      key={`${file.name}-${file.size}`}
                      className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700"
                    >
                      {file.name}
                    </span>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">
                    No reference files selected yet.
                  </p>
                )}
              </div>
            </div>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Accepted: PDF, DOCX, JPG, PNG. Up to 3 files, 10MB each.
          </p>
        </div>
      </div>

      <button
        type="submit"
        disabled={generating}
        className={`${primaryButtonClassName} ${disabledButtonStateClassName} mt-6 min-w-[140px]`}
      >
        {generating ? "Generating..." : "Generate"}
      </button>
    </article>
  );
}
