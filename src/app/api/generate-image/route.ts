import OpenAI from "openai";
import { randomUUID } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { getDb, getStorageBucket } from "@/lib/firebase-admin";
import { consumeUsage } from "@/lib/usage";

interface GenerateImageBody {
  prompt?: string;
  userId?: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as GenerateImageBody;
    const prompt = body.prompt?.trim();
    const userId = body.userId?.trim();

    if (!prompt) {
      return NextResponse.json(
        { success: false, error: "Prompt is required." },
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

    const client = new OpenAI({ apiKey });
    const imageResponse = await client.images.generate({
      model: process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-1",
      prompt,
      size: "1024x1024",
    });

    const b64 = imageResponse.data?.[0]?.b64_json;
    if (!b64) {
      return NextResponse.json(
        { success: false, error: "Image generation failed." },
        { status: 502 },
      );
    }

    const fileId = randomUUID();
    const filePath = `generated/${userId}/${fileId}.png`;
    const bucket = getStorageBucket();
    const file = bucket.file(filePath);
    const buffer = Buffer.from(b64, "base64");

    await file.save(buffer, {
      contentType: "image/png",
      metadata: {
        cacheControl: "public, max-age=31536000",
      },
    });

    const [url] = await file.getSignedUrl({
      action: "read",
      expires: "2100-01-01",
    });

    const db = getDb();
    await db.collection("documents").add({
      userId,
      type: "image",
      input: prompt,
      output: url,
      timestamp: Timestamp.now(),
    });

    return NextResponse.json({
      success: true,
      imageUrl: url,
      path: filePath,
      usage,
    });
  } catch (error) {
    console.error("/api/generate-image error", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate image." },
      { status: 500 },
    );
  }
}

