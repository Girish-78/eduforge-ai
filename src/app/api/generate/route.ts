import { Timestamp } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
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

export async function POST(request: Request) {
  try {
    const session = await getServerSessionUser();
    const body = (await request.json()) as GenerateBody;
    const type = body.type;
    const input = body.input?.trim();
    const title = body.title?.trim();

    if (!type || !isGenerateType(type)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid type. Please use a supported tool type.",
        },
        { status: 400 },
      );
    }

    if (!input) {
      return NextResponse.json(
        { success: false, error: "Input text is required." },
        { status: 400 },
      );
    }

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Please login before generating content." },
        { status: 401 },
      );
    }

    if (!userCanAccessTool(session.role, type)) {
      return NextResponse.json(
        {
          success: false,
          error: "This tool is not available for your role.",
        },
        { status: 403 },
      );
    }

    const usage = await consumeUsage(session.email);
    if (!usage.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Daily limit reached (${usage.limit} generations). Upgrade to a paid plan for higher limits.`,
          usage,
        },
        { status: 429 },
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "GEMINI_API_KEY is not configured." },
        { status: 500 },
      );
    }

    const finalPrompt = generatePrompt({ toolType: type, inputs: input });
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent(finalPrompt);
    const response = await result.response;
    console.log("Gemini raw response:", response);
    const rawText = response.text();
    const text = rawText;

    if (!text) {
      return NextResponse.json(
        { success: false, error: "No text generated. Please try again." },
        { status: 502 },
      );
    }

    const db = getDb();
    await db.collection("documents").add({
      userId: session.email,
      type,
      title: title ?? "",
      input,
      output: text,
      timestamp: Timestamp.now(),
    });

    return NextResponse.json({ output: text, usage });
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);

    console.error("GENERATE API ERROR:", error);

    return NextResponse.json(
      {
        error: "Generation failed",
        details,
      },
      { status: 500 },
    );
  }
}
