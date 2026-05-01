import { createDocxBlob } from "@/lib/docx-export";
import {
  createAttachmentHeaders,
  createSameOriginCorsHeaders,
  getExportFileName,
  loadExportLogoAsset,
  parseExportFilePayload,
} from "@/lib/export-route-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: createSameOriginCorsHeaders(request),
  });
}

export async function POST(request: Request) {
  try {
    const payload = await parseExportFilePayload(request);

    if (!payload.content?.trim()) {
      throw new Error("DOCX export content is undefined or empty.");
    }

    let logoAsset: Awaited<ReturnType<typeof loadExportLogoAsset>> = null;
    if (payload.logo?.downloadUrl) {
      try {
        logoAsset = await loadExportLogoAsset(payload);
      } catch (logoError) {
        console.error("DOCX export logo fallback applied", logoError);
      }
    }

    const blob = await createDocxBlob({
      title: payload.title,
      content: payload.content,
      exportTextContent: payload.exportTextContent,
      toolType: payload.toolType,
      schoolName: payload.schoolName,
      className: payload.className,
      subject: payload.subject,
      chapter: payload.chapter,
      periods: payload.periods,
      logo: logoAsset?.docxLogo ?? null,
    });
    const fileBuffer = Buffer.from(await blob.arrayBuffer());

    return new Response(fileBuffer, {
      headers: createAttachmentHeaders(request, {
        contentType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        fileName: getExportFileName(payload.title, "docx"),
      }),
    });
  } catch (error) {
    console.error("Export error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Export failed",
      }),
      {
        status: 500,
        headers: {
          ...Object.fromEntries(createSameOriginCorsHeaders(request).entries()),
          "Content-Type": "application/json",
        },
      },
    );
  }
}
