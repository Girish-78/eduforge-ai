import type { ExportLogoAsset } from "@/lib/export-logo";
import type { ExportFilePayload } from "@/lib/export-types";
import { isGenerateType } from "@/lib/prompt-templates";

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

function getRequestHost(request: Request) {
  return request.headers.get("x-forwarded-host") ?? request.headers.get("host");
}

function getSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = getRequestHost(request);
  if (!origin || !host) {
    return null;
  }

  try {
    const originUrl = new URL(origin);
    return originUrl.host === host ? origin : null;
  } catch {
    return null;
  }
}

export function createSameOriginCorsHeaders(request: Request) {
  const headers = new Headers({
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  });
  const sameOrigin = getSameOrigin(request);
  if (sameOrigin) {
    headers.set("Access-Control-Allow-Origin", sameOrigin);
  }

  return headers;
}

export function createAttachmentHeaders(
  request: Request,
  options: {
    contentType: string;
    fileName: string;
  },
) {
  const headers = createSameOriginCorsHeaders(request);
  headers.set("Content-Type", options.contentType);
  headers.set("Content-Disposition", `attachment; filename=${options.fileName}`);
  headers.set("Cache-Control", "no-store");
  return headers;
}

export async function parseExportFilePayload(request: Request): Promise<ExportFilePayload> {
  const payload = (await request.json()) as Partial<ExportFilePayload>;

  if (!payload.title?.trim()) {
    throw new Error("Title is required for export.");
  }

  if (!payload.content?.trim()) {
    throw new Error("Content is required for export.");
  }

  if (!payload.toolType || !isGenerateType(payload.toolType)) {
    throw new Error("A valid export tool type is required.");
  }

  if (payload.logo) {
    if (
      !payload.logo.downloadUrl?.trim() ||
      (payload.logo.imageType !== "jpg" && payload.logo.imageType !== "png")
    ) {
      throw new Error("Logo information is invalid.");
    }
  }

  return {
    title: payload.title.trim(),
    content: payload.content.trim(),
    toolType: payload.toolType,
    schoolName: payload.schoolName?.trim() ?? "",
    className: payload.className?.trim() ?? "",
    subject: payload.subject?.trim() ?? "",
    chapter: payload.chapter?.trim() ?? "",
    periods: payload.periods?.trim() ?? "",
    logo: payload.logo ?? null,
  };
}

export function getExportFileName(title: string, extension: "pdf" | "docx") {
  return `${sanitizeFileName(title)}.${extension}`;
}

export async function loadExportLogoAsset(
  payload: ExportFilePayload,
): Promise<
  | {
      buffer: Buffer;
      dataUrl: string;
      docxLogo: ExportLogoAsset;
    }
  | null
> {
  if (!payload.logo) {
    return null;
  }

  const response = await fetch(payload.logo.downloadUrl);
  if (!response.ok) {
    throw new Error("Export failed");
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const mimeType = payload.logo.imageType === "jpg" ? "image/jpeg" : "image/png";

  return {
    buffer,
    dataUrl: `data:${mimeType};base64,${buffer.toString("base64")}`,
    docxLogo: {
      dataUrl: `data:${mimeType};base64,${buffer.toString("base64")}`,
      downloadUrl: payload.logo.downloadUrl,
      imageType: payload.logo.imageType,
      bytes: new Uint8Array(buffer),
      width: payload.logo.width,
      height: payload.logo.height,
    },
  };
}
