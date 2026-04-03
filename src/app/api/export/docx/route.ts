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
    console.log("DOCX export called");
    const requestUrl = new URL(request.url);
    if (requestUrl.searchParams.get("debug") === "test") {
      console.log("DOCX export debug test response returned");
      return new Response("test docx", {
        status: 200,
        headers: createAttachmentHeaders(request, {
          contentType:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          fileName: "test-output.docx",
        }),
      });
    }

    const payload = await parseExportFilePayload(request);
    console.log("DOCX export request body received", {
      title: payload.title,
      toolType: payload.toolType,
      contentLength: payload.content.length,
      hasContent: Boolean(payload.content),
      hasLogo: Boolean(payload.logo?.downloadUrl),
    });

    if (!payload.content?.trim()) {
      throw new Error("DOCX export content is undefined or empty.");
    }

    const logoAsset = await loadExportLogoAsset(payload);
    console.log("DOCX export logo processed", {
      hasLogo: Boolean(logoAsset),
      logoBytes: logoAsset?.buffer.length ?? 0,
    });

    const blob = await createDocxBlob({
      title: payload.title,
      content: payload.content,
      toolType: payload.toolType,
      schoolName: payload.schoolName,
      className: payload.className,
      subject: payload.subject,
      chapter: payload.chapter,
      periods: payload.periods,
      logo: logoAsset?.docxLogo ?? null,
    });
    const fileBuffer = Buffer.from(await blob.arrayBuffer());
    console.log("DOCX export buffer generated", {
      bytes: fileBuffer.length,
    });

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
