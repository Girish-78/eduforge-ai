import { createSameOriginCorsHeaders } from "@/lib/export-route-utils";

const ALLOWED_LOGO_HOSTS = new Set([
  "firebasestorage.googleapis.com",
  "storage.googleapis.com",
]);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function createJsonHeaders(request: Request) {
  return {
    ...Object.fromEntries(createSameOriginCorsHeaders(request).entries()),
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  };
}

export function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: createSameOriginCorsHeaders(request),
  });
}

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const logoUrl = requestUrl.searchParams.get("url")?.trim();

    if (!logoUrl) {
      throw new Error("Logo URL is required.");
    }

    const parsedLogoUrl = new URL(logoUrl);
    if (parsedLogoUrl.protocol !== "https:") {
      throw new Error("Only HTTPS logo URLs are supported.");
    }

    if (!ALLOWED_LOGO_HOSTS.has(parsedLogoUrl.hostname)) {
      throw new Error("Logo host is not allowed.");
    }

    const upstreamResponse = await fetch(parsedLogoUrl.toString(), {
      cache: "no-store",
    });

    if (!upstreamResponse.ok) {
      throw new Error(`School logo could not be loaded (status ${upstreamResponse.status}).`);
    }

    const contentType = upstreamResponse.headers.get("content-type") ?? "application/octet-stream";
    const body = await upstreamResponse.arrayBuffer();
    const headers = createSameOriginCorsHeaders(request);
    headers.set("Content-Type", contentType);
    headers.set("Cache-Control", "no-store");

    return new Response(body, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("Export logo proxy error", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unable to proxy school logo.",
      }),
      {
        status: 500,
        headers: createJsonHeaders(request),
      },
    );
  }
}
