import type { ExportLogoAsset } from "@/lib/export-logo";
import type { ExportFilePayload } from "@/lib/export-types";
import { isGenerateType } from "@/lib/prompt-templates";

const MAX_LOGO_WIDTH_PX = 160;
const MAX_LOGO_HEIGHT_PX = 60;

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
    if (!payload.logo.downloadUrl?.trim()) {
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

function fitsWithinLogoBounds(width: number, height: number) {
  if (!width || !height) {
    return {
      width: MAX_LOGO_WIDTH_PX,
      height: MAX_LOGO_HEIGHT_PX,
    };
  }

  const scale = Math.min(MAX_LOGO_WIDTH_PX / width, MAX_LOGO_HEIGHT_PX / height, 1);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function detectImageType(buffer: Buffer, contentType: string | null) {
  if (contentType?.includes("image/jpeg")) {
    return "jpg" as const;
  }

  if (contentType?.includes("image/png")) {
    return "png" as const;
  }

  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "png" as const;
  }

  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    return "jpg" as const;
  }

  throw new Error("School logo must be a PNG or JPG image.");
}

function getPngDimensions(buffer: Buffer) {
  if (buffer.length < 24) {
    throw new Error("School logo PNG data is incomplete.");
  }

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function getJpegDimensions(buffer: Buffer) {
  let offset = 2;

  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = buffer[offset + 1];
    if (!marker || marker === 0xd9 || marker === 0xda) {
      break;
    }

    const blockLength = buffer.readUInt16BE(offset + 2);
    const isStartOfFrame =
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc;

    if (isStartOfFrame) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      };
    }

    offset += 2 + blockLength;
  }

  throw new Error("Unable to read JPG logo dimensions.");
}

function getImageDimensions(buffer: Buffer, imageType: "jpg" | "png") {
  return imageType === "png" ? getPngDimensions(buffer) : getJpegDimensions(buffer);
}

export async function loadExportLogoAsset(
  payload: ExportFilePayload,
): Promise<
  | {
      buffer: Buffer;
      dataUrl: string;
      pdfLogo: {
        dataUrl: string;
        imageType: "jpg" | "png";
        width: number;
        height: number;
      };
      docxLogo: ExportLogoAsset;
    }
  | null
> {
  if (!payload.logo) {
    return null;
  }

  const response = await fetch(payload.logo.downloadUrl);
  if (!response.ok) {
    throw new Error(`School logo could not be loaded for export (status ${response.status}).`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const imageType = detectImageType(buffer, response.headers.get("content-type"));
  const mimeType = imageType === "jpg" ? "image/jpeg" : "image/png";
  const dimensions = getImageDimensions(buffer, imageType);
  const fittedDimensions = fitsWithinLogoBounds(
    payload.logo.width ?? dimensions.width,
    payload.logo.height ?? dimensions.height,
  );
  const dataUrl = `data:${mimeType};base64,${buffer.toString("base64")}`;

  return {
    buffer,
    dataUrl,
    pdfLogo: {
      dataUrl,
      imageType,
      width: fittedDimensions.width,
      height: fittedDimensions.height,
    },
    docxLogo: {
      dataUrl,
      downloadUrl: payload.logo.downloadUrl,
      imageType,
      bytes: new Uint8Array(buffer),
      width: fittedDimensions.width,
      height: fittedDimensions.height,
    },
  };
}
