"use client";

import { saveAs } from "file-saver";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PDFHeader } from "@/components/tools/pdf-header";
import { MarkdownPreview } from "@/components/tools/markdown-preview";
import { ToolInputForm } from "@/components/tools/tool-input-form";
import { LoadingDots } from "@/components/ui/loading-dots";
import {
  disabledButtonStateClassName,
  secondaryButtonClassName,
} from "@/lib/button-styles";
import { prepareExportMarkdown } from "@/lib/export-content";
import {
  resolveFirebaseStorageDownloadUrl,
  toBase64,
} from "@/lib/export-logo";
import type { ExportFilePayload } from "@/lib/export-types";
import {
  getFirebaseClientApp,
  getFirebaseClientFirestore,
} from "@/lib/firebase-client";
import {
  buildPdfExportDocument,
  pdfExportPageSize,
  waitForDocumentFonts,
  waitForImages,
} from "@/lib/pdf-export";
import type { SessionUser } from "@/lib/session";
import {
  buildToolPromptInput,
  getToolDocumentTitle,
  TOOL_FILE_MAX_SIZE,
  type ToolDefinition,
} from "@/lib/tools";

interface ToolGeneratorProps {
  tool: ToolDefinition;
  sessionUser: SessionUser;
}

type ExportAction = "pdf" | "print" | "docx" | null;

function sanitizeFileName(value: string) {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "document"
  );
}

function getPrintableSource() {
  const element = document.getElementById("pdf-content");
  if (!element) {
    throw new Error("Unable to export PDF: #pdf-content was not found.");
  }

  return element;
}

function wait(delay: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, delay);
  });
}

