"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { MarkdownPreview } from "@/components/tools/markdown-preview";
import { LoadingDots } from "@/components/ui/loading-dots";
import {
  buildGeneratedDocumentFragment,
  isLikelyHtml,
  parseToolPromptMetadata,
} from "@/lib/generated-document";

interface SavedDocument {
  id: string;
  userId: string;
  type: string;
  title: string;
  input: string;
  output: string;
  timestamp: string | null;
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<SavedDocument[]>([]);
  const [selected, setSelected] = useState<SavedDocument | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState("");

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/documents", { cache: "no-store" });
      const payload = (await res.json()) as {
        success?: boolean;
        documents?: SavedDocument[];
        error?: string;
      };

      if (!res.ok || !payload.success) {
        setError(payload.error ?? "Failed to load documents.");
        toast.error(payload.error ?? "Failed to load documents.");
      } else {
        const nextDocuments = payload.documents ?? [];
        setDocuments(nextDocuments);
        setSelected((current) => {
          if (current) {
            return nextDocuments.find((doc) => doc.id === current.id) ?? null;
          }

          return nextDocuments[0] ?? null;
        });
      }
    } catch (loadError) {
      console.error("DocumentsPage loadDocuments error", loadError);
      setError("Unable to load documents.");
      toast.error("Unable to load documents.");
    } finally {
      setLoading(false);
    }
  }, []);

  async function onDelete(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch("/api/documents", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const payload = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !payload.success) {
        setError(payload.error ?? "Unable to delete document.");
        toast.error(payload.error ?? "Unable to delete document.");
      } else {
        setDocuments((prev) => prev.filter((doc) => doc.id !== id));
        if (selected?.id === id) {
          setSelected(null);
        }
        toast.success("Document deleted");
      }
    } catch (deleteError) {
      console.error("DocumentsPage onDelete error", deleteError);
      setError("Unable to delete document.");
      toast.error("Unable to delete document.");
    } finally {
      setDeletingId("");
    }
  }

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  const previewContent = useMemo(() => {
    if (!selected) {
      return "";
    }

    if (!isLikelyHtml(selected.output)) {
      return selected.output;
    }

    const metadata = parseToolPromptMetadata(selected.input);

    return buildGeneratedDocumentFragment(selected.output, {
      title:
        metadata.toolTitle?.trim() ||
        selected.type.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()),
      schoolName: metadata.schoolName,
      className: metadata.className,
      subject: metadata.subject,
      chapter: metadata.chapter,
      periods: metadata.periods,
      branding: "Eduforge AI",
    });
  }, [selected]);

  return (
    <section className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">My Documents</h1>
        <p className="mt-1 text-sm text-slate-600">
          View and manage your saved generated documents.
        </p>

        {error ? (
          <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        ) : null}

        {loading ? (
          <div className="mt-4">
            <LoadingDots label="Loading documents" />
          </div>
        ) : documents.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">No saved documents yet.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="rounded-xl border border-slate-200 p-3 transition hover:bg-slate-50"
              >
                <button
                  type="button"
                  onClick={() => setSelected(doc)}
                  className="w-full text-left"
                >
                  <p className="text-sm font-semibold capitalize text-slate-900">
                    {doc.title || doc.type.replace("_", " ")}
                  </p>
                  <p className="mt-1 whitespace-pre-line text-xs text-slate-600">
                    {doc.input.split("\n").slice(0, 3).join("\n")}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {doc.timestamp
                      ? new Date(doc.timestamp).toLocaleString()
                      : "Unknown time"}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(doc.id)}
                  disabled={deletingId === doc.id}
                  className="mt-2 rounded-md border border-rose-200 px-2.5 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {deletingId === doc.id ? "Deleting..." : "Delete"}
                </button>
              </div>
            ))}
          </div>
        )}
      </article>

      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Document Preview</h2>
        {selected ? (
          <div className="mt-3 space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500">Input</p>
              <p className="mt-1 whitespace-pre-line text-sm text-slate-700">
                {selected.input}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500">Output</p>
              <MarkdownPreview content={previewContent} />
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-600">
            Select a document to view content.
          </p>
        )}
      </article>
    </section>
  );
}

