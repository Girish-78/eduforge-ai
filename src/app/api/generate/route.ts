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

// --- MASTER CONFIGURATION ---

/**
 * Allow enough time for detailed document generation on hosted runtimes.
 */
export const maxDuration = 60;
export const runtime = "nodejs"; // Required for Firebase-Admin SDK compatibility

/**
 * Use Gemini 2.5 Flash by default. The model can be overridden for rollout
 * testing with GEMINI_MODEL, but the stable model is safest for production.
 */
const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const GEMINI_TIMEOUT_MS = 55_000; // Leave 5s buffer for Vercel
const RETRY_DELAY_MS = [1000, 3000]; // Delay before retry 1 and retry 2

interface GenerateBody {
  type?: GenerateType;
  input?: string;
  title?: string;
}

interface GeminiApiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  error?: { message?: string; status?: string };
}

// Helper: Sleep function
const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

async function callGeminiWithRetry(apiKey: string, prompt: string, requestId: string) {
  const maxAttempts = RETRY_DELAY_MS.length + 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

    try {
      console.info(`[api/generate] [${requestId}] AI Request Attempt ${attempt}`);

      const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 8192, // Increased for exhaustive physics lesson plans
          },
        }),
        signal: controller.signal,
        cache: "no-store",
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        console.error(`[api/generate] [${requestId}] Google API Error ${response.status}:`, errJson);
        
        // Retry only on 5xx (server) or 429 (rate limit)
        if ((response.status >= 500 || response.status === 429) && attempt < maxAttempts) {
          const delay = RETRY_DELAY_MS[attempt - 1];
          console.warn(`[api/generate] [${requestId}] Retrying in ${delay}ms due to HTTP ${response.status}`);
          await wait(delay);
          continue;
        }
        throw new Error(`AI service returned ${response.status}`);
      }

      const payload = (await response.json()) as GeminiApiResponse;
      const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!text) {
        const finishReason = payload.candidates?.[0]?.finishReason;
        throw new Error(finishReason ? `Empty AI response (${finishReason})` : "Empty AI response");
      }
      return text;

    } catch (error: unknown) {
      const isTimeout = isAbortError(error);
      console.error(
        `[api/generate] [${requestId}] Attempt ${attempt} failed: ${
          isTimeout ? "Timeout" : getErrorMessage(error)
        }`,
      );
      
      if (attempt < maxAttempts) {
        await wait(RETRY_DELAY_MS[attempt - 1] || 1000);
        continue;
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
  throw new Error("Maximum retry attempts exhausted");
}

export async function POST(request: Request) {
  const requestId = randomUUID();
  console.info(`[api/generate] [${requestId}] API Start`);

  try {
    // 1. API Key Check
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) return NextResponse.json({ success: false, message: "AI Configuration missing" }, { status: 500 });

    // 2. Auth & Input Check
    const session = await getServerSessionUser();
    if (!session) return NextResponse.json({ success: false, message: "Unauthorized: Please log in" }, { status: 401 });

    const body = (await request.json()) as GenerateBody;
    const { type, input, title } = body;
    const trimmedInput = input?.trim() ?? "";
    const trimmedTitle = title?.trim() ?? "";

    if (!type || !isGenerateType(type) || !trimmedInput) {
      return NextResponse.json({ success: false, message: "Missing required fields" }, { status: 400 });
    }

    // 3. Permissions & Usage
    if (!userCanAccessTool(session.role, type)) {
      return NextResponse.json({ success: false, message: "Access denied for this tool" }, { status: 403 });
    }

    const usage = await consumeUsage(session.email);
    if (!usage.allowed) {
      return NextResponse.json({ 
        success: false, 
        message: "Daily limit reached. Try again tomorrow.", 
        usage 
      }, { status: 429 });
    }

    // 4. Content Generation
    const finalPrompt = generatePrompt({ toolType: type, inputs: trimmedInput });
    const aiText = await callGeminiWithRetry(apiKey, finalPrompt, requestId);

    // 5. Background Save to Firebase
    try {
      const db = getDb();
      await db.collection("documents").add({
        userId: session.email,
        type,
        title: trimmedTitle || "Untitled Lesson Plan",
        input: trimmedInput,
        output: aiText,
        timestamp: Timestamp.now(),
      });
    } catch (dbErr) {
      console.error(`[api/generate] [${requestId}] DB Persist Failed:`, dbErr);
    }

    return NextResponse.json({ success: true, data: aiText, usage });

  } catch (error: unknown) {
    console.error(`[api/generate] [${requestId}] Final Fatal Error:`, getErrorMessage(error));
    
    // Safety Fallback: Return 503 instead of crashing
    return NextResponse.json({ 
      success: false, 
      message: "AI service is currently busy. Please try a shorter request." 
    }, { status: 503 });
  }
}

/** * Separate Health Route check (Optional but recommended)
 */
export async function GET() {
  return NextResponse.json({ status: "ok", engine: GEMINI_MODEL, timeout: "60s" });
}
