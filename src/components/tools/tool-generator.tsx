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
import { createDocxBlob } from "@/lib/docx-export";
import {
  getFirebaseClientApp,
  getFirebaseClientFirestore,
} from "@/lib/firebase-client";
import {
  buildPdfExportDocument,
  pdfExportConfig,
  pdfExportPageSize,
  resolveLogoDataUrl,
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
  const [logoUrl, setLogoUrl] = useState("");
  const [activeExportAction, setActiveExportAction] = useState<ExportAction>(null);

  const documentTitle = useMemo(() => {
    return getToolDocumentTitle(tool, values) || tool.navLabel;
  }, [tool, values]);

  const exportButtonsDisabled = loading || activeExportAction !== null;

  useEffect(() => {
    const auth = getAuth(getFirebaseClientApp());
    const db = getFirebaseClientFirestore();

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setProfileLoading(true);

      if (!user) {
        setLogoUrl("");
        setProfileLoading(false);
        return;
      }

      try {
        const snapshot = await getDoc(doc(db, "users", user.uid));
        setLogoUrl((snapshot.data()?.logoUrl as string | undefined) ?? "");
      } catch (profileError) {
        console.error("ToolGenerator profile load error", profileError);
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

  async function onGenerate() {
    setError("");
    setOutput("");
    setUsageWarning("");

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      toast.error(validationError);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: tool.type,
          title: documentTitle,
          input: buildToolPromptInput(tool, values, summarizeFiles(files)),
        }),
      });

      const payload = (await res.json()) as {
        output?: string;
        result?: string;
        error?: string;
        usage?: { plan?: "free" | "pro"; remaining?: number; limit?: number };
      };

      if (!res.ok) {
        const message = payload.error ?? "Generation failed.";
        setError(message);
        toast.error(message);

        if (res.status === 401) {
          router.replace("/login");
        }

        if (res.status === 403) {
          router.replace("/dashboard/tools");
        }

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
    } catch (generateError) {
      console.error("ToolGenerator onGenerate error", generateError);
      setError("Unable to reach generation service.");
      toast.error("Unable to reach generation service.");
    } finally {
      setLoading(false);
    }
  }

  async function ensurePrintableContent() {
    const source = getPrintableSource();
    const restoreSource = preparePdfContentForExport(source);

    try {
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
      const logoDataUrl = await resolveLogoDataUrl(logoUrl);
      if (logoUrl && !logoDataUrl) {
        throw new Error("School logo could not be loaded for export. Please re-upload it and try again.");
      }

      const exportDocument = await buildPdfExportDocument({
        source,
        logoDataUrl,
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

  async function handleDownloadPDF() {
    if (!output.trim()) {
      setError("Generate content first to export.");
      return;
    }

    let cleanup: (() => void) | null = null;

    try {
      setError("");
      setActiveExportAction("pdf");
      const html2pdfModule = await import("html2pdf.js");
      const html2pdf = html2pdfModule.default;
      if (typeof html2pdf !== "function") {
        throw new Error("PDF export library failed to load.");
      }

      const exportDocument = await createExportPages();
      cleanup = exportDocument.cleanup;

      await html2pdf()
        .set({
          ...pdfExportConfig,
          filename: `${sanitizeFileName(documentTitle)}.pdf`,
          pagebreak: {
            mode: ["avoid-all", "css", "legacy"],
          },
          html2canvas: {
            ...pdfExportConfig.html2canvas,
            backgroundColor: "#ffffff",
            logging: false,
            windowWidth: pdfExportPageSize.width,
          },
        })
        .from(exportDocument.documentElement)
        .save();

      toast.success("PDF downloaded");
    } catch (downloadError) {
      const message = getErrorMessage(downloadError, "Unable to export PDF. Please try again.");
      console.error("Export failed:", downloadError);
      setError(message);
      toast.error(message);
    } finally {
      cleanup?.();
      setActiveExportAction(null);
    }
  }

  async function handleDownloadDocx() {
    if (!output.trim()) {
      setError("Generate content first to export.");
      return;
    }

    try {
      setError("");
      setActiveExportAction("docx");
      const docxBlob = await createDocxBlob({
        title: documentTitle,
        content: output,
        toolType: tool.type,
        schoolName: values.schoolName,
        className: values.className,
        subject: values.subject,
        chapter: values.chapter,
        periods: values.periods,
      });

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
    if (!output.trim()) {
      setError("Generate content first to print.");
      return;
    }

    let restoreSource: (() => void) | null = null;
    let finalized = false;

    const finalizePrint = () => {
      if (finalized) {
        return;
      }

      finalized = true;
      document.body.classList.remove("pdf-print-mode");
      restoreSource?.();
      setActiveExportAction(null);
    };

    try {
      setError("");
      setActiveExportAction("print");
      const printableContent = await ensurePrintableContent();
      restoreSource = printableContent.restoreSource;

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
          void onGenerate();
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

        {loading ? (
          <div className="mt-4">
            <LoadingDots label="AI is drafting content" />
          </div>
        ) : output ? (
          <div className="mt-4 space-y-4">
            <MarkdownPreview
              content={output}
              contentId="pdf-content"
              header={
                <PDFHeader
                  toolType={tool.type}
                  schoolName={values.schoolName}
                  className={values.className}
                  subject={values.subject}
                  chapter={values.chapter}
                  periods={values.periods}
                  logoUrl={logoUrl}
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