function getExportApiUrl(format: "pdf" | "docx") {
  return `${window.location.origin}/api/export/${format}`;
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

function summarizeFiles(files: File[]) {
  return files.map((file) => ({
    name: file.name,
    size: file.size,
    type: file.type,
  }));
}

async function getExportErrorMessage(response: Response) {
  const contentType = response.headers.get("Content-Type") ?? "";
  if (contentType.includes("application/json")) {
    const payload = (await response.json().catch(() => null)) as
      | {
          error?: string;
        }
      | null;

    if (payload?.error?.trim()) {
      return payload.error;
    }
  }

  const responseText = await response.text().catch(() => "");
  return responseText.trim() || "Export failed";
}

function preparePdfContentForExport(element: HTMLElement) {
  const original = {
    width: element.style.width,
    maxWidth: element.style.maxWidth,
    overflow: element.style.overflow,
    maxHeight: element.style.maxHeight,
  };

  element.classList.add("pdf-export-ready");
  element.style.width = `${pdfExportPageSize.width}px`;
  element.style.maxWidth = `${pdfExportPageSize.width}px`;
  element.style.overflow = "visible";
  element.style.maxHeight = "none";

  return () => {
    element.classList.remove("pdf-export-ready");
    element.style.width = original.width;
    element.style.maxWidth = original.maxWidth;
    element.style.overflow = original.overflow;
    element.style.maxHeight = original.maxHeight;
  };
}

export function ToolGenerator({ tool }: ToolGeneratorProps) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(tool.fields.map((field) => [field.name, ""])),
  );
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [error, setError] = useState("");
  const [output, setOutput] = useState("");
  const [usageWarning, setUsageWarning] = useState("");
  const [logoSource, setLogoSource] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [logoBase64, setLogoBase64] = useState("");
  const [activeExportAction, setActiveExportAction] = useState<ExportAction>(null);

  const documentTitle = useMemo(() => {
    return getToolDocumentTitle(tool, values) || tool.navLabel;
  }, [tool, values]);
  const preparedExport = useMemo(() => {
    return prepareExportMarkdown(output, {
      title: documentTitle,
      toolType: tool.type,
      schoolName: values.schoolName,
      className: values.className,
      subject: values.subject,
      chapter: values.chapter,
      periods: values.periods,
    });
  }, [
    documentTitle,
    output,
    tool.type,
    values.chapter,
    values.className,
    values.periods,
    values.schoolName,
    values.subject,
  ]);

  const exportButtonsDisabled = loading || activeExportAction !== null;

  useEffect(() => {
    const auth = getAuth(getFirebaseClientApp());
    const db = getFirebaseClientFirestore();

    async function loadExportLogoPreview(nextLogoUrl: string) {
      if (!nextLogoUrl) {
        setLogoBase64("");
        return;
      }

      try {
        const nextLogoBase64 = await toBase64(nextLogoUrl);
        setLogoBase64(nextLogoBase64);
      } catch (logoPreviewError) {
        console.error("ToolGenerator logo base64 error", logoPreviewError);
        setLogoBase64("");
      }
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setProfileLoading(true);

      if (!user) {
        setLogoSource("");
        setLogoUrl("");
        setLogoBase64("");
        setProfileLoading(false);
        return;
      }

      try {
        const snapshot = await getDoc(doc(db, "users", user.uid));
        const data = snapshot.data() ?? {};
        const nextLogoSource =
          (typeof data.logoPath === "string" && data.logoPath.trim()) ||
          ((data.logoUrl as string | undefined) ?? "");

        setLogoSource(nextLogoSource);
        if (nextLogoSource) {
          try {
            const resolvedLogoUrl = await resolveFirebaseStorageDownloadUrl(nextLogoSource);
            const nextResolvedLogoUrl = resolvedLogoUrl ?? "";
            setLogoUrl(nextResolvedLogoUrl);
            await loadExportLogoPreview(nextResolvedLogoUrl);
          } catch (logoResolveError) {
            console.error("ToolGenerator logo resolve error", logoResolveError);
            const fallbackLogoUrl = typeof data.logoUrl === "string" ? data.logoUrl : "";
            setLogoUrl(fallbackLogoUrl);
            await loadExportLogoPreview(fallbackLogoUrl);
          }
        } else {
          setLogoUrl("");
          setLogoBase64("");
        }
      } catch (profileError) {
        console.error("ToolGenerator profile load error", profileError);
        setLogoBase64("");
      } finally {
        setProfileLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  function onFieldChange(name: string, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  function onFileChange(nextFiles: File[]) {
    const oversizedFile = nextFiles.find((file) => file.size > TOOL_FILE_MAX_SIZE);
    if (oversizedFile) {
      setError(`${oversizedFile.name} is larger than 10MB.`);
      toast.error(`${oversizedFile.name} is larger than 10MB.`);
      return;
    }

    setFiles(nextFiles);
  }

  function validateForm() {
    for (const field of tool.fields) {
      if (field.required && !values[field.name]?.trim()) {
        return `${field.label} is required.`;
      }
    }

    return "";
  }

  function validatePreparedExport() {
    if (!preparedExport.content.trim()) {
      return "Generate content first to export.";
    }

    if (preparedExport.invalidMathCount > 0) {
      return preparedExport.invalidMathCount === 1
        ? "1 equation could not be rendered. Please fix the math before exporting."
        : `${preparedExport.invalidMathCount} equations could not be rendered. Please fix the math before exporting.`;
    }

    return "";
  }

  const handleGenerate = async () => {
    console.log("🚀 Generate button clicked");

    try {
      const data = {
        input: "test input",
        title: "test title",
        type: "lesson-plan"
      };

      console.log("📦 Sending data:", data);

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
      });

      console.log("📡 Response status:", res.status);

      const result = await res.json();
      console.log("✅ Result:", result);

    } catch (err) {
      console.error("❌ Frontend error:", err);
    }
  };

  async function ensurePrintableContent() {
    const source = getPrintableSource();
    const restoreSource = preparePdfContentForExport(source);

    try {
      await waitForDocumentFonts();
      await waitForImages(source, {
        context: "the preview content",
        throwOnError: true,
      });
      await wait(500);
      return {
        source,
        restoreSource,
      };
    } catch (error) {
      restoreSource();
      throw error;
    }
  }

  async function createExportPages() {
    const { source, restoreSource } = await ensurePrintableContent();

    try {
      const exportDocument = await buildPdfExportDocument({
        source,
        logoDataUrl: logoBase64 || null,
      });

      await waitForImages(exportDocument.root, {
        context: "the export document",
        throwOnError: true,
      });
      await wait(500);

      return {
        ...exportDocument,
        cleanup() {
          exportDocument.cleanup();
          restoreSource();
        },
      };
    } catch (error) {
      restoreSource();
      throw error;
    }
  }

  async function createExportPayload(): Promise<ExportFilePayload> {
    const resolvedLogoUrl =
      logoUrl ||
      (await resolveFirebaseStorageDownloadUrl(logoSource || logoUrl).catch((logoResolveError) => {
        console.error("ToolGenerator export logo resolve error", logoResolveError);
        return null;
      }));

    return {
      title: documentTitle,
      content: preparedExport.content,
      exportTextContent: preparedExport.exportTextContent,
      toolType: tool.type,
      schoolName: values.schoolName,
      className: values.className,
      subject: values.subject,
      chapter: values.chapter,
      periods: values.periods,
      logo: resolvedLogoUrl
        ? {
            downloadUrl: resolvedLogoUrl,
          }
        : null,
    };
  }

  async function downloadExportFile(format: "pdf" | "docx") {
    const payload = await createExportPayload();
    const response = await fetch(getExportApiUrl(format), {
      method: "POST",
      mode: "same-origin",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(await getExportErrorMessage(response));
    }

    return response.blob();
  }

  async function handleDownloadPDF() {
    const exportValidationError = validatePreparedExport();
    if (exportValidationError) {
      setError(exportValidationError);
      toast.error(exportValidationError);
      return;
    }

    try {
      setError("");
      setActiveExportAction("pdf");
      const pdfBlob = await downloadExportFile("pdf");
      saveAs(pdfBlob, `${sanitizeFileName(documentTitle)}.pdf`);

      toast.success("PDF downloaded");
    } catch (downloadError) {
      const message = getErrorMessage(downloadError, "Unable to export PDF. Please try again.");
      console.error("Export failed:", downloadError);
      setError(message);
      toast.error(message);
    } finally {
      setActiveExportAction(null);
    }
  }

  async function handleDownloadDocx() {
    const exportValidationError = validatePreparedExport();
    if (exportValidationError) {
      setError(exportValidationError);
      toast.error(exportValidationError);
      return;
    }

    try {
      setError("");
      setActiveExportAction("docx");
      const docxBlob = await downloadExportFile("docx");

      saveAs(docxBlob, `${sanitizeFileName(documentTitle)}.docx`);
      toast.success("DOCX downloaded");
    } catch (docxError) {
      const message = getErrorMessage(docxError, "Unable to export DOCX. Please try again.");
      console.error("Export failed:", docxError);
      setError(message);
      toast.error(message);
    } finally {
      setActiveExportAction(null);
    }
  }

  async function handlePrint() {
    const exportValidationError = validatePreparedExport();
    if (exportValidationError) {
      setError(exportValidationError);
      toast.error(exportValidationError);
      return;
    }

    let cleanup: (() => void) | null = null;
    let finalized = false;

    const finalizePrint = () => {
      if (finalized) {
        return;
      }

      finalized = true;
      document.body.classList.remove("pdf-print-mode");
      cleanup?.();
      setActiveExportAction(null);
    };

    try {
      setError("");
      setActiveExportAction("print");
      const exportDocument = await createExportPages();
      cleanup = exportDocument.cleanup;

      const onAfterPrint = () => {
        window.removeEventListener("afterprint", onAfterPrint);
        finalizePrint();
      };

      window.addEventListener("afterprint", onAfterPrint);
      document.body.classList.add("pdf-print-mode");
      await wait(150);
      window.print();
      window.setTimeout(finalizePrint, 1500);
    } catch (printError) {
      const message = getErrorMessage(printError, "Unable to print PDF. Please try again.");
      console.error("Export failed:", printError);
      finalizePrint();
      setError(message);
      toast.error(message);
    }
  }

  function getActionLabel(action: Exclude<ExportAction, null>, idleLabel: string) {
    return activeExportAction === action ? "Generating..." : idleLabel;
  }

  return (
    <section className="mx-auto w-full max-w-5xl space-y-5">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void handleGenerate();
        }}
      >
        <ToolInputForm
          tool={tool}
          values={values}
          onFieldChange={onFieldChange}
          files={files}
          onFileChange={onFileChange}
          logoUrl={logoUrl}
          generating={loading}
        />
      </form>

      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Output</h2>
            <p className="mt-1 text-sm text-slate-600">
              Clean preview, export, and print layout for {tool.navLabel}.
            </p>
          </div>
          {profileLoading ? (
            <span className="text-xs text-slate-500">Loading header settings...</span>
          ) : null}
        </div>

        {error ? (
          <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        ) : null}

        {usageWarning ? (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
            {usageWarning}
          </p>
        ) : null}

        {preparedExport.invalidMathCount > 0 && output ? (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
            {preparedExport.invalidMathCount === 1
              ? "1 equation still has invalid LaTeX. Fix it before exporting."
              : `${preparedExport.invalidMathCount} equations still have invalid LaTeX. Fix them before exporting.`}
          </p>
        ) : null}

        {loading ? (
          <div className="mt-4">
            <LoadingDots label="AI is drafting content" />
          </div>
        ) : output ? (
          <div className="mt-4 space-y-4">
            <MarkdownPreview
              content={preparedExport.content}
              contentId="pdf-content"
              header={
                <PDFHeader
                  toolType={tool.type}
                  schoolName={values.schoolName}
                  className={values.className}
                  subject={values.subject}
                  chapter={values.chapter}
                  periods={values.periods}
                  logoSrc={logoBase64}
                />
              }
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleDownloadPDF}
                disabled={exportButtonsDisabled}
                aria-busy={activeExportAction === "pdf"}
                className={`${secondaryButtonClassName} ${disabledButtonStateClassName}`}
              >
                {getActionLabel("pdf", "Download PDF")}
              </button>
              <button
                type="button"
                onClick={handlePrint}
                disabled={exportButtonsDisabled}
                aria-busy={activeExportAction === "print"}
                className={`${secondaryButtonClassName} ${disabledButtonStateClassName}`}
              >
                {getActionLabel("print", "Print PDF")}
              </button>
              <button
                type="button"
                onClick={handleDownloadDocx}
                disabled={exportButtonsDisabled}
                aria-busy={activeExportAction === "docx"}
                className={`${secondaryButtonClassName} ${disabledButtonStateClassName}`}
              >
                {getActionLabel("docx", "Download DOCX")}
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-600">
            Fill the form above to generate your document.
          </p>
        )}
      </article>
    </section>
  );
}
