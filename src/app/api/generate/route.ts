import OpenAI from "openai";
import { Timestamp } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/firebase-admin";
import {
  buildPrompt,
  isGenerateType,
  type GenerateType,
} from "@/lib/prompt-templates";
import { consumeUsage } from "@/lib/usage";

interface GenerateBody {
  type?: GenerateType;
  input?: string;
  userId?: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as GenerateBody;
    const type = body.type;
    const input = body.input?.trim();
    const userId = body.userId?.trim();

    if (!type || !isGenerateType(type)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid type. Allowed values: lesson_plan, worksheet, email, essay.",
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

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "userId is required." },
        { status: 400 },
      );
    }

    const usage = await consumeUsage(userId);
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

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "OPENAI_API_KEY is not configured." },
        { status: 500 },
      );
    }

    const finalPrompt = buildPrompt(type, input);
    const client = new OpenAI({ apiKey });
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      input: [
        {
          role: "system",
          content:
            "You are an educational assistant. Provide clear, useful, and structured content suitable for schools.",
        },
        {
          role: "user",
          content: finalPrompt,
        },
      ],
    });

    const text = response.output_text?.trim();

    if (!text) {
      return NextResponse.json(
        { success: false, error: "No text generated. Please try again." },
        { status: 502 },
      );
    }

    const db = getDb();
    const docRef = await db.collection("documents").add({
      userId,
      type,
      input,
      output: text,
      timestamp: Timestamp.now(),
    });

    return NextResponse.json({
      success: true,
      id: docRef.id,
      type,
      result: text,
      usage,
    });
  } catch (error) {
    console.error("/api/generate error", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to generate content.",
      },
      { status: 500 },
    );
  }
}
