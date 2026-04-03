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
    console.log("PDF export called");
    const requestUrl = new URL(request.url);
    if (requestUrl.searchParams.get("debug") === "test") {
      console.log("PDF export debug test response returned");
      return new Response("test pdf", {
        status: 200,
        headers: createAttachmentHeaders(request, {
          contentType: "application/pdf",
          fileName: "test-output.pdf",
        }),
      });
    }

    const payload = await parseExportFilePayload(request);
    console.log("PDF export request body received", {
      title: payload.title,
      toolType: payload.toolType,
      contentLength: payload.content.length,
      hasContent: Boolean(payload.content),
      hasLogo: Boolean(payload.logo?.downloadUrl),
    });

    if (!payload.content?.trim()) {
      throw new Error("PDF export content is undefined or empty.");
    }

    const logoAsset = await loadExportLogoAsset(payload);
    console.log("PDF export logo processed", {
      hasLogo: Boolean(logoAsset),
      logoBytes: logoAsset?.buffer.length ?? 0,
    });

    const fileBuffer = await createPdfBuffer({
      payload,
      logo: logoAsset?.pdfLogo ?? null,
    });
    console.log("PDF export buffer generated", {
      bytes: fileBuffer.length,
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
