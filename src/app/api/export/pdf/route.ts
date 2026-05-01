import {
  createAttachmentHeaders,
  createSameOriginCorsHeaders,
  getExportFileName,
  loadExportLogoAsset,
  parseExportFilePayload,
} from "@/lib/export-route-utils";
import { createPdfBuffer } from "@/lib/server-pdf-export";

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
      throw new Error("PDF export content is undefined or empty.");
    }

    let logoAsset: Awaited<ReturnType<typeof loadExportLogoAsset>> = null;
    if (payload.logo?.downloadUrl) {
      try {
        logoAsset = await loadExportLogoAsset(payload);
      } catch (logoError) {
        console.error("PDF export logo fallback applied", logoError);
      }
    }

    const fileBuffer = await createPdfBuffer({
      payload,
      logo: logoAsset?.pdfLogo ?? null,
    });

    return new Response(fileBuffer, {
      headers: createAttachmentHeaders(request, {
        contentType: "application/pdf",
        fileName: getExportFileName(payload.title, "pdf"),
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
