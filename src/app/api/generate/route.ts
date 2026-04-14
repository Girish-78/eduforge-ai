import { randomUUID } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/firebase-admin";
import {
  generatePrompt,
  isGenerateType,
  type GenerateType,
} from "@/lib/prompt-templates";
import { getServerSessionUser } from "@/lib/session";
import { userCanAccessTool } from "@/lib/tools";
import { consumeUsage } from "@/lib/usage";

interface GenerateBody {
  type?: GenerateType;
  input?: string;
  title?: string;
}

interface GeminiApiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
    finishReason?: string;
  }>;
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
  promptFeedback?: {
    blockReason?: string;
  };
}

export const runtime = "nodejs";

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent";
const GEMINI_TIMEOUT_MS = 10_000;
const GEMINI_RETRY_DELAYS_MS = [1_000, 2_000] as const;

function wait(delayMs: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

function getErrorDetails(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    name: "UnknownError",
    message: String(error),
  };
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

function isNetworkError(error: unknown) {
  return error instanceof TypeError;
}

function extractGeminiText(payload: GeminiApiResponse) {
  return (
    payload.candidates
      ?.flatMap((candidate) => candidate.content?.parts ?? [])
      .map((part) => part.text ?? "")
      .join("")
      .trim() ?? ""
  );
}

function buildGeminiBody(prompt: string) {
  return JSON.stringify({
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ],
  });
}

function buildGeminiUrl(apiKey: string) {
  const url = new URL(GEMINI_API_URL);
  url.searchParams.set("key", apiKey);
  return url.toString();
}

function jsonFailure(message: string, status: number) {
  return NextResponse.json({ success: false, message }, { status });
}

async function callGeminiWithRetry({
  apiKey,
  prompt,
  requestId,
}: {
  apiKey: string;
  prompt: string;
  requestId: string;
}) {
  const totalAttempts = GEMINI_RETRY_DELAYS_MS.length + 1;

  for (let attempt = 1; attempt <= totalAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

    try {
      console.info("[api/generate] Gemini request started", {
        requestId,
        attempt,
        totalAttempts,
      });

      const response = await fetch(buildGeminiUrl(apiKey), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: buildGeminiBody(prompt),
        signal: controller.signal,
        cache: "no-store",
      });

      const rawBody = await response.text();

      if (!response.ok) {
        const retryable = response.status >= 500;

        console.error("[api/generate] Gemini HTTP error", {
          requestId,
          attempt,
          status: response.status,
          body: rawBody,
        });

        if (retryable && attempt < totalAttempts) {
          const delayMs = GEMINI_RETRY_DELAYS_MS[attempt - 1] ?? 0;

          console.warn("[api/generate] Retrying Gemini request", {
            requestId,
            attempt,
            nextAttempt: attempt + 1,
            delayMs,
            reason: `HTTP ${response.status}`,
          });

          await wait(delayMs);
          continue;
        }

        throw new Error(`Gemini request failed with status ${response.status}`);
      }

      let payload: GeminiApiResponse;

      try {
        payload = JSON.parse(rawBody) as GeminiApiResponse;
      } catch (parseError) {
        console.error("[api/generate] Gemini response parse failed", {
          requestId,
          attempt,
          body: rawBody,
          error: getErrorDetails(parseError),
        });
        throw new Error("Gemini returned an invalid response payload");
      }

      if (payload.error?.message) {
        throw new Error(payload.error.message);
      }

      const text = extractGeminiText(payload);
      if (!text) {
        const reason =
          payload.promptFeedback?.blockReason ??
          payload.candidates?.[0]?.finishReason ??
          "empty_response";

        throw new Error(`Gemini returned no text (${reason})`);
      }

      return text;
    } catch (error) {
      const retryable = (isAbortError(error) || isNetworkError(error)) && attempt < totalAttempts;

      if (retryable) {
        const delayMs = GEMINI_RETRY_DELAYS_MS[attempt - 1] ?? 0;

        console.warn("[api/generate] Retrying Gemini request", {
          requestId,
          attempt,
          nextAttempt: attempt + 1,
          delayMs,
          reason: isAbortError(error) ? "timeout" : "network_error",
          error: getErrorDetails(error),
        });

        await wait(delayMs);
        continue;
      }

      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw new Error("Gemini request failed after exhausting retries");
}

export async function POST(request: Request) {
  const requestId = randomUUID();

  console.info("[api/generate] API start", { requestId });

  try {
    console.info("[api/generate] Request received", {
      requestId,
      method: request.method,
      url: request.url,
    });

    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      console.error("[api/generate] Missing GEMINI_API_KEY", { requestId });
      return jsonFailure("AI service temporarily unavailable", 500);
    }

    const session = await getServerSessionUser();

    let body: GenerateBody;

    try {
      body = (await request.json()) as GenerateBody;
    } catch (parseError) {
      console.error("[api/generate] Invalid request body", {
        requestId,
        error: getErrorDetails(parseError),
      });
      return jsonFailure("Invalid request body.", 400);
    }

    const type = body.type;
    const input = body.input?.trim();
    const title = body.title?.trim();

    console.info("[api/generate] Parsed request", {
      requestId,
      type,
      titleLength: title?.length ?? 0,
      inputLength: input?.length ?? 0,
      user: session?.email ?? null,
    });

    if (!type || !isGenerateType(type)) {
      return jsonFailure("Invalid type. Please use a supported tool type.", 400);
    }

    if (!input) {
      return jsonFailure("Input text is required.", 400);
    }

    if (!session) {
      return jsonFailure("Please login before generating content.", 401);
    }

    if (!userCanAccessTool(session.role, type)) {
      return jsonFailure("This tool is not available for your role.", 403);
    }

    const usage = await consumeUsage(session.email);
    if (!usage.allowed) {
      return NextResponse.json(
        {
          success: false,
          message: `Daily limit reached (${usage.limit} generations). Upgrade to a paid plan for higher limits.`,
          usage,
        },
        { status: 429 },
      );
    }

    const finalPrompt = generatePrompt({ toolType: type, inputs: input });
    const text = await callGeminiWithRetry({
      apiKey,
      prompt: finalPrompt,
      requestId,
    });

    try {
      const db = getDb();
      await db.collection("documents").add({
        userId: session.email,
        type,
        title: title ?? "",
        input,
        output: text,
        timestamp: Timestamp.now(),
      });
    } catch (persistError) {
      console.error("[api/generate] Failed to persist generated document", {
        requestId,
        error: getErrorDetails(persistError),
      });
    }

    return NextResponse.json({
      success: true,
      data: text,
      usage,
    });
  } catch (error) {
    console.error("[api/generate] Full error", {
      requestId,
      error: getErrorDetails(error),
    });

    return jsonFailure("AI service temporarily unavailable", 503);
  }
}
