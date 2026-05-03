"use client";

import { saveAs } from "file-saver";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MarkdownPreview } from "@/components/tools/markdown-preview";
import { ToolInputForm } from "@/components/tools/tool-input-form";
import { LoadingDots } from "@/components/ui/loading-dots";
import {
  disabledButtonStateClassName,
  secondaryButtonClassName,
} from "@/lib/button-styles";
import {
  buildGeneratedDocumentFragment,
} from "@/lib/generated-document";
import { prepareExportMarkdown } from "@/lib/export-content";
import {
  resolveFirebaseStorageDownloadUrl,
  toBase64,
} from "@/lib/export-logo";
import {
  getFirebaseClientApp,
  getFirebaseClientFirestore,
} from "@/lib/firebase-client";
import {
  buildPdfExportDocument,
  pdfExportConfig,
  pdfExportPageSize,
  waitForDocumentFonts,
  waitForImages,
} from "@/lib/pdf-export";
import type { ExportFilePayload } from "@/lib/export-types";
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
type GenerateUsage = {
  allowed: boolean;
  count: number;
  limit: number;
  remaining: number;
  plan: "free" | "pro";
};

type GenerateResponse = {
  success?: boolean;
  data?: string;
  message?: string;
  output?: string;
  error?: string;
  details?: string;
  usage?: GenerateUsage;
};

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

export function ToolGenerator({ tool, sessionUser }: ToolGeneratorProps) {
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
  const [logoBase64, setLogoBase64] = useState("");
  const [activeExportAction, setActiveExportAction] = useState<ExportAction>(null);

  const documentTitle = useMemo(() => {
    return getToolDocumentTitle(tool, values) || tool.navLabel;
  }, [tool, values]);
  const preparedDocumentFragment = useMemo(() => {
    if (!output.trim()) {
      return "";
    }

    return buildGeneratedDocumentFragment(output, {
      title: tool.navLabel,
      toolType: tool.type,
      schoolName: values.schoolName,
      className: values.className,
      subject: values.subject,
      chapter: values.chapter,
      periods: values.periods,
      logoDataUrl: logoBase64 || null,
      branding: "Eduforge AI",
    });
  }, [
    output,
    values.chapter,
    values.className,
    values.periods,
    values.schoolName,
    values.subject,
    logoBase64,
    tool.navLabel,
    tool.type,
  ]);
  const preparedExportContent = useMemo(() => {
    if (!output.trim()) {
      return null;
    }

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

    if (nextFiles.length > 3) {
      setError("You can upload up to 3 reference files.");
      toast.error("You can upload up to 3 reference files.");
      setFiles(nextFiles.slice(0, 3));
      return;
    }

    setError("");
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
    if (!preparedDocumentFragment.trim() || !preparedExportContent?.content.trim()) {
      return "Generate content first to export.";
    }

    return "";
  }

  function buildExportPayload(): ExportFilePayload {
    if (!preparedExportContent) {
      throw new Error("Generate content first to export.");
    }

    return {
      title: documentTitle,
      content: output,
      exportTextContent: preparedExportContent.exportTextContent,
      toolType: tool.type,
      schoolName: values.schoolName,
      className: values.className,
      subject: values.subject,
      chapter: values.chapter,
      periods: values.periods,
      logo: logoUrl
        ? {
            downloadUrl: logoUrl,
          }
        : null,
    };
  }

  async function downloadServerExport(format: "pdf" | "docx") {
    const payload = buildExportPayload();
    const response = await fetch(`/api/export/${format}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorPayload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      throw new Error(errorPayload?.error?.trim() || `Unable to export ${format.toUpperCase()}.`);
    }

    const blob = await response.blob();
    saveAs(blob, `${sanitizeFileName(documentTitle)}.${format}`);
  }

  const handleGenerate = async () => {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      toast.error(validationError);
      return;
    }

    setLoading(true);
    setError("");
    setUsageWarning("");

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: tool.type,
          title: documentTitle,
          input: buildToolPromptInput(tool, values, summarizeFiles(files)),
        }),
      });

      const result = (await response.json().catch(() => null)) as GenerateResponse | null;
      const responseError =
        result?.message?.trim() ||
        result?.error?.trim() ||
        result?.details?.trim() ||
        "Unable to generate content.";

      if (!response.ok) {
        if (response.status === 401) {
          toast.error(responseError);
          router.push("/login");
          return;
        }

        if (response.status === 403) {
          toast.error(responseError);
          router.push("/dashboard/tools");
          return;
        }

        throw new Error(responseError);
      }

      const nextOutput = result?.data?.trim() || result?.output?.trim();
      if (!nextOutput) {
        throw new Error("No content was generated. Please try again.");
      }

      setOutput(nextOutput);

      const usage = result?.usage;
      if (usage?.plan === "free") {
        const generationLabel = usage.remaining === 1 ? "generation" : "generations";
        setUsageWarning(
          usage.remaining > 0
            ? `${usage.remaining} ${generationLabel} left today on your free plan.`
            : "You have used all free generations available today.",
        );
      } else if (sessionUser.plan === "free") {
        setUsageWarning("");
      }

      toast.success(`${tool.navLabel} generated successfully.`);
    } catch (generateError) {
      const message = getErrorMessage(
        generateError,
        "Unable to generate content. Please try again.",
      );
      console.error("Generate failed:", generateError);
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
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

  async function handleDownloadPDF() {
    const exportValidationError = validatePreparedExport();
    if (exportValidationError) {
      setError(exportValidationError);
      toast.error(exportValidationError);
      return;
    }

    let cleanup: (() => void) | null = null;

    try {
      setError("");
      setActiveExportAction("pdf");

      const exportDocument = await createExportPages();
      cleanup = exportDocument.cleanup;
      const { default: html2pdf } = await import("html2pdf.js");
      const worker = html2pdf()
        .set({
          ...pdfExportConfig,
          filename: `${sanitizeFileName(documentTitle)}.pdf`,
          pagebreak: {
            mode: ["css", "legacy"],
            avoid: [
              "tr",
              "figure",
              "svg",
              "img",
              ".lesson-plan-visual",
              ".question-paper-visual",
              ".cheatsheet-card",
              ".cheatsheet-visual",
            ],
          },
        })
        .from(exportDocument.documentElement)
        .toPdf();

      await worker.get("pdf", (pdf) => {
        const totalPages = pdf.internal.getNumberOfPages();
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();

        for (let pageIndex = 1; pageIndex <= totalPages; pageIndex += 1) {
          pdf.setPage(pageIndex);
          pdf.setFontSize(9);
          pdf.setTextColor(100, 116, 139);
          pdf.text(`Page ${pageIndex} of ${totalPages}`, pageWidth / 2, pageHeight - 6, {
            align: "center",
          });
        }
      });
      await worker.save();

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
    const exportValidationError = validatePreparedExport();
    if (exportValidationError) {
      setError(exportValidationError);
      toast.error(exportValidationError);
      return;
    }

    try {
      setError("");
      setActiveExportAction("docx");
      await downloadServerExport("docx");
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

        {loading ? (
          <div className="mt-4">
            <LoadingDots label="AI is drafting content" />
          </div>
        ) : output ? (
          <div className="mt-4 space-y-4">
            <MarkdownPreview content={preparedDocumentFragment} contentId="pdf-content" />
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
