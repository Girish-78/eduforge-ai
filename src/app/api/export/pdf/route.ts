import { NextResponse } from "next/server";

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
    const logoAsset = await loadExportLogoAsset(payload);
    const fileBuffer = await createPdfBuffer({
      payload,
      logoDataUrl: logoAsset?.dataUrl,
    });

    return new Response(fileBuffer, {
      headers: createAttachmentHeaders(request, {
        contentType: "application/pdf",
        fileName: getExportFileName(payload.title, "pdf"),
      }),
    });
  } catch (error) {
    console.error("/api/export/pdf error", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Export failed" },
      {
        status: 500,
        headers: createSameOriginCorsHeaders(request),
      },
    );
  }
}
